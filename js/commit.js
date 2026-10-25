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
  // subscriptions get their keep / review / cancel ring instead of the date (not once you've cancelled one)
  const vd = it.kind === 'sub' && !isTrialNow(it) && !it.paused && !isCancelled(it) ? subVerdict(it) : null;
  const lead = vd ? `<div class="when vr">${ringSvg(subSignals(it).map(s => s[0] === vd), 34, VERDICT[vd][1])}</div>`
    : `<div class="when">${when ? `${dfmt(when, { month: 'short' })}<b>${when.getDate()}</b>` : '—'}</div>`;
  const ends = isCancelled(it) ? `<span class="tag">${t('Ends {d}', { d: dfmt(fromISO(it.until), { day: 'numeric', month: 'short' }) })}</span>` : '';
  return `<li class="it" data-id="${it.id}">
    ${lead}
    <div><div class="nm">${esc(it.name)}${isTrialNow(it) ? `<span class="tag">${t('Trial')}</span>` : ''}${ends}</div><div class="meta">${meta}${vd && when ? ' · ' + t('next {d}', { d: dfmt(when, { day: 'numeric', month: 'short' }) }) : ''}</div></div>
    <div class="amt num ${sign > 0 ? 'pos' : ''}">${sign > 0 ? '+' : ''}${b.main}${b.approx ? `<small>${b.approx}</small>` : ''}${vd ? `<span class="verdict" style="color:${VERDICT[vd][1]}">${VERDICT[vd][0]}</span>` : ''}</div></li>`;
}

