// Today: the month's orbit, what's safe to spend until payday, warnings, how sure the number is,
// the payday plan, and what's next.
const NS = 'http://www.w3.org/2000/svg';
const el = (tag, attrs = {}, parent) => {
  const e = document.createElementNS(NS, tag);
  for (const k in attrs) e.setAttribute(k, attrs[k]);
  if (parent) parent.appendChild(e);
  return e;
};

// Augur-style ring: faint track, rounded gradient segments with a soft glow, glass centre
function ringSvg(votes, size = 92, color) {
  const big = size > 60, u = 'rg' + (++_uid);
  const sw = big ? Math.max(6, size * .085) : Math.max(3.4, size * .075);
  const C = size / 2, r = C - sw / 2 - (big ? 4 : 1.5), n = votes.length, gap = big ? 0.26 : 0.34;
  const stops = color
    ? `<stop offset="0" style="stop-color:${color};stop-opacity:.7"/><stop offset="1" style="stop-color:${color}"/>`
    : '<stop offset="0" style="stop-color:var(--r1)"/><stop offset=".5" style="stop-color:var(--r2)"/><stop offset="1" style="stop-color:var(--r3)"/>';
  let s = `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" style="overflow:visible;flex:none">
    <defs><linearGradient id="${u}" x1="0" y1="0" x2="1" y2="1">${stops}</linearGradient>
    <radialGradient id="${u}c" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#fff" stop-opacity=".2"/><stop offset="1" stop-color="#fff" stop-opacity=".03"/></radialGradient></defs>
    <circle cx="${C}" cy="${C}" r="${r}" fill="none" stroke="var(--line)" stroke-width="${sw}" opacity=".7"/>`;
  votes.forEach((v, i) => {
    const a0 = (i / n) * Math.PI * 2 - Math.PI / 2 + gap / 2, a1 = ((i + 1) / n) * Math.PI * 2 - Math.PI / 2 - gap / 2;
    const p = a => `${(C + r * Math.cos(a)).toFixed(2)} ${(C + r * Math.sin(a)).toFixed(2)}`;
    if (v) s += `<path d="M${p(a0)} A${r} ${r} 0 0 1 ${p(a1)}" fill="none" stroke="url(#${u})" stroke-width="${sw}" stroke-linecap="round" style="filter:drop-shadow(0 0 ${big ? 5 : 2.5}px var(--ringGlow))"/>`;
  });
  if (big) {
    s += `<circle cx="${C}" cy="${C}" r="${r - sw / 2 - 5}" fill="url(#${u}c)" stroke="var(--line)" stroke-width="1"/>
      <text x="${C}" y="${C + size * .07}" text-anchor="middle" font-family="var(--serif)" font-size="${size * .28}" fill="url(#${u})">${votes.filter(Boolean).length}<tspan font-size="${size * .14}" fill="var(--muted)">/${n}</tspan></text>
      <text x="${C}" y="${C + size * .23}" text-anchor="middle" font-size="${size * .085}" font-weight="700" letter-spacing="1.4" fill="var(--muted)">${esc(t('AGREE'))}</text>`;
  }
  return s + '</svg>';
}

let orbitSel = null;
const ORBIT_N = 30;
function orbitGroups() {
  const g = {};
  liveItems().forEach(it => {
    const ring = (it.kind === 'income' || it.kind === 'move') ? 0 : ((REPEATS[it.repeat] || REPEATS.month)[1] === 'month' && !isTrialNow(it)) ? 1 : 2;
    occurrences(it, ORBIT_N - 1, 0).forEach(k => { const key = k + '-' + ring; (g[key] = g[key] || { k, ring, items: [] }).items.push(it); });
  });
  return Object.values(g);
}

