package com.remcoland.journeys;

import android.content.ContentResolver;
import android.content.Context;
import android.net.Uri;
import android.provider.MediaStore;
import android.webkit.CookieManager;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.List;

/**
 * Streams originally-selected photos to the existing /api/journeys/:id/photos
 * multipart endpoint. Reads each file via MediaStore.setRequireOriginal() so
 * GPS EXIF survives — the whole reason this plugin exists instead of using
 * the web upload flow's <input type="file">, which on Android routes through
 * the system Photo Picker and strips location data unconditionally.
 *
 * Auth reuses the WebView's own session cookie (grabbed via the native
 * CookieManager, which can read it even though it's httpOnly) so the server
 * sees the same logged-in user as the web app.
 */
class MultipartUploader {

  static class Result {
    final int statusCode;
    final String body;

    Result(int statusCode, String body) {
      this.statusCode = statusCode;
      this.body = body;
    }
  }

  static Result upload(Context context, String uploadUrl, List<Uri> uris, List<String> filenames) throws IOException {
    String boundary = "JourneysBoundary" + System.currentTimeMillis();
    URL url = new URL(uploadUrl);
    HttpURLConnection conn = (HttpURLConnection) url.openConnection();
    conn.setDoOutput(true);
    conn.setChunkedStreamingMode(0);
    conn.setRequestMethod("POST");
    conn.setRequestProperty("Content-Type", "multipart/form-data; boundary=" + boundary);

    String cookie = CookieManager.getInstance().getCookie(uploadUrl);
    if (cookie != null) {
      conn.setRequestProperty("Cookie", cookie);
    }

    ContentResolver resolver = context.getContentResolver();

    try (OutputStream out = conn.getOutputStream()) {
      for (int i = 0; i < uris.size(); i++) {
        Uri originalUri = MediaStore.setRequireOriginal(uris.get(i));
        String filename = filenames.get(i);
        String mimeType = resolver.getType(originalUri);
        if (mimeType == null) mimeType = "application/octet-stream";

        writeString(out, "--" + boundary + "\r\n");
        writeString(out, "Content-Disposition: form-data; name=\"file\"; filename=\"" + sanitize(filename) + "\"\r\n");
        writeString(out, "Content-Type: " + mimeType + "\r\n\r\n");

        try (InputStream in = resolver.openInputStream(originalUri)) {
          if (in == null) throw new IOException("Could not open " + filename);
          byte[] buffer = new byte[64 * 1024];
          int read;
          while ((read = in.read(buffer)) != -1) {
            out.write(buffer, 0, read);
          }
        }
        writeString(out, "\r\n");
      }
      writeString(out, "--" + boundary + "--\r\n");
    }

    int status = conn.getResponseCode();
    InputStream responseStream = status >= 200 && status < 300 ? conn.getInputStream() : conn.getErrorStream();
    String body = readAll(responseStream);
    conn.disconnect();
    return new Result(status, body);
  }

  private static String sanitize(String filename) {
    return filename.replace("\"", "'");
  }

  private static void writeString(OutputStream out, String s) throws IOException {
    out.write(s.getBytes(StandardCharsets.UTF_8));
  }

  private static String readAll(InputStream in) throws IOException {
    if (in == null) return "";
    ByteArrayOutputStream buffer = new ByteArrayOutputStream();
    byte[] chunk = new byte[8192];
    int read;
    while ((read = in.read(chunk)) != -1) {
      buffer.write(chunk, 0, read);
    }
    return buffer.toString("UTF-8");
  }
}