let cmKind = 'all'; // which commitments the list shows: all, or one kind
function renderCommit() {
  const v = $('#vCommit');
  if (!liveAccounts().length) {
    v.innerHTML = `<div class="card empty"><div class="big">${t('Add an account first')}</div><p class="sub">${t('Bills and subscriptions are paid from an account, so Kalendae needs at least one.')}</p>
      <button class="btn wide" style="margin-top:14px" id="cGo">${t('Add an account')}</button></div>`;
    $('#cGo').onclick = () => { showTab('accounts'); accountSheet(); };
    return;
  }
  const all = liveItems();
  const ended = all.filter(it => it.kind === 'sub' && hasEnded(it)); // cancelled and past the last paid day
  const items = all.filter(it => !hasEnded(it));
  const trials = items.filter(isTrialNow).sort((x, y) => nextIn(x) - nextIn(y));
  let html = trials.map(it => {
    const k = nextIn(it), a = accountById(it.acct);
    return `<div class="card trial" data-id="${it.id}"><h3>${t('Trial ends')} <em>${inDaysText(k)}</em></h3>
      <div style="display:flex;justify-content:space-between;align-items:flex-end;gap:12px">
        <div><div style="font-family:var(--display);font-weight:700;font-size:24px;letter-spacing:-.5px;line-height:1.1">${esc(it.name)}</div>
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
    // subscriptions worth a second look: one row that takes you to them
    const look = items.filter(it => it.kind === 'sub' && !isTrialNow(it) && !it.paused && !isCancelled(it) && subVerdict(it) !== 'k');
    if (look.length) {
      const yearly = look.reduce((s, it) => s + conv(perMonth(it), itemCur(it)) * 12, 0);
      const unrated = look.filter(it => !it.usage).length;
      html += `<div class="card alerts">${alertRow('id="cLook"', KINDS.sub.icon, 'var(--warn)', `${t('Worth a look')} · ${t('{v} a year', { v: fmt(yearly) })}`,
        tn(look.length, '{n} subscription got a review or cancel vote: {names}.', '{n} subscriptions got a review or cancel vote: {names}.',
          { names: look.slice(0, 3).map(it => esc(it.name)).join(', ') + (look.length > 3 ? '…' : '') }) + ' ' +
        (unrated ? tn(unrated, 'Rate how often you use it for a fairer vote.', 'Rate how often you use them for a fairer vote.') : t('Tap one to see why.')))}</div>`;
    }
    // one list, filtered by kind
    const kinds = ['sub', 'bill', 'income', 'move'].filter(k => items.some(it => it.kind === k));
    if (cmKind !== 'all' && !kinds.includes(cmKind)) cmKind = 'all';
    const byDate = list => list.sort((x, y) => (nextIn(x) ?? 9999) - (nextIn(y) ?? 9999));
    const label = k => k === 'move' ? t('Moves') : KINDS[k].many;
    html += `<div class="seg scroller" id="cKind" style="margin-top:16px">${[['all', t('All')]].concat(kinds.map(k => [k, label(k)])).map(([k, n]) =>
      `<button data-k="${k}" class="${k === cmKind ? 'on' : ''}">${n}</button>`).join('')}</div>
      <div class="card" style="margin-top:10px">${cmKind === 'all'
        ? kinds.map(k => { const list = byDate(items.filter(it => it.kind === k)); return `<div class="grp" style="display:flex;justify-content:space-between"><span>${label(k)}</span><span>${list.length}</span></div><ul class="list">${list.map(itemRow).join('')}</ul>`; }).join('')
        : `<ul class="list">${byDate(items.filter(it => it.kind === cmKind)).map(itemRow).join('')}</ul>`}
        <button class="btn ghost wide" id="cAdd" style="margin-top:12px">${svg('<path d="M12 5v14M5 12h14"/>')} ${cmKind === 'all' ? t('Add') : NEW_KIND[cmKind]}</button></div>`;
  }
  // like the subscriptions page in Google Play: what you've cancelled, when it ran out, and a way back
  if (ended.length) html += `<details class="card"><summary><h3>${t('Cancelled')} <em>${ended.length}</em></h3></summary><ul class="list">${ended.sort((x, y) => y.until.localeCompare(x.until)).map(it => {
    const d = fromISO(it.until), a = accountById(it.acct);
    return `<li class="it" data-ended="${it.id}"><div class="when">${dfmt(d, { month: 'short' })}<b>${d.getDate()}</b></div>
      <div><div class="nm">${esc(it.name)}</div><div class="meta"><span class="dot" style="background:${accColor(a)}"></span>${t('Expired {d}', { d: dfmt(d, { day: 'numeric', month: 'short', year: 'numeric' }) })} · ${fmt(it.amount, itemCur(it))} ${perText(it)}</div></div>
      <div class="amt"><span class="chip">${t('Renew')}</span></div></li>`;
  }).join('')}</ul></details>`;
  html += `<p class="honest">${t('Dates repeat by themselves: a bill on the 31st lands on the last day of shorter months.')}</p>`;
  v.innerHTML = html;
  $$('[data-new]', v).forEach(b => b.onclick = () => itemSheet(null, b.dataset.new));
  $$('#cKind [data-k]', v).forEach(b => b.onclick = () => { tick('8'); cmKind = b.dataset.k; renderCommit(); });
  const add = $('#cAdd', v); if (add) add.onclick = () => itemSheet(null, cmKind === 'all' ? 'sub' : cmKind);
  const lk = $('#cLook', v); if (lk) lk.onclick = () => { cmKind = 'sub'; renderCommit(); $('#cKind').scrollIntoView({ behavior: 'smooth', block: 'start' }); };
  $$('.it[data-id]', v).forEach(r => r.onclick = () => itemSheet(S.items.find(x => x.id === r.dataset.id)));
  $$('[data-ended]', v).forEach(r => r.onclick = () => renewSheet(S.items.find(x => x.id === r.dataset.ended)));
  $$('[data-act]', v).forEach(b => b.onclick = e => {
    e.stopPropagation();
    const it = S.items.find(x => x.id === b.dataset.id);
    // a cancelled trial runs until the day before it would have turned paid
    if (b.dataset.act === 'cancelled') { markCancelled(it, isoDay(addDays(fromISO(it.start), -1)), true); toast(t('{name} cancelled', { name: it.name })); }
    else { it.trial = false; upsertItem(it); toast(t('{name} kept', { name: it.name })); }
  });
}

// ---- cancelling and renewing a subscription ----
// until: the last day you've paid for. A trial may end before today; a paid plan runs at least until today.
function markCancelled(it, until, trial) {
  it.until = !trial && until < todayISO() ? todayISO() : until;
  it.cancelled = todayISO();
  upsertItem(it);
}
function cancelSubSheet(it) {
  const k = nextIn(it);
  const paidUntil = k != null ? isoDay(addDays(dateIn(k), -1)) : todayISO();
  openSheet(`<h2>${t('Cancel subscription')}</h2>
    <p class="lead">${t('Kalendae can’t cancel {name} for you: do that where you pay for it (Google Play, the App Store or the service’s website). Then mark it here, and it stops counting after the last day you’ve paid for.', { name: `<b>${esc(it.name)}</b>` })}</p>
    <div class="field"><label>${t('Paid until')}</label><input class="input num" id="cuD" type="date" value="${paidUntil < todayISO() ? todayISO() : paidUntil}" min="${todayISO()}"></div>
    <div class="row2"><button class="btn ghost" id="cuX">${t('Later')}</button><button class="btn danger" id="cuOk">${t('Mark as cancelled')}</button></div>`, body => {
    $('#cuX', body).onclick = () => itemSheet(it);
    $('#cuOk', body).onclick = () => {
      markCancelled(it, $('#cuD', body).value || todayISO());
      tick(); closeSheet(); toast(t('{name} cancelled', { name: it.name }));
    };
  });
}
function renewSheet(it) {
  const d = fromISO(it.until), when = dfmt(d, { day: 'numeric', month: 'short', year: 'numeric' });
  openSheet(`<h2>${esc(it.name)}</h2>
    <p class="lead">${hasEnded(it) ? t('Expired {d}', { d: when }) : t('Ends {d}', { d: when })}. ${t('Renew it where you paid for it (Google Play, the App Store or the service’s website), then tell Kalendae when the next payment is.')}</p>
    <div class="field"><label>${t('Amount')}</label><div style="display:flex;gap:8px;align-items:center"><input class="input money num" id="rnA" inputmode="decimal" value="${it.amount}" style="flex:1"><span class="sub num">${itemCur(it)}</span></div></div>
    <div class="field"><label>${t('Next payment')}</label><input class="input num" id="rnD" type="date" value="${hasEnded(it) ? todayISO() : isoDay(addDays(d, 1))}"></div>
    <div class="row2"><button class="btn danger" id="rnDel">${t('Remove')}</button><button class="btn" id="rnOk">${t('Renew')}</button></div>`, body => {
    $('#rnOk', body).onclick = () => {
      const before = Object.assign({}, it);
      const v = parseAmount($('#rnA', body).value);
      if (v > 0) it.amount = Math.abs(v);
      it.start = $('#rnD', body).value || todayISO();
      it.trial = false;
      delete it.until; delete it.cancelled;
      notePrice(it, before);
      upsertItem(it);
      tick(); closeSheet(); toast(t('{name} renewed', { name: it.name }));
    };
    $('#rnDel', body).onclick = async () => {
      if (await confirmSheet(t('Delete {name}?', { name: it.name }), t('It’s removed from your forecast. Nothing changes in your real account.'), t('Delete'), true)) { removeItem(it.id); toast(t('Deleted')); }
    };
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
    ${it.kind === 'sub' ? `<div class="card" style="margin-top:16px;padding:4px 16px"><div class="tog"><div>${t('Free trial now')}<small>${t('The date above is when it turns paid')}</small></div><button class="sw-t ${it.trial ? 'on' : ''}" id="iTrial"></button></div></div>
      <div class="field"><label>${t('How often do you use it?')}</label><div class="chips" id="iUse">${Object.entries(USAGE).map(([k, [n]]) =>
        `<button class="chip ${k === it.usage ? 'on' : ''}" data-u="${k}">${n}</button>`).join('')}</div></div>
      ${existing && !isTrialNow(it) && !isCancelled(it) ? `<div class="why">${(() => { const vd = subVerdict(it); return `<div class="why-h">${ringSvg(subSignals(it).map(s => s[0] === vd), 44, VERDICT[vd][1])}<b style="color:${VERDICT[vd][1]}">${VERDICT[vd][0]}</b></div>`; })()}
        ${subSignals(it).map(([v, k, txt]) => `<div><i style="color:${VERDICT[v][1]}">${k}</i><span>${esc(txt)}</span></div>`).join('')}</div>` : ''}` : ''}
    ${existing && it.varies && it.kind !== 'move' ? actualsHtml() : ''}
    ${moreBox('item', `<div class="field"><label>${t('Notify me')}</label><div class="chips" id="iRem">${Object.entries(REMIND).map(([k, [n]]) =>
      `<button class="chip ${k === remindOf(it) ? 'on' : ''}" data-r="${k}">${n}</button>`).join('')}</div>
      ${isTrialNow(it) ? `<p class="sub" style="margin-top:6px">${t('Trials always warn you 2 days before and on the day.')}</p>` : ''}</div>
      ${it.kind === 'sub' ? `<div class="field"><label>${t('Cheaper plans (optional)')}</label>
        <div style="display:flex;gap:8px"><input class="input num" id="iAlt" inputmode="decimal" value="${it.alt || ''}" placeholder="${esc(t('Yearly plan, per year'))}">
        <input class="input num" id="iAltM" inputmode="decimal" value="${it.altMonthly || ''}" placeholder="${esc(t('Cheaper tier, a month'))}"></div>
        <p class="sub" style="margin-top:6px">${t('In {c}. Kalendae tells you if switching would save money.', { c: itemCur(it) })}</p></div>` : ''}
      ${it.kind !== 'move' || existing ? `<div class="card" style="padding:0 16px">
        ${it.kind !== 'move' ? `<div class="tog"><div>${t('Amount changes')}<small>${t('Like electricity: type an average')}</small></div><button class="sw-t ${it.varies ? 'on' : ''}" id="iVar"></button></div>` : ''}
        ${existing ? `<div class="tog"><div>${t('Paused')}<small>${t('Kept, but left out of the forecast')}</small></div><button class="sw-t ${it.paused ? 'on' : ''}" id="iPause"></button></div>` : ''}
      </div>` : ''}`, !!(it.remind || it.alt || it.altMonthly || it.paused || (it.varies && !existing)))}
    ${existing && existing.kind === 'sub' ? (isCancelled(existing)
      ? `<p class="sub" style="margin-top:14px">${t('Ends {d}', { d: dfmt(fromISO(existing.until), { day: 'numeric', month: 'short', year: 'numeric' }) })}</p><button class="btn ghost wide" id="iRenew" style="margin-top:8px">${t('Renew')}</button>`
      : `<button class="btn ghost wide" id="iCancelSub" style="margin-top:12px">${t('Cancel subscription')}</button>`) : ''}
    <div class="row2">${existing ? `<button class="btn danger" id="iDel">${t('Delete')}</button>` : `<button class="btn ghost" id="iCancel">${t('Cancel')}</button>`}<button class="btn" id="iSave">${t('Save')}</button></div>`;
  };

  // what a bill that changes really came to: a column per bill, your estimate (dashed) and the real average (solid)
  let actRange = 12; // months; 0 = everything
  const actualsHtml = () => {
    const cur = itemCur(it), list = it.actuals || [];
    const t0 = day0(), from = actRange ? isoDay(new Date(t0.getFullYear(), t0.getMonth() - actRange, t0.getDate())) : '0000-00-00';
    const shown = list.filter(x => x.d >= from).slice(-24);
    const avg = shown.length ? shown.reduce((s, x) => s + x.v, 0) / shown.length : null;
    const long = d => dfmt(fromISO(d), { day: 'numeric', month: 'short', year: 'numeric' });
    const bars = shown.map(x => ({ v: conv(x.v, cur), label: dfmt(fromISO(x.d), { month: 'short' }), tip: `${long(x.d)} · ${fmt(x.v, cur)}`,
      c: x.v > it.amount * 1.15 ? 'var(--warn)' : 'var(--a1)' }));
    const recent = list.map((x, i) => i).slice(-6).reverse();
    return `<div class="field"><label>${it.kind === 'bill' ? t('Actual bills') : t('Actual amounts')}</label>
      ${list.length ? `<div class="card" style="margin-top:0;padding:12px 14px">
        <div class="chips" id="iActR">${[[6, t('6 months')], [12, t('12 months')], [0, t('Everything')]].map(([m, n]) => `<button class="chip ${m === actRange ? 'on' : ''}" data-m="${m}">${n}</button>`).join('')}</div>
        ${shown.length ? barChartSvg(bars, [{ v: conv(it.amount, cur), dash: true }, { v: conv(avg, cur), color: 'var(--ink)' }]) : `<p class="sub" style="margin-top:10px">${t('Nothing logged here yet.')}</p>`}
        <div class="cap" id="iActCap"></div>
        <div class="fkeys"><span><i class="dash"></i>${t('your estimate')} · ${fmt(it.amount, cur)}</span>${avg != null ? `<span><i style="background:var(--ink)"></i>${t('Your average')} · ${fmt(avg, cur)}</span>` : ''}</div>
        ${avg != null && shown.length >= 2 && Math.abs(avg - it.amount) >= 0.5 ? `<button class="btn ghost wide" id="iActUse" style="margin-top:10px;padding:9px 12px;font-size:13px">${t('Use your average as the estimate')}</button>` : ''}
        <ul class="list" style="margin-top:8px">${recent.map(i => { const x = list[i], d = fromISO(x.d); return `<li><div class="when">${dfmt(d, { month: 'short' })}<b>${d.getDate()}</b></div>
          <div class="sub">${d.getFullYear()}</div><div class="amt num">${fmt(x.v, cur)} <button class="chip" data-del="${i}" aria-label="${esc(t('Remove'))}" style="padding:2px 9px;margin-inline-start:6px">×</button></div></li>`; }).join('')}</ul></div>` : ''}
      <div style="display:flex;gap:8px;margin-top:8px"><input class="input num" id="iActD" type="date" value="${todayISO()}" max="${todayISO()}" style="flex:1.2;min-width:0">
        <input class="input num" id="iActV" inputmode="decimal" placeholder="${esc(t('Amount'))}" style="flex:1;min-width:0"><button class="btn" id="iActAdd" style="padding:10px 14px">${t('Add')}</button></div>
      <p class="sub" style="margin-top:6px">${t('Type what each bill really came to. The forecast then uses last year’s bill from the same time of year, so winter heating isn’t planned at the summer price. Your balance still comes from check-ins.')}</p></div>`;
  };
  // the bill history is saved straight away, without the Save button
  const saveActuals = withAmount => {
    const live = S.items.find(x => x.id === it.id);
    if (!live) return;
    live.actuals = (it.actuals || []).slice();
    if (withAmount) live.amount = it.amount;
    save();
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
    // bill history
    $$('#iActR [data-m]', body).forEach(b => b.onclick = () => { keep(body); actRange = +b.dataset.m; redraw(); });
    const actAdd = $('#iActAdd', body);
    if (actAdd) actAdd.onclick = () => {
      keep(body);
      const v = parseAmount($('#iActV', body).value), d = $('#iActD', body).value;
      if (!(v > 0) || !d) { toast(t('Type the amount')); return; }
      it.actuals = (it.actuals || []).concat([{ d, v: Math.abs(v) }]).sort((x, y) => x.d.localeCompare(y.d)).slice(-60);
      saveActuals(); tick('8'); redraw();
    };
    $$('[data-del]', body).forEach(b => b.onclick = () => { keep(body); it.actuals.splice(+b.dataset.del, 1); saveActuals(); redraw(); });
    const actUse = $('#iActUse', body);
    if (actUse) actUse.onclick = () => {
      keep(body);
      const t0 = day0(), from = actRange ? isoDay(new Date(t0.getFullYear(), t0.getMonth() - actRange, t0.getDate())) : '0000-00-00';
      const shown = it.actuals.filter(x => x.d >= from).slice(-24);
      it.amount = Math.round(shown.reduce((s, x) => s + x.v, 0) / shown.length * 100) / 100;
      saveActuals(true); tick(); redraw(); toast(t('Saved'));
    };
    mountBars(body, '#iActCap');
    // cancelling a subscription, or bringing a cancelled one back
    const cancelSub = $('#iCancelSub', body); if (cancelSub) cancelSub.onclick = () => cancelSubSheet(existing);
    const renew = $('#iRenew', body); if (renew) renew.onclick = () => renewSheet(existing);
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