function drawOrbit(svgEl, center, safe) {
  svgEl.innerHTML = '';
  const C = 170, R = [86, 112, 138];
  const ang = t => (t / ORBIT_N) * Math.PI * 2 - Math.PI / 2;
  const pt = (t, r) => [C + r * Math.cos(ang(t)), C + r * Math.sin(ang(t))];
  svgEl.insertAdjacentHTML('beforeend', `<defs><linearGradient id="orbG" x1="0" y1="0" x2="1" y2="1"><stop offset="0" style="stop-color:var(--r1)"/><stop offset=".5" style="stop-color:var(--r2)"/><stop offset="1" style="stop-color:var(--r3)"/></linearGradient>
    <radialGradient id="orbC"><stop offset=".55" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#fff" stop-opacity=".07"/></radialGradient></defs>
    <circle cx="170" cy="170" r="74" fill="url(#orbC)" stroke="var(--line)"/>`);
  R.forEach((r, i) => el('circle', { cx: C, cy: C, r, fill: 'none', stroke: 'var(--line)', 'stroke-width': i === 1 ? 1.4 : 1, 'stroke-dasharray': i === 0 ? '2 4' : i === 2 ? '1 5' : '' }, svgEl));
  for (let t = 0; t < ORBIT_N; t++) {
    const [x1, y1] = pt(t, 152), [x2, y2] = pt(t, dateIn(t).getDay() === 1 ? 160 : 156);
    el('line', { x1, y1, x2, y2, stroke: 'var(--muted)', 'stroke-opacity': .5, 'stroke-width': 1 }, svgEl);
  }
  [7, 14, 21].forEach(t => {
    const [x, y] = pt(t, 168);
    el('text', { x, y: y + 3, 'text-anchor': 'middle', 'font-size': 9.5, fill: 'var(--muted)', 'font-family': 'var(--sans)' }, svgEl).textContent = dateIn(t).toLocaleDateString(LOCALE, { day: 'numeric', month: 'short' });
  });
  el('path', { d: `M${C - 5} 4 L${C + 5} 4 L${C} 12 Z`, fill: 'var(--ink)' }, svgEl);
  if (safe && safe.payT && safe.payT < ORBIT_N) {
    const [x0, y0] = pt(0, 146), [x1, y1] = pt(safe.payT, 146);
    el('path', { d: `M${x0} ${y0} A146 146 0 ${safe.payT > ORBIT_N / 2 ? 1 : 0} 1 ${x1} ${y1}`, fill: 'none', stroke: 'url(#orbG)', 'stroke-width': 4, 'stroke-linecap': 'round', style: 'filter:drop-shadow(0 0 5px var(--ringGlow))' }, svgEl);
  }
  moonEvents(ORBIT_N - 1).forEach(m => {
    const [x, y] = pt(m.t, 152);
    const g = el('g', {}, svgEl);
    el('circle', { cx: x, cy: y, r: 5.5, fill: m.type === 'full' ? 'var(--gold)' : 'var(--solid)', stroke: 'var(--gold)', 'stroke-width': 1.4 }, g);
    el('title', {}, g).textContent = (m.type === 'full' ? t('Full moon') : t('New moon')) + ' · ' + dfmt(dateIn(m.t), { day: 'numeric', month: 'short' });
  });
  orbitGroups().forEach(g => {
    const total = g.items.reduce((s, it) => s + Math.abs(conv(it.amount, itemCur(it), 'PLN')), 0);
    const r = Math.max(5, Math.min(12, 3.5 + Math.sqrt(total) / 6));
    const [x, y] = pt(g.k, R[g.ring]);
    const fill = g.ring === 0 ? 'var(--gold)' : accColor(accountById(g.items[0].acct));
    const key = g.k + '-' + g.ring;
    const node = el('g', { style: `cursor:pointer;transform-origin:${x}px ${y}px` }, svgEl);
    if (orbitSel === key) el('circle', { cx: x, cy: y, r: r + 5, fill: 'none', stroke: 'var(--ink)', 'stroke-width': 1.2 }, node);
    el('circle', { cx: x, cy: y, r: r + 2, fill: 'var(--solid)' }, node);
    el('circle', { cx: x, cy: y, r, fill }, node);
    if (g.items.some(isTrialNow)) el('circle', { cx: x, cy: y, r: r + 3.5, fill: 'none', stroke: 'var(--a4)', 'stroke-width': 1.2, 'stroke-dasharray': '2 2' }, node);
    el('circle', { cx: x, cy: y, r: 17, fill: 'transparent' }, node);
    node.addEventListener('click', e => { e.stopPropagation(); tick('8'); orbitSel = orbitSel === key ? null : key; drawOrbit(svgEl, center, safe); });
  });
  drawCenter(center, safe);
}

