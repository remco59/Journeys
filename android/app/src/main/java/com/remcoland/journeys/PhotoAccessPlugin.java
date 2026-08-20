package com.remcoland.journeys;

import android.Manifest;
import android.app.Activity;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.ServiceConnection;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.IBinder;
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
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

/**
 * Bridges the web app's photo upload flow to a native picker that reads
 * unredacted EXIF (see PhotoPickerActivity / MultipartUploader for why).
 * The actual chunked upload runs in PhotoUploadService (a foreground
 * service) so it survives the app being backgrounded; this plugin just
 * binds to it and forwards progress/results to JS.
 *
 * JS side (PhotoUploader.vue) calls pickAndUpload({ journeyId, baseUrl })
 * and gets back the same { importId, files: [...] } shape the existing
 * POST /api/journeys/:id/photos endpoint already returns for the web flow.
 */
@CapacitorPlugin(name = "PhotoAccess")
public class PhotoAccessPlugin extends Plugin {

  private static final int PERMISSION_REQUEST_CODE = 9821;
  private static final int NOTIFICATION_PERMISSION_REQUEST_CODE = 9822;

  private PhotoUploadService uploadService;
  private boolean isServiceBound = false;

  private PluginCall pendingUploadCall;
  private String pendingUploadUrl;
  private ArrayList<Uri> pendingUris;
  private ArrayList<String> pendingFilenames;

  private final ServiceConnection uploadServiceConnection = new ServiceConnection() {
    @Override
    public void onServiceConnected(ComponentName name, IBinder service) {
      uploadService = ((PhotoUploadService.LocalBinder) service).getService();
      runPendingUpload();
    }

    @Override
    public void onServiceDisconnected(ComponentName name) {
      uploadService = null;
    }
  };

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

  // Best-effort: without this the upload's foreground service still runs
  // fine, the user just won't see its progress notification. Not worth
  // blocking the photo picker over, so this doesn't gate pickAndUpload().
  private void ensureNotificationPermission() {
    if (
      Build.VERSION.SDK_INT >= 33 &&
      ContextCompat.checkSelfPermission(getContext(), Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
    ) {
      ActivityCompat.requestPermissions(getActivity(), new String[] { Manifest.permission.POST_NOTIFICATIONS }, NOTIFICATION_PERMISSION_REQUEST_CODE);
    }
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

    pendingUploadCall = call;
    pendingUploadUrl = uploadUrl;
    pendingUris = uris;
    pendingFilenames = filenames;

    ensureNotificationPermission();

    Intent serviceIntent = new Intent(getContext(), PhotoUploadService.class);
    ContextCompat.startForegroundService(getContext(), serviceIntent);
    isServiceBound = getContext().bindService(serviceIntent, uploadServiceConnection, Context.BIND_AUTO_CREATE);
  }

  private void runPendingUpload() {
    if (uploadService == null || pendingUploadCall == null) return;

    PluginCall call = pendingUploadCall;
    String uploadUrl = pendingUploadUrl;
    ArrayList<Uri> uris = pendingUris;
    ArrayList<String> filenames = pendingFilenames;
    pendingUploadCall = null;

    uploadService.startUpload(
      uploadUrl,
      uris,
      filenames,
      new PhotoUploadService.UploadListener() {
        @Override
        public void onProgress(int completed, int total) {
          JSObject progress = new JSObject();
          progress.put("completed", completed);
          progress.put("total", total);
          notifyListeners("photoUploadProgress", progress);
        }

        @Override
        public void onComplete(String importId, JSONArray files) {
          try {
            JSONObject response = new JSONObject();
            response.put("importId", importId);
            response.put("files", files);
            call.resolve(new JSObject(response.toString()));
          } catch (JSONException e) {
            call.reject("Upload failed: " + e.getMessage(), e);
          }
          unbindUploadService();
        }

        @Override
        public void onError(String message) {
          call.reject("Upload failed: " + message);
          unbindUploadService();
        }
      }
    );
  }

  private void unbindUploadService() {
    if (isServiceBound) {
      getContext().unbindService(uploadServiceConnection);
      isServiceBound = false;
    }
    uploadService = null;
  }
}
