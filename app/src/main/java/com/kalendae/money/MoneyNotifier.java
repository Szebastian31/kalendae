package com.kalendae.money;

import android.app.AlarmManager;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;

import org.json.JSONArray;
import org.json.JSONObject;

import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Calendar;
import java.util.Date;
import java.util.List;
import java.util.Locale;

/**
 * Kalendae's notifications, built like Consensus Weather's: once a day, at a time you choose (09:00 by
 * default), Android wakes Kalendae roughly on time (inexact, battery-friendly, no alarm permission) and it
 * posts an ordinary notification about what's coming: renewals, bills, trial endings.
 * Warnings (a trial ending tomorrow, an account about to run short) go on their own higher-priority
 * channel, like Consensus Weather's severe-weather alerts.
 *
 * The web app works out what to say and on which day, and hands over a list:
 * [{"id":"netflix-2026-10-24","day":"2026-10-21","title":"Netflix renews in 3 days","body":"67 zł from Shared","warn":false}]
 */
public class MoneyNotifier extends BroadcastReceiver {
    static final String CH_UPCOMING = "upcoming";
    static final String CH_WARN = "warnings";
    static final String PREFS = "kalendae_notif";
    static final int REQ_DAILY = 100;
    static final int ID_SUMMARY = 1;

    static SharedPreferences prefs(Context c) { return c.getSharedPreferences(PREFS, Context.MODE_PRIVATE); }
    static boolean isEnabled(Context c) { return prefs(c).getBoolean("enabled", true); }
    static String time(Context c) { return prefs(c).getString("time", "09:00"); }

    /** From the web app: {"enabled":true,"time":"09:00","groupTitle":"{n} payments coming up"} */
    public static void setConfig(Context c, String json) {
        try {
            JSONObject o = new JSONObject(json);
            prefs(c).edit()
                    .putBoolean("enabled", o.optBoolean("enabled", true))
                    .putString("time", o.optString("time", "09:00"))
                    .putString("groupTitle", o.optString("groupTitle", "{n} payments coming up"))
                    .apply();
            scheduleAll(c);
        } catch (Exception ignored) {
        }
    }

    /** From the web app: everything worth telling you about over the next weeks (see the class comment). */
    public static void setEvents(Context c, String json) {
        prefs(c).edit().putString("events", json).apply();
    }

    // ---- scheduling ----
    public static void scheduleAll(Context c) {
        AlarmManager am = c.getSystemService(AlarmManager.class);
        am.cancel(pending(c));
        if (!isEnabled(c)) return;
        String[] hm = time(c).split(":");
        Calendar t = Calendar.getInstance();
        t.set(Calendar.HOUR_OF_DAY, safeInt(hm.length > 0 ? hm[0] : "9", 9));
        t.set(Calendar.MINUTE, safeInt(hm.length > 1 ? hm[1] : "0", 0));
        t.set(Calendar.SECOND, 0);
        if (t.getTimeInMillis() <= System.currentTimeMillis()) t.add(Calendar.DAY_OF_YEAR, 1);
        am.setInexactRepeating(AlarmManager.RTC_WAKEUP, t.getTimeInMillis(), AlarmManager.INTERVAL_DAY, pending(c));
    }

