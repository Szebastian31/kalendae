// Commitments: income, bills, subscriptions and moves, and the form to add or edit them.
const kindTotalsMonthly = kind => liveItems().filter(it => it.kind === kind).reduce((s, it) => s + conv(perMonth(it), itemCur(it)), 0);

function itemRow(it) {
  const a = accountById(it.acct);
  const k = nextIn(it);
  const when = k == null ? null : dateIn(k);
  const sign = it.kind === 'income' ? 1 : -1;
  const b = fmtBoth(it.amount * sign, itemCur(it));
  const rep = (REPEATS[it.repeat] || REPEATS.month)[0].replace('Every ', '').replace('Only once', 'once');
  const to = it.kind === 'move' ? ` → ${it.to ? esc((accountById(it.to) || {}).name || '?') : 'outside'}` : '';
  const meta = [`<span class="dot" style="background:${accColor(a)}"></span>${esc(a.name)}${to}`, it.paused ? 'paused' : rep, it.varies ? 'average' : ''].filter(Boolean).join(' · ');
  return `<li class="it" data-id="${it.id}">
    <div class="when">${when ? `${when.toLocaleDateString('en-GB', { month: 'short' })}<b>${when.getDate()}</b>` : '—'}</div>
    <div><div class="nm">${esc(it.name)}${isTrialNow(it) ? '<span class="tag">Trial</span>' : ''}</div><div class="meta">${meta}</div></div>
    <div class="amt num ${sign > 0 ? 'pos' : ''}">${sign > 0 ? '+' : ''}${b.main}${b.approx ? `<small>${b.approx}</small>` : ''}</div></li>`;
}

