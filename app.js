// Kalendae 0.2: the shell. Tabs, header, and the screens that arrive in the next steps.
let CURRENT_TAB = 'today';

function showTab(name) {
  CURRENT_TAB = name;
  $$('#tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === name));
  $$('.view').forEach(v => v.classList.toggle('on', v.dataset.view === name));
  $('#scroll').scrollTop = 0;
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

function renderToday() {
  const accts = liveAccounts();
  const v = $('#vToday');
  if (!accts.length) {
    v.innerHTML = `<div class="card soon"><div style="width:110px;margin:0 auto">${iconSVG({ size: 110 })}</div>
      <div class="big">A forecast for your money</div>
      <p class="sub">Start with your accounts. Next, your income, bills and subscriptions, and Kalendae shows what's safe to spend until payday.</p>
      <button class="btn wide" style="margin-top:18px" id="goAccts">Add your accounts</button></div>`;
    $('#goAccts').onclick = () => { showTab('accounts'); accountSheet(); };
    return;
  }
  const stale = accts.filter(a => a.balanceAt && (new Date(todayISO()) - new Date(a.balanceAt)) / 864e5 > 7);
  v.innerHTML = `<div class="card"><h3>What's yours <em>${accts.length} accounts</em></h3>
      <div class="big num">${fmt(netWorth())}</div>
      <p class="sub" style="margin-top:8px">${stale.length ? `${stale.length} balance${stale.length > 1 ? 's are' : ' is'} more than a week old. Tap Accounts to update.` : 'All balances checked this week.'}</p></div>
    <div class="card soon" style="padding:28px 16px"><div class="big" style="font-size:24px">The orbit comes next</div>
      <p class="sub">Version 0.3 adds income, bills and subscriptions, then the month's orbit, the forecast and “safe to spend”.</p>
      ${NATIVE ? '<button class="btn ghost" style="margin-top:14px" id="testN">Send a test notification</button>' : ''}</div>`;
  if (NATIVE) $('#testN').onclick = () => {
    if (!NATIVE.notificationsAllowed()) { NATIVE.askNotifications(); return; }
    NATIVE.testNotification('Netflix renews in 3 days', '67 zł from Shared on Sunday. Renewals, bills and trial endings will look like this.', false);
    toast('Sent. Pull down your notifications.');
  };
}

function renderSoon(id, title, text) {
  $(id).innerHTML = `<div class="card soon"><div class="big" style="font-size:26px">${title}</div><p class="sub">${text}</p></div>`;
}

function renderAll() {
  applyLook();
  renderHeader();
  renderToday();
  renderAccounts();
  renderSoon('#vForecast', 'Forecast', 'Each account’s balance for the next 60 days, with an honest likely range, arrives in version 0.3.');
  renderSoon('#vCommit', 'Commitments', 'Subscriptions, bills, trials and the keep-or-cancel rings arrive in version 0.3.');
}
onChange(renderAll);

window.kalendaeResume = () => {
  renderHeader();
  refreshRates().then(changed => { if (changed) renderAll(); });
};

renderAll();
syncNotifConfig();
refreshRates().then(changed => { if (changed) renderAll(); });
if ('serviceWorker' in navigator && !NATIVE && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
