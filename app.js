// Kalendae: the shell. Tabs, header, start-up, and keeping everything in sync.
let CURRENT_TAB = 'today';

function showTab(name) {
  CURRENT_TAB = name;
  $$('#tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === name));
  $$('.view').forEach(v => v.classList.toggle('on', v.dataset.view === name));
  $('#scroll').scrollTop = 0;
  if (name === 'forecast') renderForecast(); // the chart needs to be visible to measure itself
}
$$('#tabs button').forEach(b => b.onclick = () => { tick('8'); showTab(b.dataset.tab); });

function renderHeader() {
  $('#headIcon').innerHTML = iconSVG({ size: 38 });
  $('#today').textContent = dateLong();
  $('#curPill').innerHTML = `${S.settings.display}${S.settings.currencies.length > 1 ? ' <span class="muted">▾</span>' : ''}`;
}
// tap the currency pill to flip through the currencies you use
$('#curPill').onclick = () => {
  const c = S.settings.currencies;
  if (c.length < 2) { settingsSheet(); return; }
  S.settings.display = c[(c.indexOf(S.settings.display) + 1) % c.length];
  save();
  toast(`Showing money in ${CURRENCIES[S.settings.display][0].toLowerCase()}`);
};
$('#openSettings').onclick = settingsSheet;

function renderAll() {
  applyLook();
  renderHeader();
  renderToday();
  renderCommit();
  renderAccounts();
  if (CURRENT_TAB === 'forecast') renderForecast();
}
onChange(renderAll);

let resizeT;
window.addEventListener('resize', () => { clearTimeout(resizeT); resizeT = setTimeout(() => { if (CURRENT_TAB === 'forecast') renderForecast(); }, 150); });

// a new day may have started since the app was last open
let lastDay = todayISO();
window.kalendaeResume = () => {
  if (todayISO() !== lastDay) { lastDay = todayISO(); renderAll(); } else renderHeader();
  refreshRates().then(changed => { if (changed) renderAll(); });
};

renderAll();
syncNotifConfig();
refreshRates().then(changed => { if (changed) renderAll(); });
if ('serviceWorker' in navigator && !NATIVE && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
