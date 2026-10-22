# Kalendae

**A forecast for your money: what's coming, and what's safe to spend until payday.**

No app store, no account, no bank login, no ads. Everything stays on your phone.

> Work in progress. Version 0.1 is the foundation: the Android app installs, the icon is in place and notifications work. Accounts, bills, subscriptions and the forecast arrive in the next versions.

---

☕️ You can support me and Buy me a coffee ☕️

[https://buycoffee.to/szebastian](https://buycoffee.to/szebastian)

---

## Getting started

### Android app (recommended)

1. Open **[Releases](https://github.com/Szebastian31/kalendae/releases/latest)** on your phone and download **Kalendae_v….apk**.
1. Open the file. If Android asks, allow your browser to **install unknown apps**.
1. Open Kalendae and allow **notifications**, so Kalendae can tell you about renewals, bills and trial endings a few days ahead.

### iPhone or any browser

1. Open **[szebastian31.github.io/kalendae](https://szebastian31.github.io/kalendae/)**.
1. **iPhone (Safari):** tap **Share**, then **Add to Home Screen**. **Android (Chrome):** tap **⋮**, then **Install app**.

## Privacy

Everything stays on your phone. Your accounts, amounts and dates are saved on your device only and never uploaded.

---

_Kalendae is Latin for the first day of the Roman month, first set by the new moon, when debts fell due. The moneylender's ledger was a calendarium, which is where "calendar" comes from. It's a sibling to Consensus Weather, Fidelis, Vestis, Caelum, Hora and Augur._

<details>
<summary>For developers</summary>

The interface is plain HTML, CSS and JavaScript, hosted on GitHub Pages. The Android app (`app/`) bundles those same files into a native WebView shell that adds a daily notification about what's coming up, sent even when the app is closed (an inexact daily check, like Consensus Weather, re-planned after a restart), saving and opening backup files, the share sheet and vibration. GitHub Actions builds the APK on every push and publishes it as a release.

| File | What it does |
| --- | --- |
| `index.html` | Layout and styles |
| `app.js` | The app |
| `icons/icon.js` | The icon drawing, used by the app and `icons.html` |
| `icons/icon.svg`, `icons.html` | The icon, and a page that exports the PNG icons |
| `manifest.webmanifest`, `sw.js` | Home-screen install and offline cache |
| `app/` | Android app: WebView shell, daily notifications, backup files, launcher icon |
| `.github/workflows/build.yml` | Builds the APK and publishes it as a release |

After changing any file, bump `VERSION` in `sw.js` so installed web copies update, and `versionName` + `versionCode` in `app/build.gradle` for a new APK release. A `.js` file at the repo root is bundled into the APK automatically; add it to `index.html` and `sw.js` too.

</details>
