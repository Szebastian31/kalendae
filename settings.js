// Settings: look, currencies, notifications, backup, and deleting everything.
const LOOKS = {
  night: ['Night', 'linear-gradient(#070d26,#2b3d7e)', '#eef3ff'],
  dawn: ['Dawn', 'linear-gradient(#2a1b6a,#77479a 60%,#e0828e)', '#f4f0ff'],
  paper: ['Paper', 'linear-gradient(#f7f1e6,#ecdcca)', '#22182e'],
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
  const html = `<h2>Settings</h2><p class="lead">Everything here is saved on this phone only.</p>

    <div class="field"><label>Look</label><div class="looks" id="sLook">${Object.entries(LOOKS).map(([k, [n, bg, fg]]) =>
      `<button data-k="${k}" class="${k === st.look ? 'on' : ''}" style="background:${bg};color:${fg}">${n}</button>`).join('')}</div></div>

    <div class="field"><label>Show budgets in</label><div class="chips" id="sDisp">${st.currencies.map(c =>
      `<button class="chip ${c === st.display ? 'on' : ''}" data-c="${c}">${c}</button>`).join('')}</div></div>

    <div class="field"><label>Currencies you use</label>
      <div class="chips" id="sCurs">${Object.keys(CURRENCIES).map(c =>
        `<button class="chip ${st.currencies.includes(c) ? 'on' : ''} ${locked.includes(c) ? 'lock' : ''}" data-c="${c}" title="${CURRENCIES[c][0]}">${c}</button>`).join('')}</div>
      <p class="sub" style="margin-top:8px">A dot means an account uses it, so it stays on. ${esc(ratesNote())}</p>
      <button class="btn ghost" style="margin-top:8px;padding:8px 12px;font-size:13px" id="sRates">Update rates now</button></div>

    <div class="card" style="padding:12px 16px">
      <div class="tog"><div>Daily notification<small>${NATIVE ? 'Renewals, bills and trial endings, a few days ahead' : 'Only in the Android app'}</small></div>
        <button class="sw-t ${st.notifOn ? 'on' : ''}" id="sNotif" ${NATIVE ? '' : 'disabled'}></button></div>
      <div class="tog"><div>Around<small>Android sends it within a few minutes of this</small></div>
        <input class="input num" id="sTime" type="time" value="${st.notifTime}" style="width:118px;padding:8px 10px" ${NATIVE ? '' : 'disabled'}></div>
      ${NATIVE ? `<div class="tog"><div>Notifications on this phone<small>${allowed ? 'Allowed' : 'Not allowed yet'}</small></div>
        <button class="btn ghost" style="padding:8px 12px;font-size:13px" id="sPerm">${allowed ? 'Settings' : 'Allow'}</button></div>` : ''}
    </div>

    <div class="field"><label>Backup</label>
      <p class="sub">Kalendae has no account, so this file is how you move to a new phone. Keep it somewhere safe, like your cloud drive.</p>
      <div class="row2"><button class="btn" id="sExport">Save a backup</button><button class="btn ghost" id="sImport">Restore</button></div></div>

    <div class="field"><label>Start over</label><button class="btn danger wide" id="sWipe">Delete everything on this phone</button></div>
    <p class="honest">Kalendae ${NATIVE ? NATIVE.version() : 'web'} · the only thing it downloads is the exchange-rate table from the National Bank of Poland.</p>`;

  openSheet(html, body => {
    $$('#sLook button', body).forEach(b => b.onclick = () => { st.look = b.dataset.k; save(); settingsSheet(); });
    $$('#sDisp button', body).forEach(b => b.onclick = () => { st.display = b.dataset.c; save(); settingsSheet(); });
    $$('#sCurs button', body).forEach(b => b.onclick = () => {
      const c = b.dataset.c;
      if (st.currencies.includes(c)) {
        if (locked.includes(c)) { toast(`${CURRENCIES[c][0]} is used by an account`); return; }
        if (st.currencies.length === 1) { toast('Keep at least one currency'); return; }
        st.currencies = st.currencies.filter(x => x !== c);
        if (st.display === c) st.display = st.currencies[0];
      } else st.currencies.push(c);
      save(); settingsSheet();
    });
    $('#sRates', body).onclick = async () => {
      toast('Downloading rates…');
      const ok = await refreshRates(true);
      toast(ok ? 'Rates updated' : 'Couldn’t reach the National Bank of Poland');
      if (ok) { save(); settingsSheet(); }
    };
    if (NATIVE) {
      $('#sNotif', body).onclick = () => { st.notifOn = !st.notifOn; save(); syncNotifConfig(); settingsSheet(); };
      $('#sTime', body).onchange = e => { st.notifTime = e.target.value || '09:00'; save(); syncNotifConfig(); toast(`Daily notification around ${st.notifTime}`); };
      $('#sPerm', body).onclick = () => allowed ? NATIVE.openNotifSettings() : NATIVE.askNotifications();
    }
    $('#sExport', body).onclick = exportBackup;
    $('#sImport', body).onclick = () => $('#filePick').click();
    $('#sWipe', body).onclick = async () => {
      const ok = await confirmSheet('Delete everything?', 'All accounts, bills and settings on this phone are removed. Save a backup first if you might want them back.', 'Delete everything', true);
      if (ok) { wipeAll(); toast('Everything deleted'); }
    };
  });
}

function syncNotifConfig() {
  if (NATIVE) NATIVE.setNotifConfig(JSON.stringify({ enabled: S.settings.notifOn, time: S.settings.notifTime, groupTitle: '{n} payments coming up' }));
}

// ---- backup ----
async function exportBackup() {
  const pw = await promptSheet('Lock the backup?', 'Add a password so nobody else can open the file. Leave it empty to save it unlocked. There’s no way to recover a forgotten password.',
    { type: 'password', placeholder: 'Password (optional)', ok: 'Save backup' });
  if (pw === null) return;
  const text = await makeBackup(pw.trim());
  const name = `kalendae-backup-${todayISO()}.json`;
  if (NATIVE) { NATIVE.saveFile(name, text); return; }
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  toast('Backup saved');
}
window.kalendaeSaved = ok => toast(ok ? 'Backup saved' : 'Backup not saved');

$('#filePick').onchange = async e => {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file) return;
  const text = await file.text();
  let next = null, pw = '';
  for (let tries = 0; tries < 3 && !next; tries++) {
    try { next = await readBackup(text, pw); }
    catch (err) {
      if (err.message === 'file') { toast('That isn’t a Kalendae backup'); return; }
      pw = await promptSheet(tries ? 'Wrong password' : 'This backup is locked', 'Type the password you chose when you saved it.', { type: 'password', ok: 'Open' });
      if (pw === null) return;
    }
  }
  if (!next) { toast('Couldn’t open the backup'); return; }
  const n = next.accounts.length;
  const ok = await confirmSheet('Restore this backup?', `It has ${n} account${n === 1 ? '' : 's'}. Everything currently on this phone is replaced.`, 'Restore');
  if (ok) { replaceState(next); syncNotifConfig(); toast('Backup restored'); }
};
