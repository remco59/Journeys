package com.remcoland.journeys;

import android.Manifest;
import android.app.Activity;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import androidx.activity.result.ActivityResult;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Bridges the web app's photo upload flow to a native picker that reads
 * unredacted EXIF (see PhotoPickerActivity / MultipartUploader for why).
 *
 * JS side (PhotoUploader.vue) calls pickAndUpload({ journeyId, baseUrl })
 * and gets back the same { importId, files: [...] } shape the existing
 * POST /api/journeys/:id/photos endpoint already returns for the web flow.
 */
@CapacitorPlugin(name = "PhotoAccess")
public class PhotoAccessPlugin extends Plugin {

  private static final int PERMISSION_REQUEST_CODE = 9821;
  // Uploading the whole selection as one request over one connection was the source
  // of "broken pipe" failures on larger batches: originals are large/uncompressed,
  // so one connection could stay open for minutes, long enough to hit server/proxy
  // idle timeouts or get killed by Doze if the app was backgrounded mid-upload.
  // Splitting into small chunks keeps each connection short-lived and lets earlier
  // chunks survive even if a later one fails.
  private static final int CHUNK_SIZE = 5;
  private static final int MAX_RETRIES_PER_CHUNK = 1;
  private final ExecutorService uploadExecutor = Executors.newSingleThreadExecutor();

  private String[] requiredPermissions() {
    if (Build.VERSION.SDK_INT >= 33) {
      return new String[] { Manifest.permission.READ_MEDIA_IMAGES, Manifest.permission.ACCESS_MEDIA_LOCATION };
    } else if (Build.VERSION.SDK_INT >= 29) {
      return new String[] { Manifest.permission.READ_EXTERNAL_STORAGE, Manifest.permission.ACCESS_MEDIA_LOCATION };
    } else {
      return new String[] { Manifest.permission.READ_EXTERNAL_STORAGE };
    }
  }

  // Named to avoid colliding with Plugin.hasRequiredPermissions(), which is
  // public and driven by the (unused here) @CapacitorPlugin permissions
  // annotation — this plugin checks permissions manually instead since the
  // required set is SDK-version-dependent (see requiredPermissions()).
  private boolean hasPhotoPermissions() {
    for (String permission : requiredPermissions()) {
      if (ContextCompat.checkSelfPermission(getContext(), permission) != PackageManager.PERMISSION_GRANTED) {
        return false;
      }
    }
    return true;
  }

  @PluginMethod
  public void pickAndUpload(PluginCall call) {
    String journeyId = call.getString("journeyId");
    String baseUrl = call.getString("baseUrl");
    if (journeyId == null || baseUrl == null) {
      call.reject("journeyId and baseUrl are required");
      return;
    }

    if (!hasPhotoPermissions()) {
      saveCall(call);
      ActivityCompat.requestPermissions(getActivity(), requiredPermissions(), PERMISSION_REQUEST_CODE);
      return;
    }

    launchPicker(call);
  }

  @Override
  protected void handleRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
    super.handleRequestPermissionsResult(requestCode, permissions, grantResults);
    if (requestCode != PERMISSION_REQUEST_CODE) return;

    PluginCall call = getSavedCall();
    if (call == null) return;

    if (hasPhotoPermissions()) {
      launchPicker(call);
    } else {
      call.reject("Photo access permission was denied");
      freeSavedCall();
    }
  }

  private void launchPicker(PluginCall call) {
    Intent intent = new Intent(getActivity(), PhotoPickerActivity.class);
    startActivityForResult(call, intent, "photoPickerResult");
  }

  @ActivityCallback
  private void photoPickerResult(PluginCall call, ActivityResult result) {
    if (call == null) return;

    if (result.getResultCode() != Activity.RESULT_OK || result.getData() == null) {
      call.reject("No photos selected");
      return;
    }

    Intent data = result.getData();
    List<String> uriStrings = data.getStringArrayListExtra(PhotoPickerActivity.EXTRA_RESULT_URIS);
    List<String> names = data.getStringArrayListExtra(PhotoPickerActivity.EXTRA_RESULT_NAMES);
    if (uriStrings == null || uriStrings.isEmpty()) {
      call.reject("No photos selected");
      return;
    }

    String journeyId = call.getString("journeyId");
    String baseUrl = call.getString("baseUrl");
    String uploadUrl = baseUrl.replaceAll("/$", "") + "/api/journeys/" + journeyId + "/photos";

    ArrayList<Uri> uris = new ArrayList<>();
    for (String s : uriStrings) uris.add(Uri.parse(s));
    ArrayList<String> filenames = new ArrayList<>(names);

    uploadExecutor.execute(() -> {
      try {
        String importId = null;
        JSONArray allFiles = new JSONArray();

        for (int start = 0; start < uris.size(); start += CHUNK_SIZE) {
          int end = Math.min(start + CHUNK_SIZE, uris.size());
          List<Uri> chunkUris = uris.subList(start, end);
          List<String> chunkNames = filenames.subList(start, end);

          MultipartUploader.Result chunkResult = uploadChunkWithRetry(uploadUrl, chunkUris, chunkNames);
          if (chunkResult != null && chunkResult.statusCode >= 200 && chunkResult.statusCode < 300) {
            JSONObject chunkJson = new JSONObject(chunkResult.body);
            if (importId == null) importId = chunkJson.optString("importId", null);
            JSONArray chunkFiles = chunkJson.optJSONArray("files");
            if (chunkFiles != null) {
              for (int i = 0; i < chunkFiles.length(); i++) {
                allFiles.put(chunkFiles.get(i));
              }
            }
          } else {
            String reason = chunkResult != null
              ? ("Upload failed with status " + chunkResult.statusCode)
              : "Network error";
            for (String name : chunkNames) {
              JSONObject failed = new JSONObject();
              failed.put("filename", name);
              failed.put("status", "rejected");
              failed.put("reason", reason);
              allFiles.put(failed);
            }
          }
        }

        JSONObject response = new JSONObject();
        response.put("importId", importId);
        response.put("files", allFiles);
        call.resolve(new JSObject(response.toString()));
      } catch (Exception e) {
        call.reject("Upload failed: " + e.getMessage(), e);
      }
    });
  }

  private MultipartUploader.Result uploadChunkWithRetry(String uploadUrl, List<Uri> chunkUris, List<String> chunkNames) {
    for (int attempt = 0; attempt <= MAX_RETRIES_PER_CHUNK; attempt++) {
      try {
        return MultipartUploader.upload(getContext(), uploadUrl, chunkUris, chunkNames);
      } catch (IOException e) {
        if (attempt >= MAX_RETRIES_PER_CHUNK) {
          return null;
        }
        try {
          Thread.sleep(1000);
        } catch (InterruptedException interrupted) {
          Thread.currentThread().interrupt();
          return null;
        }
      }
    }
    return null;
  }
}
