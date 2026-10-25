// Weekly check-in: type today's balances (or count your cash) and Kalendae works out what went on
// everyday things since last time, without you logging a single coffee. It then learns your real
// everyday spending, so the forecast's range narrows week by week.
const NOTES = {
  PLN: [500, 200, 100, 50, 20, 10], EUR: [500, 200, 100, 50, 20, 10, 5], USD: [100, 50, 20, 10, 5, 1], GBP: [50, 20, 10, 5],
  CHF: [1000, 200, 100, 50, 20, 10], CZK: [5000, 2000, 1000, 500, 200, 100], SEK: [1000, 500, 200, 100, 50, 20], NOK: [1000, 500, 200, 100, 50],
  DKK: [1000, 500, 200, 100, 50], HUF: [20000, 10000, 5000, 2000, 1000, 500], UAH: [1000, 500, 200, 100, 50, 20], CAD: [100, 50, 20, 10, 5],
  AUD: [100, 50, 20, 10, 5], JPY: [10000, 5000, 1000],
};

// what the account should hold today, from its last known balance and everything dated since
function expectedNow(a) {
  const since = a.balanceAt || todayISO();
  const days = Math.max(0, daysBetween(fromISO(since), day0()));
  let v = a.balance * (a.type === 'card' ? -1 : 1), planned = [];
  if (days > 0) liveItems().forEach(it => {
    const isSrc = it.acct === a.id, isDst = it.kind === 'move' && it.to === a.id;
    if (!isSrc && !isDst) return;
    // landed after the last check (day 1 … today)
    const n = occurrences(it, 0, -days + 1).length;
    if (!n) return;
    const amt = conv(it.amount, itemCur(it), a.cur) * KINDS[it.kind].sign * (isSrc ? 1 : -1) * n;
    v += amt; planned.push({ name: isSrc ? it.name : (it.inName || it.name), amt });
  });
  return { days, v, planned, everyday: (a.everyday || 0) / 30.44 * days };
}

// applies one check-in and learns from it; returns what happened, for the summary
function applyCheckin(a, actual) {
  const e = expectedNow(a);
  let res;
  if (isGrowth(a) && !countsToSpend(a)) {
    // savings and investments: the difference is interest, round-ups or the market moving, never everyday spending
    res = { a, days: e.days, growth: actual - e.v };
  } else {
    // money gone that wasn't planned: what you didn't log, plus the everyday spends you did log (already off the balance)
    const unlogged = e.v - (a.type === 'card' ? -actual : actual);
    const logged = loggedUnsettled(a);
    const spent = unlogged < -0.5 ? unlogged : unlogged + logged;
    res = { a, days: e.days, spent, logged, perDay: e.days ? spent / e.days : 0, before: a.everyday || 0 };
    if (e.days >= 2 && spent > -0.5) {
      a.spendHist = (a.spendHist || []).concat([+res.perDay.toFixed(2)]).slice(-8);
      const learned = a.spendHist.reduce((s, x) => s + x, 0) / a.spendHist.length * 30.44;
      a.everyday = Math.round(a.spendHist.length < 2 && a.everyday ? (a.everyday + learned) / 2 : learned);
    }
  }
  S.checkins.push({ acct: a.id, d: todayISO(), expected: +e.v.toFixed(2), actual, days: e.days });
  S.checkins = S.checkins.slice(-200);
  a.balance = a.type === 'card' ? Math.abs(actual) : actual;
  a.balanceAt = todayISO();
  settleSpends(a.id);
  return res;
}

// how much everyday spending varies, per day, in the display currency (for the forecast's range)
function dailySpread(a) {
  const h = a && a.spendHist;
  if (!h || h.length < 3) return dailySpend(a) * 0.6;
  const m = h.reduce((s, x) => s + x, 0) / h.length;
  const sd = Math.sqrt(h.reduce((s, x) => s + (x - m) ** 2, 0) / (h.length - 1));
  return conv(sd, a.cur);
}

// savings and investments only need a look about once a month
const checkinDue = () => liveAccounts().filter(a => a.type !== 'card' && (!a.balanceAt || daysBetween(fromISO(a.balanceAt), day0()) >= (isGrowth(a) ? 30 : 6)));

