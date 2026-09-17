package com.primeiraligapoker.app;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.view.Window;
import android.webkit.CookieManager;
import android.webkit.ServiceWorkerController;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

public class MainActivity extends Activity {
    private static final String HOME_URL = "https://nhoquin.github.io/plp-poker/";
    private static final String APP_HOST = "nhoquin.github.io";

    private WebView webView;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        configureWindow();
        configureWebView();

        if (savedInstanceState == null) {
            webView.loadUrl(HOME_URL);
        } else {
            webView.restoreState(savedInstanceState);
        }
    }

    private void configureWindow() {
        Window window = getWindow();
        window.setStatusBarColor(Color.rgb(5, 5, 4));
        window.setNavigationBarColor(Color.rgb(5, 5, 4));
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            window.getDecorView().setSystemUiVisibility(0);
        }
    }

    private void configureWebView() {
        webView = new WebView(this);
        webView.setBackgroundColor(Color.rgb(5, 5, 4));
        setContentView(webView);

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setCacheMode(WebSettings.LOAD_DEFAULT);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(true);
        settings.setBuiltInZoomControls(false);
        settings.setDisplayZoomControls(false);
        settings.setSupportZoom(false);
        settings.setTextZoom(100);
        settings.setUserAgentString(settings.getUserAgentString() + " PLPAndroid/1.0");

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            WebView.setSafeBrowsingWhitelist(java.util.Collections.singletonList(APP_HOST), null);
        }

        CookieManager cookies = CookieManager.getInstance();
        cookies.setAcceptCookie(true);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            cookies.setAcceptThirdPartyCookies(webView, true);
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
            try {
                ServiceWorkerController.getInstance().getServiceWorkerWebSettings().setAllowContentAccess(true);
            } catch (Exception ignored) {
            }
        }

        webView.setWebChromeClient(new WebChromeClient());
        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                return handleNavigation(request.getUrl());
            }

            @SuppressWarnings("deprecation")
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, String url) {
                return handleNavigation(Uri.parse(url));
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                super.onPageFinished(view, url);
                view.evaluateJavascript(
                    "document.documentElement.classList.add('plp-android-apk');" +
                    "document.body && document.body.classList.add('plp-android-apk');",
                    null
                );
            }

            @Override
            public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                super.onReceivedError(view, request, error);
                if (request.isForMainFrame()) {
                    showOfflinePage();
                }
            }
        });

        webView.setDownloadListener((url, userAgent, contentDisposition, mimetype, contentLength) -> openExternal(Uri.parse(url)));
        webView.setOnLongClickListener(v -> true);
        webView.setLongClickable(false);
    }

    private boolean handleNavigation(Uri uri) {
        String scheme = uri.getScheme();
        String host = uri.getHost();

        if (("https".equalsIgnoreCase(scheme) || "http".equalsIgnoreCase(scheme)) && APP_HOST.equalsIgnoreCase(host)) {
            return false;
        }

        if ("about".equalsIgnoreCase(scheme) || "data".equalsIgnoreCase(scheme)) {
            return false;
        }

        openExternal(uri);
        return true;
    }

    private void openExternal(Uri uri) {
        try {
            startActivity(new Intent(Intent.ACTION_VIEW, uri));
        } catch (ActivityNotFoundException ignored) {
        }
    }

    private void showOfflinePage() {
        String html = "<!doctype html><html><head><meta name='viewport' content='width=device-width,initial-scale=1'>" +
            "<style>body{margin:0;background:#050504;color:#f7f4ec;font-family:system-ui;display:grid;place-items:center;min-height:100vh;text-align:center;padding:28px;box-sizing:border-box}" +
            ".card{max-width:420px;padding:28px 22px;border:1px solid rgba(244,201,20,.35);border-radius:24px;background:#100e0a;box-shadow:0 20px 60px #0008}" +
            "h1{margin:0 0 8px;color:#ffe36a;font-size:25px}p{color:#c5bcaa;line-height:1.5;font-size:14px}" +
            "button{margin-top:16px;border:0;border-radius:14px;padding:13px 20px;background:#f4c914;color:#151006;font-weight:800}</style></head>" +
            "<body><div class='card'><h1>1ª Liga de Poker</h1><p>Sem conexão com o sistema agora. Confira sua internet e tente novamente.</p>" +
            "<button onclick=\"location.href='" + HOME_URL + "'\">Tentar novamente</button></div></body></html>";
        webView.loadDataWithBaseURL(HOME_URL, html, "text/html", "UTF-8", null);
    }

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        webView.saveState(outState);
        super.onSaveInstanceState(outState);
    }

    @Override
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) {
            webView.goBack();
        } else {
            super.onBackPressed();
        }
    }

    @Override
    protected void onDestroy() {
        if (webView != null) {
            webView.stopLoading();
            webView.setWebChromeClient(null);
            webView.setWebViewClient(null);
            webView.destroy();
        }
        super.onDestroy();
    }
}
