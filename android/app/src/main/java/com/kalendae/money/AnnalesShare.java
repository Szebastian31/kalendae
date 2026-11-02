package com.kalendae.money;

import android.content.Context;
import android.content.SharedPreferences;
import android.webkit.JavascriptInterface;

import org.json.JSONObject;

import java.text.SimpleDateFormat;
import java.util.Calendar;
import java.util.Iterator;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;

/**
 * What Kalendae shares with Annales, the stamp journal: each day's spending and safe-to-spend, as the page
 * hands it over (window.AnnalesShare.put). Kept in the app's own storage for 120 days and read only by
 * {@link AnnalesProvider}, which answers Annales alone. Nothing leaves the phone.
 */
public final class AnnalesShare {
    static final String PREFS = "annales_share";
    private static final int KEEP_DAYS = 120;
    private final Context ctx;

    public AnnalesShare(Context c) { ctx = c.getApplicationContext(); }

    /** date "YYYY-MM-DD"; json an object of short text values, merged into what that day already has. */
    @JavascriptInterface
    public void put(String date, String json) {
        if (date == null || !date.matches("\\d{4}-\\d{2}-\\d{2}")) return;
        try {
            SharedPreferences p = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
            JSONObject day = new JSONObject(p.getString("d:" + date, "{}"));
            JSONObject in = new JSONObject(json);
            for (Iterator<String> k = in.keys(); k.hasNext(); ) { String key = k.next(); day.put(key, in.optString(key)); }
            SharedPreferences.Editor e = p.edit().putString("d:" + date, day.toString());
            Calendar c = Calendar.getInstance();
            c.add(Calendar.DAY_OF_YEAR, -KEEP_DAYS);
            String oldest = "d:" + new SimpleDateFormat("yyyy-MM-dd", Locale.US).format(c.getTime());
            for (String key : p.getAll().keySet()) if (key.startsWith("d:") && key.compareTo(oldest) < 0) e.remove(key);
            e.apply();
        } catch (Exception ignored) {}
    }

    static Map<String, String> day(Context c, String date) {
        Map<String, String> out = new LinkedHashMap<>();
        try {
            JSONObject o = new JSONObject(c.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString("d:" + date, "{}"));
            for (Iterator<String> k = o.keys(); k.hasNext(); ) { String key = k.next(); out.put(key, o.optString(key)); }
        } catch (Exception ignored) {}
        return out;
    }
}
