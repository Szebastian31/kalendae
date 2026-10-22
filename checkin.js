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
  const spent = e.v - (a.type === 'card' ? -actual : actual); // money gone that wasn't planned
  const res = { a, days: e.days, spent, perDay: e.days ? spent / e.days : 0, before: a.everyday || 0 };
  if (e.days >= 2 && spent > -0.5) {
    a.spendHist = (a.spendHist || []).concat([+res.perDay.toFixed(2)]).slice(-8);
    const learned = a.spendHist.reduce((s, x) => s + x, 0) / a.spendHist.length * 30.44;
    a.everyday = Math.round(a.spendHist.length < 2 && a.everyday ? (a.everyday + learned) / 2 : learned);
  }
  S.checkins.push({ acct: a.id, d: todayISO(), expected: +e.v.toFixed(2), actual, days: e.days });
  S.checkins = S.checkins.slice(-200);
  a.balance = a.type === 'card' ? Math.abs(actual) : actual;
  a.balanceAt = todayISO();
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

const checkinDue = () => liveAccounts().filter(a => a.type !== 'card' && (!a.balanceAt || daysBetween(fromISO(a.balanceAt), day0()) >= 6));

function checkinSheet(onlyId) {
  const accts = liveAccounts().filter(a => !onlyId || a.id === onlyId);
  const due = new Set(checkinDue().map(a => a.id));
  const rows = accts.map(a => {
    const e = expectedNow(a);
    const notes = a.type === 'cash' && NOTES[a.cur];
    return `<div class="ci" data-id="${a.id}">
      <div class="ci-h"><span class="sw sm" style="background:${accColor(a)}">${svg(ACCOUNT_TYPES[a.type].icon)}</span>
        <div><b>${esc(a.name)}</b><div class="meta">${e.days ? `last ${agoText(a.balanceAt)} · expected ≈ ${fmt(e.v, a.cur)}` : 'checked today'}</div></div>
        ${due.has(a.id) ? '<span class="tag">Due</span>' : ''}</div>
      ${notes ? `<div class="notes">${notes.map(n => `<label>${fmt(n, a.cur)} ×<input class="num" data-n="${n}" inputmode="numeric" placeholder="0"></label>`).join('')}
          <label>Coins<input class="num" data-n="coins" inputmode="decimal" placeholder="0"></label></div>
        <div class="sub cashTotal"></div>`
        : `<input class="input money num" inputmode="decimal" placeholder="${a.type === 'card' ? 'Owed now' : 'Balance now'}" data-bal>`}
    </div>`;
  }).join('');
  openSheet(`<h2>${onlyId ? 'Check in' : 'Weekly check-in'}</h2>
    <p class="lead">Type what's in each account right now. Leave any you didn't check empty. Kalendae works out the everyday spending in between.</p>
    ${rows}
    <div class="row2"><button class="btn ghost" id="ciX">Later</button><button class="btn" id="ciS">Save</button></div>`, body => {
    $$('.ci', body).forEach(box => {
      const ins = $$('[data-n]', box);
      if (!ins.length) return;
      const upd = () => {
        const t = ins.reduce((s, i) => s + (parseAmount(i.value) || 0) * (i.dataset.n === 'coins' ? 1 : +i.dataset.n), 0);
        box.dataset.total = ins.some(i => i.value.trim()) ? t : '';
        $('.cashTotal', box).textContent = box.dataset.total !== '' ? `Counted ${fmt(t, accountById(box.dataset.id).cur)}` : '';
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
      if (!results.length) { toast('Type at least one balance'); return; }
      save(); tick('18,40,18');
      checkinResult(results);
    };
  });
}

function checkinResult(results) {
  const lines = results.map(r => {
    const a = r.a;
    if (!r.days) return `<li><b>${esc(a.name)}</b> updated.</li>`;
    if (r.spent < -0.5) return `<li><b>${esc(a.name)}</b>: ${fmt(-r.spent, a.cur)} more than expected. Money came in that Kalendae doesn't know about. If it repeats, add it as income.</li>`;
    const usual = r.before ? r.before / 30.44 : null;
    const vs = !usual ? '' : r.perDay > usual * 1.2 ? ', <b>above</b> your usual' : r.perDay < usual * .8 ? ', <b>below</b> your usual' : ', close to your usual';
    return `<li><b>${esc(a.name)}</b>: ${fmt(r.spent, a.cur)} went on everyday things in ${r.days} day${r.days > 1 ? 's' : ''}, about ${fmt(r.perDay, a.cur)} a day${vs}.</li>`;
  }).join('');
  openSheet(`<h2>Checked in</h2><ul class="cires">${lines}</ul>
    <p class="sub" style="margin-top:12px">Kalendae now expects about <b>${results.filter(r => r.a.everyday).map(r => `${fmt(r.a.everyday, r.a.cur)} a month from ${esc(r.a.name)}`).join(', ') || 'what you set'}</b> in everyday spending. The forecast's range narrows as you check in each week.</p>
    <button class="btn wide" style="margin-top:14px" id="ciOk">Done</button>`, body => $('#ciOk', body).onclick = closeSheet);
}
