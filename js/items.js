// Plans: income, bills, subscriptions and moves between accounts,
// and the maths that turns them into a day-by-day forecast and "safe to spend".
// An item: { id, kind, name, amount (positive, in its account's currency), acct, to (moves only),
//            start (next date, yyyy-mm-dd), repeat (see REPEATS), trial (sub: start = when the trial ends),
//            varies (amount is an average), paused, note,
//            until (last day it runs: a cancelled subscription is paid up to here), cancelled (the day you cancelled),
//            actuals ([{ d, v }]: what a bill that changes really came to, newest last) }
const KINDS = {
  income: { one: t('Income'), many: t('Income'), sign: 1, icon: '<path d="M12 19V5M6 11l6-6 6 6"/>' },
  bill:   { one: t('Bill'), many: t('Bills'), sign: -1, icon: '<path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/><path d="M9 8h6M9 12h6"/>' },
  sub:    { one: t('Subscription'), many: t('Subscriptions'), sign: -1, icon: '<path d="M4 12a8 8 0 0 1 14-5.3M20 12a8 8 0 0 1-14 5.3"/><path d="M18 3v4h-4M6 21v-4h4"/>' },
  move:   { one: t('Move'), many: t('Moves between accounts'), sign: -1, icon: '<path d="M4 8h14l-3-3M20 16H6l3 3"/>' },
};
const REPEATS = {
  week: [t('Every week'), 'week', 1], week2: [t('Every 2 weeks'), 'week', 2], week4: [t('Every 4 weeks'), 'week', 4],
  month: [t('Every month'), 'month', 1], month2: [t('Every 2 months'), 'month', 2], month3: [t('Every 3 months'), 'month', 3],
  month6: [t('Every 6 months'), 'month', 6], year: [t('Every year'), 'year', 1], once: [t('Only once'), 'once', 0],
};
const HORIZON = 60;

const SUGGEST = {
  income: [t('Salary'), t('Freelance'), t('Side job'), t('Pension'), t('Benefits'), t('Child benefit (800+)'), t('Rent from tenants'), t('Allowance'), t('Bonus'), t('Dividends')],
  bill: [t('Rent'), t('Mortgage'), t('Electricity'), t('Gas'), t('Water'), t('Heating'), t('Internet'), t('Phone'), t('Insurance'), t('Car insurance'), t('Home insurance'), t('Loan'), t('Car loan'), t('Credit card'), t('Childcare'), t('School'), t('Council tax'), t('Housing fees'), t('TV licence'), t('Parking')],
  sub: ['Netflix', 'Spotify', 'YouTube Premium', 'Disney+', 'Max', 'Amazon Prime', 'Apple One', 'Apple Music', 'iCloud+', 'Google One', 'ChatGPT Plus', 'Claude Pro', 'Microsoft 365', 'Adobe Creative Cloud', 'Lightroom', 'Canva Pro', 'Figma', 'Notion', 'Duolingo', 'Xbox Game Pass', 'PlayStation Plus', 'Nintendo Switch Online', 'Audible', 'Kindle Unlimited', 'Tidal', 'Deezer', 'Canal+', 'Player', 'SkyShowtime', t('Gym'), t('Patreon'), 'Dropbox', 'Proton', 'NordVPN', '1Password', 'Strava', 'Headspace', 'LinkedIn Premium', 'Uber One', 'Bolt Plus'],
  move: [t('To savings'), t('To shared account'), t('Investing'), t('Cash withdrawal'), t('Holiday pot'), t('Emergency fund'), t('Credit card payment')],
};

// ---- dates ----
const day0 = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };
const fromISO = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const daysBetween = (a, b) => Math.round((b - a) / 864e5);
function stepDate(d, unit, every, anchorDay) {
  if (unit === 'week') return addDays(d, 7 * every);
  const months = unit === 'year' ? 12 * every : every;
  const y = d.getFullYear(), m = d.getMonth() + months;
  return new Date(y, m, Math.min(anchorDay, new Date(y, m + 1, 0).getDate())); // 31st → 28/29/30 in short months
}

