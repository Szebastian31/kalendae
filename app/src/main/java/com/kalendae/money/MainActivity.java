package com.kalendae.money;

import android.Manifest;
import android.app.Activity;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.provider.Settings;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import androidx.webkit.WebViewAssetLoader;

import java.io.OutputStream;
import java.nio.charset.StandardCharsets;

/**
 * Kalendae's whole interface is the web app, bundled in the APK. This activity hosts it full screen and
 * gives it what a browser can't do reliably: a daily notification about what's coming up (sent even when the app is closed), saving and
 * opening backup files, the share sheet and vibration.
 * Your money data lives in the WebView's local storage, which never leaves the phone
 * (allowBackup is off, so it isn't copied to cloud backups either; use the backup file instead).
 */
public class MainActivity extends Activity {
    private static final String HOST = "appassets.androidplatform.net";
    private static final String START = "https://" + HOST + "/assets/www/index.html";
    private static final String NIGHT = "#070d26";
    private static final int REQ_NOTIFY = 1, REQ_SAVE = 2, REQ_OPEN = 3;

    private WebView web;
    private String pendingSave;
    private ValueCallback<Uri[]> pendingOpen;

    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);
        getWindow().setStatusBarColor(Color.parseColor(NIGHT));
        getWindow().setNavigationBarColor(Color.parseColor(NIGHT));
        MoneyNotifier.createChannels(this);
        MoneyNotifier.scheduleAll(this);

        web = new WebView(this);
        web.setBackgroundColor(Color.parseColor(NIGHT));
        setContentView(web);

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setAllowFileAccess(false);
        s.setTextZoom(100);

        final WebViewAssetLoader loader = new WebViewAssetLoader.Builder()
                .addPathHandler("/assets/", new WebViewAssetLoader.AssetsPathHandler(this))
                .build();
        web.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest req) {
                return loader.shouldInterceptRequest(req.getUrl());
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest req) {
                Uri u = req.getUrl();
                if (HOST.equals(u.getHost())) return false;
                try { startActivity(new Intent(Intent.ACTION_VIEW, u)); } catch (Exception ignored) {}
                return true;
            }
        });
        // <input type="file"> for restoring a backup
        web.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView v, ValueCallback<Uri[]> cb, FileChooserParams p) {
                if (pendingOpen != null) pendingOpen.onReceiveValue(null);
                pendingOpen = cb;
                Intent i = new Intent(Intent.ACTION_OPEN_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE).setType("*/*");
                try { startActivityForResult(i, REQ_OPEN); } catch (Exception e) { pendingOpen = null; return false; }
                return true;
            }
        });
        web.addJavascriptInterface(new Bridge(), "KalendaeNative");

        if (state != null) web.restoreState(state);
        else web.loadUrl(START);
    }

    @Override
    protected void onSaveInstanceState(Bundle out) {
        super.onSaveInstanceState(out);
        web.saveState(out);
    }

    @Override
    protected void onResume() {
        super.onResume();
        web.onResume();
        // a new day may have started, or a notification was tapped
        web.evaluateJavascript("window.kalendaeResume&&kalendaeResume()", null);
    }

    @Override
    protected void onPause() {
        web.onPause();
        super.onPause();
    }

    @Override
    @SuppressWarnings("deprecation")
    public void onBackPressed() {
        web.evaluateJavascript("window.kalendaeBack?kalendaeBack():false", v -> {
            if (!"true".equals(v)) moveTaskToBack(true);
        });
    }

    @Override
    protected void onDestroy() {
        web.destroy();
        super.onDestroy();
    }

    @Override
    @SuppressWarnings("deprecation")
    protected void onActivityResult(int req, int res, Intent data) {
        super.onActivityResult(req, res, data);
        if (req == REQ_SAVE) {
            boolean ok = false;
            if (res == RESULT_OK && data != null && data.getData() != null && pendingSave != null) {
                try (OutputStream o = getContentResolver().openOutputStream(data.getData())) {
                    o.write(pendingSave.getBytes(StandardCharsets.UTF_8));
                    ok = true;
                } catch (Exception ignored) {}
            }
            pendingSave = null;
            web.evaluateJavascript("window.kalendaeSaved&&kalendaeSaved(" + ok + ")", null);
        } else if (req == REQ_OPEN && pendingOpen != null) {
            Uri u = (res == RESULT_OK && data != null) ? data.getData() : null;
            pendingOpen.onReceiveValue(u == null ? null : new Uri[]{u});
            pendingOpen = null;
        }
    }

    @Override
    public void onRequestPermissionsResult(int req, String[] perms, int[] results) {
        super.onRequestPermissionsResult(req, perms, results);
        if (req == REQ_NOTIFY) web.evaluateJavascript("window.kalendaeResume&&kalendaeResume()", null);
    }

    /** Everything the web app can ask Android for, as window.KalendaeNative. */
    private class Bridge {
        /** {"enabled":true,"time":"09:00","groupTitle":"{n} payments coming up"} — re-plans the daily check */
        @JavascriptInterface
        public void setNotifConfig(String json) {
            MoneyNotifier.setConfig(MainActivity.this, json);
        }

        /** What to tell you and on which day: [{"id","day":"yyyy-MM-dd","title","body","warn"}] */
        @JavascriptInterface
        public void setNotifEvents(String json) {
            MoneyNotifier.setEvents(MainActivity.this, json);
        }

        /** Posts one notification right now, so you can see what they look like. */
        @JavascriptInterface
        public void testNotification(String title, String body, boolean warn) {
            MoneyNotifier.post(MainActivity.this, warn ? MoneyNotifier.CH_WARN : MoneyNotifier.CH_UPCOMING,
                    warn ? 999 : MoneyNotifier.ID_SUMMARY, title, body, null);
        }

        @JavascriptInterface
        public String notifTime() {
            return MoneyNotifier.isEnabled(MainActivity.this) ? MoneyNotifier.time(MainActivity.this) : "";
        }

        @JavascriptInterface
        public boolean notificationsAllowed() {
            return android.os.Build.VERSION.SDK_INT < 33
                    || checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED;
        }

        @JavascriptInterface
        public void askNotifications() {
            if (android.os.Build.VERSION.SDK_INT >= 33)
                runOnUiThread(() -> requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS}, REQ_NOTIFY));
        }

        /** Android's notification settings for Kalendae (to switch a channel off, or back on). */
        @JavascriptInterface
        public void openNotifSettings() {
            runOnUiThread(() -> {
                try {
                    startActivity(new Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).putExtra(Settings.EXTRA_APP_PACKAGE, getPackageName()));
                } catch (Exception ignored) {}
            });
        }

        /** Opens the system "save as" screen for the backup file. Calls kalendaeSaved(true|false) after. */
        @JavascriptInterface
        public void saveFile(String name, String text) {
            runOnUiThread(() -> {
                pendingSave = text;
                Intent i = new Intent(Intent.ACTION_CREATE_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE)
                        .setType("application/json").putExtra(Intent.EXTRA_TITLE, name);
                try { startActivityForResult(i, REQ_SAVE); } catch (Exception e) { pendingSave = null; }
            });
        }

        @JavascriptInterface
        public void share(String text) {
            runOnUiThread(() -> {
                Intent i = new Intent(Intent.ACTION_SEND);
                i.setType("text/plain");
                i.putExtra(Intent.EXTRA_TEXT, text);
                try { startActivity(Intent.createChooser(i, "Share")); } catch (Exception ignored) {}
            });
        }

        /** Same patterns as navigator.vibrate: "18" or "18,40,18". */
        @JavascriptInterface
        public void vibrate(String csv) {
            Vibrator vib = getSystemService(Vibrator.class);
            if (vib == null || !vib.hasVibrator()) return;
            try {
                String[] parts = csv.split(",");
                if (parts.length == 1) {
                    vib.vibrate(VibrationEffect.createOneShot(Math.max(1, Long.parseLong(parts[0].trim())), VibrationEffect.DEFAULT_AMPLITUDE));
                    return;
                }
                long[] pattern = new long[parts.length + 1];
                for (int k = 0; k < parts.length; k++) pattern[k + 1] = Long.parseLong(parts[k].trim());
                vib.vibrate(VibrationEffect.createWaveform(pattern, -1));
            } catch (Exception ignored) {
            }
        }

        /** Downloads the exchange-rate table. Only the National Bank of Poland's API is allowed. */
        @JavascriptInterface
        public String fetchRates(String url) {
            try {
                java.net.URL u = new java.net.URL(url);
                if (!"https".equals(u.getProtocol()) || !"api.nbp.pl".equals(u.getHost())) return "";
                java.net.HttpURLConnection cn = (java.net.HttpURLConnection) u.openConnection();
                cn.setConnectTimeout(10000);
                cn.setReadTimeout(12000);
                cn.setRequestProperty("Accept", "application/json");
                if (cn.getResponseCode() != 200) return "";
                try (java.io.InputStream in = cn.getInputStream()) {
                    java.io.ByteArrayOutputStream out = new java.io.ByteArrayOutputStream();
                    byte[] buf = new byte[8192];
                    int n;
                    while ((n = in.read(buf)) > 0) out.write(buf, 0, n);
                    return out.toString("UTF-8");
                } finally {
                    cn.disconnect();
                }
            } catch (Exception e) {
                return "";
            }
        }

        @JavascriptInterface
        public String version() {
            try {
                return getPackageManager().getPackageInfo(getPackageName(), 0).versionName;
            } catch (Exception e) {
                return "";
            }
        }
    }
}
