// Spending as it happens: log a purchase the moment you make it (amount, which account, what for) and,
// if you like, keep a photo of the receipt for returns, warranties or apps like Google Opinion Rewards.
// A logged spend comes straight off the account's balance, so "safe to spend" stays true between check-ins.
// Receipt photos are kept on the phone in IndexedDB (too big for the main save) and go into backups.
const SPEND_CATS = {
  groceries: [t('Groceries'), '<path d="M4 6h16l-1.5 9H5.5z"/><circle cx="8" cy="19" r="1.4"/><circle cx="17" cy="19" r="1.4"/><path d="M2 3h2l.5 3"/>'],
  eating:    [t('Eating out'), '<path d="M7 3v8M5 3v4a2 2 0 0 0 4 0V3M7 11v10M17 3c-2 1-3 4-3 7h3v11"/>'],
  coffee:    [t('Coffee & snacks'), '<path d="M4 9h12v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5z"/><path d="M16 11h1.5a2.5 2.5 0 0 1 0 5H16M8 3v3M12 3v3"/>'],
  transport: [t('Transport & fuel'), '<path d="M5 16V9l2-4h10l2 4v7z"/><circle cx="8" cy="16.5" r="1.6"/><circle cx="16" cy="16.5" r="1.6"/><path d="M5 10h14"/>'],
  shopping:  [t('Shopping'), '<path d="M5 8h14l-1 12H6z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/>'],
  health:    [t('Health & beauty'), '<path d="M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.5-7 10-7 10z"/>'],
  fun:       [t('Fun & going out'), '<path d="M4 8h16v3a2 2 0 0 0 0 4v3H4v-3a2 2 0 0 0 0-4z"/><path d="M14 8v10" stroke-dasharray="1.5 2"/>'],
  home:      [t('Home'), '<path d="M4 11l8-7 8 7v9H4z"/><path d="M10 20v-5h4v5"/>'],
  kids:      [t('Kids'), '<circle cx="12" cy="8" r="3.5"/><path d="M6 20a6 6 0 0 1 12 0"/>'],
  gifts:     [t('Gifts'), '<rect x="4" y="9" width="16" height="11" rx="1.5"/><path d="M12 9v11M4 13h16M12 9c-2-4-6-3-5 0M12 9c2-4 6-3 5 0"/>'],
  big:       [t('Big one-off'), '<rect x="3" y="5" width="18" height="12" rx="2"/><path d="M8 21h8M12 17v4"/>'],
  other:     [t('Other'), '<circle cx="6" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="18" cy="12" r="1.5"/>'],
};
const spendLabel = sp => sp.note || (SPEND_CATS[sp.cat] || SPEND_CATS.other)[0];
const liveSpends = () => S.spends.filter(sp => accountById(sp.acct));

// ---- the balance effect ----
// A spend dated on or after the account's last typed balance comes off that balance. Once you type a new
// balance (or check in) it's "settled": the number you typed already includes it.
// A round-up (sp.ru, in the paying account's currency) comes off with it and lands in the savings account sp.ruTo.
function spendEffect(sp, sign) {
  const a = accountById(sp.acct);
  if (!a) return;
  a.balance = Math.round((a.balance + (a.type === 'card' ? 1 : -1) * (sp.amt + (sp.ru || 0)) * sign) * 100) / 100; // a card stores what you owe
}
function roundupEffect(sp, sign) {
  const a = accountById(sp.acct), d = sp.ru && accountById(sp.ruTo);
  if (!a || !d) return;
  d.balance = Math.round((d.balance + conv(sp.ru, a.cur, d.cur) * sign) * 100) / 100;
}
function settleSpends(acctId) {
  S.spends.forEach(sp => {
    if (sp.acct === acctId && sp.applied) sp.settled = true;
    if (sp.ruTo === acctId && sp.ruIn) sp.ruSettled = true;
  });
}
// Round-ups: some banks put a little aside every time you pay by card, rounded up to the next 1, 5 or 10
// (sometimes doubled), or a % of the payment. Set on the savings account; amt is in the paying account's currency.
function roundupAmount(r, amt) {
  const step = r.step || 1;
  return Math.round((r.mode === 'percent' ? amt * (r.pct || 0) / 100 : (Math.ceil(amt / step - 1e-9) * step - amt) * (r.times || 1)) * 100) / 100;
}
function roundupFor(acctId, amt) {
  const to = liveAccounts().find(x => x.roundup && x.roundup.from === acctId && x.id !== acctId);
  if (!to || !(amt > 0)) return null;
  const v = roundupAmount(to.roundup, amt);
  return v > 0 ? { to, v } : null;
}
// logged everyday spending not yet inside a typed balance, in the account's currency (for check-ins)
function loggedUnsettled(a) {
  return S.spends.filter(sp => sp.acct === a.id && sp.applied && !sp.settled && sp.cat !== 'big').reduce((s, sp) => s + sp.amt, 0);
}

