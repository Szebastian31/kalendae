// Column charts: what your bills really came to, and what you spent each day or week, with lines for
// what you expected (dashed) and your real average (solid). Tap a column to see its amount.
// bars: [{ v, label, tip, c }], lines: [{ v, dash, color }]; amounts in the currency you show money in.
function barChartSvg(bars, lines = []) {
  const W = 340, H = 150, P = { l: 38, r: 4, t: 8, b: 18 };
  const top = Math.max(1, ...bars.map(b => b.v), ...lines.map(l => l.v)) * 1.08;
  const y = v => P.t + (1 - v / top) * (H - P.t - P.b);
  const n = Math.max(1, bars.length), bw = (W - P.l - P.r) / n;
  const raw = top / 4, p = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 5, 10].map(m => m * p).find(s => s >= raw);
  const short = v => Math.abs(v) >= 1e6 ? (v / 1e6).toLocaleString(LOCALE) + 'M' : Math.abs(v) >= 1000 ? (v / 1000).toLocaleString(LOCALE) + 'k' : v.toLocaleString(LOCALE);
  let s = `<svg class="bars" viewBox="0 0 ${W} ${H}" role="img">`;
  for (let v = 0; v <= top; v += step)
    s += `<line x1="${P.l}" x2="${W - P.r}" y1="${y(v)}" y2="${y(v)}" stroke="var(--line)"/><text x="${P.l - 5}" y="${y(v) + 3.5}" text-anchor="end" font-size="9.5" fill="var(--muted)">${short(v)}</text>`;
  const every = Math.ceil(n / 8); // a label under every column, or every few when there are many
  bars.forEach((b, i) => {
    const x = P.l + i * bw, h = Math.max(b.v > 0 ? 2 : 0, y(0) - y(b.v));
    s += `<rect data-i="${i}" x="${(x + bw * .17).toFixed(1)}" y="${(y(0) - h).toFixed(1)}" width="${(bw * .66).toFixed(1)}" height="${h.toFixed(1)}" rx="${Math.min(4, bw * .2).toFixed(1)}" fill="${b.c || 'var(--a3)'}"><title>${esc(b.tip || '')}</title></rect>`;
    s += `<rect data-i="${i}" x="${x.toFixed(1)}" y="${P.t}" width="${bw.toFixed(1)}" height="${H - P.t - P.b}" fill="transparent"/>`;
    if ((n - 1 - i) % every === 0) s += `<text x="${(x + bw / 2).toFixed(1)}" y="${H - 5}" text-anchor="middle" font-size="9.5" fill="var(--muted)">${esc(b.label)}</text>`;
  });
  lines.forEach(l => {
    s += `<line x1="${P.l}" x2="${W - P.r}" y1="${y(l.v)}" y2="${y(l.v)}" stroke="${l.color || 'var(--muted)'}" stroke-width="1.6"${l.dash ? ' stroke-dasharray="4 3"' : ''}/>`;
  });
  return s + '</svg>';
}

// tapping a column shows its amount in the caption under the chart
function mountBars(root, capSel) {
  const cap = $(capSel, root);
  const chart = $('svg.bars', root);
  if (!cap || !chart) return;
  chart.querySelectorAll('rect[data-i]').forEach(r => r.addEventListener('click', () => {
    const i = r.dataset.i, bar = chart.querySelector(`rect[data-i="${i}"] title`);
    chart.querySelectorAll('rect[data-i]').forEach(x => x.style.opacity = x.dataset.i === i || x.getAttribute('fill') === 'transparent' ? '' : '.55');
    cap.textContent = bar ? bar.textContent : '';
    tick('8');
  }));
}
