package com.remcoland.journeys;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Intent;
import android.net.Uri;
import android.os.Binder;
import android.os.Build;
import android.os.IBinder;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import java.io.IOException;
import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Runs the chunked photo upload (see MultipartUploader) as a foreground
 * service so it keeps running when the app is backgrounded or the device
 * enters Doze — previously this ran on a plain ExecutorService owned by
 * PhotoAccessPlugin, which the OS was free to freeze/kill as soon as
 * MainActivity left the foreground. The ongoing notification is the price
 * Android charges for that background-execution grant on a "dataSync"
 * foreground service, not a feature in its own right.
 *
 * Only one upload runs at a time (single-thread executor), matching the
 * previous plugin-owned executor's behavior.
 */
public class PhotoUploadService extends Service {

  private static final String CHANNEL_ID = "photo_uploads";
  private static final int NOTIFICATION_ID = 4821;
  private static final int CHUNK_SIZE = 5;
  private static final int MAX_RETRIES_PER_CHUNK = 1;

  interface UploadListener {
    void onProgress(int completed, int total);
    void onComplete(String importId, JSONArray files);
    void onError(String message);
  }

  private final IBinder binder = new LocalBinder();
  private final ExecutorService uploadExecutor = Executors.newSingleThreadExecutor();

  class LocalBinder extends Binder {
    PhotoUploadService getService() {
      return PhotoUploadService.this;
    }
  }

  @Override
  public void onCreate() {
    super.onCreate();
    createNotificationChannel();
  }

  @Override
  public IBinder onBind(Intent intent) {
    return binder;
  }

  private void createNotificationChannel() {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      NotificationChannel channel = new NotificationChannel(
        CHANNEL_ID,
        "Photo uploads",
        NotificationManager.IMPORTANCE_LOW
      );
      channel.setDescription("Progress while photos upload in the background");
      getSystemService(NotificationManager.class).createNotificationChannel(channel);
    }
  }

  private PendingIntent buildContentIntent() {
    Intent intent = new Intent(this, MainActivity.class);
    intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
    return PendingIntent.getActivity(this, 0, intent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
  }

  private Notification buildNotification(int completed, int total) {
    NotificationCompat.Builder builder = new NotificationCompat.Builder(this, CHANNEL_ID)
      .setSmallIcon(R.drawable.ic_stat_upload)
      .setContentTitle("Uploading photos")
      .setContentIntent(buildContentIntent())
      .setOngoing(true)
      .setOnlyAlertOnce(true)
      .setPriority(NotificationCompat.PRIORITY_LOW);

    if (total > 0) {
      builder.setContentText(completed + " of " + total + " photos uploaded");
      builder.setProgress(total, completed, false);
    } else {
      builder.setContentText("Starting…");
      builder.setProgress(0, 0, true);
    }
    return builder.build();
  }

  // Detaches the notification from the foreground service (so it survives
  // stopSelf() and becomes user-dismissible) and swaps it for a final
  // success/failure summary in place of the progress bar.
  private void showFinalNotification(String title, String text) {
    stopForeground(Service.STOP_FOREGROUND_DETACH);
    Notification notification = new NotificationCompat.Builder(this, CHANNEL_ID)
      .setSmallIcon(R.drawable.ic_stat_upload)
      .setContentTitle(title)
      .setContentText(text)
      .setContentIntent(buildContentIntent())
      .setAutoCancel(true)
      .setPriority(NotificationCompat.PRIORITY_DEFAULT)
      .build();
    NotificationManagerCompat.from(this).notify(NOTIFICATION_ID, notification);
  }

  void startUpload(String uploadUrl, List<Uri> uris, List<String> filenames, UploadListener listener) {
    int totalCount = uris.size();
    startForeground(NOTIFICATION_ID, buildNotification(0, totalCount));

    uploadExecutor.execute(() -> {
      try {
        String importId = null;
        JSONArray allFiles = new JSONArray();

        for (int start = 0; start < uris.size(); start += CHUNK_SIZE) {
          int end = Math.min(start + CHUNK_SIZE, uris.size());
          int chunkStart = start;
          List<Uri> chunkUris = uris.subList(start, end);
          List<String> chunkNames = filenames.subList(start, end);

          MultipartUploader.ProgressListener progressListener = sentCount -> {
            int completed = chunkStart + sentCount;
            listener.onProgress(completed, totalCount);
            NotificationManagerCompat.from(this).notify(NOTIFICATION_ID, buildNotification(completed, totalCount));
          };

          MultipartUploader.Result chunkResult = uploadChunkWithRetry(uploadUrl, chunkUris, chunkNames, progressListener);
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

        int failedCount = 0;
        for (int i = 0; i < allFiles.length(); i++) {
          if ("rejected".equals(allFiles.optJSONObject(i).optString("status"))) failedCount++;
        }
        int successCount = totalCount - failedCount;
        showFinalNotification(
          failedCount == 0 ? "Upload complete" : "Upload finished with errors",
          failedCount == 0
            ? successCount + (successCount == 1 ? " photo" : " photos") + " uploaded"
            : successCount + " uploaded, " + failedCount + " failed"
        );
        listener.onComplete(importId, allFiles);
      } catch (Exception e) {
        showFinalNotification("Upload failed", e.getMessage() != null ? e.getMessage() : "An unexpected error occurred");
        listener.onError(e.getMessage());
      } finally {
        stopSelf();
      }
    });
  }

  private MultipartUploader.Result uploadChunkWithRetry(
    String uploadUrl,
    List<Uri> chunkUris,
    List<String> chunkNames,
    MultipartUploader.ProgressListener progressListener
  ) {
    for (int attempt = 0; attempt <= MAX_RETRIES_PER_CHUNK; attempt++) {
      try {
        return MultipartUploader.upload(getApplicationContext(), uploadUrl, chunkUris, chunkNames, progressListener);
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

  @Override
  public void onDestroy() {
    uploadExecutor.shutdown();
    super.onDestroy();
  }
}
