// Settings: language, look, currencies, notifications, backup, sample data, and deleting everything.
const LOOKS = {
  night: [t('Night'), 'linear-gradient(#070d26,#2b3d7e)', '#eef3ff'],
  dawn: [t('Dawn'), 'linear-gradient(#2a1b6a,#77479a 60%,#e0828e)', '#f4f0ff'],
  paper: [t('Paper'), 'linear-gradient(#f7f1e6,#ecdcca)', '#22182e'],
};

function applyLook() {
  document.documentElement.dataset.look = S.settings.look;
  const top = getComputedStyle(document.documentElement).getPropertyValue('--sky-top').trim();
  $('meta[name=theme-color]').setAttribute('content', top);
}

function settingsSheet() {
  const st = S.settings;
  const locked = currenciesInUse();
  const allowed = NATIVE ? NATIVE.notificationsAllowed() : ('Notification' in window && Notification.permission === 'granted');
  const html = `<h2>${t('Settings')}</h2><p class="lead">${t('Everything here is saved on this phone only.')}</p>

    <div class="field"><label>${t('Language')}</label><select class="input" id="sLang">${Object.entries(LANGS).map(([k, [n]]) =>
      `<option value="${k}" ${k === LANG ? 'selected' : ''}>${n}</option>`).join('')}</select></div>

    <div class="field"><label>${t('Look')}</label><div class="looks" id="sLook">${Object.entries(LOOKS).map(([k, [n, bg, fg]]) =>
      `<button data-k="${k}" class="${k === st.look ? 'on' : ''}" style="background:${bg};color:${fg}">${n}</button>`).join('')}</div></div>

    <div class="field"><label>${t('Show budgets in')}</label><div class="chips" id="sDisp">${st.currencies.map(c =>
      `<button class="chip ${c === st.display ? 'on' : ''}" data-c="${c}">${c}</button>`).join('')}</div></div>

    <div class="field"><label>${t('Currencies you use')}</label>
      <div class="chips" id="sCurs">${Object.keys(CURRENCIES).map(c =>
        `<button class="chip ${st.currencies.includes(c) ? 'on' : ''} ${locked.includes(c) ? 'lock' : ''}" data-c="${c}" title="${esc(curName(c))}">${c}</button>`).join('')}</div>
      <p class="sub" style="margin-top:8px">${t('A dot means an account uses it, so it stays on.')} ${esc(ratesNote())}</p>
      <button class="btn ghost" style="margin-top:8px;padding:8px 12px;font-size:13px" id="sRates">${t('Update rates now')}</button></div>

    <div class="card" style="padding:12px 16px">
      <div class="tog"><div>${t('Daily notification')}<small>${NATIVE ? t('Renewals, bills and trial endings, a few days ahead') : t('Only in the Android app')}</small></div>
        <button class="sw-t ${st.notifOn ? 'on' : ''}" id="sNotif" ${NATIVE ? '' : 'disabled'}></button></div>
      <div class="tog"><div>${t('Around')}<small>${t('Android sends it within a few minutes of this')}</small></div>
        <input class="input num" id="sTime" type="time" value="${st.notifTime}" style="width:118px;padding:8px 10px" ${NATIVE ? '' : 'disabled'}></div>
      ${NATIVE ? `<div class="tog"><div>${t('Notifications on this phone')}<small>${allowed ? t('Allowed') : t('Not allowed yet')}</small></div>
        <button class="btn ghost" style="padding:8px 12px;font-size:13px" id="sPerm">${allowed ? t('Settings') : t('Allow')}</button></div>` : ''}
      <div class="tog"><div>${t('Weekly check-in')}<small>${t('A reminder to type your balances')}</small></div>
        <select class="input" id="sCheck" style="width:138px;padding:8px 10px">${['off'].concat(WEEKDAYS.map((_, i) => i)).map(v =>
          `<option value="${v}" ${(v === 'off' ? st.checkinDay == null : +v === st.checkinDay) ? 'selected' : ''}>${v === 'off' ? t('Off') : WEEKDAYS[v]}</option>`).join('')}</select></div>
    </div>

    <div class="field"><label>${t('Backup')}</label>
      <p class="sub">${t('Kalendae has no account, so this file is how you move to a new phone. Keep it somewhere safe, like your cloud drive.')}</p>
      <div class="row2"><button class="btn" id="sExport">${t('Save a backup')}</button><button class="btn ghost" id="sImport">${t('Restore')}</button></div></div>

    <div class="field"><label>${t('Try it out')}</label>
      <p class="sub">${t('Fills Kalendae with a made-up month (accounts in three currencies, bills, subscriptions and a trial) so you can see every screen. Your own data is replaced, so save a backup first.')}</p>
      <button class="btn ghost wide" style="margin-top:8px" id="sDemo">${t('Load sample data')}</button></div>

    <div class="field"><label>${t('Start over')}</label><button class="btn danger wide" id="sWipe">${t('Delete everything on this phone')}</button></div>
    <p class="honest">${t('Kalendae {v} · the only thing it downloads is the exchange-rate table from the National Bank of Poland.', { v: NATIVE ? NATIVE.version() : 'web' })}</p>`;

  openSheet(html, body => {
    $('#sLang', body).onchange = e => setLanguage(e.target.value);
    $$('#sLook button', body).forEach(b => b.onclick = () => { st.look = b.dataset.k; save(); settingsSheet(); });
    $$('#sDisp button', body).forEach(b => b.onclick = () => { st.display = b.dataset.c; save(); settingsSheet(); });
    $$('#sCurs button', body).forEach(b => b.onclick = () => {
      const c = b.dataset.c;
      if (st.currencies.includes(c)) {
        if (locked.includes(c)) { toast(t('{c} is used by an account', { c: curName(c) })); return; }
        if (st.currencies.length === 1) { toast(t('Keep at least one currency')); return; }
        st.currencies = st.currencies.filter(x => x !== c);
        if (st.display === c) st.display = st.currencies[0];
      } else st.currencies.push(c);
      save(); settingsSheet();
    });
    $('#sRates', body).onclick = async () => {
      toast(t('Downloading rates…'));
      const ok = await refreshRates(true);
      toast(ok ? t('Rates updated') : t('Couldn’t reach the National Bank of Poland'));
      if (ok) { save(); settingsSheet(); }
    };
    if (NATIVE) {
      $('#sNotif', body).onclick = () => { st.notifOn = !st.notifOn; save(); syncNotifConfig(); settingsSheet(); };
      $('#sTime', body).onchange = e => { st.notifTime = e.target.value || '09:00'; save(); syncNotifConfig(); toast(t('Daily notification around {time}', { time: st.notifTime })); };
      $('#sPerm', body).onclick = () => allowed ? NATIVE.openNotifSettings() : NATIVE.askNotifications();
    }
    $('#sCheck', body).onchange = e => {
      st.checkinDay = e.target.value === 'off' ? null : +e.target.value; save();
      toast(st.checkinDay == null ? t('Check-in reminder off') : t('Check-in reminder on {day}', { day: WEEKDAYS[st.checkinDay] }));
    };
    $('#sExport', body).onclick = exportBackup;
    $('#sImport', body).onclick = () => $('#filePick').click();
    $('#sDemo', body).onclick = async () => {
      const ok = await confirmSheet(t('Load sample data?'), t('Everything currently on this phone is replaced with a made-up month. Delete everything later to start fresh.'), t('Load it'));
      if (ok) { replaceState(sampleState()); toast(t('Sample data loaded')); showTab('today'); }
    };
    $('#sWipe', body).onclick = async () => {
      const ok = await confirmSheet(t('Delete everything?'), t('All accounts, bills and settings on this phone are removed. Save a backup first if you might want them back.'), t('Delete everything'), true);
      if (ok) { wipeAll(); toast(t('Everything deleted')); }
    };
  });
}

