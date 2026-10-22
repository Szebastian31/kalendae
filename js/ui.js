// Small shared helpers: elements, escaping, sheets, toasts, haptics.
const NATIVE = window.KalendaeNative || null;
const $ = (s, root = document) => root.querySelector(s);
const $$ = (s, root = document) => [...root.querySelectorAll(s)];
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const svg = paths => `<svg class="sv" viewBox="0 0 24 24">${paths}</svg>`;
const accColor = a => `var(--a${(a.color % ACCOUNT_COLORS) + 1})`;

function tick(ms = '14') {
  if (NATIVE) NATIVE.vibrate(String(ms)); else if (navigator.vibrate) navigator.vibrate(+ms);
}

let toastTimer;
function toast(text) {
  const t = $('#toast');
  t.textContent = text;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2400);
}

// ---- bottom sheet (one at a time; a second one replaces the first) ----
let sheetClose = null;
function openSheet(html, mount, onClose) {
  const prev = sheetClose; sheetClose = null;
  if (prev) prev();
  $('#sheetBody').innerHTML = html;
  $('#sheet').scrollTop = 0;
  $('#scrim').classList.add('show');
  $('#sheet').classList.add('show');
  sheetClose = onClose || null;
  if (mount) mount($('#sheetBody'));
}
function closeSheet() {
  if (!$('#sheet').classList.contains('show')) return false;
  $('#sheet').classList.remove('show');
  $('#scrim').classList.remove('show');
  const fn = sheetClose; sheetClose = null;
  if (fn) fn();
  return true;
}
$('#scrim').onclick = closeSheet;

// Android back button: close a sheet first, then go back to Today, then leave the app.
window.kalendaeBack = () => {
  const viewer = document.querySelector(".viewer"); if (viewer) { viewer.remove(); return true; }
  if (closeSheet()) return true;
  if (CURRENT_TAB !== 'today') { showTab('today'); return true; }
  return false;
};

// a confirmation sheet; resolves true/false
function confirmSheet(title, text, yes = t('Yes'), danger = false) {
  return new Promise(res => {
    let answered = false;
    openSheet(`<h2>${esc(title)}</h2><p class="lead">${text}</p>
      <div class="row2"><button class="btn ghost" data-a="no">${t('Cancel')}</button><button class="btn ${danger ? 'danger' : ''}" data-a="yes">${esc(yes)}</button></div>`,
      body => $$('[data-a]', body).forEach(b => b.onclick = () => { answered = true; closeSheet(); res(b.dataset.a === 'yes'); }),
      () => { if (!answered) res(false); });
  });
}

// asks for one line of text (e.g. a backup password); resolves the text or null
function promptSheet(title, text, opts = {}) {
  return new Promise(res => {
    let done = false;
    openSheet(`<h2>${esc(title)}</h2><p class="lead">${text}</p>
      <input class="input" id="pIn" type="${opts.type || 'text'}" placeholder="${esc(opts.placeholder || '')}" autocomplete="off">
      <div class="row2"><button class="btn ghost" data-a="no">${esc(opts.cancel || t('Cancel'))}</button><button class="btn" data-a="yes">${esc(opts.ok || t('OK'))}</button></div>`,
      body => {
        const inp = $('#pIn', body);
        setTimeout(() => inp.focus(), 300);
        $$('[data-a]', body).forEach(b => b.onclick = () => { done = true; const v = inp.value; closeSheet(); res(b.dataset.a === 'yes' ? v : null); });
      },
      () => { if (!done) res(null); });
  });
}

function dateLong(d = new Date()) {
  return d.toLocaleDateString(LOCALE, { weekday: 'long', day: 'numeric', month: 'long' });
}
function agoText(iso) {
  if (!iso) return '';
  const days = Math.round((new Date(todayISO()) - new Date(iso)) / 864e5);
  return days <= 0 ? t('today') : days === 1 ? t('yesterday') : days < 7 ? tn(days, '{n} day ago', '{n} days ago') : new Date(iso).toLocaleDateString(LOCALE, { day: 'numeric', month: 'short' });
}
