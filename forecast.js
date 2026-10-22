// Forecast: each account's balance for the next 60 days, with an 80% likely range,
// in the currency you show money in.
let fcSel = null; // account id, or 'all'

function renderForecast() {
  const v = $('#vForecast');
  const accts = liveAccounts().filter(a => a.type !== 'card');
  if (!accts.length) {
    v.innerHTML = `<div class="card empty"><div class="big">${t('Nothing to forecast yet')}</div><p class="sub">${t('Add an account and a few bills, and the next 60 days appear here.')}</p></div>`;
    return;
  }
  if (!fcSel || (fcSel !== 'all' && !accountById(fcSel))) fcSel = (mainAccount() || accts[0]).id;
  const ids = fcSel === 'all' ? liveAccounts().map(a => a.id) : [fcSel];
  const f = forecast(ids);
  const low = lowestPoint(f), end = f[HORIZON];
  const sel = fcSel === 'all' ? null : accountById(fcSel);
  const floor = sel && sel === mainAccount() && S.settings.floor ? conv(S.settings.floor, sel.cur) : null;
  const short = d => dfmt(d, { day: 'numeric', month: 'short' });
  v.innerHTML = `<div class="chips" style="margin:8px 0 2px">${accts.map(a =>
      `<button class="chip ${a.id === fcSel ? 'on' : ''}" data-f="${a.id}"><span class="dot" style="background:${accColor(a)}"></span>${esc(a.name)}</button>`).join('')}
      ${liveAccounts().length > 1 ? `<button class="chip ${fcSel === 'all' ? 'on' : ''}" data-f="all">${t('Everything')}</button>` : ''}</div>
    <div class="card"><h3><span>${sel ? esc(sel.name) : t('Everything')} · ${t('60 days')} · ${S.settings.display}</span><em>${t('80% likely range')}</em></h3>
      <div class="chartWrap" id="chartWrap"><svg id="chart"></svg><div class="tip" id="tip"></div></div>
      <div class="fkeys"><span><i style="background:${sel ? accColor(sel) : 'var(--ink)'}"></i>${t('Expected')}</span><span><i class="band"></i>${t('Likely range')}</span>${floor != null ? `<span><i class="dash"></i>${t('Your floor')}</span>` : ''}<span><i class="pay"></i>${t('Payday')}</span></div>
      <div class="stats">
        <div class="stat"><div class="k">${t('Now')}</div><div class="v num">${fmt(f[0].mid)}</div><div class="s">${sel ? t('updated {ago}', { ago: agoText(sel.balanceAt) }) : t('all accounts')}</div></div>
        <div class="stat"><div class="k">${t('Lowest')}</div><div class="v num" style="color:${low.mid < 0 ? 'var(--warn)' : 'inherit'}">${fmt(low.mid)}</div><div class="s">${short(low.date)}</div></div>
        <div class="stat"><div class="k">${short(end.date)}</div><div class="v num">${fmt(end.mid)}</div><div class="s">± ${fmt((end.hi - end.lo) / 2)}</div></div></div></div>
    <div class="card"><h3>${t('What moves the line')}</h3><ul class="list" id="fcList"></ul></div>
    <p class="honest">${ids.some(id => accountById(id).everyday) ? t('The range widens because everyday spending varies; weekly check-ins narrow it.') : t('Add your everyday spending to an account and the forecast takes it off day by day.')}
      ${ids.some(id => accountById(id).cur !== S.settings.display) ? ' ' + t('Money in other currencies widens it a little too.') : ''} ${t('It’s a forecast, not a bank statement.')}</p>`;

  $$('[data-f]', v).forEach(b => b.onclick = () => { fcSel = b.dataset.f; tick('8'); renderForecast(); });
  const big = [];
  f.forEach(p => p.ev.forEach(e => big.push({ p, e })));
  big.sort((x, y) => x.p.t - y.p.t);
  const daily = ids.reduce((s, id) => s + dailySpend(accountById(id)) * (ids.length > 1 ? myShare(accountById(id)) : 1), 0);
  $('#fcList').innerHTML = big.slice(0, 12).map(({ p, e }) => `<li><div class="when">${dfmt(p.date, { month: 'short' })}<b>${p.date.getDate()}</b></div>
      <div><div class="nm">${esc(e.name)}</div><div class="meta"><span class="dot" style="background:${accColor(e.acct)}"></span>${esc(e.acct.name)}${e.it.varies ? ' · ' + t('average') : ''}</div></div>
      <div class="amt num ${e.a > 0 ? 'pos' : ''}">${e.a > 0 ? '+' : ''}${fmt(e.a)}</div></li>`).join('') +
    (daily ? `<li><div class="when">${t('daily')}</div><div><div class="nm">${t('Everyday spending')}</div><div class="meta">${t('your estimate')}</div></div><div class="amt num">${fmt(-daily)}</div></li>` : '') ||
    `<li><div></div><div class="sub">${t('Nothing planned in the next 60 days.')}</div><div></div></li>`;
  requestAnimationFrame(() => drawChart(f, sel, floor, ids));
}

const FC_TODAY = t('Today'), FC_EXPECTED = t('expected');