function syncNotifConfig() {
  if (NATIVE) NATIVE.setNotifConfig(JSON.stringify({ enabled: S.settings.notifOn, time: S.settings.notifTime, groupTitle: t('{n} things coming up') }));
}

// ---- backup ----
async function exportBackup() {
  const pw = await promptSheet(t('Lock the backup?'), t('Add a password so nobody else can open the file. Leave it empty to save it unlocked. There’s no way to recover a forgotten password.'),
    { type: 'password', placeholder: t('Password (optional)'), ok: t('Save backup') });
  if (pw === null) return;
  const text = await makeBackup(pw.trim());
  const name = `kalendae-backup-${todayISO()}.json`;
  if (NATIVE) { NATIVE.saveFile(name, text); return; }
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  toast(t('Backup saved'));
}
window.kalendaeSaved = ok => toast(ok ? t('Backup saved') : t('Backup not saved'));

$('#filePick').onchange = async e => {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file) return;
  const text = await file.text();
  let next = null, pw = '';
  for (let tries = 0; tries < 3 && !next; tries++) {
    try { next = await readBackup(text, pw); }
    catch (err) {
      if (err.message === 'file') { toast(t('That isn’t a Kalendae backup')); return; }
      pw = await promptSheet(tries ? t('Wrong password') : t('This backup is locked'), t('Type the password you chose when you saved it.'), { type: 'password', ok: t('Open') });
      if (pw === null) return;
    }
  }
  if (!next) { toast(t('Couldn’t open the backup')); return; }
  const n = next.accounts.length;
  const ok = await confirmSheet(t('Restore this backup?'), tn(n, 'It has {n} account. Everything currently on this phone is replaced.', 'It has {n} accounts. Everything currently on this phone is replaced.'), t('Restore'));
  if (ok) { replaceState(next); syncNotifConfig(); toast(t('Backup restored')); }
};

