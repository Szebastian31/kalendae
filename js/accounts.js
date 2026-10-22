// Accounts: every place your money lives (banks, savings, cards, PayPal, Revolut, Cash App, cash…),
// each in its own currency, optionally shared with someone.
function netWorth() {
  return liveAccounts().reduce((s, a) => s + conv(signedBalance(a), a.cur) * myShare(a), 0);
}

function renderAccounts() {
  const v = $('#vAccounts');
  const accts = liveAccounts();
  if (!accts.length) {
    v.innerHTML = `<div class="card empty">
      <div style="width:88px;margin:0 auto">${iconSVG({ size: 88 })}</div>
      <div class="big">${t('Where does your money live?')}</div>
      <p class="sub">${t('Add each account once: banks, savings, cards, PayPal, Revolut, Cash App, and the cash in your wallet. Each keeps its own currency.')}</p>
      <button class="btn wide" style="margin-top:16px" id="addFirst">${t('Add your first account')}</button></div>
      <p class="honest">${t('No bank login. You type the balance; Kalendae never connects to your bank.')}</p>`;
    $('#addFirst').onclick = () => accountSheet();
    return;
  }
  const curs = [...new Set(accts.map(a => a.cur))];
  const total = netWorth();
  const shareW = a => Math.max(0, conv(signedBalance(a), a.cur) * myShare(a));
  const mixTotal = accts.reduce((s, a) => s + shareW(a), 0) || 1;
  const hasShared = accts.some(a => a.shared);

  let html = `<div class="card">
    <h3>${t('What’s yours')} <em>${tn(accts.length, '{n} account', '{n} accounts')} · ${tn(curs.length, '{n} currency', '{n} currencies')}</em></h3>
    <div class="big num">${fmt(total)}</div>
    <div class="mix">${accts.map(a => `<div style="flex:${shareW(a) / mixTotal};background:${accColor(a)}"></div>`).join('')}</div>
    <div class="sub">${[curs.length > 1 ? t('At 30-day average rates') : '', hasShared ? t('counts only your part of shared accounts') : '', accts.some(a => a.type === 'card') ? t('cards count as money owed') : '']
      .filter(Boolean).join(' · ') || t('Everything you have, in one number.')}</div></div>`;

  html += '<div class="card">';
  GROUP_ORDER.forEach(g => {
    const list = accts.filter(a => ACCOUNT_TYPES[a.type].group === g);
    if (!list.length) return;
    html += `<div class="grp">${g}</div>` + list.map(a => {
      const type = ACCOUNT_TYPES[a.type];
      const b = fmtBoth(signedBalance(a), a.cur);
      const meta = [a.provider, a.cur, a.shared ? t('with {name}', { name: a.partner || t('someone') }) : '', t('updated {ago}', { ago: agoText(a.balanceAt) })].filter(Boolean).join(' · ');
      return `<div class="acct" data-id="${a.id}">
        <div class="sw" style="background:${accColor(a)}">${svg(type.icon)}</div>
        <div><div class="nm">${esc(a.name)}${a.shared ? `<span class="tag">${t('Shared')}</span>` : ''}</div><div class="meta">${esc(meta)}</div></div>
        <div class="bal num">${b.main}${b.approx ? `<small>${b.approx}</small>` : ''}</div></div>`;
    }).join('');
  });
  html += `<div class="row2"><button class="btn" id="checkAll">${svg('<path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>')} ${t('Check in')}</button><button class="btn ghost" id="addAcct">${svg('<path d="M12 5v14M5 12h14"/>')} ${t('Add')}</button></div></div>`;

  if (curs.some(c => c !== S.settings.display)) {
    html += `<div class="card"><h3>${t('Exchange rates')} <em>${RATES.source === 'NBP' ? t('30-day average') : t('estimate')}</em></h3>
      <div class="rates">${curs.filter(c => c !== S.settings.display).map(c => `<div>${c}<b class="num">${rateLine(c)}</b>${t('±{p}% this month', { p: rateSpread(c).toFixed(1) })}</div>`).join('')}</div>
      <p class="sub" style="margin-top:10px">${ratesNote()}</p></div>`;
  }
  html += `<p class="honest">${t('Check in each week (or tap an account) to update balances; cash accounts get a note-by-note count. Amounts in other currencies carry a ≈; they’re converted at an average, not today’s exact rate.')}</p>`;
  v.innerHTML = html;
  $$('.acct', v).forEach(r => r.onclick = () => accountSheet(accountById(r.dataset.id)));
  $('#addAcct').onclick = () => accountSheet();
  $('#checkAll').onclick = () => checkinSheet();
}

