// Kalendae data: everything you enter, saved on this phone only (localStorage).
// One object, `S`, is the whole state. Call save() after changing it.
const STORE_KEY = 'kalendae-state';
const SCHEMA = 1;
// ?demo=today|forecast|commit|accounts|spend shows made-up sample data and never saves (for the README screenshots)
const DEMO = (location.search.match(/[?&]demo=(\w+)/) || [])[1] || null;

const ACCOUNT_TYPES = {
  bank:    { label: t('Bank account'), group: t('Banks'), icon: '<rect x="3" y="9" width="18" height="10" rx="1.5"/><path d="M2 9l10-5 10 5M7 12v4M12 12v4M17 12v4"/>' },
  savings: { label: t('Savings'), group: t('Savings & investments'), icon: '<circle cx="12" cy="13" r="7"/><path d="M12 9v8M9.5 11h4a1.5 1.5 0 0 1 0 3h-3a1.5 1.5 0 0 0 0 3h4"/>' },
  invest:  { label: t('Investments'), group: t('Savings & investments'), icon: '<path d="M3 20h18"/><path d="M5 16l5-5 4 3 6-7"/><path d="M16 7h4v4"/>' },
  card:    { label: t('Credit card'), group: t('Banks'), icon: '<rect x="3" y="6" width="18" height="12" rx="2.5"/><path d="M3 10h18M7 15h4"/>' },
  wallet:  { label: t('Wallet app'), group: t('Wallets & e-money'), icon: '<path d="M8 19l2-14h5a4 4 0 0 1 0 8h-4l-1 6z"/>' },
  emoney:  { label: t('E-money'), group: t('Wallets & e-money'), icon: '<circle cx="12" cy="12" r="8"/><path d="M8 12h8M12 8l4 4-4 4"/>' },
  cash:    { label: t('Cash'), group: t('Cash'), icon: '<rect x="2.5" y="7" width="19" height="10" rx="2"/><circle cx="12" cy="12" r="2.5"/><path d="M6 10v4M18 10v4"/>' },
  other:   { label: t('Other'), group: t('Other'), icon: '<circle cx="6" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="18" cy="12" r="1.5"/>' },
};
const GROUP_ORDER = [t('Banks'), t('Wallets & e-money'), t('Cash'), t('Savings & investments'), t('Other')];
const ACCOUNT_COLORS = 12; // --a1 … --a12 in each look
// money you spend day to day; savings, investments and cards stay out of "safe to spend" unless you tick them
const SPEND_TYPES = ['bank', 'wallet', 'emoney', 'cash', 'other'];
// money put aside for later: its value can go up and down (interest, round-ups, the market), and that isn't spending
const GROWTH_TYPES = ['savings', 'invest'];
const isGrowth = a => GROWTH_TYPES.includes(a.type);

function freshState() {
  return {
    schema: SCHEMA,
    created: new Date().toISOString(),
    settings: {
      look: 'night',
      display: 'PLN',
      currencies: ['PLN'],
      notifOn: true,
      notifTime: '09:00',
      mainAcct: null,   // where new bills go by default; null = where most income lands
      floor: 0,         // keep at least this much across your spending money
      floorCur: null,   // the floor's currency; null = the one you show money in
      checkinDay: 0,    // weekly check-in reminder: 0 = Sunday … 6 = Saturday, null = off
    },
    accounts: [],   // a.spend: true/false counts it in "safe to spend" or not; unset = by type (SPEND_TYPES)
                    // a.roundup (savings, investments): { from, mode: 'round' | 'percent', step, times, pct }
    items: [],      // income, bills, subscriptions, moves
    checkins: [],   // weekly balance check-ins
    spends: [],     // purchases logged as you make them (receipt photos live in IndexedDB)
    transfers: [],  // money moved between your accounts right away: { id, d, from, to, amt (in from's currency) }
  };
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return freshState();
    return migrate(JSON.parse(raw));
  } catch (e) {
    return freshState();
  }
}

// Brings older saves (and older backups) up to the current shape.
function migrate(s) {
  const f = freshState();
  s.settings = Object.assign({}, f.settings, s.settings || {});
  s.accounts = Array.isArray(s.accounts) ? s.accounts : [];
  s.items = Array.isArray(s.items) ? s.items : [];
  s.checkins = Array.isArray(s.checkins) ? s.checkins : [];
  s.spends = Array.isArray(s.spends) ? s.spends : [];
  s.transfers = Array.isArray(s.transfers) ? s.transfers : [];
  s.accounts.forEach((a, i) => {
    if (!a.id) a.id = uid();
    if (!ACCOUNT_TYPES[a.type]) a.type = 'other';
    if (typeof a.balance !== 'number') a.balance = parseFloat(a.balance) || 0;
    if (a.color == null) a.color = i % ACCOUNT_COLORS;
    if (a.shared && !a.split) a.split = { mode: 'equal', mine: 50 };
    // savings and investments have no everyday spending (before 1.2 a check-in could learn some from a change in value)
    if (isGrowth(a) && !a.spend) { delete a.everyday; delete a.spendHist; }
  });
  if (!s.settings.currencies.includes(s.settings.display)) s.settings.currencies.unshift(s.settings.display);
  // before 1.0.2 the floor was kept in the one spending account, in its currency
  if (s.settings.floor && !s.settings.floorCur) {
    const old = s.accounts.find(a => a.id === s.settings.mainAcct);
    s.settings.floorCur = old ? old.cur : s.settings.display;
  }
  s.schema = SCHEMA;
  return s;
}

