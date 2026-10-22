// Notifications from your real dates. Kalendae works out what to tell you and on which day, and hands
// the list to Android, which posts it once a day around your chosen time (like Consensus Weather),
// even when the app is closed. Several on one day arrive together as one notification.
const REMIND = { off: ['Off', null], same: ['On the day', 0], d1: ['1 day before', 1], d3: ['3 days before', 3], d7: ['1 week before', 7] };
const defaultRemind = it => it.kind === 'sub' || it.kind === 'bill' ? 'd3' : 'off';
const remindOf = it => it.remind || defaultRemind(it);
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function whenText(k) {
  if (k === 0) return 'today';
  if (k === 1) return 'tomorrow';
  return k < 7 ? `on ${dateIn(k).toLocaleDateString('en-GB', { weekday: 'long' })}` : `on ${dateIn(k).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`;
}

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
          title: before ? `${it.name} trial ends in ${before} days` : `${it.name} trial ends today`,
          body: `It becomes ${money} ${perText(it)} from ${a.name}${before ? ` ${whenText(k)}` : ''}. Cancel ${before ? 'before then' : 'now'} if you don't want it.` });
      });
      return;
    }
    const lead = REMIND[remindOf(it)][1];
    if (lead == null) return;
    occurrences(it, n, 0).forEach(k => {
      if (k - lead < 0) return;
      const verb = it.kind === 'sub' ? 'renews' : it.kind === 'bill' ? 'is due' : it.kind === 'income' ? 'arrives' : 'is planned';
      const rel = lead === 0 ? 'today' : lead === 1 ? 'tomorrow' : `in ${lead} days`;
      push(k - lead, { id: `${it.id}-${isoDay(dateIn(k))}`, warn: false,
        title: `${it.name} ${verb} ${rel}`,
        body: `${money} ${it.kind === 'income' ? 'into' : 'from'} ${a.name}${lead > 1 ? ' ' + whenText(k) : ''}${it.varies ? ' (about)' : ''}.` });
    });
  });
  // an account about to run short: warn 3 days ahead (or today, if it's sooner)
  warnings().forEach(w => {
    push(w.first.t - 3, { id: `short-${w.acct.id}-${isoDay(w.first.date)}`, warn: true,
      title: `${w.acct.name} may run short ${whenText(w.first.t)}`,
      body: `Lowest point ${fmt(w.low.mid)} on ${w.low.date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}. Open Kalendae to plan a top-up.` });
  });
  // the weekly check-in
  if (S.settings.checkinDay != null && liveAccounts().length) {
    for (let k = 0; k <= n; k++) if (dateIn(k).getDay() === +S.settings.checkinDay)
      push(k, { id: `checkin-${isoDay(dateIn(k))}`, warn: false, title: 'Weekly check-in',
        body: 'A minute to type today’s balances keeps the forecast honest.' });
  }
  return ev;
}

let notifT;
function syncNotifEvents() {
  if (!NATIVE || !NATIVE.setNotifEvents) return;
  clearTimeout(notifT);
  notifT = setTimeout(() => { try { NATIVE.setNotifEvents(JSON.stringify(buildNotifEvents())); } catch (e) {} }, 300);
}