// the day offsets from today (fromDay … n) when an item lands
function occurrences(it, n, fromDay = 0) {
  const out = [];
  if (!it.start || it.paused) return out;
  const t0 = day0();
  const [, unit, every] = REPEATS[it.repeat] || REPEATS.month;
  let d = fromISO(it.start);
  const anchor = d.getDate();
  const end = it.until ? fromISO(it.until) : null; // cancelled: nothing after the last paid day
  if (unit === 'once') { const k = daysBetween(t0, d); if (k >= fromDay && k <= n && !(end && d > end)) out.push(k); return out; }
  for (let g = 0; g < 4000 && daysBetween(t0, d) < fromDay; g++) d = stepDate(d, unit, every, anchor);
  for (let g = 0; g < 400; g++) {
    const k = daysBetween(t0, d);
    if (k > n || (end && d > end)) break;
    out.push(k);
    d = stepDate(d, unit, every, anchor);
  }
  return out;
}
const nextIn = (it, max = 800) => { const o = occurrences(it, max, 0); return o.length ? o[0] : null; };
const dateIn = k => addDays(day0(), k);
const isTrialNow = it => it.kind === 'sub' && it.trial && !it.until && nextIn(it) != null && fromISO(it.start) >= day0();
// a subscription you've cancelled: still running until `until`, then ended
const isCancelled = it => !!it.until;
const hasEnded = it => !!it.until && it.until < todayISO();

// what an item costs (or brings) per month, in its own currency
function perMonth(it) {
  if (it.paused || it.until) return 0;
  const [, unit, every] = REPEATS[it.repeat] || REPEATS.month;
  if (unit === 'once') return 0;
  return it.amount * (unit === 'week' ? 52 / 12 / every : unit === 'year' ? 1 / 12 / every : 1 / every);
}
// the currency the amount is in: chosen on moves (e.g. 500 USD to investing from a PLN account), else the account's
const itemCur = it => it.cur || (accountById(it.acct) || {}).cur || S.settings.display;
const liveItems = () => S.items.filter(it => accountById(it.acct) && !accountById(it.acct).archived);

function upsertItem(it) {
  const i = S.items.findIndex(x => x.id === it.id);
  if (i < 0) S.items.push(it); else S.items[i] = it;
  save();
}
function removeItem(id) { S.items = S.items.filter(it => it.id !== id); save(); }

// everyday spending per day, in the display currency
const dailySpend = a => a && a.everyday ? conv(a.everyday / 30.44, a.cur) : 0;

// What a bill is expected to be on day k. One that changes with the seasons (heating, electricity) uses the
// bill you logged around the same date last year, so winter isn't planned at the summer price; otherwise your average.
function amountOn(it, k) {
  if (!it.varies || !it.actuals || !it.actuals.length) return it.amount;
  const d = dateIn(k), ago = new Date(d.getFullYear() - 1, d.getMonth(), d.getDate());
  const near = it.actuals.filter(x => Math.abs(daysBetween(fromISO(x.d), ago)) <= 16);
  return near.length ? near[near.length - 1].v : it.amount;
}

// ---- forecast: balance per day for one account or several, in the display currency ----
function forecast(ids, n = HORIZON) {
  const set = new Set(ids);
  const many = ids.length > 1;
  const today = todayISO();
  const w = a => many ? myShare(a) : 1;   // in "everything", count only your part of shared accounts
  const ev = Array.from({ length: n + 1 }, () => []);
  liveItems().forEach(it => {
    const src = accountById(it.acct);
    const dst = it.kind === 'move' && it.to ? accountById(it.to) : null;
    const inSrc = set.has(src.id), inDst = !!dst && set.has(dst.id);
    if (!inSrc && !inDst) return;
    if (inSrc && inDst && w(src) === w(dst)) return; // a move between your own accounts isn't spending
    const v = k => conv(amountOn(it, k), itemCur(it)) * KINDS[it.kind].sign;
    occurrences(it, n, 0).forEach(k => {
      if (inSrc && !(k === 0 && src.balanceAt >= today)) ev[k].push({ it, a: v(k) * w(src), name: it.name, acct: src });
      if (inDst && !(k === 0 && dst.balanceAt >= today)) ev[k].push({ it, a: -v(k) * w(dst), name: it.inName || t('From {a}', { a: src.name }), acct: dst });
    });
  });
  const accts = ids.map(accountById).filter(Boolean);
  let bal = accts.reduce((s, a) => s + conv(signedBalance(a), a.cur) * w(a), 0);
  const mean = accts.reduce((s, a) => s + dailySpend(a) * w(a), 0);
  const sd = Math.sqrt(accts.reduce((s, a) => s + (dailySpread(a) * w(a)) ** 2, 0)); // learned from check-ins
  const fx = accts.reduce((s, a) => s + (a.cur === S.settings.display ? 0 : Math.abs(conv(a.balance, a.cur)) * w(a) * rateSpread(a.cur) / 100), 0);
  const out = [];
  for (let t = 0; t <= n; t++) {
    if (t > 0) bal -= mean;
    ev[t].forEach(e => bal += e.a);
    const s = 1.28 * sd * Math.sqrt(t) + fx * Math.sqrt(t / 30);
    out.push({ t, date: dateIn(t), mid: bal, lo: bal - s, hi: bal + s, ev: ev[t] });
  }
  return out;
}
const lowestPoint = f => f.slice(1).reduce((m, p) => (p.mid < m.mid ? p : m), f[1] || f[0]);

