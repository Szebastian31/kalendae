// Commitments: income, bills, subscriptions and moves, and the form to add or edit them.
const kindTotalsMonthly = kind => liveItems().filter(it => it.kind === kind).reduce((s, it) => s + conv(perMonth(it), itemCur(it)), 0);

// "monthly", "every 2 weeks", "once": the short form shown in lists
const REPEAT_SHORT = { week: t('weekly'), week2: t('every 2 weeks'), week4: t('every 4 weeks'), month: t('monthly'), month2: t('every 2 months'),
  month3: t('every 3 months'), month6: t('every 6 months'), year: t('yearly'), once: t('once') };
// "a month", "every 2 weeks", "once": after a price
const REPEAT_PER = { week: t('a week'), week2: t('every 2 weeks'), week4: t('every 4 weeks'), month: t('a month'), month2: t('every 2 months'),
  month3: t('every 3 months'), month6: t('every 6 months'), year: t('a year'), once: t('once') };
const perText = it => REPEAT_PER[it.repeat] || REPEAT_PER.month;
const inDaysText = k => k === 0 ? t('today') : k === 1 ? t('tomorrow') : tn(k, 'in {n} day', 'in {n} days');

function itemRow(it) {
  const a = accountById(it.acct);
  const k = nextIn(it);
  const when = k == null ? null : dateIn(k);
  const sign = it.kind === 'income' ? 1 : -1;
  const b = fmtBoth(it.amount * sign, itemCur(it));
  const rep = REPEAT_SHORT[it.repeat] || REPEAT_SHORT.month;
  const to = it.kind === 'move' ? ` → ${it.to ? esc((accountById(it.to) || {}).name || '?') : t('outside')}` : '';
  const meta = [`<span class="dot" style="background:${accColor(a)}"></span>${esc(a.name)}${to}`, it.paused ? t('paused') : rep, it.varies ? t('average') : ''].filter(Boolean).join(' · ');
  // subscriptions get their keep / review / cancel ring instead of the date
  const vd = it.kind === 'sub' && !isTrialNow(it) && !it.paused ? subVerdict(it) : null;
  const lead = vd ? `<div class="when vr">${ringSvg(subSignals(it).map(s => s[0] === vd), 34, VERDICT[vd][1])}</div>`
    : `<div class="when">${when ? `${dfmt(when, { month: 'short' })}<b>${when.getDate()}</b>` : '—'}</div>`;
  return `<li class="it" data-id="${it.id}">
    ${lead}
    <div><div class="nm">${esc(it.name)}${isTrialNow(it) ? `<span class="tag">${t('Trial')}</span>` : ''}</div><div class="meta">${meta}${vd && when ? ' · ' + t('next {d}', { d: dfmt(when, { day: 'numeric', month: 'short' }) }) : ''}</div></div>
    <div class="amt num ${sign > 0 ? 'pos' : ''}">${sign > 0 ? '+' : ''}${b.main}${b.approx ? `<small>${b.approx}</small>` : ''}${vd ? `<span class="verdict" style="color:${VERDICT[vd][1]}">${VERDICT[vd][0]}</span>` : ''}</div></li>`;
}