function drawCenter(c, safe) {
  if (orbitSel) {
    const g = orbitGroups().find(g => g.k + '-' + g.ring === orbitSel);
    if (g) {
      const rows = g.items.map(it => {
        const v = it.amount * KINDS[it.kind].sign;
        return `<div class="row"><span>${esc(it.name)}</span><b class="num ${v > 0 ? 'pos' : ''}">${v > 0 ? '+' : ''}${fmt(v, itemCur(it))}</b></div>`;
      }).join('');
      c.innerHTML = `<div class="k">${dateIn(g.k).toLocaleDateString(LOCALE, { weekday: 'short', day: 'numeric', month: 'short' })}</div><div class="sub" style="margin:3px 0 8px">${inDaysText(g.k)}</div>${rows}`;
      return;
    }
    orbitSel = null;
  }
  if (!safe) { c.innerHTML = ''; return; }
  c.innerHTML = `<div class="k">${t('Safe to spend')}</div><div class="big num" style="color:${safe.safe < 0 ? 'var(--warn)' : 'inherit'}">${fmt(safe.safe)}</div>
    <div class="sub">${safe.noIncome ? t('next 30 days') : t('until payday · {d}', { d: dfmt(dateIn(safe.payT), { day: 'numeric', month: 'short' }) })}<br>${safe.safe > 0 ? t('≈ {v} a day', { v: fmt(safe.perDay) }) : t('after what’s planned')}</div>`;
}