function saveSpend(sp, before) {
  const a = accountById(sp.acct);
  sp.amt = +conv(sp.amount, sp.cur, a.cur).toFixed(2);
  if (before && before.settled && before.acct === sp.acct) {
    sp.applied = true; sp.settled = true; // already inside a balance you typed; only the record changes
  } else {
    if (before && before.applied && !before.settled) spendEffect(before, -1);
    if (before && before.ruIn && !before.ruSettled) roundupEffect(before, -1);
    sp.applied = sp.d >= (a.balanceAt || '0000-00-00');
    sp.settled = false;
    const ru = sp.applied ? roundupFor(sp.acct, sp.amt) : null;
    delete sp.ru; delete sp.ruTo; delete sp.ruIn; delete sp.ruSettled;
    if (ru) { sp.ru = ru.v; sp.ruTo = ru.to.id; sp.ruIn = sp.d >= (ru.to.balanceAt || '0000-00-00'); sp.ruSettled = false; }
    if (sp.applied) spendEffect(sp, 1);
    if (sp.ruIn) roundupEffect(sp, 1);
  }
  const i = S.spends.findIndex(x => x.id === sp.id);
  if (i < 0) S.spends.push(sp); else S.spends[i] = sp;
  S.spends.sort((x, y) => (x.d + x.ts) < (y.d + y.ts) ? -1 : 1);
  S.settings.lastSpendAcct = sp.acct;
  save();
}
function removeSpend(sp) {
  if (sp.applied && !sp.settled) spendEffect(sp, -1);
  if (sp.ruIn && !sp.ruSettled) roundupEffect(sp, -1);
  S.spends = S.spends.filter(x => x.id !== sp.id);
  if (sp.receipt) delReceipt(sp.id);
  save();
}

// ---- receipt photos (IndexedDB) ----
let receiptDb;
function rdb() {
  if (!receiptDb) receiptDb = new Promise((res, rej) => {
    const r = indexedDB.open('kalendae-receipts', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('r');
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
  return receiptDb;
}
async function rtx(mode, fn) {
  const db = await rdb();
  return new Promise((res, rej) => {
    const tx = db.transaction('r', mode), out = fn(tx.objectStore('r'));
    tx.oncomplete = () => res(out && 'result' in out ? out.result : undefined);
    tx.onerror = () => rej(tx.error);
  });
}
const putReceipt = (id, blob) => DEMO ? Promise.resolve() : rtx('readwrite', s => s.put(blob, id));
const getReceipt = id => DEMO ? Promise.resolve(DEMO_RECEIPT()) : rtx('readonly', s => s.get(id)).catch(() => null);
const delReceipt = id => rtx('readwrite', s => s.delete(id)).catch(() => {});
const clearReceipts = () => rtx('readwrite', s => s.clear()).catch(() => {});
async function allReceipts() {
  const out = {};
  for (const sp of S.spends) if (sp.receipt) { const b = await getReceipt(sp.id); if (b) out[sp.id] = await blobToB64(b); }
  return out;
}
async function restoreReceipts(map) {
  await clearReceipts();
  for (const id in map || {}) await putReceipt(id, new Blob([unb64(map[id])], { type: 'image/jpeg' }));
}
const blobToB64 = blob => new Promise(res => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1]); r.readAsDataURL(blob); });