function renderCommit() {
  const v = $('#vCommit');
  if (!liveAccounts().length) {
    v.innerHTML = `<div class="card empty"><div class="big">Add an account first</div><p class="sub">Bills and subscriptions are paid from an account, so Kalendae needs at least one.</p>
      <button class="btn wide" style="margin-top:14px" id="cGo">Add an account</button></div>`;
    $('#cGo').onclick = () => { showTab('accounts'); accountSheet(); };
    return;
  }
  const items = liveItems();
  const trials = items.filter(isTrialNow).sort((x, y) => nextIn(x) - nextIn(y));
  let html = trials.map(it => {
    const k = nextIn(it), a = accountById(it.acct);
    return `<div class="card trial" data-id="${it.id}"><h3>Trial ends <em>${inDaysText(k)}</em></h3>
      <div style="display:flex;justify-content:space-between;align-items:flex-end;gap:12px">
        <div><div style="font-family:var(--serif);font-size:24px;line-height:1.1">${esc(it.name)}</div>
        <div class="sub" style="margin-top:4px">Becomes <b class="num">${fmt(it.amount, itemCur(it))} ${perText(it)}</b> on ${dateIn(k).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}, from ${esc(a.name)}</div></div>
        ${ringSvg([k > 3, k > 1, k > 0, true].map(Boolean), 54, k <= 3 ? 'var(--warn)' : 'var(--good)')}</div>
      <div class="row2"><button class="btn ghost" data-act="cancelled" data-id="${it.id}">I cancelled it</button><button class="btn" data-act="keep" data-id="${it.id}">Keep it</button></div></div>`;
  }).join('');

  if (!items.length) {
    html += `<div class="card empty"><div class="big">What comes and goes?</div>
      <p class="sub">Add your salary, rent and bills, subscriptions like Netflix or Spotify, and regular moves like “to savings”. Each needs its next date; Kalendae repeats it for you.</p>
      <div class="kindgrid" style="margin-top:16px">${Object.entries(KINDS).map(([k, d]) => `<button data-new="${k}">${svg(d.icon)}${d.one}</button>`).join('')}</div></div>`;
  } else {
    const subs = kindTotalsMonthly('sub'), bills = kindTotalsMonthly('bill'), inc = kindTotalsMonthly('income');
    html += `<div class="card"><div class="stats">
      <div class="stat"><div class="k">Coming in</div><div class="v num">${fmt(inc)}</div><div class="s">a month</div></div>
      <div class="stat"><div class="k">Bills</div><div class="v num">${fmt(bills)}</div><div class="s">a month</div></div>
      <div class="stat"><div class="k">Subscriptions</div><div class="v num">${fmt(subs)}</div><div class="s">${fmt(subs * 12)} a year</div></div></div>
      <p class="sub" style="margin-top:10px">Monthly equivalents: a yearly bill counts as 1/12 here.${S.accounts.some(a => a.shared) ? ' Shared accounts are counted in full.' : ''}</p></div>`;
    ['sub', 'bill', 'income', 'move'].forEach(kind => {
      const list = items.filter(it => it.kind === kind).sort((x, y) => (nextIn(x) ?? 9999) - (nextIn(y) ?? 9999));
      if (!list.length) return;
      html += `<div class="card"><h3>${KINDS[kind].many} <em>${list.length}</em></h3><ul class="list">${list.map(itemRow).join('')}</ul></div>`;
    });
    html += `<div class="kindgrid" style="margin-top:14px">${Object.entries(KINDS).map(([k, d]) => `<button data-new="${k}">${svg('<path d="M12 5v14M5 12h14"/>')}${d.one}</button>`).join('')}</div>`;
  }
  html += `<p class="honest">Dates repeat by themselves: a bill on the 31st lands on the last day of shorter months.</p>`;
  v.innerHTML = html;
  $$('[data-new]', v).forEach(b => b.onclick = () => itemSheet(null, b.dataset.new));
  $$('.it', v).forEach(r => r.onclick = () => itemSheet(S.items.find(x => x.id === r.dataset.id)));
  $$('[data-act]', v).forEach(b => b.onclick = e => {
    e.stopPropagation();
    const it = S.items.find(x => x.id === b.dataset.id);
    if (b.dataset.act === 'cancelled') { removeItem(it.id); toast(`${it.name} removed`); }
    else { it.trial = false; upsertItem(it); toast(`${it.name} kept`); }
  });
}
// "a month", "every 2 weeks", "once"
const perText = it => { const [n, unit, every] = REPEATS[it.repeat] || REPEATS.month; return unit === 'once' ? 'once' : every === 1 ? `a ${unit}` : n.toLowerCase(); };
const inDaysText = k => k === 0 ? 'today' : k === 1 ? 'tomorrow' : `in ${k} days`;