function renderToday() {
  const v = $('#vToday');
  const accts = liveAccounts();
  if (!accts.length) {
    v.innerHTML = `<div class="card soon"><div style="width:110px;margin:0 auto">${iconSVG({ size: 110 })}</div>
      <div class="big">${t('A forecast for your money')}</div>
      <p class="sub">${t('Start with your accounts, then your income, bills and subscriptions. Kalendae shows what’s safe to spend until payday.')}</p>
      <button class="btn wide" style="margin-top:18px" id="goAccts">${t('Add your accounts')}</button></div>`;
    $('#goAccts').onclick = () => { showTab('accounts'); accountSheet(); };
    return;
  }
  const safe = safeToSpend();
  const items = liveItems();
  const short = d => dfmt(d, { day: 'numeric', month: 'short' });
  let html = `<div class="orbitWrap"><svg id="orbit" viewBox="0 0 340 340" preserveAspectRatio="xMidYMid meet"></svg><div class="orbitCenter" id="orbitCenter"></div></div>
    <div class="legend"><span><span class="dot" style="background:var(--gold)"></span>${t('Money in & moves')}</span><span>${t('Middle: monthly')}</span><span>${t('Outer: other & trials')}</span></div>`;

  if (!items.length) html += `<div class="card"><h3>${t('Next: what comes and goes')}</h3><p class="sub">${t('Add your salary, bills and subscriptions so the orbit fills up and “safe to spend” knows what’s coming.')}</p>
    <button class="btn wide" style="margin-top:12px" id="tAdd">${t('Add income or a bill')}</button></div>`;

  const due = checkinDue();
  if (due.length) html += `<div class="card ciCard"><div class="wt">${svg('<path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>')}
    <div><b>${t('Time for a check-in')}</b><br>${due.length === 1 ? t('{a} was last updated {ago}.', { a: esc(due[0].name), ago: agoText(due[0].balanceAt) }) : t('{n} balances are a week old or more.', { n: due.length })} ${t('Type what’s in them now and Kalendae learns your everyday spending.')}</div></div>
    <div class="row2"><button class="btn" id="tCheck">${t('Check in')}</button></div></div>`;

  warnings().slice(0, 2).forEach(w => {
    const a = w.acct;
    html += `<div class="card warn"><div class="wt">${svg('<path d="M12 3 2 20h20L12 3z"/><path d="M12 10v4M12 17.5v.5"/>')}
      <div><b>${t('{a} runs short around {d}', { a: esc(a.name), d: short(w.first.date) })}</b><br>
      ${w.payT && w.payT > w.first.t ? t('Lowest point {v} on {d}, before money next arrives.', { v: fmt(w.low.mid), d: short(w.low.date) }) : t('Lowest point {v} on {d}.', { v: fmt(w.low.mid), d: short(w.low.date) })}${a.shared && a.partner ? ' ' + t('Worth telling {name}.', { name: esc(a.partner) }) : ''}</div></div>
      <div class="row2"><button class="btn ghost" data-fix="${a.id}">${t('Plan a top-up')}</button></div></div>`;
  });

  html += spendCardHtml();

  if (safe) {
    const nonIncome = items.filter(it => it.kind !== 'income').length;
    const sig = [
      [!safe.noIncome, safe.noIncome ? t('No income dated in {a}', { a: esc(safe.acct.name) }) : t('Income is dated')],
      [nonIncome > 0, nonIncome ? tn(nonIncome, '{n} commitment has a date', '{n} commitments have dates') : t('No bills or subscriptions yet')],
      [safe.acct.balanceAt && (new Date(todayISO()) - new Date(safe.acct.balanceAt)) / 864e5 <= 7, t('Balance updated {ago}', { ago: agoText(safe.acct.balanceAt) })],
      [!!safe.acct.everyday, safe.acct.everyday ? t('Everyday spending is set') : t('Everyday spending not set')],
    ];
    const agree = sig.filter(s => s[0]).length;
    const sure = [t('Rough guess'), t('Rough guess'), t('Fairly sure'), t('Fairly sure'), t('Sure')][agree];
    html += `<div class="card" id="safeCard"><h3>${t('How sure is “safe to spend”?')} <em>${sure}</em></h3>
      <div class="agree">${ringSvg(sig.map(s => s[0]))}<ul>${sig.map(s => `<li class="${s[0] ? 'y' : 'n'}"><i>${s[0] ? '✓' : '~'}</i>${s[1]}</li>`).join('')}</ul></div>
      <p class="sub" style="margin-top:10px">${safe.acct.everyday && safe.fun > 0 ? t('At your usual everyday spending you’d still have {v} spare for fun.', { v: `<b class="num">${fmt(safe.fun)}</b>` }) : ''}
      ${S.settings.floor ? t('Counted from {a}, keeping {v} untouched.', { a: `<b>${esc(safe.acct.name)}</b>`, v: fmt(S.settings.floor, safe.acct.cur) }) : t('Counted from {a}.', { a: `<b>${esc(safe.acct.name)}</b>` })} <a href="#" id="safeSet" class="link">${t('Change')}</a></p></div>`;
  }

  const plan = paydayPlan();
  if (plan && plan.income > 0) {
    const total = plan.rows.reduce((s, r) => s + r.v, 0) + Math.max(0, plan.left);
    html += `<div class="card"><h3>${t('Payday plan · {d}', { d: short(dateIn(plan.day)) })} <em class="num">${fmt(plan.income)}</em></h3>
      <div class="planbar">${plan.rows.map(r => `<div style="flex:${r.v / total};background:${r.c}"></div>`).join('')}${plan.left > 0 ? `<div style="flex:${plan.left / total};background:var(--gold)"></div>` : ''}</div>
      <div class="planlist">${plan.rows.map(r => `<div class="l"><span class="dot" style="background:${r.c}"></span><span>${esc(r.k)}${r.s ? `<small>${r.s}</small>` : ''}</span></div><div class="num">${fmt(r.v)}</div>`).join('')}
      <div class="l"><span class="dot" style="background:var(--gold)"></span><span><b>${plan.left >= 0 ? t('Free') : t('Short')}</b><small>${plan.left >= 0 ? t('yours to spend, save or invest') : t('more is planned than comes in')}</small></span></div><div class="num" style="color:${plan.left < 0 ? 'var(--warn)' : 'inherit'}"><b>${fmt(plan.left)}</b></div></div></div>`;
  }

  const next = upcoming(14).slice(0, 7);
  if (next.length) html += `<div class="card"><h3>${t('Next up')} <em>${t('every account')}</em></h3><ul class="list">${next.map(({ k, it }) => {
    const d = dateIn(k), a = accountById(it.acct), sign = KINDS[it.kind].sign, b = fmtBoth(it.amount * sign, itemCur(it));
    return `<li class="it" data-id="${it.id}"><div class="when">${dfmt(d, { month: 'short' })}<b>${d.getDate()}</b></div>
      <div><div class="nm">${esc(it.name)}${isTrialNow(it) && k === nextIn(it) ? ' · ' + t('trial ends') : ''}</div><div class="meta"><span class="dot" style="background:${accColor(a)}"></span>${esc(a.name)} · ${inDaysText(k)}</div></div>
      <div class="amt num ${sign > 0 ? 'pos' : ''}">${sign > 0 ? '+' : ''}${b.main}${b.approx ? `<small>${b.approx}</small>` : ''}</div></li>`;
  }).join('')}</ul></div>`;

  v.innerHTML = html;
  drawOrbit($('#orbit'), $('#orbitCenter'), safe);
  const add = $('#tAdd'); if (add) add.onclick = () => itemSheet(null, 'income');
  const chk = $('#tCheck'); if (chk) chk.onclick = () => checkinSheet();
  const ss = $('#safeSet'); if (ss) ss.onclick = e => { e.preventDefault(); safeSettingsSheet(); };
  $$('.it[data-id]', v).forEach(r => r.onclick = () => itemSheet(S.items.find(x => x.id === r.dataset.id)));
  mountSpendButtons(v);
  $$('[data-fix]', v).forEach(b => b.onclick = () => {
    const a = accountById(b.dataset.fix);
    const from = liveAccounts().find(x => x.id !== a.id && x.type === 'savings') || liveAccounts().find(x => x.id !== a.id && x.type !== 'card');
    if (!from) { toast(t('Add another account to move money from')); return; }
    const w = warnings().find(w => w.acct.id === a.id);
    const need = Math.ceil(conv(w.floor - w.low.mid, S.settings.display, from.cur) / 50) * 50 + 50;
    itemSheet(null, 'move', { id: uid(), kind: 'move', name: t('Top up {a}', { a: a.name }), amount: need, acct: from.id, to: a.id, cur: from.cur,
      start: isoDay(addDays(w.first.date, -1)), repeat: 'once', trial: false, varies: false, paused: false }, t('Plan a top-up'));
  });
}