function drawChart(f, sel, floor, ids) {
  const wrap = $('#chartWrap'), svgEl = $('#chart'), tip = $('#tip');
  if (!wrap) return;
  const W = wrap.clientWidth, H = wrap.clientHeight;
  if (!W) return;
  svgEl.setAttribute('width', W); svgEl.setAttribute('height', H); svgEl.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svgEl.innerHTML = '';
  const P = { l: 46, r: 8, t: 14, b: 22 };
  let lo = Math.min(...f.map(p => p.lo), floor ?? Infinity, 0), hi = Math.max(...f.map(p => p.hi), 1);
  const pad = (hi - lo) * .07 || 1; lo -= pad; hi += pad;
  const x = t => P.l + (t / HORIZON) * (W - P.l - P.r);
  const y = vv => P.t + (1 - (vv - lo) / (hi - lo)) * (H - P.t - P.b);
  const span = hi - lo;
  const step = [1, 2, 5].flatMap(m => [1, 10, 100, 1e3, 1e4, 1e5, 1e6, 1e7].map(p => m * p)).sort((a, b) => a - b).find(s => span / s <= 5) || 1e7;
  for (let vv = Math.ceil(lo / step) * step; vv <= hi; vv += step) {
    el('line', { x1: P.l, x2: W - P.r, y1: y(vv), y2: y(vv), stroke: 'var(--line)', 'stroke-width': 1 }, svgEl);
    el('text', { x: P.l - 6, y: y(vv) + 3.5, 'text-anchor': 'end', 'font-size': 10, fill: 'var(--muted)' }, svgEl)
      .textContent = Math.abs(vv) >= 1e6 ? (vv / 1e6).toLocaleString(LOCALE) + 'M' : Math.abs(vv) >= 1000 ? (vv / 1000).toLocaleString(LOCALE) + 'k' : vv;
  }
  if (lo < 0) el('line', { x1: P.l, x2: W - P.r, y1: y(0), y2: y(0), stroke: 'var(--warn)', 'stroke-width': 1.2 }, svgEl);
  for (let t = 0; t <= HORIZON; t++) {
    const d = f[t].date;
    if (t === 0 || d.getDate() === 1)
      el('text', { x: x(t), y: H - 6, 'text-anchor': t === 0 ? 'start' : 'middle', 'font-size': 10, fill: 'var(--muted)' }, svgEl)
        .textContent = t === 0 ? FC_TODAY : dfmt(d, { month: 'short' });
  }
  const color = sel ? accColor(sel) : 'var(--ink)';
  const band = f.map(p => `${x(p.t)},${y(p.hi)}`).join(' L') + ' L' + f.slice().reverse().map(p => `${x(p.t)},${y(p.lo)}`).join(' L');
  el('path', { d: 'M' + band + ' Z', fill: color, 'fill-opacity': .14 }, svgEl);
  if (floor != null) el('line', { x1: P.l, x2: W - P.r, y1: y(floor), y2: y(floor), stroke: 'var(--muted)', 'stroke-width': 1.5, 'stroke-dasharray': '3 3' }, svgEl);
  el('path', { d: 'M' + f.map(p => `${x(p.t)},${y(p.mid)}`).join(' L'), fill: 'none', stroke: color, 'stroke-width': 2, 'stroke-linejoin': 'round' }, svgEl);
  f.forEach(p => { if (p.ev.some(e => e.it.kind === 'income' && ids.includes(e.acct.id))) el('circle', { cx: x(p.t), cy: P.t - 4, r: 3.5, fill: 'var(--gold)' }, svgEl); });
  const L = lowestPoint(f);
  el('circle', { cx: x(L.t), cy: y(L.mid), r: 6, fill: 'var(--solid)' }, svgEl);
  el('circle', { cx: x(L.t), cy: y(L.mid), r: 4, fill: L.mid < (floor ?? 0) ? 'var(--warn)' : color }, svgEl);

  const cross = el('line', { y1: P.t, y2: H - P.b, stroke: 'var(--ink)', 'stroke-opacity': 0, 'stroke-width': 1 }, svgEl);
  const mark = el('circle', { r: 4.5, fill: color, stroke: 'var(--solid)', 'stroke-width': 2, opacity: 0 }, svgEl);
  const hit = el('rect', { x: P.l, y: 0, width: W - P.l - P.r, height: H, fill: 'transparent' }, svgEl);
  const move = e => {
    const r = svgEl.getBoundingClientRect();
    const t = Math.max(0, Math.min(HORIZON, Math.round((e.clientX - r.left - P.l) / (W - P.l - P.r) * HORIZON)));
    const p = f[t];
    cross.setAttribute('x1', x(t)); cross.setAttribute('x2', x(t)); cross.setAttribute('stroke-opacity', .25);
    mark.setAttribute('cx', x(t)); mark.setAttribute('cy', y(p.mid)); mark.setAttribute('opacity', 1);
    tip.innerHTML = `<b>${p.date.toLocaleDateString(LOCALE, { weekday: 'short', day: 'numeric', month: 'short' })}</b><br><span class="num">${fmt(p.mid)}</span> ${FC_EXPECTED}<br>
      <span class="num" style="opacity:.7">${fmt(p.lo)} – ${fmt(p.hi)}</span>` + p.ev.slice(0, 4).map(e => `<br>${esc(e.name)} <span class="num">${e.a > 0 ? '+' : ''}${fmt(e.a)}</span>`).join('');
    tip.style.opacity = 1;
    tip.style.left = (x(t) + 190 > W ? x(t) - 190 : x(t) + 12) + 'px';
  };
  hit.addEventListener('pointermove', move);
  hit.addEventListener('pointerdown', move);
  hit.addEventListener('pointerleave', () => { tip.style.opacity = 0; cross.setAttribute('stroke-opacity', 0); mark.setAttribute('opacity', 0); });
}
