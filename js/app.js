// Kalendae: the shell. Tabs, header, start-up, and keeping everything in sync.
let CURRENT_TAB = 'today';
const TAB_TITLES = { today: t('Today'), forecast: t('Forecast'), commit: t('Commitments'), accounts: t('Accounts') };

function showTab(name) {
  CURRENT_TAB = name;
  $$('#tabs button[data-tab]').forEach(b => b.classList.toggle('on', b.dataset.tab === name));
  $$('.view').forEach(v => v.classList.toggle('on', v.dataset.view === name));
  $('#title').textContent = TAB_TITLES[name];
  $('#scroll').scrollTop = 0;
  if (name === 'forecast') renderForecast(); // the chart needs to be visible to measure itself
}
$$('#tabs button[data-tab]').forEach(b => b.onclick = () => { tick('8'); showTab(b.dataset.tab); });

function renderHeader() {
  $('#headIcon').innerHTML = iconSVG({ size: 28 });
  $('#today').textContent = dateLong();
  $('#title').textContent = TAB_TITLES[CURRENT_TAB];
  $('#curPill').innerHTML = `${S.settings.display}${S.settings.currencies.length > 1 ? ' <span class="muted">▾</span>' : ''}`;
}
// tap the currency pill to flip through the currencies you use
$('#curPill').onclick = () => {
  const c = S.settings.currencies;
  if (c.length < 2) { settingsSheet(); return; }
  S.settings.display = c[(c.indexOf(S.settings.display) + 1) % c.length];
  save();
  toast(t('Showing money in {c}', { c: curName(S.settings.display) }));
};
$('#openSettings').onclick = settingsSheet;
$("#fab").onclick = () => { tick("8"); spendSheet(); };
// once the page scrolls, a strip of glass appears behind the status bar so the clock stays readable
$('#scroll').addEventListener('scroll', () => document.body.classList.toggle('scrolled', $('#scroll').scrollTop > 6), { passive: true });

function renderAll() {
  applyLook();
  renderHeader();
  renderToday();
  renderCommit();
  renderAccounts();
  $("#fab").hidden = !liveAccounts().length;
  if (CURRENT_TAB === 'forecast') renderForecast();
}
onChange(renderAll);
onChange(syncNotifEvents); // keep Android's list of upcoming notifications in step with your data

let resizeT;
window.addEventListener('resize', () => { clearTimeout(resizeT); resizeT = setTimeout(() => { if (CURRENT_TAB === 'forecast') renderForecast(); }, 150); });

// a new day may have started since the app was last open
let lastDay = todayISO();
window.kalendaeResume = () => {
  if (todayISO() !== lastDay) { lastDay = todayISO(); renderAll(); syncNotifEvents(); } else renderHeader();
  refreshRates().then(changed => { if (changed) renderAll(); });
};

translateStatic(); // tab names and labels in index.html, in your language
if (DEMO) {
  // README screenshots: made-up data, a still page, nothing saved (see tools/screenshots.sh)
  S = sampleState();
  const look = (location.search.match(/[?&]look=(\w+)/) || [])[1];
  if (look) S.settings.look = look;
  document.head.insertAdjacentHTML('beforeend', '<style>*{animation:none!important;transition:none!important}</style>');
  renderAll();
  if (DEMO === 'spend') spendSheet(S.spends.find(sp => sp.id === 's-lidl'));
  else showTab(DEMO);
} else {
  renderAll();
  syncNotifConfig();
  syncNotifEvents();
  refreshRates().then(changed => { if (changed) renderAll(); });
  if ('serviceWorker' in navigator && !NATIVE && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
}

// Annales, the stamp journal, shows each day's spending on its postmark. In the Android app the page hands
// the last week's totals and today's safe-to-spend to the shell (window.AnnalesShare), which keeps them on the
// phone and answers only Annales. In a browser there's no bridge, and none of this runs.
(function () {
  if (!window.AnnalesShare) return;
  const round = v => String(Math.round(v * 100) / 100);
  function shareWithAnnales() {
    try {
      if (typeof S === 'undefined' || !S || (typeof DEMO !== 'undefined' && DEMO) || !liveAccounts().length) return;
      const list = liveSpends();
      const safe = safeToSpend();
      for (let i = 0; i < 7; i++) {
        const d = isoDay(addDays(day0(), -i));
        const spent = list.filter(sp => sp.d === d).reduce((s, sp) => s + conv(sp.amt, accountById(sp.acct).cur), 0);
        const o = { 'money.spent': fmt(spent), 'money.spentN': round(spent) };
        // safe-to-spend is only known for today; earlier days keep what they had on the day
        if (i === 0 && safe) {
          const perDay = safe.safe > 0 ? safe.perDay || 0 : 0;
          o['money.safe'] = fmt(perDay);
          o['money.safeN'] = round(perDay);
        }
        AnnalesShare.put(d, JSON.stringify(o));
      }
    } catch (e) {}
  }
  setTimeout(shareWithAnnales, 2000);
  setInterval(shareWithAnnales, 60000);
  document.addEventListener('visibilitychange', () => { if (document.hidden) shareWithAnnales(); });
})();
