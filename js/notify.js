// Notifications from your real dates. Kalendae works out what to tell you and on which day, and hands
// the list to Android, which posts it once a day around your chosen time (like Consensus Weather),
// even when the app is closed. Several on one day arrive together as one notification.
const REMIND = { off: [t('Off'), null], same: [t('On the day'), 0], d1: [t('1 day before'), 1], d3: [t('3 days before'), 3], d7: [t('1 week before'), 7] };
const defaultRemind = it => it.kind === 'sub' || it.kind === 'bill' ? 'd3' : 'off';
const remindOf = it => it.remind || defaultRemind(it);
// weekday names in the app's language, Sunday first (2023-01-01 was a Sunday)
const WEEKDAYS = Array.from({ length: 7 }, (_, i) => new Date(2023, 0, 1 + i).toLocaleDateString(LOCALE, { weekday: 'long' }));

// "on Friday" is worded differently per weekday in many languages (we wtorek, am Dienstag), so each has its own text
const ON_DAY = [t('on Sunday'), t('on Monday'), t('on Tuesday'), t('on Wednesday'), t('on Thursday'), t('on Friday'), t('on Saturday')];

function whenText(k) {
  if (k === 0) return t('today');
  if (k === 1) return t('tomorrow');
  return k < 7 ? ON_DAY[dateIn(k).getDay()] : t('on {date}', { date: dfmt(dateIn(k), { day: 'numeric', month: 'short' }) });
}
const inDaysRel = n => n === 0 ? t('today') : n === 1 ? t('tomorrow') : tn(n, 'in {n} day', 'in {n} days');

function buildNotifEvents(n = 45) {
  const ev = [];
  const push = (k, e) => ev.push(Object.assign({ day: isoDay(dateIn(Math.max(0, k))) }, e));
  liveItems().forEach(it => {
    const a = accountById(it.acct), cur = itemCur(it);
    const money = fmt(it.amount, cur, { cents: true });
    if (isTrialNow(it)) {
      const k = nextIn(it);
      [2, 0].forEach(before => {
        if (k - before < 0) return;
        push(k - before, { id: `${it.id}-trial-${before}`, warn: true,
          title: before ? t('{name} trial ends in {n} days', { name: it.name, n: before }) : t('{name} trial ends today', { name: it.name }),
          body: before
            ? t('It becomes {v} {per} from {a} {when}. Cancel before then if you don’t want it.', { v: money, per: perText(it), a: a.name, when: whenText(k) })
            : t('It becomes {v} {per} from {a}. Cancel now if you don’t want it.', { v: money, per: perText(it), a: a.name }) });
      });
      return;
    }
    const lead = REMIND[remindOf(it)][1];
    if (lead == null) return;
    const verbs = { sub: '{name} renews {when}', bill: '{name} is due {when}', income: '{name} arrives {when}', move: '{name} is planned {when}' };
    occurrences(it, n, 0).forEach(k => {
      if (k - lead < 0) return;
      const vars = { v: money, a: a.name, when: whenText(k) };
      push(k - lead, { id: `${it.id}-${isoDay(dateIn(k))}`, warn: false,
        title: t(verbs[it.kind], { name: it.name, when: inDaysRel(lead) }),
        body: (it.kind === 'income' ? (lead > 1 ? t('{v} into {a} {when}.', vars) : t('{v} into {a}.', vars))
                                    : (lead > 1 ? t('{v} from {a} {when}.', vars) : t('{v} from {a}.', vars)))
              + (it.varies ? ' ' + t('(about)') : '') });
    });
  });
  // an account (or your spending money as a whole) about to run short: warn 3 days ahead (or today, if it's sooner)
  warnings().forEach(w => {
    push(w.first.t - 3, { id: `short-${w.pool ? 'spend' : w.acct.id}-${isoDay(w.first.date)}`, warn: true,
      title: t('{a} may run short {when}', { a: w.label || w.acct.name, when: whenText(w.first.t) }),
      body: t('Lowest point {v} on {d}. Open Kalendae to plan a top-up.', { v: fmt(w.low.mid), d: dfmt(w.low.date, { day: 'numeric', month: 'short' }) }) });
  });
  // the weekly check-in
  if (S.settings.checkinDay != null && liveAccounts().length) {
    for (let k = 0; k <= n; k++) if (dateIn(k).getDay() === +S.settings.checkinDay)
      push(k, { id: `checkin-${isoDay(dateIn(k))}`, warn: false, title: t('Weekly check-in'),
        body: t('A minute to type today’s balances keeps the forecast honest.') });
  }
  return ev;
}

let notifT;
function syncNotifEvents() {
  if (!NATIVE || !NATIVE.setNotifEvents) return;
  clearTimeout(notifT);
  notifT = setTimeout(() => { try { NATIVE.setNotifEvents(JSON.stringify(buildNotifEvents())); } catch (e) {} }, 300);
}