function checkinSheet(onlyId) {
  const accts = liveAccounts().filter(a => !onlyId || a.id === onlyId);
  const due = new Set(checkinDue().map(a => a.id));
  const rows = accts.map(a => {
    const e = expectedNow(a);
    const notes = a.type === 'cash' && NOTES[a.cur];
    return `<div class="ci" data-id="${a.id}">
      <div class="ci-h"><span class="sw sm" style="background:${accColor(a)}">${svg(ACCOUNT_TYPES[a.type].icon)}</span>
        <div><b>${esc(a.name)}</b><div class="meta">${e.days ? t('last {ago} · expected ≈ {v}', { ago: agoText(a.balanceAt), v: fmt(e.v, a.cur) }) : t('checked today')}</div></div>
        ${due.has(a.id) ? `<span class="tag">${t('Due')}</span>` : ''}</div>
      ${notes ? `<div class="notes">${notes.map(n => `<label>${fmt(n, a.cur)} ×<input class="num" data-n="${n}" inputmode="numeric" placeholder="0"></label>`).join('')}
          <label>${t('Coins')}<input class="num" data-n="coins" inputmode="decimal" placeholder="0"></label></div>
        <div class="sub cashTotal"></div>`
        : `<input class="input money num" inputmode="decimal" placeholder="${a.type === 'card' ? t('Owed now') : a.type === 'invest' ? t('Value now') : t('Balance now')}" data-bal>`}
    </div>`;
  }).join('');
  openSheet(`<h2>${onlyId ? t('Check in') : t('Weekly check-in')}</h2>
    <p class="lead">${t('Type what’s in each account right now. Leave any you didn’t check empty. Kalendae works out the everyday spending in between.')}</p>
    ${rows}
    <div class="row2"><button class="btn ghost" id="ciX">${t('Later')}</button><button class="btn" id="ciS">${t('Save')}</button></div>`, body => {
    $$('.ci', body).forEach(box => {
      const ins = $$('[data-n]', box);
      if (!ins.length) return;
      const upd = () => {
        const tot = ins.reduce((s, i) => s + (parseAmount(i.value) || 0) * (i.dataset.n === 'coins' ? 1 : +i.dataset.n), 0);
        box.dataset.total = ins.some(i => i.value.trim()) ? tot : '';
        $('.cashTotal', box).textContent = box.dataset.total !== '' ? t('Counted {v}', { v: fmt(tot, accountById(box.dataset.id).cur) }) : '';
      };
      ins.forEach(i => i.oninput = upd);
    });
    $('#ciX', body).onclick = closeSheet;
    $('#ciS', body).onclick = () => {
      const results = [];
      $$('.ci', body).forEach(box => {
        const a = accountById(box.dataset.id);
        const bal = box.querySelector('[data-bal]');
        const v = bal ? parseAmount(bal.value) : (box.dataset.total === '' || box.dataset.total == null ? null : +box.dataset.total);
        if (v == null) return;
        results.push(applyCheckin(a, v));
      });
      if (!results.length) { toast(t('Type at least one balance')); return; }
      save(); tick('18,40,18');
      checkinResult(results);
    };
  });
}

function checkinResult(results) {
  const lines = results.map(r => {
    const a = r.a, name = `<b>${esc(a.name)}</b>`;
    if (r.growth != null) {
      if (!r.days || Math.abs(r.growth) < 0.5) return `<li>${t('{a} updated.', { a: name })}</li>`;
      return `<li>${r.growth > 0 ? t('{a}: up {v} since the last check, from interest, round-ups or the market.', { a: name, v: fmt(r.growth, a.cur) })
        : t('{a}: down {v} since the last check. Savings and investments go up and down; it isn’t counted as spending.', { a: name, v: fmt(-r.growth, a.cur) })}</li>`;
    }
    if (!r.days) return `<li>${t('{a} updated.', { a: name })}</li>`;
    if (r.spent < -0.5) return `<li>${t('{a}: {v} more than expected. Money came in that Kalendae doesn’t know about. If it repeats, add it as income.', { a: name, v: fmt(-r.spent, a.cur) })}</li>`;
    const usual = r.before ? r.before / 30.44 : null;
    const vs = !usual ? '' : r.perDay > usual * 1.2 ? t('above your usual') : r.perDay < usual * .8 ? t('below your usual') : t('close to your usual');
    const vars = { a: name, v: fmt(r.spent, a.cur), d: fmt(r.perDay, a.cur), vs: `<b>${vs}</b>` };
    return `<li>${vs ? tn(r.days, '{a}: {v} went on everyday things in {n} day, about {d} a day, {vs}.', '{a}: {v} went on everyday things in {n} days, about {d} a day, {vs}.', vars)
                     : tn(r.days, '{a}: {v} went on everyday things in {n} day, about {d} a day.', '{a}: {v} went on everyday things in {n} days, about {d} a day.', vars)}${r.logged > 0.5 ? ' ' + t('You logged {v} of it.', { v: fmt(r.logged, a.cur) }) : ''}</li>`;
  }).join('');
  const learned = results.filter(r => r.a.everyday).map(r => t('{v} a month from {a}', { v: fmt(r.a.everyday, r.a.cur), a: esc(r.a.name) })).join(', ');
  const spending = results.some(r => r.growth == null);
  openSheet(`<h2>${t('Checked in')}</h2><ul class="cires">${lines}</ul>
    ${spending ? `<p class="sub" style="margin-top:12px">${t('Kalendae now expects about {v} in everyday spending. The forecast’s range narrows as you check in each week.', { v: `<b>${learned || t('what you set')}</b>` })}</p>` : ''}
    <button class="btn wide" style="margin-top:14px" id="ciOk">${t('Done')}</button>`, body => $('#ciOk', body).onclick = closeSheet);
}