function renderCommit() {
  const v = $('#vCommit');
  if (!liveAccounts().length) {
    v.innerHTML = `<div class="card empty"><div class="big">${t('Add an account first')}</div><p class="sub">${t('Bills and subscriptions are paid from an account, so Kalendae needs at least one.')}</p>
      <button class="btn wide" style="margin-top:14px" id="cGo">${t('Add an account')}</button></div>`;
    $('#cGo').onclick = () => { showTab('accounts'); accountSheet(); };
    return;
  }
  const items = liveItems();
  const trials = items.filter(isTrialNow).sort((x, y) => nextIn(x) - nextIn(y));
  let html = trials.map(it => {
    const k = nextIn(it), a = accountById(it.acct);
    return `<div class="card trial" data-id="${it.id}"><h3>${t('Trial ends')} <em>${inDaysText(k)}</em></h3>
      <div style="display:flex;justify-content:space-between;align-items:flex-end;gap:12px">
        <div><div style="font-family:var(--serif);font-size:24px;line-height:1.1">${esc(it.name)}</div>
        <div class="sub" style="margin-top:4px">${t('Becomes {v} on {d}, from {a}', { v: `<b class="num">${fmt(it.amount, itemCur(it))} ${perText(it)}</b>`, d: dfmt(dateIn(k), { weekday: 'short', day: 'numeric', month: 'short' }), a: esc(a.name) })}</div></div>
        ${ringSvg([k > 3, k > 1, k > 0, true].map(Boolean), 54, k <= 3 ? 'var(--warn)' : 'var(--good)')}</div>
      <div class="row2"><button class="btn ghost" data-act="cancelled" data-id="${it.id}">${t('I cancelled it')}</button><button class="btn" data-act="keep" data-id="${it.id}">${t('Keep it')}</button></div></div>`;
  }).join('');

  if (!items.length) {
    html += `<div class="card empty"><div class="big">${t('What comes and goes?')}</div>
      <p class="sub">${t('Add your salary, rent and bills, subscriptions like Netflix or Spotify, and regular moves like “to savings”. Each needs its next date; Kalendae repeats it for you.')}</p>
      <div class="kindgrid" style="margin-top:16px">${Object.entries(KINDS).map(([k, d]) => `<button data-new="${k}">${svg(d.icon)}${d.one}</button>`).join('')}</div></div>`;
  } else {
    const subs = kindTotalsMonthly('sub'), bills = kindTotalsMonthly('bill'), inc = kindTotalsMonthly('income');
    html += `<div class="card"><div class="stats">
      <div class="stat"><div class="k">${t('Coming in')}</div><div class="v num">${fmt(inc)}</div><div class="s">${t('a month')}</div></div>
      <div class="stat"><div class="k">${t('Bills')}</div><div class="v num">${fmt(bills)}</div><div class="s">${t('a month')}</div></div>
      <div class="stat"><div class="k">${t('Subscriptions')}</div><div class="v num">${fmt(subs)}</div><div class="s">${t('{v} a year', { v: fmt(subs * 12) })}</div></div></div>
      <p class="sub" style="margin-top:10px">${t('Monthly equivalents: a yearly bill counts as 1/12 here.')}${S.accounts.some(a => a.shared) ? ' ' + t('Shared accounts are counted in full.') : ''}</p></div>`;
    // subscriptions worth a second look
    const look = items.filter(it => it.kind === 'sub' && !isTrialNow(it) && !it.paused && subVerdict(it) !== 'k');
    if (look.length) {
      const yearly = look.reduce((s, it) => s + conv(perMonth(it), itemCur(it)) * 12, 0);
      const unrated = look.filter(it => !it.usage).length;
      html += `<div class="card"><h3>${t('Worth a look')} <em>${t('{v} a year', { v: fmt(yearly) })}</em></h3>
        <div class="agree">${ringSvg(items.filter(it => it.kind === 'sub' && !isTrialNow(it) && !it.paused).map(it => subVerdict(it) === 'k'), 78)}
        <p class="sub">${tn(look.length, '{n} subscription got a review or cancel vote: {names}.', '{n} subscriptions got a review or cancel vote: {names}.',
          { names: look.slice(0, 3).map(it => `<b>${esc(it.name)}</b>`).join(', ') + (look.length > 3 ? '…' : '') })}
        ${unrated ? tn(unrated, 'Rate how often you use it for a fairer vote.', 'Rate how often you use them for a fairer vote.') : t('Tap one to see why.')}</p></div></div>`;
    }
    ['sub', 'bill', 'income', 'move'].forEach(kind => {
      const list = items.filter(it => it.kind === kind).sort((x, y) => (nextIn(x) ?? 9999) - (nextIn(y) ?? 9999));
      if (!list.length) return;
      html += `<div class="card"><h3>${KINDS[kind].many} <em>${list.length}</em></h3><ul class="list">${list.map(itemRow).join('')}</ul></div>`;
    });
    html += `<div class="kindgrid" style="margin-top:14px">${Object.entries(KINDS).map(([k, d]) => `<button data-new="${k}">${svg('<path d="M12 5v14M5 12h14"/>')}${d.one}</button>`).join('')}</div>`;
  }
  html += `<p class="honest">${t('Dates repeat by themselves: a bill on the 31st lands on the last day of shorter months.')}</p>`;
  v.innerHTML = html;
  $$('[data-new]', v).forEach(b => b.onclick = () => itemSheet(null, b.dataset.new));
  $$('.it', v).forEach(r => r.onclick = () => itemSheet(S.items.find(x => x.id === r.dataset.id)));
  $$('[data-act]', v).forEach(b => b.onclick = e => {
    e.stopPropagation();
    const it = S.items.find(x => x.id === b.dataset.id);
    if (b.dataset.act === 'cancelled') { removeItem(it.id); toast(t('{name} removed', { name: it.name })); }
    else { it.trial = false; upsertItem(it); toast(t('{name} kept', { name: it.name })); }
  });
}

