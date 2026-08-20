package com.remcoland.journeys;

import android.content.Context;
import android.net.ConnectivityManager;
import android.net.Network;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebView;
import com.getcapacitor.Bridge;
import com.getcapacitor.BridgeWebViewClient;

/**
 * Extends Capacitor's built-in server.errorPath fallback (offline.html, configured in
 * capacitor.config.ts) with two refinements:
 *  - A reachable server that responds with a real HTTP error (e.g. 401/404) is not a
 *    connectivity failure, so those must not trigger the offline page the way
 *    onReceivedError (DNS/timeout/connection-refused) legitimately should.
 *  - Once the offline page is showing, automatically reload the production URL as soon
 *    as the OS reports connectivity restored, instead of waiting for a manual tap.
 */
public class ConnectionAwareWebViewClient extends BridgeWebViewClient {

  private final Bridge bridge;
  private volatile boolean showingOfflinePage = false;

  public ConnectionAwareWebViewClient(Bridge bridge) {
    super(bridge);
    this.bridge = bridge;
    registerNetworkCallback();
  }

  @Override
  public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
    if (request.isForMainFrame()) {
      showingOfflinePage = true;
    }
    super.onReceivedError(view, request, error);
  }

  @Override
  public void onReceivedHttpError(WebView view, WebResourceRequest request, WebResourceResponse errorResponse) {
    if (request.isForMainFrame()) {
      if (errorResponse.getStatusCode() < 500) {
        return;
      }
      showingOfflinePage = true;
    }
    super.onReceivedHttpError(view, request, errorResponse);
  }

  @Override
  public void onPageFinished(WebView view, String url) {
    String serverUrl = bridge.getServerUrl();
    if (url != null && serverUrl != null && url.startsWith(serverUrl)) {
      showingOfflinePage = false;
    }
    super.onPageFinished(view, url);
  }

  private void registerNetworkCallback() {
    ConnectivityManager connectivityManager = (ConnectivityManager) bridge
      .getContext()
      .getSystemService(Context.CONNECTIVITY_SERVICE);
    if (connectivityManager == null) {
      return;
    }
    connectivityManager.registerDefaultNetworkCallback(
      new ConnectivityManager.NetworkCallback() {
        @Override
        public void onAvailable(Network network) {
          if (!showingOfflinePage) {
            return;
          }
          String serverUrl = bridge.getServerUrl();
          if (serverUrl == null) {
            return;
          }
          WebView webView = bridge.getWebView();
          webView.post(() -> webView.loadUrl(serverUrl));
        }
      }
    );
  }
}