let S = loadState();
const listeners = [];
function onChange(fn) { listeners.push(fn); }
function save() {
  if (!DEMO) try { localStorage.setItem(STORE_KEY, JSON.stringify(S)); } catch (e) { toast(t('Couldn’t save on this phone')); }
  listeners.forEach(fn => fn());
}

function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
const isoDay = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const todayISO = () => isoDay(new Date()); // local date, not UTC

// ---- accounts ----
function accountById(id) { return S.accounts.find(a => a.id === id); }
function liveAccounts() { return S.accounts.filter(a => !a.archived); }
function myShare(a) { return a.shared ? (a.split && a.split.mode === 'percent' ? a.split.mine / 100 : 0.5) : 1; }
// cards hold debt: a positive balance on a card is what you owe
function signedBalance(a) { return a.type === 'card' ? -Math.abs(a.balance) : a.balance; }
const countsToSpend = a => a.spend != null ? !!a.spend : SPEND_TYPES.includes(a.type);

function upsertAccount(a) {
  const i = S.accounts.findIndex(x => x.id === a.id);
  a.balanceAt = a.balanceAt || todayISO();
  if (i >= 0 && S.accounts[i].balance !== a.balance) settleSpends(a.id); // the typed balance already includes logged spends
  if (i < 0) S.accounts.push(a); else S.accounts[i] = a;
  if (!S.settings.currencies.includes(a.cur)) S.settings.currencies.push(a.cur);
  save();
}
function removeAccount(id) {
  S.accounts = S.accounts.filter(a => a.id !== id);
  S.items = S.items.filter(it => it.acct !== id && it.to !== id);
  S.spends.filter(sp => sp.acct === id && sp.receipt).forEach(sp => delReceipt(sp.id));
  S.spends = S.spends.filter(sp => sp.acct !== id);
  S.transfers = S.transfers.filter(x => x.from !== id && x.to !== id);
  S.accounts.forEach(x => { if (x.roundup && x.roundup.from === id) delete x.roundup; });
  save();
}
function currenciesInUse() { return [...new Set(liveAccounts().map(a => a.cur))]; }

// moves money between two of your accounts straight away (both balances change now, like a logged spend)
function transferNow(from, to, amt) {
  const into = conv(amt, from.cur, to.cur);
  from.balance = Math.round((from.balance + (from.type === 'card' ? amt : -amt)) * 100) / 100; // a card stores what you owe
  to.balance = Math.round((to.balance + (to.type === 'card' ? -into : into)) * 100) / 100;
  S.transfers.push({ id: uid(), d: todayISO(), from: from.id, to: to.id, amt });
  S.transfers = S.transfers.slice(-300);
  save();
}

// ---- backup: a file you keep somewhere safe, optionally locked with a password ----
async function deriveKey(password, salt) {
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: 250000, hash: 'SHA-256' }, base,
    { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}
const b64 = buf => {
  const u = new Uint8Array(buf);
  let s = '';
  for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000));
  return btoa(s);
};
const unb64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));

async function makeBackup(password) {
  const payload = JSON.stringify(Object.assign({}, S, { receipts: await allReceipts() })); // receipt photos ride along
  const head = { app: 'kalendae', schema: SCHEMA, exported: new Date().toISOString() };
  if (!password) return JSON.stringify(Object.assign(head, { state: JSON.parse(payload) }));
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(password, salt);
  const data = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(payload));
  return JSON.stringify(Object.assign(head, { locked: true, salt: b64(salt), iv: b64(iv), data: b64(data) }));
}

// Returns the state inside a backup file. Throws 'password' if one is needed or wrong, 'file' if it isn't a backup.
async function readBackup(text, password) {
  let o;
  try { o = JSON.parse(text); } catch (e) { throw new Error('file'); }
  if (!o || o.app !== 'kalendae') throw new Error('file');
  if (!o.locked) return migrate(o.state);
  if (!password) throw new Error('password');
  try {
    const key = await deriveKey(password, unb64(o.salt));
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(o.iv) }, key, unb64(o.data));
    return migrate(JSON.parse(new TextDecoder().decode(plain)));
  } catch (e) {
    throw new Error('password');
  }
}
function replaceState(next) { S = next; save(); }
function wipeAll() { localStorage.removeItem(STORE_KEY); clearReceipts(); S = freshState(); save(); }