// ---- your spending money: every bank, wallet, e-money and cash account added together ----
// Savings, investments and cards stay out unless you tick them, so a move into savings counts as set aside.
function spendingAccounts() {
  const live = liveAccounts();
  const pool = live.filter(countsToSpend);
  if (pool.length) return pool;
  const one = live.find(a => a.type !== 'card') || live[0];
  return one ? [one] : [];
}
// the cushion "safe to spend" never touches, in the display currency
const spendFloor = () => conv(S.settings.floor || 0, S.settings.floorCur || S.settings.display);

// the account most of your income lands in (and where new bills go by default)
function mainAccount() {
  const pool = spendingAccounts();
  const chosen = S.settings.mainAcct && accountById(S.settings.mainAcct);
  if (chosen && !chosen.archived && pool.includes(chosen)) return chosen;
  const by = {};
  liveItems().filter(it => it.kind === 'income' && pool.some(a => a.id === it.acct)).forEach(it => { by[it.acct] = (by[it.acct] || 0) + conv(perMonth(it), itemCur(it)); });
  const best = Object.entries(by).sort((x, y) => y[1] - x[1])[0];
  if (best) return accountById(best[0]);
  const live = liveAccounts();
  return pool.find(a => a.type === 'bank') || pool[0] || live.find(a => a.type !== 'card') || live[0] || null;
}
// the next day (from … max) that income lands in this account
function nextPayday(a, from = 1, max = 62) {
  let best = null;
  liveItems().forEach(it => {
    if (it.kind !== 'income' || it.acct !== a.id) return;
    const k = occurrences(it, max, from)[0];
    if (k != null && (best == null || k < best)) best = k;
  });
  return best;
}
// your payday: when your main income next arrives, else the first income into any spending account
function poolPayday(pool, from = 1, max = 62) {
  const main = mainAccount();
  const k = main && pool.includes(main) ? nextPayday(main, from, max) : null;
  if (k != null) return k;
  return pool.reduce((best, a) => { const x = nextPayday(a, from, max); return x != null && (best == null || x < best) ? x : best; }, null);
}
function safeToSpend() {
  const pool = spendingAccounts();
  if (!pool.length) return null;
  const ids = pool.map(a => a.id);
  const w = a => ids.length > 1 ? myShare(a) : 1; // only your part of shared accounts, as in the forecast
  const payT = poolPayday(pool);
  const until = payT || 30;
  const f = forecast(ids, until);
  let committed = 0;
  for (let k = 0; k < until; k++) f[k].ev.forEach(e => committed += e.a);
  const start = pool.reduce((s, a) => s + conv(signedBalance(a), a.cur) * w(a), 0);
  const floor = spendFloor();
  const safe = start + committed - floor;
  const daily = pool.reduce((s, a) => s + dailySpend(a) * w(a), 0);
  return { acct: mainAccount() || pool[0], accts: pool, payT, until, safe, perDay: safe / until, fun: safe - daily * until, daily,
    committed: -committed, floor, noIncome: payT == null };
}

