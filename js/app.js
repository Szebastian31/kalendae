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