// ---- add / edit ----
function accountSheet(existing) {
  const a = existing ? JSON.parse(JSON.stringify(existing)) : {
    id: uid(), name: '', type: 'bank', provider: '', cur: S.settings.display, balance: 0,
    shared: false, partner: '', split: { mode: 'equal', mine: 50 }, color: S.accounts.length % ACCOUNT_COLORS,
  };
  const curOpts = () => {
    const mine = S.settings.currencies;
    const rest = Object.keys(CURRENCIES).filter(c => !mine.includes(c));
    return mine.concat(rest).map(c => `<option value="${c}" ${c === a.cur ? 'selected' : ''}>${c} · ${esc(curName(c))}</option>`).join('');
  };
  const balLabel = () => a.type === 'card' ? t('Owed on the card') : t('Balance now');
  const html = `<h2>${existing ? esc(existing.name) : t('New account')}</h2>
    <p class="lead">${existing ? t('Update the balance whenever you check it.') : t('Pick what kind it is, then type what’s in it right now.')}</p>
    <div class="typegrid" id="aType">${Object.entries(ACCOUNT_TYPES).map(([k, type]) =>
      `<button data-k="${k}" class="${k === a.type ? 'on' : ''}">${svg(type.icon)}${type.label}</button>`).join('')}</div>
    <div class="field"><label id="aBalL">${balLabel()}</label>
      <input class="input money num" id="aBal" inputmode="decimal" value="${a.balance ? a.balance : ''}" placeholder="0"></div>
    <div class="field"><label>${t('Currency')}</label><select class="input" id="aCur">${curOpts()}</select></div>
    <div class="field"><label>${t('Name')}</label><input class="input" id="aName" value="${esc(a.name)}" placeholder="${esc(t('e.g. Personal, Holiday pot'))}"></div>
    <div class="field"><label>${t('Bank or service')}</label><input class="input" id="aProv" value="${esc(a.provider || '')}" placeholder="${esc(t('Search or type any name'))}" autocomplete="off">
      <div class="chips" id="provSug" style="margin-top:8px"></div></div>
    <div class="field"><label>${t('Everyday spending a month')}</label>
      <input class="input num" id="aEvery" inputmode="decimal" value="${a.everyday ? a.everyday : ''}" placeholder="${esc(t('Optional · groceries, coffee, fuel…'))}">
      <p class="sub" style="margin-top:6px">${t('A rough guess is fine. The forecast takes it off a little each day; weekly check-ins refine it.')}</p></div>
    <div class="field"><label>${t('Colour')}</label><div class="swatches" id="aColor">${Array.from({ length: ACCOUNT_COLORS }, (_, i) =>
      `<button class="${i === a.color ? 'on' : ''}" data-c="${i}" style="background:var(--a${i + 1})" aria-label="${esc(t('Colour {n}', { n: i + 1 }))}"></button>`).join('')}</div></div>
    <div class="card" style="margin-top:16px;padding:12px 16px">
      <div class="tog"><div>${t('Shared account')}<small>${t('A joint account, or a pot you split with someone')}</small></div><button class="sw-t ${a.shared ? 'on' : ''}" id="aShared" aria-label="${esc(t('Shared'))}"></button></div>
      <div id="shareBox" style="display:${a.shared ? 'block' : 'none'}">
        <div class="field"><label>${t('Shared with')}</label><input class="input" id="aPartner" value="${esc(a.partner || '')}" placeholder="${esc(t('Name'))}"></div>
        <div class="field"><label>${t('How it’s split')}</label>
          <div class="seg" id="aSplitMode"><button data-m="equal" class="${a.split.mode !== 'percent' ? 'on' : ''}">50 / 50</button><button data-m="percent" class="${a.split.mode === 'percent' ? 'on' : ''}">${t('By share')}</button></div>
          <div class="split" id="splitRow" style="display:${a.split.mode === 'percent' ? 'flex' : 'none'}">
            <span class="sub">${t('You')}</span><input type="range" min="5" max="95" step="5" id="aMine" value="${a.split.mine}"><span class="sub num" id="aMineLbl"></span></div>
          <p class="sub" style="margin-top:8px">${t('Only your part counts in “What’s yours”. Both of you will get the warning if it runs short.')}</p></div>
      </div>
    </div>
    <div class="row2">${existing ? `<button class="btn danger" id="aDel">${t('Delete')}</button>` : `<button class="btn ghost" id="aCancel">${t('Cancel')}</button>`}<button class="btn" id="aSave">${t('Save')}</button></div>`;

  openSheet(html, body => {
    // suggestions from banks around the world; whatever you type is kept as-is
    const provList = () => {
      const q = $('#aProv', body).value;
      const list = providerSuggestions(a.type, q, 10).filter(p => p !== q);
      const custom = q.trim() && !list.some(p => fold(p) === fold(q.trim())) ? `<span class="sub" style="align-self:center">${t('“{name}” will be saved as typed', { name: esc(q.trim()) })}</span>` : '';
      $('#provSug', body).innerHTML = list.map(p => `<button class="chip" data-p="${esc(p)}">${esc(p)}</button>`).join('') + custom;
      $$('#provSug [data-p]', body).forEach(b => b.onclick = () => { $('#aProv', body).value = b.dataset.p; provList(); });
    };
    $('#aProv', body).oninput = provList;
    provList();
    $$('#aType button', body).forEach(b => b.onclick = () => {
      a.type = b.dataset.k;
      $$('#aType button', body).forEach(x => x.classList.toggle('on', x === b));
      $('#aBalL', body).textContent = balLabel();
      if (!$('#aName', body).value || $('#aName', body).dataset.auto) { $('#aName', body).value = ACCOUNT_TYPES[a.type].label; $('#aName', body).dataset.auto = '1'; }
      provList();
    });
    $('#aName', body).oninput = e => delete e.target.dataset.auto;
    $$('#aColor button', body).forEach(b => b.onclick = () => { a.color = +b.dataset.c; $$('#aColor button', body).forEach(x => x.classList.toggle('on', x === b)); });
    $('#aShared', body).onclick = e => { a.shared = !a.shared; e.target.classList.toggle('on', a.shared); $('#shareBox', body).style.display = a.shared ? 'block' : 'none'; };
    const mineLbl = () => $('#aMineLbl', body).textContent = `${a.split.mine}% · ${100 - a.split.mine}%`;
    mineLbl();
    $$('#aSplitMode button', body).forEach(b => b.onclick = () => {
      a.split.mode = b.dataset.m;
      $$('#aSplitMode button', body).forEach(x => x.classList.toggle('on', x === b));
      $('#splitRow', body).style.display = a.split.mode === 'percent' ? 'flex' : 'none';
    });
    $('#aMine', body).oninput = e => { a.split.mine = +e.target.value; mineLbl(); };
    if (!existing) setTimeout(() => $('#aBal', body).focus(), 350);

    $('#aSave', body).onclick = () => {
      const bal = parseAmount($('#aBal', body).value);
      if (bal == null) { toast(t('Type the balance, e.g. 1250 or 1250,50')); return; }
      const newBal = a.type === 'card' ? Math.abs(bal) : bal; // a card stores what you owe
      if (!existing || newBal !== existing.balance) a.balanceAt = todayISO();
      a.balance = newBal;
      a.cur = $('#aCur', body).value;
      a.name = $('#aName', body).value.trim() || ACCOUNT_TYPES[a.type].label;
      a.provider = $('#aProv', body).value.trim();
      a.everyday = Math.abs(parseAmount($('#aEvery', body).value) || 0);
      a.partner = $('#aPartner', body).value.trim();
      upsertAccount(a);
      tick();
      closeSheet();
      toast(existing ? t('Saved') : t('{name} added', { name: a.name }));
    };
    if (existing) $('#aDel', body).onclick = async () => {
      const ok = await confirmSheet(t('Delete {name}?', { name: existing.name }), t('Its balance, and anything planned on it, will be removed from Kalendae. Your real account isn’t touched.'), t('Delete'), true);
      if (ok) { removeAccount(existing.id); toast(t('Deleted')); }
    };
    else $('#aCancel', body).onclick = closeSheet;
  });
}