    static PendingIntent pending(Context c) {
        Intent i = new Intent(c, MoneyNotifier.class).setAction("com.kalendae.money.DAILY");
        return PendingIntent.getBroadcast(c, REQ_DAILY, i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    public static void createChannels(Context c) {
        NotificationManager nm = c.getSystemService(NotificationManager.class);
        NotificationChannel up = new NotificationChannel(CH_UPCOMING, "Coming up", NotificationManager.IMPORTANCE_DEFAULT);
        up.setDescription("Renewals and bills a few days before they're due");
        nm.createNotificationChannel(up);
        NotificationChannel w = new NotificationChannel(CH_WARN, "Warnings", NotificationManager.IMPORTANCE_HIGH);
        w.setDescription("Trials about to turn paid, and accounts about to run short");
        nm.createNotificationChannel(w);
    }

    @Override
    public void onReceive(final Context ctx, Intent intent) {
        final String action = intent.getAction();
        final PendingResult pr = goAsync();
        new Thread(() -> {
            try {
                createChannels(ctx);
                if (Intent.ACTION_BOOT_COMPLETED.equals(action) || Intent.ACTION_MY_PACKAGE_REPLACED.equals(action)) {
                    scheduleAll(ctx);
                    catchUp(ctx);
                } else if (isEnabled(ctx)) {
                    check(ctx);
                }
            } catch (Exception ignored) {
            } finally {
                pr.finish();
            }
        }).start();
    }

    /** The phone was off at notification time: tell today's news once it's back on. */
    static void catchUp(Context c) throws Exception {
        if (!isEnabled(c)) return;
        String[] hm = time(c).split(":");
        Calendar now = Calendar.getInstance();
        int mins = now.get(Calendar.HOUR_OF_DAY) * 60 + now.get(Calendar.MINUTE);
        if (mins >= safeInt(hm[0], 9) * 60 + safeInt(hm.length > 1 ? hm[1] : "0", 0)) check(c);
    }

    /** Once a day: everything due since the last check (so nothing is lost if a day was skipped). */
    static void check(Context c) throws Exception {
        SharedPreferences p = prefs(c);
        String today = new SimpleDateFormat("yyyy-MM-dd", Locale.US).format(new Date());
        String last = p.getString("lastDay", "");
        if (today.compareTo(last) <= 0) return;
        p.edit().putString("lastDay", today).apply();

        JSONArray all = new JSONArray(p.getString("events", "[]"));
        List<JSONObject> upcoming = new ArrayList<>();
        for (int i = 0; i < all.length(); i++) {
            JSONObject e = all.getJSONObject(i);
            String day = e.optString("day");
            if (day.compareTo(today) > 0 || day.compareTo(last) <= 0) continue;
            if (e.optBoolean("warn")) post(c, CH_WARN, 1000 + Math.abs(e.optString("id").hashCode() % 100000), e.optString("title"), e.optString("body"), null);
            else upcoming.add(e);
        }
        if (upcoming.isEmpty()) return;
        if (upcoming.size() == 1) {
            JSONObject e = upcoming.get(0);
            post(c, CH_UPCOMING, ID_SUMMARY, e.optString("title"), e.optString("body"), null);
            return;
        }
        String title = p.getString("groupTitle", "{n} payments coming up").replace("{n}", String.valueOf(upcoming.size()));
        List<String> lines = new ArrayList<>();
        for (JSONObject e : upcoming) lines.add(e.optString("title") + " · " + e.optString("body"));
        post(c, CH_UPCOMING, ID_SUMMARY, title, lines.get(0), lines);
    }

    static void post(Context c, String channel, int id, String title, String body, List<String> lines) {
        Notification.Builder b = new Notification.Builder(c, channel)
                .setSmallIcon(R.drawable.ic_stat_kalendae)
                .setColor(0xFFDFE6F2)
                .setContentTitle(title)
                .setContentText(body)
                .setAutoCancel(true);
        if (lines != null) {
            Notification.InboxStyle s = new Notification.InboxStyle();
            for (String l : lines) s.addLine(l);
            b.setStyle(s);
        } else {
            b.setStyle(new Notification.BigTextStyle().bigText(body));
        }
        Intent open = c.getPackageManager().getLaunchIntentForPackage(c.getPackageName());
        if (open != null) b.setContentIntent(PendingIntent.getActivity(c, 300 + id % 1000, open,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE));
        c.getSystemService(NotificationManager.class).notify(id, b.build());
    }

    static int safeInt(String s, int def) {
        try { return Integer.parseInt(s.trim()); } catch (Exception e) { return def; }
    }
}