// ---- add / edit ----
function itemSheet(existing, kind = 'sub', preset = null, title = null) {
  const accts = liveAccounts();
  const main = mainAccount();
  const it = preset || (existing ? JSON.parse(JSON.stringify(existing)) : {
    id: uid(), kind, name: '', amount: 0, acct: (main || accts[0]).id, to: null,
    start: todayISO(), repeat: 'month', trial: false, varies: false, paused: false,
  });
  const dateLabel = () => it.kind === 'income' ? 'Next payday' : it.kind === 'move' ? 'Next move' : it.trial ? 'Trial ends (first payment)' : 'Next payment';
  const acctChips = (sel, id, skip, outside) => `<div class="chips" id="${id}">${accts.filter(a => a.id !== skip).map(a =>
    `<button class="chip ${a.id === sel ? 'on' : ''}" data-a="${a.id}"><span class="dot" style="background:${accColor(a)}"></span>${esc(a.name)} · ${a.cur}</button>`).join('')}${outside ? `<button class="chip ${!sel ? 'on' : ''}" data-a="">Outside Kalendae</button>` : ''}</div>`;

  const draw = () => {
    const a = accountById(it.acct) || accts[0];
    // a move can be counted in any currency: the source's, the destination's (e.g. EUR savings), or any you use (e.g. USD stocks)
    const moveCurChips = it => {
      const src = a.cur, dst = it.to && accountById(it.to) ? accountById(it.to).cur : null;
      const opts = [...new Set([src, dst, ...S.settings.currencies].filter(Boolean))];
      const cur = itemCur(it);
      const note = cur === src ? `Taken from ${esc(a.name)} as typed.`
        : `${esc(a.name)} pays ≈ ${fmt(conv(it.amount || 0, cur, src), src)} at the 30-day average rate.`;
      return `<div class="chips" id="iCurPick" style="margin-top:8px">${opts.map(c => `<button class="chip ${c === cur ? 'on' : ''}" data-c="${c}">${c}</button>`).join('')}
        <button class="chip" data-c="+">Other…</button></div><p class="sub" style="margin-top:6px">${note}</p>`;
    };
    return `<h2>${title ? esc(title) : existing ? esc(existing.name) : 'New ' + KINDS[it.kind].one.toLowerCase()}</h2>
    <div class="seg" id="iKind" style="margin:6px 0 4px">${Object.entries(KINDS).map(([k, d]) => `<button data-k="${k}" class="${k === it.kind ? 'on' : ''}">${d.one}</button>`).join('')}</div>
    <div class="field"><label>Name</label><input class="input" id="iName" value="${esc(it.name)}" placeholder="${esc(SUGGEST[it.kind][0])}" autocomplete="off">
      <div class="chips" id="iSug" style="margin-top:8px"></div></div>
    <div class="field"><label>${it.kind === 'income' ? 'Amount you receive' : 'Amount'}${it.varies ? ' (average)' : ''}</label>
      <div style="display:flex;gap:8px;align-items:center"><input class="input money num" id="iAmt" inputmode="decimal" value="${it.amount || ''}" placeholder="0" style="flex:1"><span class="sub num" id="iCur" style="min-width:42px">${itemCur(it)}</span></div>
      ${it.kind === 'move' ? moveCurChips(it) : ''}</div>
    <div class="field"><label>${it.kind === 'income' ? 'Arrives in' : it.kind === 'move' ? 'From' : 'Paid from'}</label>${acctChips(it.acct, 'iAcct')}</div>
    ${it.kind === 'move' ? `<div class="field"><label>To</label>${acctChips(it.to, 'iTo', it.acct, true)}
      <p class="sub" style="margin-top:6px">A move between your own accounts isn't spending. “Outside Kalendae” is for money that leaves, like investing.</p></div>` : ''}
    <div class="field"><label>${dateLabel()}</label><input class="input num" id="iDate" type="date" value="${it.start}"></div>
    <div class="field"><label>Repeats</label><select class="input" id="iRep">${Object.entries(REPEATS).map(([k, [n]]) => `<option value="${k}" ${k === it.repeat ? 'selected' : ''}>${n}</option>`).join('')}</select></div>
    <div class="card" style="margin-top:16px;padding:6px 16px">
      ${it.kind === 'sub' ? `<div class="tog"><div>Free trial now<small>The date above is when it turns paid</small></div><button class="sw-t ${it.trial ? 'on' : ''}" id="iTrial"></button></div>` : ''}
      ${it.kind !== 'move' ? `<div class="tog"><div>Amount changes<small>Like electricity: type an average</small></div><button class="sw-t ${it.varies ? 'on' : ''}" id="iVar"></button></div>` : ''}
      ${existing ? `<div class="tog"><div>Paused<small>Kept, but left out of the forecast</small></div><button class="sw-t ${it.paused ? 'on' : ''}" id="iPause"></button></div>` : ''}
    </div>
    <div class="row2">${existing ? '<button class="btn danger" id="iDel">Delete</button>' : '<button class="btn ghost" id="iCancel">Cancel</button>'}<button class="btn" id="iSave">Save</button></div>`;
  };

  const keep = body => { // remember typed values before redrawing
    it.name = $('#iName', body).value;
    const v = parseAmount($('#iAmt', body).value); if (v != null) it.amount = Math.abs(v);
    it.start = $('#iDate', body).value || it.start;
    it.repeat = $('#iRep', body).value;
  };
  const mount = body => {
    const sug = () => {
      const q = fold($('#iName', body).value.trim());
      const list = SUGGEST[it.kind].filter(s => !q || fold(s).includes(q)).filter(s => fold(s) !== q).slice(0, 8);
      $('#iSug', body).innerHTML = list.map(s => `<button class="chip" data-s="${esc(s)}">${esc(s)}</button>`).join('');
      $$('#iSug [data-s]', body).forEach(b => b.onclick = () => { $('#iName', body).value = b.dataset.s; sug(); });
    };
    sug();
    $('#iName', body).oninput = sug;
    $$('#iKind button', body).forEach(b => b.onclick = () => {
      keep(body); it.kind = b.dataset.k;
      if (it.kind !== 'sub') it.trial = false;
      if (it.kind !== 'move') delete it.cur;
      if (it.kind === 'move' && it.to === it.acct) it.to = null;
      redraw();
    });
    $$('#iAcct button', body).forEach(b => b.onclick = () => { keep(body); it.acct = b.dataset.a; if (it.to === it.acct) it.to = null; redraw(); });
    $$('#iTo button', body).forEach(b => b.onclick = () => {
      keep(body);
      const prevDst = it.to && accountById(it.to) ? accountById(it.to).cur : null;
      it.to = b.dataset.a || null;
      // moving into a EUR savings account? count it in euros, unless you already picked a currency yourself
      const dst = it.to && accountById(it.to) ? accountById(it.to).cur : null;
      if (dst && (!it.cur || it.cur === prevDst)) it.cur = dst === accountById(it.acct).cur ? undefined : dst;
      redraw();
    });
    $$('#iCurPick button', body).forEach(b => b.onclick = async () => {
      keep(body);
      let c = b.dataset.c;
      if (c === '+') {
        const typed = await promptSheet('Which currency?', `Type its 3-letter code, e.g. USD, EUR, CHF. Kalendae knows ${Object.keys(CURRENCIES).length}.`, { placeholder: 'USD', ok: 'Use it' });
        c = typed && typed.trim().toUpperCase();
        if (!c) { itemSheet(existing, it.kind, it, title); return; }
        if (!CURRENCIES[c]) { toast(`${c} isn’t in the list`); itemSheet(existing, it.kind, it, title); return; }
        if (!S.settings.currencies.includes(c)) { S.settings.currencies.push(c); save(); }
        it.cur = c === accountById(it.acct).cur ? undefined : c;
        itemSheet(existing, it.kind, it, title);
        return;
      }
      it.cur = c === accountById(it.acct).cur ? undefined : c;
      redraw();
    });
    const tog = (id, key) => { const el = $(id, body); if (el) el.onclick = () => { keep(body); it[key] = !it[key]; redraw(); }; };
    tog('#iTrial', 'trial'); tog('#iVar', 'varies'); tog('#iPause', 'paused');
    if (!existing && !it.name) setTimeout(() => $('#iName', body).focus(), 350);

    $('#iSave', body).onclick = () => {
      keep(body);
      it.name = it.name.trim() || SUGGEST[it.kind][0];
      if (!(it.amount > 0)) { toast('Type the amount'); return; }
      if (!it.start) { toast('Pick the date'); return; }
      if (it.kind === 'move' && it.to === it.acct) { toast('Pick a different account to move to'); return; }
      if (it.kind === 'move' && it.to) it.inName = `From ${accountById(it.acct).name}`; else delete it.inName;
      if (it.kind !== 'move' || !it.cur || it.cur === accountById(it.acct).cur) delete it.cur;
      upsertItem(it);
      tick(); closeSheet();
      toast(existing ? 'Saved' : `${it.name} added`);
    };
    if (existing) $('#iDel', body).onclick = async () => {
      if (await confirmSheet(`Delete ${existing.name}?`, 'It’s removed from your forecast. Nothing changes in your real account.', 'Delete', true)) { removeItem(existing.id); toast('Deleted'); }
    };
    else $('#iCancel', body).onclick = closeSheet;
  };
  const redraw = () => { $('#sheetBody').innerHTML = draw(); mount($('#sheetBody')); };
  openSheet(draw(), mount);
}
