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
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

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
        MultipartUploader.Result uploadResult = MultipartUploader.upload(getContext(), uploadUrl, uris, filenames);
        if (uploadResult.statusCode >= 200 && uploadResult.statusCode < 300) {
          call.resolve(new JSObject(uploadResult.body));
        } else {
          call.reject("Upload failed with status " + uploadResult.statusCode + ": " + uploadResult.body);
        }
      } catch (Exception e) {
        call.reject("Upload failed: " + e.getMessage(), e);
      }
    });
  }
}
