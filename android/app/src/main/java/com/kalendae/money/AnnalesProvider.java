package com.kalendae.money;

import android.content.ContentProvider;
import android.content.ContentValues;
import android.database.Cursor;
import android.database.MatrixCursor;
import android.net.Uri;

import java.util.List;
import java.util.Map;

/**
 * Answers Annales, the stamp journal, with one day of what Kalendae shared:
 * content://com.kalendae.money.annales/day/2026-11-02 → money.spent, money.safe, money.spentN, money.safeN.
 * Read-only, and it returns nothing to any app but Annales.
 */
public class AnnalesProvider extends ContentProvider {
    private static final String ANNALES = "com.annales.journal";

    @Override public boolean onCreate() { return true; }

    @Override
    public Cursor query(Uri uri, String[] projection, String selection, String[] args, String sort) {
        MatrixCursor out = new MatrixCursor(new String[]{"key", "value"});
        if (!ANNALES.equals(getCallingPackage()) || getContext() == null) return out;
        List<String> segs = uri.getPathSegments();
        if (segs.size() != 2 || !"day".equals(segs.get(0)) || !segs.get(1).matches("\\d{4}-\\d{2}-\\d{2}")) return out;
        for (Map.Entry<String, String> e : AnnalesShare.day(getContext(), segs.get(1)).entrySet())
            out.addRow(new Object[]{e.getKey(), e.getValue()});
        return out;
    }

    @Override public String getType(Uri uri) { return null; }
    @Override public Uri insert(Uri uri, ContentValues values) { return null; }
    @Override public int delete(Uri uri, String selection, String[] args) { return 0; }
    @Override public int update(Uri uri, ContentValues values, String selection, String[] args) { return 0; }
}
