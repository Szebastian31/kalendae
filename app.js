// Kalendae 0.1: the foundation. Shows the icon, checks what this phone allows,
// and sends a test notification through Android (or the browser) to prove the pipeline works.
const NATIVE = window.KalendaeNative || null;
const $ = s => document.querySelector(s);

$('#ico').innerHTML = iconSVG({ size: 116 });

// the daily check: one notification a day, roughly at this time, like Consensus Weather
if (NATIVE) NATIVE.setNotifConfig(JSON.stringify({ enabled: true, time: '09:00', groupTitle: '{n} payments coming up' }));

function checks() {
  const rows = [];
  rows.push(['Running as', NATIVE ? `Android app ${NATIVE.version()}` : 'Web app']);
  const fix = $('#fix');
  fix.style.display = 'none';
  if (NATIVE) {
    const notif = NATIVE.notificationsAllowed();
    rows.push(['Notifications', notif ? 'On' : 'Off', notif]);
    rows.push(['Daily check', notif ? `Around ${NATIVE.notifTime() || '09:00'}` : 'Waiting for notifications', notif]);
    fix.style.display = '';
    if (!notif) { fix.textContent = 'Allow notifications'; fix.onclick = () => NATIVE.askNotifications(); }
    else { fix.textContent = 'Notification settings'; fix.onclick = () => NATIVE.openNotifSettings(); }
  } else {
    const p = 'Notification' in window ? Notification.permission : 'unsupported';
    rows.push(['Notifications', p === 'granted' ? 'On' : p === 'unsupported' ? 'Not available' : 'Off', p === 'granted']);
    rows.push(['Daily check', 'Only in the Android app', false]);
  }
  let saved = false;
  try { localStorage.setItem('kalendae-test', '1'); saved = localStorage.getItem('kalendae-test') === '1'; localStorage.removeItem('kalendae-test'); } catch (e) {}
  rows.push(['Saving on this phone', saved ? 'Works' : 'Blocked', saved]);
  $('#checks').innerHTML = rows.map(([k, v, ok]) =>
    `<div class="row"><span>${k}</span><span class="${ok === undefined ? '' : ok ? 'ok' : 'no'}">${v}</span></div>`).join('');
}

$('#test').onclick = () => {
  const title = 'Netflix renews in 3 days';
  const body = '67 zł from Shared on Sunday. This is a test: renewals, bills and trial endings will look like this.';
  if (NATIVE) {
    if (!NATIVE.notificationsAllowed()) { NATIVE.askNotifications(); $('#msg').textContent = 'Allow notifications first, then tap again.'; return; }
    NATIVE.testNotification(title, body, false);
    NATIVE.vibrate('18');
    $('#msg').textContent = 'Sent. Pull down your notifications to see it.';
    return;
  }
  if (!('Notification' in window)) { $('#msg').textContent = 'This browser can’t show notifications.'; return; }
  Notification.requestPermission().then(p => {
    checks();
    if (p !== 'granted') { $('#msg').textContent = 'Notifications are off for this site.'; return; }
    new Notification(title, { body, icon: 'icons/icon-192.png' });
    $('#msg').textContent = 'Sent.';
  });
};

window.kalendaeResume = checks;
checks();

if ('serviceWorker' in navigator && !NATIVE && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
