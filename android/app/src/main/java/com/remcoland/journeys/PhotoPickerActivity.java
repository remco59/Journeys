package com.remcoland.journeys;

import android.app.Activity;
import android.content.Intent;
import android.database.Cursor;
import android.graphics.Bitmap;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.provider.MediaStore;
import android.util.Size;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.BaseAdapter;
import android.widget.Button;
import android.widget.GridView;
import android.widget.ImageView;
import android.widget.TextView;
import androidx.annotation.Nullable;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Custom in-app photo grid, queried directly against MediaStore.Images.Media.
 * Deliberately not the system Photo Picker (see AndroidManifest.xml comment)
 * — that picker strips GPS EXIF unconditionally. This one lets the caller
 * (PhotoAccessPlugin, which already holds READ_MEDIA_IMAGES +
 * ACCESS_MEDIA_LOCATION) read the true originals afterward.
 */
public class PhotoPickerActivity extends Activity {

  static final String EXTRA_RESULT_URIS = "uris";
  static final String EXTRA_RESULT_NAMES = "names";

  private final ArrayList<Uri> allUris = new ArrayList<>();
  private final ArrayList<String> allNames = new ArrayList<>();
  private final LinkedHashSet<Integer> selectedPositions = new LinkedHashSet<>();
  private final ExecutorService thumbExecutor = Executors.newFixedThreadPool(4);

  private GridView gridView;
  private Button uploadButton;
  private PhotoAdapter adapter;

  @Override
  protected void onCreate(@Nullable Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);
    setContentView(R.layout.activity_photo_picker);

    gridView = findViewById(R.id.photoGrid);
    uploadButton = findViewById(R.id.uploadButton);
    Button cancelButton = findViewById(R.id.cancelButton);

    loadPhotos();

    adapter = new PhotoAdapter();
    gridView.setAdapter(adapter);
    gridView.setOnItemClickListener((parent, view, position, id) -> {
      if (!selectedPositions.remove(position)) {
        selectedPositions.add(position);
      }
      adapter.notifyDataSetChanged();
      updateUploadButton();
    });

    cancelButton.setOnClickListener(v -> {
      setResult(Activity.RESULT_CANCELED);
      finish();
    });

    uploadButton.setOnClickListener(v -> {
      ArrayList<String> uriStrings = new ArrayList<>();
      ArrayList<String> names = new ArrayList<>();
      for (int position : selectedPositions) {
        uriStrings.add(allUris.get(position).toString());
        names.add(allNames.get(position));
      }
      Intent result = new Intent();
      result.putStringArrayListExtra(EXTRA_RESULT_URIS, uriStrings);
      result.putStringArrayListExtra(EXTRA_RESULT_NAMES, names);
      setResult(Activity.RESULT_OK, result);
      finish();
    });

    updateUploadButton();
  }

  private void updateUploadButton() {
    int count = selectedPositions.size();
    uploadButton.setEnabled(count > 0);
    uploadButton.setText(count > 0 ? ("Upload (" + count + ")") : "Upload");
  }

  private void loadPhotos() {
    Uri collection = MediaStore.Images.Media.EXTERNAL_CONTENT_URI;
    String[] projection = { MediaStore.Images.Media._ID, MediaStore.Images.Media.DISPLAY_NAME };
    String sortOrder = MediaStore.Images.Media.DATE_TAKEN + " DESC";

    try (Cursor cursor = getContentResolver().query(collection, projection, null, null, sortOrder)) {
      if (cursor == null) return;
      int idCol = cursor.getColumnIndexOrThrow(MediaStore.Images.Media._ID);
      int nameCol = cursor.getColumnIndexOrThrow(MediaStore.Images.Media.DISPLAY_NAME);
      while (cursor.moveToNext()) {
        long id = cursor.getLong(idCol);
        String name = cursor.getString(nameCol);
        allUris.add(Uri.withAppendedPath(collection, String.valueOf(id)));
        allNames.add(name != null ? name : ("photo_" + id + ".jpg"));
      }
    }
  }

  @Override
  protected void onDestroy() {
    super.onDestroy();
    thumbExecutor.shutdownNow();
  }

  private class PhotoAdapter extends BaseAdapter {
    @Override
    public int getCount() {
      return allUris.size();
    }

    @Override
    public Object getItem(int position) {
      return allUris.get(position);
    }

    @Override
    public long getItemId(int position) {
      return position;
    }

    @Override
    public View getView(int position, @Nullable View convertView, ViewGroup parent) {
      View view = convertView;
      if (view == null) {
        view = LayoutInflater.from(PhotoPickerActivity.this).inflate(R.layout.grid_item_photo, parent, false);
      }
      ImageView thumbnail = view.findViewById(R.id.thumbnail);
      TextView badge = view.findViewById(R.id.selectedBadge);
      badge.setVisibility(selectedPositions.contains(position) ? View.VISIBLE : View.GONE);

      Uri uri = allUris.get(position);
      thumbnail.setTag(uri);
      thumbnail.setImageBitmap(null);

      thumbExecutor.execute(() -> {
        Bitmap bitmap = loadThumbnail(uri);
        runOnUiThread(() -> {
          if (uri.equals(thumbnail.getTag()) && bitmap != null) {
            thumbnail.setImageBitmap(bitmap);
          }
        });
      });

      return view;
    }

    private Bitmap loadThumbnail(Uri uri) {
      try {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
          return getContentResolver().loadThumbnail(uri, new Size(200, 200), null);
        } else {
          long id = Long.parseLong(uri.getLastPathSegment());
          return MediaStore.Images.Thumbnails.getThumbnail(
            getContentResolver(), id, MediaStore.Images.Thumbnails.MINI_KIND, null
          );
        }
      } catch (Exception e) {
        return null;
      }
    }
  }
}
