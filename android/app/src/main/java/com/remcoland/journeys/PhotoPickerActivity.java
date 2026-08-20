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
import android.view.GestureDetector;
import android.view.HapticFeedbackConstants;
import android.view.LayoutInflater;
import android.view.MotionEvent;
import android.view.View;
import android.view.ViewGroup;
import android.widget.BaseAdapter;
import android.widget.Button;
import android.widget.FrameLayout;
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

  // Drag-to-select state: a long-press anchors a range at the cell it started
  // on, and every subsequent move recomputes the contiguous range between that
  // anchor and the finger's current cell (shift-click style), growing or
  // shrinking live as the finger moves — rather than a "paint" that only adds.
  private boolean dragSelecting = false;
  private int dragAnchorPosition = -1;
  private int lastDragPosition = -1;
  private final LinkedHashSet<Integer> dragRangeSelected = new LinkedHashSet<>();

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

    GestureDetector longPressDetector = new GestureDetector(this, new GestureDetector.SimpleOnGestureListener() {
      @Override
      public void onLongPress(MotionEvent e) {
        int position = gridView.pointToPosition((int) e.getX(), (int) e.getY());
        if (position == GridView.INVALID_POSITION) return;
        dragSelecting = true;
        dragAnchorPosition = position;
        lastDragPosition = position;
        dragRangeSelected.clear();
        gridView.performHapticFeedback(HapticFeedbackConstants.LONG_PRESS);
        updateDragRange(position);
      }
    });

    gridView.setOnTouchListener((v, event) -> {
      longPressDetector.onTouchEvent(event);

      if (!dragSelecting) {
        return false;
      }

      switch (event.getActionMasked()) {
        case MotionEvent.ACTION_MOVE:
          int position = gridView.pointToPosition((int) event.getX(), (int) event.getY());
          if (position != GridView.INVALID_POSITION && position != lastDragPosition) {
            lastDragPosition = position;
            updateDragRange(position);
          }
          return true;
        case MotionEvent.ACTION_UP:
        case MotionEvent.ACTION_CANCEL:
          dragSelecting = false;
          dragAnchorPosition = -1;
          lastDragPosition = -1;
          dragRangeSelected.clear();
          return true;
        default:
          return true;
      }
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

  // Recomputes the live drag range [anchor..current] and reconciles it against
  // selectedPositions: cells that fell out of the range since the last move are
  // deselected, cells newly covered are selected. Only touches positions this
  // drag gesture itself added (dragRangeSelected), so it never clobbers
  // selections made by earlier taps or an earlier, separate drag gesture.
  private void updateDragRange(int currentPosition) {
    int lo = Math.min(dragAnchorPosition, currentPosition);
    int hi = Math.max(dragAnchorPosition, currentPosition);
    LinkedHashSet<Integer> newRange = new LinkedHashSet<>();
    for (int p = lo; p <= hi; p++) newRange.add(p);

    for (Integer p : dragRangeSelected) {
      if (!newRange.contains(p)) selectedPositions.remove(p);
    }
    selectedPositions.addAll(newRange);

    dragRangeSelected.clear();
    dragRangeSelected.addAll(newRange);

    adapter.notifyDataSetChanged();
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
      boolean selected = selectedPositions.contains(position);
      badge.setVisibility(selected ? View.VISIBLE : View.GONE);

      // Inset the thumbnail within its cell when selected, so the reserved space
      // reads as a shrink-with-whitespace cue instead of just the checkmark badge.
      int insetPx = selected ? dpToPx(8) : 0;
      FrameLayout.LayoutParams thumbLp = (FrameLayout.LayoutParams) thumbnail.getLayoutParams();
      if (thumbLp.leftMargin != insetPx) {
        thumbLp.setMargins(insetPx, insetPx, insetPx, insetPx);
        thumbnail.setLayoutParams(thumbLp);
      }

      Uri uri = allUris.get(position);
      if (!uri.equals(thumbnail.getTag())) {
        // Only reset/re-decode when this recycled view is being repurposed for a
        // different photo. Without this check, every notifyDataSetChanged() (e.g.
        // toggling one item's selection) blanks and re-decodes every visible
        // thumbnail, causing a full-grid flash.
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
      }

      return view;
    }

    private int dpToPx(int dp) {
      float density = getResources().getDisplayMetrics().density;
      return Math.round(dp * density);
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