function safeSettingsSheet() {
  const a = mainAccount();
  openSheet(`<h2>${t('Safe to spend')}</h2><p class="lead">${t('Which account do you spend from day to day? Kalendae counts what’s left in it until your next income arrives.')}</p>
    <div class="field"><label>${t('Spending account')}</label><div class="chips" id="mA">${liveAccounts().filter(x => x.type !== 'card').map(x =>
      `<button class="chip ${x.id === a.id ? 'on' : ''}" data-a="${x.id}"><span class="dot" style="background:${accColor(x)}"></span>${esc(x.name)}</button>`).join('')}</div></div>
    <div class="field"><label>${t('Always keep at least')}</label><div style="display:flex;gap:8px;align-items:center"><input class="input money num" id="mF" inputmode="decimal" value="${S.settings.floor || ''}" placeholder="0" style="flex:1"><span class="sub" id="mC">${a.cur}</span></div>
      <p class="sub" style="margin-top:6px">${t('A cushion that “safe to spend” never touches. You’ll get a warning if the forecast dips below it.')}</p></div>
    <div class="row2"><button class="btn ghost" id="mX">${t('Cancel')}</button><button class="btn" id="mS">${t('Save')}</button></div>`, body => {
    let pick = a.id;
    $$('#mA button', body).forEach(b => b.onclick = () => { pick = b.dataset.a; $$('#mA button', body).forEach(x => x.classList.toggle('on', x === b)); $('#mC', body).textContent = accountById(pick).cur; });
    $('#mX', body).onclick = closeSheet;
    $('#mS', body).onclick = () => { S.settings.mainAcct = pick; S.settings.floor = Math.abs(parseAmount($('#mF', body).value) || 0); save(); closeSheet(); toast(t('Saved')); };
  });
}