// photos straight from a phone camera are 3–12 MB; a 1600 px JPEG is plenty to read a receipt (~200 KB)
async function shrinkImage(file, max = 1600, q = 0.8) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
    const k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement('canvas');
    c.width = Math.round(img.naturalWidth * k); c.height = Math.round(img.naturalHeight * k);
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    return await new Promise(res => c.toBlob(res, 'image/jpeg', q));
  } finally { URL.revokeObjectURL(url); }
}
const receiptName = sp => `kalendae-receipt-${sp.d}-${(sp.note || sp.cat).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'spend'}.jpg`;

async function saveReceiptToPhone(sp) {
  const blob = await getReceipt(sp.id);
  if (!blob) return;
  if (NATIVE && NATIVE.saveImage) {
    toast(NATIVE.saveImage(receiptName(sp), await blobToB64(blob)) ? t('Saved to Pictures › Kalendae') : t('Couldn’t save the photo'));
    return;
  }
  const url = URL.createObjectURL(blob), a = document.createElement('a');
  a.href = url; a.download = receiptName(sp);
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
async function shareReceipt(sp) {
  const blob = await getReceipt(sp.id);
  if (!blob) return;
  if (NATIVE && NATIVE.shareImage) { NATIVE.shareImage(receiptName(sp), await blobToB64(blob)); return; }
  const file = new File([blob], receiptName(sp), { type: 'image/jpeg' });
  if (navigator.canShare && navigator.canShare({ files: [file] })) navigator.share({ files: [file] }).catch(() => {});
  else saveReceiptToPhone(sp);
}

// ---- Today: what you've spent ----
function spendCardHtml() {
  const accts = liveAccounts();
  if (!accts.length) return '';
  const today = todayISO(), weekFrom = isoDay(addDays(day0(), -6));
  const inDisp = sp => conv(sp.amt, accountById(sp.acct).cur);
  const list = liveSpends();
  const dayTotal = list.filter(sp => sp.d === today).reduce((s, sp) => s + inDisp(sp), 0);
  const week = list.filter(sp => sp.d >= weekFrom && sp.d <= today);
  const weekTotal = week.reduce((s, sp) => s + inDisp(sp), 0);
  const usual = accts.reduce((s, a) => s + conv(a.everyday || 0, a.cur) * myShare(a), 0) / 30.44 * 7;
  const recent = list.slice(-3).reverse();
  const plus = svg('<path d="M12 5v14M5 12h14"/>');
  if (!list.length) return `<div class="card spendCard"><h3>${t('Spending')}</h3>
    <p class="sub">${t('Log a purchase as you make it: the amount comes straight off the account, and you can keep a photo of the receipt for returns, warranties or receipt apps.')}</p>
    <div class="row2"><button class="btn" data-spend="new">${plus} ${t('Log a spend')}</button></div></div>`;
  return `<div class="card spendCard"><h3>${t('Spending')} <em>${t('last 7 days')}</em></h3>
    <div class="stats" style="grid-template-columns:repeat(2,minmax(0,1fr))">
      <div class="stat"><div class="k">${t('Today')}</div><div class="v num">${fmt(dayTotal)}</div></div>
      <div class="stat"><div class="k">${t('7 days')}</div><div class="v num">${fmt(weekTotal)}</div><div class="s">${usual > 0 ? t('usually about {v}', { v: fmt(usual) }) : '&nbsp;'}</div></div></div>
    <ul class="list" style="margin-top:6px">${recent.map(spendRow).join('')}</ul>
    <div class="row2"><button class="btn" data-spend="new">${plus} ${t('Log a spend')}</button><button class="btn ghost" data-spend="all">${t('All spending')}</button></div></div>`;
}
function spendRow(sp) {
  const a = accountById(sp.acct), d = fromISO(sp.d), b = fmtBoth(-sp.amount, sp.cur);
  const icon = (SPEND_CATS[sp.cat] || SPEND_CATS.other)[1];
  return `<li class="it" data-sid="${sp.id}"><div class="when">${dfmt(d, { month: 'short' })}<b>${d.getDate()}</b></div>
    <div><div class="nm">${esc(spendLabel(sp))}${sp.receipt ? `<span class="rcpt" title="${esc(t('Receipt'))}">${svg(RECEIPT_ICON)}</span>` : ''}</div>
      <div class="meta"><span class="dot" style="background:${accColor(a)}"></span>${esc(a.name)}${sp.note ? ' · ' + esc((SPEND_CATS[sp.cat] || SPEND_CATS.other)[0]) : ''}</div></div>
    <div class="amt num">${b.main}${b.approx ? `<small>${b.approx}</small>` : ''}</div></li>`;
}
const RECEIPT_ICON = '<path d="M6 3h12v18l-2-1.5-2 1.5-2-1.5-2 1.5-2-1.5L6 21z"/><path d="M9 8h6M9 12h6M9 16h3"/>';
function mountSpendButtons(root) {
  $$('[data-spend]', root).forEach(b => b.onclick = () => b.dataset.spend === 'all' ? spendsSheet() : spendSheet());
  $$('[data-sid]', root).forEach(r => r.onclick = () => spendSheet(S.spends.find(x => x.id === r.dataset.sid)));
}

// ---- what you logged, day by day (or week by week), next to your usual ----
let spRange = 14;
const SP_RANGES = { 14: t('14 days'), 30: t('30 days'), 84: t('12 weeks') };
function spendChartHtml(list, filter) {
  const step = spRange > 30 ? 7 : 1, n = spRange / step, t0 = day0();
  const short = d => dfmt(d, { day: 'numeric', month: 'short' });
  const bars = Array.from({ length: n }, (_, i) => {
    const end = addDays(t0, -(n - 1 - i) * step), start = addDays(end, -(step - 1));
    const from = isoDay(start), to = isoDay(end);
    const v = list.filter(sp => sp.d >= from && sp.d <= to).reduce((s, sp) => s + conv(sp.amt, accountById(sp.acct).cur), 0);
    return { v, label: step === 1 ? String(end.getDate()) : short(start),
      tip: (step === 1 ? end.toLocaleDateString(LOCALE, { weekday: 'short', day: 'numeric', month: 'short' }) : `${short(start)} – ${short(end)}`) + ' · ' + fmt(v) };
  });
  // your usual: the everyday spending Kalendae has learned from check-ins (or the guess you typed)
  const accts = filter === 'all' || filter === 'receipts' ? liveAccounts() : [accountById(filter)].filter(Boolean);
  const usual = accts.reduce((s, a) => s + conv(a.everyday || 0, a.cur) * myShare(a), 0) / 30.44 * step;
  const avg = bars.reduce((s, b) => s + b.v, 0) / n;
  bars.forEach(b => { b.c = usual && b.v > usual * 1.15 ? 'var(--warn)' : 'var(--a3)'; });
  const per = v => step === 1 ? t('≈ {v} a day', { v: fmt(v) }) : `${fmt(v)} ${t('a week')}`;
  return `<div class="card" style="padding:12px 14px">
    <div class="chips" id="spR">${Object.entries(SP_RANGES).map(([k, name]) => `<button class="chip ${+k === spRange ? 'on' : ''}" data-r="${k}">${name}</button>`).join('')}</div>
    ${barChartSvg(bars, [usual ? { v: usual, dash: true } : null, { v: avg, color: 'var(--ink)' }].filter(Boolean))}
    <div class="cap" id="spCap"></div>
    <div class="fkeys">${usual ? `<span><i class="dash"></i>${t('Your usual')} · ${per(usual)}</span>` : ''}<span><i style="background:var(--ink)"></i>${t('Your average')} · ${per(avg)}</span></div></div>`;
}

// ---- all spending ----
function spendsSheet(filter = 'all') {
  const list = liveSpends().filter(sp => filter === 'all' || (filter === 'receipts' ? sp.receipt : sp.acct === filter)).slice().reverse();
  const months = {};
  list.forEach(sp => { const k = sp.d.slice(0, 7); (months[k] = months[k] || []).push(sp); });
  const chips = [['all', t('Everything')], ['receipts', t('With receipts')]].concat(liveAccounts().filter(a => S.spends.some(sp => sp.acct === a.id)).map(a => [a.id, a.name]));
  openSheet(`<h2>${t('All spending')}</h2>
    <div class="chips" id="spF" style="margin:6px 0 4px">${chips.map(([k, n]) => `<button class="chip ${k === filter ? 'on' : ''}" data-f="${k}">${esc(n)}</button>`).join('')}</div>
    ${list.length ? spendChartHtml(list, filter) : ''}
    ${Object.keys(months).length ? Object.entries(months).map(([k, rows]) => {
      const total = rows.reduce((s, sp) => s + conv(sp.amt, accountById(sp.acct).cur), 0);
      return `<div class="grp" style="display:flex;justify-content:space-between;margin-top:16px"><span>${dfmt(fromISO(k + '-01'), { month: 'long', year: 'numeric' })}</span><span class="num">${fmt(total)}</span></div>
        <ul class="list">${rows.map(spendRow).join('')}</ul>`;
    }).join('') : `<p class="sub" style="margin-top:16px">${t('Nothing logged here yet.')}</p>`}
    <div class="row2"><button class="btn ghost" id="spX">${t('Done')}</button><button class="btn" id="spN">${svg('<path d="M12 5v14M5 12h14"/>')} ${t('Log a spend')}</button></div>`, body => {
    $$('#spF [data-f]', body).forEach(b => b.onclick = () => spendsSheet(b.dataset.f));
    $$('#spR [data-r]', body).forEach(b => b.onclick = () => { tick('8'); spRange = +b.dataset.r; spendsSheet(filter); });
    mountBars(body, '#spCap');
    $$('[data-sid]', body).forEach(r => r.onclick = () => spendSheet(S.spends.find(x => x.id === r.dataset.sid), () => spendsSheet(filter)));
    $('#spX', body).onclick = closeSheet;
    $('#spN', body).onclick = () => spendSheet(null, () => spendsSheet(filter));
  });
}

// ---- log or edit one spend ----
function spendSheet(existing, back, preset) {
  const accts = liveAccounts();
  if (!accts.length) { toast(t('Add an account first')); return; }
  const startAcct = accountById(S.settings.lastSpendAcct) && !accountById(S.settings.lastSpendAcct).archived ? S.settings.lastSpendAcct : (mainAccount() || accts[0]).id;
  const sp = existing ? Object.assign({}, existing) : Object.assign({ id: uid(), acct: startAcct, amount: 0, cur: null, cat: 'groceries', note: '', d: todayISO(), ts: Date.now(), receipt: false }, preset);
  if (!sp.cur) sp.cur = accountById(sp.acct).cur;
  let photo = null;          // a new photo picked in this sheet (Blob), or 'remove'
  let photoUrl = null;
  const release = () => { if (photoUrl) URL.revokeObjectURL(photoUrl); photoUrl = null; };
  const isAlready = a => sp.d < (a.balanceAt || '0000-00-00') || (existing && existing.settled && existing.acct === sp.acct);
  // the round-up that goes with it: as worked out for a spend already inside a typed balance, a preview otherwise
  const ruNote = () => {
    const a = accountById(sp.acct);
    const r = isAlready(a) ? (existing && existing.ru && accountById(existing.ruTo) ? { v: existing.ru, to: accountById(existing.ruTo) } : null)
      : sp.amount ? roundupFor(sp.acct, conv(sp.amount, sp.cur, a.cur)) : null;
    return r ? ' ' + t('Plus a {v} round-up into {a}.', { v: fmt(r.v, a.cur), a: esc(r.to.name) }) : '';
  };

  const draw = () => {
    const a = accountById(sp.acct);
    const curs = [...new Set([a.cur, ...S.settings.currencies])];
    const already = isAlready(a);
    const hasPhoto = photo instanceof Blob || (photo !== 'remove' && sp.receipt);
    return `<h2>${existing ? esc(spendLabel(existing)) : t('Log a spend')}</h2>
      <div class="field"><label>${t('Amount')}</label>
        <div style="display:flex;gap:8px;align-items:center"><input class="input money num" id="sAmt" inputmode="decimal" value="${sp.amount || ''}" placeholder="0" style="flex:1"><span class="sub num" style="min-width:42px">${sp.cur}</span></div>
        ${curs.length > 1 ? `<div class="chips" id="sCur" style="margin-top:8px">${curs.map(c => `<button class="chip ${c === sp.cur ? 'on' : ''}" data-c="${c}">${c}</button>`).join('')}</div>` : ''}
        ${sp.cur !== a.cur && sp.amount ? `<p class="sub" style="margin-top:6px">${t('{a} pays ≈ {v} at the 30-day average rate.', { a: esc(a.name), v: fmt(conv(sp.amount, sp.cur, a.cur), a.cur) })}</p>` : ''}</div>
      <div class="field"><label>${t('Paid from')}</label><div class="chips" id="sAcct">${accts.map(x =>
        `<button class="chip ${x.id === sp.acct ? 'on' : ''}" data-a="${x.id}"><span class="dot" style="background:${accColor(x)}"></span>${esc(x.name)}</button>`).join('')}</div></div>
      <div class="field"><label>${t('What for')}</label><div class="typegrid" id="sCat">${Object.entries(SPEND_CATS).map(([k, [n, ic]]) =>
        `<button data-k="${k}" class="${k === sp.cat ? 'on' : ''}">${svg(ic)}${n}</button>`).join('')}</div></div>
      <div class="field"><label>${t('Shop or note')}</label><input class="input" id="sNote" value="${esc(sp.note)}" placeholder="${esc(t('Optional · e.g. Lidl, pharmacy, birthday present'))}" autocomplete="off"></div>
      <div class="field"><label>${t('Date')}</label><input class="input num" id="sDate" type="date" value="${sp.d}" max="${todayISO()}"></div>
      <div class="field"><label>${t('Receipt')}</label>
        ${hasPhoto ? `<div class="rcptBox"><img id="sImg" alt="${esc(t('Receipt'))}"><div class="rcptBtns">
            ${existing && existing.receipt && !(photo instanceof Blob) ? `<button class="btn ghost" id="sSaveImg">${t('Save to phone')}</button><button class="btn ghost" id="sShare">${t('Share')}</button>` : ''}
            <button class="btn ghost" id="sPick">${t('Replace')}</button><button class="btn danger" id="sDrop">${t('Remove')}</button></div></div>`
          : `<button class="btn ghost wide" id="sPick">${svg(RECEIPT_ICON)} ${t('Add a receipt photo')}</button>`}
        <p class="sub" style="margin-top:6px">${t('Kept on this phone with your data. Handy for returns, warranties, or receipt apps like Google Opinion Rewards.')}</p></div>
      <p class="sub" style="margin-top:14px">${already
        ? t('Already in the balance you typed for {a} on {d}, so it’s kept as a record only.', { a: esc(a.name), d: dfmt(fromISO(a.balanceAt), { day: 'numeric', month: 'short' }) })
        : sp.cat === 'big' ? t('Comes off {a} straight away. A one-off isn’t counted as everyday spending.', { a: esc(a.name) })
        : t('Comes off {a} straight away, so “safe to spend” stays true.', { a: esc(a.name) })}<span id="sRu">${ruNote()}</span></p>
      <div class="row2">${existing ? `<button class="btn danger" id="sDel">${t('Delete')}</button>` : `<button class="btn ghost" id="sX">${t('Cancel')}</button>`}<button class="btn" id="sOk">${t('Save')}</button></div>`;
  };
  const keep = body => {
    const v = parseAmount($('#sAmt', body).value); if (v != null) sp.amount = Math.abs(v);
    sp.note = $('#sNote', body).value.trim();
    sp.d = $('#sDate', body).value || sp.d;
  };
  const mount = body => {
    const img = $('#sImg', body);
    if (img) {
      if (photo instanceof Blob) { release(); photoUrl = URL.createObjectURL(photo); img.src = photoUrl; }
      else getReceipt(sp.id).then(b => { if (b && img.isConnected) { release(); photoUrl = URL.createObjectURL(b); img.src = photoUrl; } });
      img.onclick = () => viewImage(img.src);
    }
    $$('#sCur [data-c]', body).forEach(b => b.onclick = () => { keep(body); sp.cur = b.dataset.c; redraw(); });
    $('#sAmt', body).oninput = () => { keep(body); $('#sRu', body).innerHTML = ruNote(); };
    $$('#sAcct [data-a]', body).forEach(b => b.onclick = () => {
      keep(body);
      const prev = accountById(sp.acct);
      sp.acct = b.dataset.a;
      if (sp.cur === prev.cur) sp.cur = accountById(sp.acct).cur; // follow the account's currency unless you picked another
      redraw();
    });
    $$('#sCat [data-k]', body).forEach(b => b.onclick = () => { keep(body); sp.cat = b.dataset.k; redraw(); });
    $('#sDate', body).onchange = () => { keep(body); redraw(); };
    $('#sPick', body).onclick = () => { keep(body); pickReceipt(blob => { photo = blob; redraw(); }); };
    const drop = $('#sDrop', body); if (drop) drop.onclick = () => { keep(body); photo = 'remove'; redraw(); };
    const si = $('#sSaveImg', body); if (si) si.onclick = () => saveReceiptToPhone(existing);
    const sh = $('#sShare', body); if (sh) sh.onclick = () => shareReceipt(existing);
    if (!existing && !sp.amount) setTimeout(() => { const i = $('#sAmt', body); if (i) i.focus(); }, 350);

    $('#sOk', body).onclick = async () => {
      keep(body);
      if (!(sp.amount > 0)) { toast(t('Type the amount')); return; }
      if (photo instanceof Blob) { await putReceipt(sp.id, photo); sp.receipt = true; }
      else if (photo === 'remove') { await delReceipt(sp.id); sp.receipt = false; }
      saveSpend(sp, existing);
      tick('12');
      release();
      toast(existing ? t('Saved') : t('{v} from {a}', { v: fmt(sp.amount, sp.cur), a: accountById(sp.acct).name }));
      if (back) back(); else closeSheet();
    };
    if (existing) $('#sDel', body).onclick = async () => {
      const ok = await confirmSheet(t('Delete {name}?', { name: spendLabel(existing) }),
        existing.applied && !existing.settled ? t('It goes back onto {a}, and its receipt photo is deleted.', { a: esc(accountById(existing.acct).name) }) : t('The record and its receipt photo are deleted. Your balance stays as you typed it.'), t('Delete'), true);
      if (ok) { removeSpend(existing); release(); toast(t('Deleted')); if (back) back(); }
    };
    else $('#sX', body).onclick = () => { release(); closeSheet(); };
  };
  const redraw = () => { const y = $('#sheet').scrollTop; $('#sheetBody').innerHTML = draw(); mount($('#sheetBody')); $('#sheet').scrollTop = y; };
  openSheet(draw(), mount, release);
}

// the receipt full screen; tap anywhere to close
function viewImage(src) {
  const v = document.createElement('div');
  v.className = 'viewer';
  v.innerHTML = `<img src="${src}" alt="">`;
  v.onclick = () => v.remove();
  document.body.appendChild(v);
}

// one hidden file input for receipt photos; on phones it offers the camera and the gallery
function pickReceipt(done) {
  const inp = $('#receiptPick');
  inp.value = '';
  inp.onchange = async () => {
    const f = inp.files && inp.files[0];
    if (!f) return;
    try { done(await shrinkImage(f)); } catch (e) { toast(t('That photo couldn’t be opened')); }
  };
  inp.click();
}

// a drawn receipt for the sample data and the README screenshots
function DEMO_RECEIPT() {
  const lines = [['Bread', '6.49'], ['Tomatoes 1 kg', '11.90'], ['Cheese', '14.99'], ['Coffee beans', '32.99'], ['Apples', '8.79'], ['Milk 2×', '11.24']];
  const svgTxt = `<svg xmlns="http://www.w3.org/2000/svg" width="360" height="520" viewBox="0 0 360 520"><rect width="360" height="520" fill="#fbf8f1"/>
    <g font-family="Menlo,monospace" font-size="15" fill="#2a2730"><text x="180" y="52" text-anchor="middle" font-size="22" font-weight="700">LIDL</text>
    <text x="180" y="78" text-anchor="middle" font-size="12" fill="#77727c">ul. Prosta 12 · Warszawa</text>
    ${lines.map(([n, v], i) => `<text x="34" y="${130 + i * 30}">${n}</text><text x="326" y="${130 + i * 30}" text-anchor="end">${v}</text>`).join('')}
    <path d="M34 322h292" stroke="#2a2730" stroke-dasharray="4 4"/><text x="34" y="356" font-weight="700" font-size="18">SUMA PLN</text><text x="326" y="356" text-anchor="end" font-weight="700" font-size="18">86.40</text>
    <text x="34" y="392" font-size="12" fill="#77727c">KARTA ****4021</text><text x="180" y="470" text-anchor="middle" font-size="12" fill="#77727c">Dziękujemy · Thank you</text></g></svg>`;
  return new Blob([svgTxt], { type: 'image/svg+xml' });
}