// ---- add / edit ----
const NEW_KIND = { income: t('New income'), bill: t('New bill'), sub: t('New subscription'), move: t('New move') };
function itemSheet(existing, kind = 'sub', preset = null, title = null) {
  const accts = liveAccounts();
  const main = mainAccount();
  const it = preset || (existing ? JSON.parse(JSON.stringify(existing)) : {
    id: uid(), kind, name: '', amount: 0, acct: (main || accts[0]).id, to: null,
    start: todayISO(), repeat: 'month', trial: false, varies: false, paused: false,
  });
  const dateLabel = () => it.kind === 'income' ? t('Next payday') : it.kind === 'move' ? t('Next move') : it.trial ? t('Trial ends (first payment)') : t('Next payment');
  const acctChips = (sel, id, skip, outside) => `<div class="chips" id="${id}">${accts.filter(a => a.id !== skip).map(a =>
    `<button class="chip ${a.id === sel ? 'on' : ''}" data-a="${a.id}"><span class="dot" style="background:${accColor(a)}"></span>${esc(a.name)} · ${a.cur}</button>`).join('')}${outside ? `<button class="chip ${!sel ? 'on' : ''}" data-a="">${t('Outside Kalendae')}</button>` : ''}</div>`;

  const draw = () => {
    const a = accountById(it.acct) || accts[0];
    // a move can be counted in any currency: the source's, the destination's (e.g. EUR savings), or any you use (e.g. USD stocks)
    const moveCurChips = it => {
      const src = a.cur, dst = it.to && accountById(it.to) ? accountById(it.to).cur : null;
      const opts = [...new Set([src, dst, ...S.settings.currencies].filter(Boolean))];
      const cur = itemCur(it);
      const note = cur === src ? t('Taken from {a} as typed.', { a: esc(a.name) })
        : t('{a} pays ≈ {v} at the 30-day average rate.', { a: esc(a.name), v: fmt(conv(it.amount || 0, cur, src), src) });
      return `<div class="chips" id="iCurPick" style="margin-top:8px">${opts.map(c => `<button class="chip ${c === cur ? 'on' : ''}" data-c="${c}">${c}</button>`).join('')}
        <button class="chip" data-c="+">${t('Other…')}</button></div><p class="sub" style="margin-top:6px">${note}</p>`;
    };
    return `<h2>${title ? esc(title) : existing ? esc(existing.name) : NEW_KIND[it.kind]}</h2>
    <div class="seg" id="iKind" style="margin:6px 0 4px">${Object.entries(KINDS).map(([k, d]) => `<button data-k="${k}" class="${k === it.kind ? 'on' : ''}">${d.one}</button>`).join('')}</div>
    <div class="field"><label>${t('Name')}</label><input class="input" id="iName" value="${esc(it.name)}" placeholder="${esc(SUGGEST[it.kind][0])}" autocomplete="off">
      <div class="chips" id="iSug" style="margin-top:8px"></div></div>
    <div class="field"><label>${it.kind === 'income' ? t('Amount you receive') : t('Amount')}${it.varies ? ' ' + t('(average)') : ''}</label>
      <div style="display:flex;gap:8px;align-items:center"><input class="input money num" id="iAmt" inputmode="decimal" value="${it.amount || ''}" placeholder="0" style="flex:1"><span class="sub num" id="iCur" style="min-width:42px">${itemCur(it)}</span></div>
      ${it.kind === 'move' ? moveCurChips(it) : ''}</div>
    <div class="field"><label>${it.kind === 'income' ? t('Arrives in') : it.kind === 'move' ? t('From') : t('Paid from')}</label>${acctChips(it.acct, 'iAcct')}</div>
    ${it.kind === 'move' ? `<div class="field"><label>${t('To')}</label>${acctChips(it.to, 'iTo', it.acct, true)}
      <p class="sub" style="margin-top:6px">${t('A move between your own accounts isn’t spending. “Outside Kalendae” is for money that leaves, like investing.')}</p></div>` : ''}
    <div class="field"><label>${dateLabel()}</label><input class="input num" id="iDate" type="date" value="${it.start}"></div>
    <div class="field"><label>${t('Repeats')}</label><select class="input" id="iRep">${Object.entries(REPEATS).map(([k, [n]]) => `<option value="${k}" ${k === it.repeat ? 'selected' : ''}>${n}</option>`).join('')}</select></div>
    <div class="field"><label>${t('Notify me')}</label><div class="chips" id="iRem">${Object.entries(REMIND).map(([k, [n]]) =>
      `<button class="chip ${k === remindOf(it) ? 'on' : ''}" data-r="${k}">${n}</button>`).join('')}</div>
      ${isTrialNow(it) ? `<p class="sub" style="margin-top:6px">${t('Trials always warn you 2 days before and on the day.')}</p>` : ''}</div>
    ${it.kind === 'sub' ? `<div class="field"><label>${t('How often do you use it?')}</label><div class="chips" id="iUse">${Object.entries(USAGE).map(([k, [n]]) =>
        `<button class="chip ${k === it.usage ? 'on' : ''}" data-u="${k}">${n}</button>`).join('')}</div></div>
      <div class="field"><label>${t('Cheaper plans (optional)')}</label>
        <div style="display:flex;gap:8px"><input class="input num" id="iAlt" inputmode="decimal" value="${it.alt || ''}" placeholder="${esc(t('Yearly plan, per year'))}">
        <input class="input num" id="iAltM" inputmode="decimal" value="${it.altMonthly || ''}" placeholder="${esc(t('Cheaper tier, a month'))}"></div>
        <p class="sub" style="margin-top:6px">${t('In {c}. Kalendae tells you if switching would save money.', { c: itemCur(it) })}</p></div>
      ${existing && !isTrialNow(it) ? `<div class="why">${(() => { const vd = subVerdict(it); return `<div class="why-h">${ringSvg(subSignals(it).map(s => s[0] === vd), 44, VERDICT[vd][1])}<b style="color:${VERDICT[vd][1]}">${VERDICT[vd][0]}</b></div>`; })()}
        ${subSignals(it).map(([v, k, txt]) => `<div><i style="color:${VERDICT[v][1]}">${k}</i><span>${esc(txt)}</span></div>`).join('')}</div>` : ''}` : ''}
    <div class="card" style="margin-top:16px;padding:6px 16px">
      ${it.kind === 'sub' ? `<div class="tog"><div>${t('Free trial now')}<small>${t('The date above is when it turns paid')}</small></div><button class="sw-t ${it.trial ? 'on' : ''}" id="iTrial"></button></div>` : ''}
      ${it.kind !== 'move' ? `<div class="tog"><div>${t('Amount changes')}<small>${t('Like electricity: type an average')}</small></div><button class="sw-t ${it.varies ? 'on' : ''}" id="iVar"></button></div>` : ''}
      ${existing ? `<div class="tog"><div>${t('Paused')}<small>${t('Kept, but left out of the forecast')}</small></div><button class="sw-t ${it.paused ? 'on' : ''}" id="iPause"></button></div>` : ''}
    </div>
    <div class="row2">${existing ? `<button class="btn danger" id="iDel">${t('Delete')}</button>` : `<button class="btn ghost" id="iCancel">${t('Cancel')}</button>`}<button class="btn" id="iSave">${t('Save')}</button></div>`;
  };

  const keep = body => { // remember typed values before redrawing
    it.name = $('#iName', body).value;
    const v = parseAmount($('#iAmt', body).value); if (v != null) it.amount = Math.abs(v);
    it.start = $('#iDate', body).value || it.start;
    it.repeat = $('#iRep', body).value;
    const alt = $('#iAlt', body), altM = $('#iAltM', body);
    if (alt) { it.alt = Math.abs(parseAmount(alt.value) || 0) || undefined; it.altMonthly = Math.abs(parseAmount(altM.value) || 0) || undefined; }
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
    $$('#iRem button', body).forEach(b => b.onclick = () => { keep(body); it.remind = b.dataset.r; redraw(); });
    $$('#iUse button', body).forEach(b => b.onclick = () => { keep(body); it.usage = it.usage === b.dataset.u ? undefined : b.dataset.u; redraw(); });
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
        const typed = await promptSheet(t('Which currency?'), t('Type its 3-letter code, e.g. USD, EUR, CHF. Kalendae knows {n}.', { n: Object.keys(CURRENCIES).length }), { placeholder: 'USD', ok: t('Use it') });
        c = typed && typed.trim().toUpperCase();
        if (!c) { itemSheet(existing, it.kind, it, title); return; }
        if (!CURRENCIES[c]) { toast(t('{c} isn’t in the list', { c })); itemSheet(existing, it.kind, it, title); return; }
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
      if (!(it.amount > 0)) { toast(t('Type the amount')); return; }
      if (!it.start) { toast(t('Pick the date')); return; }
      if (it.kind === 'move' && it.to === it.acct) { toast(t('Pick a different account to move to')); return; }
      if (it.kind === 'move' && it.to) it.inName = t('From {a}', { a: accountById(it.acct).name }); else delete it.inName;
      if (it.kind !== 'move' || !it.cur || it.cur === accountById(it.acct).cur) delete it.cur;
      if (it.kind !== 'sub') { delete it.usage; delete it.alt; delete it.altMonthly; delete it.prices; }
      notePrice(it, existing);
      if (it.remind === defaultRemind(it)) delete it.remind;
      upsertItem(it);
      tick(); closeSheet();
      toast(existing ? t('Saved') : t('{name} added', { name: it.name }));
    };
    if (existing) $('#iDel', body).onclick = async () => {
      if (await confirmSheet(t('Delete {name}?', { name: existing.name }), t('It’s removed from your forecast. Nothing changes in your real account.'), t('Delete'), true)) { removeItem(existing.id); toast(t('Deleted')); }
    };
    else $('#iCancel', body).onclick = closeSheet;
  };
  const redraw = () => { $('#sheetBody').innerHTML = draw(); mount($('#sheetBody')); };
  openSheet(draw(), mount);
}