// what your next payday is planned for, across your spending money
function paydayPlan() {
  const pool = spendingAccounts();
  if (!pool.length) return null;
  const ids = new Set(pool.map(a => a.id));
  const w = a => pool.length > 1 ? myShare(a) : 1;
  const p1 = poolPayday(pool);
  if (p1 == null) return null;
  const p2 = poolPayday(pool, p1 + 1, p1 + 62) || p1 + 30;
  const incomeItems = liveItems().filter(it => it.kind === 'income' && ids.has(it.acct) && occurrences(it, p1, p1).length);
  const income = incomeItems.reduce((s, it) => s + conv(it.amount, itemCur(it)) * w(accountById(it.acct)), 0);
  const moves = {}, rows = [];
  let bills = 0;
  liveItems().filter(it => ids.has(it.acct) && it.kind !== 'income').forEach(it => {
    const src = accountById(it.acct), dst = it.kind === 'move' && it.to ? accountById(it.to) : null;
    const inDst = !!dst && ids.has(dst.id);
    if (inDst && w(src) === w(dst)) return; // only moving money between your spending accounts
    const times = occurrences(it, p2 - 1, p1);
    if (!times.length) return;
    const amt = times.reduce((s, k) => s + conv(amountOn(it, k), itemCur(it)), 0);
    const v = amt * w(src) - (inDst ? amt * w(dst) : 0); // into a shared spending account, only the part that stops being yours
    if (it.kind === 'move') moves[it.name] = (moves[it.name] || 0) + v; else bills += v;
  });
  Object.entries(moves).forEach(([k, v], i) => rows.push({ k, v, c: `var(--a${(i % 4) + 3})` }));
  if (bills) rows.push({ k: t('Bills & subscriptions'), v: bills, c: 'var(--a2)' });
  const every = pool.reduce((s, a) => s + dailySpend(a) * w(a), 0) * (p2 - p1);
  if (every) rows.push({ k: t('Everyday'), v: every, c: 'var(--muted)', s: t('your estimate') });
  const left = income - rows.reduce((s, r) => s + r.v, 0);
  return { acct: mainAccount() || pool[0], day: p1, nextDay: p2, income, rows, left };
}

// the first day each account dips below zero, and the day your spending money dips below your floor
function warnings() {
  const pool = spendingAccounts();
  const floor = spendFloor();
  const solo = pool.length === 1 ? pool[0] : null; // one spending account: its own warning uses the floor
  const out = [];
  liveAccounts().filter(a => a.type !== 'card').forEach(a => {
    const f = forecast([a.id]);
    const fl = a === solo ? floor : 0;
    const first = f.find(p => p.t > 0 && p.mid < fl);
    if (!first) return;
    out.push({ acct: a, first, low: lowestPoint(f), floor: fl, payT: nextPayday(a) });
  });
  if (pool.length > 1 && floor > 0) {
    const f = forecast(pool.map(a => a.id));
    const first = f.find(p => p.t > 0 && p.mid < floor);
    if (first) out.push({ acct: mainAccount() || pool[0], pool: true, label: t('Spending money'), first, low: lowestPoint(f), floor, payT: poolPayday(pool) });
  }
  return out.sort((x, y) => x.first.t - y.first.t);
}

// everything landing in the next n days, across all accounts
function upcoming(n = 14) {
  const out = [];
  liveItems().forEach(it => occurrences(it, n, 0).forEach(k => out.push({ k, it })));
  return out.sort((x, y) => x.k - y.k || Math.abs(conv(y.it.amount, itemCur(y.it))) - Math.abs(conv(x.it.amount, itemCur(x.it))));
}

// moon phases from the mean synodic month (accurate to about a day), like Caelum
function moonEvents(n) {
  const ref = Date.UTC(2000, 0, 6, 18, 14), syn = 29.530588853;
  const age = d => { const x = (Date.UTC(d.getFullYear(), d.getMonth(), d.getDate(), 12) - ref) / 864e5; return ((x % syn) + syn) % syn; };
  const out = [];
  for (let t = 1; t <= n; t++) {
    const a = age(dateIn(t - 1)), b = age(dateIn(t));
    if (b < a) out.push({ t, type: 'new' });
    else if (a < 14.765 && b >= 14.765) out.push({ t, type: 'full' });
  }
  return out;
}
