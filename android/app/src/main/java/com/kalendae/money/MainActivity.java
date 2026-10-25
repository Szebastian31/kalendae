package com.kalendae.money;

import android.Manifest;
import android.app.Activity;
import android.content.ClipData;
import android.content.ContentValues;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.graphics.Insets;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.provider.MediaStore;
import android.provider.Settings;
import android.util.Base64;
import android.view.View;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import android.view.WindowManager;
import android.window.OnBackInvokedDispatcher;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;

import androidx.core.content.FileProvider;
import androidx.webkit.WebViewAssetLoader;

import java.io.File;
import java.io.FileOutputStream;

import java.io.OutputStream;
import java.nio.charset.StandardCharsets;

/**
 * Kalendae's whole interface is the web app, bundled in the APK. This activity hosts it full screen and
 * gives it what a browser can't do reliably: a daily notification about what's coming up (sent even when the app is closed), saving and
 * opening backup files, receipt photos (camera, saving to Pictures, sharing), the share sheet and vibration.
 * The page draws edge to edge, behind the status bar and the gesture bar; it's told how tall they are (--sat / --sab)
 * so nothing important sits under them.
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
    private File cameraFile;          // where the camera writes a receipt photo
    private static final String FILES = "com.kalendae.money.files"; // the FileProvider in AndroidManifest.xml
    private int insetTop, insetBottom; // status bar and gesture bar, in CSS pixels
    private boolean lightBars;         // dark clock and icons, for a light look

    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);
        // If Kalendae crashed last time, show what happened instead of crashing again, so it can be sent on.
        // Your money data isn't touched: it's in the WebView's storage, not here.
        final File crash = new File(getFilesDir(), "crash.txt");
        final Thread.UncaughtExceptionHandler prev = Thread.getDefaultUncaughtExceptionHandler();
        Thread.setDefaultUncaughtExceptionHandler((th, e) -> {
            try (FileOutputStream o = new FileOutputStream(crash)) {
                java.io.StringWriter sw = new java.io.StringWriter();
                java.io.PrintWriter pw = new java.io.PrintWriter(sw);
                e.printStackTrace(pw);
                pw.flush();
                String head = "Kalendae " + appVersion() + " · Android " + Build.VERSION.RELEASE + " (API " + Build.VERSION.SDK_INT + ") · " + Build.MANUFACTURER + " " + Build.MODEL + "\n\n";
                o.write((head + sw).getBytes(StandardCharsets.UTF_8));
            } catch (Exception ignored) {}
            if (prev != null) prev.uncaughtException(th, e);
        });
        if (crash.exists()) { showCrash(crash); return; }

        try { edgeToEdge(); } catch (Exception ignored) {}
        try {
            MoneyNotifier.createChannels(this);
            MoneyNotifier.scheduleAll(this);
        } catch (Exception ignored) {}
        clearCache("camera");
        clearCache("shared");

        web = new WebView(this);
        web.setBackgroundColor(Color.parseColor(NIGHT));
        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(Color.parseColor(NIGHT));
        root.addView(web, new FrameLayout.LayoutParams(FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT));
        setContentView(root);
        // the bars' heights go to the page; the keyboard shrinks the page instead, so the field you type in stays visible
        root.setOnApplyWindowInsetsListener((v, ins) -> { try {
            int top, bottom, ime;
            if (Build.VERSION.SDK_INT >= 30) {
                Insets bars = ins.getInsets(WindowInsets.Type.systemBars() | WindowInsets.Type.displayCutout());
                top = bars.top;
                bottom = bars.bottom;
                ime = ins.getInsets(WindowInsets.Type.ime()).bottom;
            } else {
                top = ins.getSystemWindowInsetTop();
                bottom = ins.getStableInsetBottom();
                int all = ins.getSystemWindowInsetBottom();
                ime = all > bottom ? all : 0; // more than the gesture bar: the keyboard is open
            }
            v.setPadding(0, 0, 0, ime);
            float d = getResources().getDisplayMetrics().density;
            insetTop = Math.round(top / d);
            insetBottom = ime > 0 ? 0 : Math.round(bottom / d);
            pushInsets();
            } catch (Exception ignored) {}
            return ins;
        });

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

            @Override
            public void onPageFinished(WebView view, String url) {
                pushInsets(); // a fresh page has forgotten them
            }
        });
        // <input type="file">: a backup file to restore, or a receipt photo (camera or gallery)
        web.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView v, ValueCallback<Uri[]> cb, FileChooserParams p) {
                if (pendingOpen != null) pendingOpen.onReceiveValue(null);
                pendingOpen = cb;
                cameraFile = null;
                boolean image = false;
                for (String type : p.getAcceptTypes()) if (type != null && type.startsWith("image")) image = true;
                Intent i;
                if (image) {
                    Intent pick = new Intent(Intent.ACTION_GET_CONTENT).addCategory(Intent.CATEGORY_OPENABLE).setType("image/*");
                    i = Intent.createChooser(pick, null);
                    try {
                        File dir = new File(getCacheDir(), "camera");
                        dir.mkdirs();
                        cameraFile = new File(dir, "receipt-" + System.currentTimeMillis() + ".jpg");
                        Uri out = FileProvider.getUriForFile(MainActivity.this, FILES, cameraFile);
                        Intent cam = new Intent(MediaStore.ACTION_IMAGE_CAPTURE).putExtra(MediaStore.EXTRA_OUTPUT, out)
                                .addFlags(Intent.FLAG_GRANT_WRITE_URI_PERMISSION | Intent.FLAG_GRANT_READ_URI_PERMISSION);
                        cam.setClipData(ClipData.newRawUri("", out)); // so the camera app is allowed to write the file
                        i.putExtra(Intent.EXTRA_INITIAL_INTENTS, new Intent[]{cam});
                    } catch (Exception e) {
                        cameraFile = null;
                    }
                } else {
                    i = new Intent(Intent.ACTION_OPEN_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE).setType("*/*");
                }
                try { startActivityForResult(i, REQ_OPEN); } catch (Exception e) { pendingOpen = null; return false; }
                return true;
            }
        });
        web.addJavascriptInterface(new Bridge(), "KalendaeNative");
        // Android 16 no longer calls onBackPressed for apps targeting it; back arrives here instead
        if (Build.VERSION.SDK_INT >= 33) try {
            getOnBackInvokedDispatcher().registerOnBackInvokedCallback(OnBackInvokedDispatcher.PRIORITY_DEFAULT, this::goBack);
        } catch (Exception ignored) {}

        if (state != null) web.restoreState(state);
        else web.loadUrl(START);
    }

    /** What went wrong last time, with Share (to send it on) and Try again. Plain Android views only, nothing that could fail the same way. */
    private void showCrash(File crash) {
        String text;
        try { text = new String(java.nio.file.Files.readAllBytes(crash.toPath()), StandardCharsets.UTF_8); }
        catch (Exception e) { text = "(the error report couldn't be read)"; }
        final String report = text;
        float d = getResources().getDisplayMetrics().density;
        int pad = Math.round(20 * d);

        android.widget.LinearLayout box = new android.widget.LinearLayout(this);
        box.setOrientation(android.widget.LinearLayout.VERTICAL);
        box.setBackgroundColor(Color.parseColor(NIGHT));
        box.setPadding(pad, Math.round(56 * d), pad, Math.round(32 * d));

        android.widget.TextView title = new android.widget.TextView(this);
        title.setText("Kalendae stopped last time");
        title.setTextColor(Color.WHITE);
        title.setTextSize(22);
        box.addView(title);

        android.widget.TextView lead = new android.widget.TextView(this);
        lead.setText("Your data is safe. Tap Share and send this to whoever is fixing the app, then Try again.");
        lead.setTextColor(Color.parseColor("#B8C2E0"));
        lead.setTextSize(15);
        lead.setPadding(0, Math.round(8 * d), 0, Math.round(14 * d));
        box.addView(lead);

        android.widget.LinearLayout row = new android.widget.LinearLayout(this);
        android.widget.Button share = new android.widget.Button(this);
        share.setText("Share");
        share.setOnClickListener(v -> {
            Intent i = new Intent(Intent.ACTION_SEND).setType("text/plain").putExtra(Intent.EXTRA_TEXT, report);
            try { startActivity(Intent.createChooser(i, "Share")); } catch (Exception ignored) {}
        });
        android.widget.Button again = new android.widget.Button(this);
        again.setText("Try again");
        again.setOnClickListener(v -> { crash.delete(); recreate(); });
        row.addView(share);
        row.addView(again);
        box.addView(row);

        android.widget.TextView log = new android.widget.TextView(this);
        log.setText(report);
        log.setTextColor(Color.parseColor("#DFE6F2"));
        log.setTextSize(11);
        log.setTypeface(android.graphics.Typeface.MONOSPACE);
        log.setTextIsSelectable(true);
        log.setPadding(0, Math.round(14 * d), 0, 0);
        android.widget.ScrollView scroll = new android.widget.ScrollView(this);
        scroll.addView(log);
        box.addView(scroll, new android.widget.LinearLayout.LayoutParams(-1, 0, 1f));
        setContentView(box);
    }

    private String appVersion() {
        try { return getPackageManager().getPackageInfo(getPackageName(), 0).versionName; } catch (Exception e) { return "?"; }
    }

    /** Draw behind the status bar and the gesture bar, with both bars see-through. */
    @SuppressWarnings("deprecation")
    private void edgeToEdge() {
        getWindow().setStatusBarColor(Color.TRANSPARENT);
        getWindow().setNavigationBarColor(Color.TRANSPARENT);
        getWindow().setStatusBarContrastEnforced(false);
        getWindow().setNavigationBarContrastEnforced(false);
        getWindow().getAttributes().layoutInDisplayCutoutMode = WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES;
        if (Build.VERSION.SDK_INT >= 30) getWindow().setDecorFitsSystemWindows(false);
        applyBars();
    }

    /** Light icons on the dark looks, dark icons on Paper. */
    @SuppressWarnings("deprecation")
    private void applyBars() {
        if (Build.VERSION.SDK_INT >= 30) {
            WindowInsetsController c = getWindow().getInsetsController();
            if (c != null) {
                int both = WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS | WindowInsetsController.APPEARANCE_LIGHT_NAVIGATION_BARS;
                c.setSystemBarsAppearance(lightBars ? both : 0, both);
            }
        } else {
            int f = View.SYSTEM_UI_FLAG_LAYOUT_STABLE | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION;
            if (lightBars) f |= View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR | View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR;
            getWindow().getDecorView().setSystemUiVisibility(f);
        }
    }

    private void pushInsets() {
        if (web == null) return;
        web.evaluateJavascript("(function(s){s.setProperty('--sat','" + insetTop + "px');s.setProperty('--sab','" + insetBottom + "px')})(document.documentElement.style)", null);
    }

    @Override
    protected void onSaveInstanceState(Bundle out) {
        super.onSaveInstanceState(out);
        if (web != null) web.saveState(out);
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (web == null) return;
        web.onResume();
        // a new day may have started, or a notification was tapped
        web.evaluateJavascript("window.kalendaeResume&&kalendaeResume()", null);
    }

    @Override
    protected void onPause() {
        if (web != null) web.onPause();
        super.onPause();
    }

    /** Back (Android 15 and older) */
    @Override
    @SuppressWarnings("deprecation")
    public void onBackPressed() {
        goBack();
    }

    /** Back closes an open sheet first; otherwise Kalendae goes to the background instead of quitting. */
    private void goBack() {
        if (web == null) { finish(); return; }
        web.evaluateJavascript("window.kalendaeBack?kalendaeBack():false", v -> {
            if (!"true".equals(v)) moveTaskToBack(true);
        });
    }

    @Override
    protected void onDestroy() {
        if (web != null) web.destroy();
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
            Uri u = null;
            if (res == RESULT_OK) {
                if (data != null && data.getData() != null) u = data.getData();               // picked from the gallery or files
                else if (cameraFile != null && cameraFile.length() > 0)                        // taken with the camera
                    u = FileProvider.getUriForFile(this, FILES, cameraFile);
            }
            pendingOpen.onReceiveValue(u == null ? null : new Uri[]{u});
            pendingOpen = null;
        }
    }

    @Override
    public void onRequestPermissionsResult(int req, String[] perms, int[] results) {
        super.onRequestPermissionsResult(req, perms, results);
        if (req == REQ_NOTIFY) web.evaluateJavascript("window.kalendaeResume&&kalendaeResume()", null);
    }

    /** Old camera photos and shared receipts (copies; the real ones live in the app's storage). */
    private void clearCache(String sub) {
        File[] fs = new File(getCacheDir(), sub).listFiles();
        if (fs != null) for (File f : fs) f.delete();
    }

    private static String safeName(String n) {
        String s = n == null ? "" : n.replaceAll("[^A-Za-z0-9._-]", "-");
        return s.isEmpty() ? "receipt.jpg" : s;
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

        /** The look changed: dark status-bar icons on a light look, light ones on a dark look. */
        @JavascriptInterface
        public void setBars(boolean light) {
            if (light == lightBars) return;
            runOnUiThread(() -> { lightBars = light; applyBars(); });
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

        /** Downloads exchange rates. Only the three public rate APIs (NBP, Frankfurter, currency-api) are allowed. */
        @JavascriptInterface
        public String fetchRates(String url) {
            try {
                java.net.URL u = new java.net.URL(url);
                if (!"https".equals(u.getProtocol()) || !java.util.Arrays.asList("api.nbp.pl", "api.frankfurter.dev", "cdn.jsdelivr.net").contains(u.getHost())) return "";
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

        /** Saves a receipt photo to Pictures/Kalendae, where the gallery and receipt apps can find it. */
        @JavascriptInterface
        public boolean saveImage(String name, String base64) {
            try {
                ContentValues v = new ContentValues();
                v.put(MediaStore.Images.Media.DISPLAY_NAME, safeName(name));
                v.put(MediaStore.Images.Media.MIME_TYPE, "image/jpeg");
                v.put(MediaStore.Images.Media.RELATIVE_PATH, Environment.DIRECTORY_PICTURES + "/Kalendae");
                Uri u = getContentResolver().insert(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, v);
                if (u == null) return false;
                try (OutputStream o = getContentResolver().openOutputStream(u)) {
                    o.write(Base64.decode(base64, Base64.DEFAULT));
                }
                return true;
            } catch (Exception e) {
                return false;
            }
        }

        /** Shares a receipt photo, e.g. straight into Google Opinion Rewards or an email. */
        @JavascriptInterface
        public void shareImage(String name, String base64) {
            try {
                File dir = new File(getCacheDir(), "shared");
                dir.mkdirs();
                File f = new File(dir, safeName(name));
                try (FileOutputStream o = new FileOutputStream(f)) {
                    o.write(Base64.decode(base64, Base64.DEFAULT));
                }
                Uri u = FileProvider.getUriForFile(MainActivity.this, FILES, f);
                Intent i = new Intent(Intent.ACTION_SEND).setType("image/jpeg").putExtra(Intent.EXTRA_STREAM, u)
                        .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                i.setClipData(ClipData.newRawUri("", u));
                runOnUiThread(() -> {
                    try { startActivity(Intent.createChooser(i, null)); } catch (Exception ignored) {}
                });
            } catch (Exception ignored) {
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