// ---- sample data: a made-up month, for trying Kalendae and for screenshots ----
function sampleState() {
  const s = freshState();
  s.settings = Object.assign(s.settings, { look: S.settings.look, display: 'PLN', currencies: ['PLN', 'EUR', 'USD'], floor: 500 });
  const d = n => isoDay(addDays(day0(), n));
  const dom = day => { const x = day0(); let y = new Date(x.getFullYear(), x.getMonth(), day); if (y <= x) y = new Date(x.getFullYear(), x.getMonth() + 1, day); return isoDay(y); };
  const A = (id, name, type, cur, balance, color, extra) => Object.assign({ id, name, type, provider: '', cur, balance, color, balanceAt: d(-3), shared: false, split: { mode: 'equal', mine: 50 } }, extra);
  s.accounts = [
    A('per', t('Personal'), 'bank', 'PLN', 4650, 0, { provider: 'mBank', everyday: 2600, spendHist: [78, 96, 81, 90] }),
    A('sh', t('Home'), 'bank', 'PLN', 2140, 1, { provider: 'ING Bank Śląski', shared: true, partner: 'Ola', everyday: 2100 }),
    A('sav', t('Buffer'), 'savings', 'PLN', 9200, 2, { provider: 'mBank' }),
    A('rev', 'Revolut', 'emoney', 'EUR', 420, 3, { provider: 'Revolut', everyday: 90 }),
    A('pp', 'PayPal', 'wallet', 'USD', 312, 4, { provider: 'PayPal' }),
    A('cash', t('Cash'), 'cash', 'PLN', 260, 5, { provider: t('Wallet'), everyday: 360 }),
  ];
  const I = (name, kind, amount, acct, start, extra) => Object.assign({ id: uid(), name, kind, amount, acct, start, repeat: 'month', trial: false, varies: false, paused: false }, extra);
  s.items = [
    I(t('Salary'), 'income', 8400, 'per', dom(10)),
    I(t('To shared account'), 'move', 2500, 'per', dom(10), { to: 'sh', inName: t('From {a}', { a: t('Personal') }) }),
    I(t('To savings'), 'move', 1200, 'per', dom(10), { to: 'sav', inName: t('From {a}', { a: t('Personal') }) }),
    I(t('Investing'), 'move', 150, 'per', dom(11), { to: null, cur: 'USD' }),
    I(t('Cash withdrawal'), 'move', 300, 'per', dom(12), { to: 'cash', inName: t('From {a}', { a: t('Personal') }) }),
    I('Ola', 'income', 2500, 'sh', dom(28)),
    I(t('Freelance'), 'income', 450, 'pp', dom(15), { varies: true }),
    I(t('Rent'), 'bill', 3600, 'sh', dom(1)),
    I(t('Internet'), 'bill', 69, 'sh', dom(5)),
    I(t('Electricity'), 'bill', 210, 'sh', dom(15), { varies: true }),
    I(t('Phone'), 'bill', 55, 'per', dom(12)),
    I(t('Car insurance'), 'bill', 1240, 'per', d(6), { repeat: 'year' }),
    I('Netflix', 'sub', 67, 'sh', dom(24), { usage: 'monthly', prices: [{ d: d(-200), v: 60 }, { d: d(-20), v: 67 }], altMonthly: 33 }),
    I('Spotify Duo', 'sub', 37.99, 'sh', dom(2), { usage: 'daily' }),
    I('YouTube Premium', 'sub', 29.99, 'per', dom(18), { usage: 'weekly' }),
    I(t('Gym'), 'sub', 159, 'per', dom(3), { usage: 'weekly', alt: 1668 }),
    I('iCloud+ 200 GB', 'sub', 11.99, 'per', dom(27), { usage: 'daily' }),
    I('Lightroom', 'sub', 54.99, 'per', dom(26), { usage: 'never', alt: 539 }),
    I('Proton Mail', 'sub', 4.99, 'rev', dom(30), { usage: 'daily' }),
    I('Duolingo Max', 'sub', 239.99, 'per', d(3), { repeat: 'year', trial: true }),
  ];
  return s;
}
