// Keep, review or cancel: four signals vote on each subscription, like Augur's systems vote on a reading.
//  Usage   – how much you say you use it (asked in the form; Kalendae doesn't read your screen time)
//  Price   – has it gone up in the last 12 months (Kalendae remembers each price you save)
//  Plan    – is a yearly or cheaper plan you typed in worth switching to
//  Overlap – do you pay for something else that does the same job
const SUB_GROUPS = {
  'video': ['netflix', 'disney', 'max', 'hbo', 'prime video', 'amazon prime', 'skyshowtime', 'canal+', 'player', 'apple tv', 'paramount', 'hulu', 'peacock', 'viaplay', 'polsat box', 'crunchyroll', 'mubi', 'youtube premium'],
  'music': ['spotify', 'apple music', 'tidal', 'deezer', 'youtube music', 'youtube premium', 'amazon music', 'soundcloud'],
  'cloud storage': ['icloud', 'google one', 'dropbox', 'onedrive', 'microsoft 365', 'proton', 'pcloud', 'mega'],
  'AI assistant': ['chatgpt', 'claude', 'gemini', 'copilot', 'perplexity', 'mistral'],
  'gaming': ['game pass', 'playstation plus', 'ps plus', 'nintendo switch online', 'ea play', 'ubisoft+', 'geforce now'],
  'books & audio': ['audible', 'kindle unlimited', 'storytel', 'legimi', 'empik go', 'bookbeat', 'scribd'],
  'photo & design': ['adobe', 'lightroom', 'photoshop', 'canva', 'figma', 'affinity'],
  'VPN': ['nordvpn', 'expressvpn', 'surfshark', 'proton vpn', 'mullvad'],
  'fitness': ['gym', 'strava', 'peloton', 'fitbit premium', 'apple fitness', 'multisport', 'medicover sport', 'fiit'],
  'news': ['news', 'times', 'guardian', 'wyborcza', 'rzeczpospolita', 'economist', 'medium', 'substack'],
  'rides & delivery': ['uber one', 'bolt plus', 'glovo prime', 'wolt+', 'deliveroo plus'],
};
const USAGE = { daily: ['Every day', 'k'], weekly: ['Every week', 'k'], monthly: ['Now and then', 'r'], never: ['Hardly ever', 'c'] };

const subGroups = it => { const n = it.name.toLowerCase(); return Object.keys(SUB_GROUPS).filter(g => SUB_GROUPS[g].some(w => n.includes(w))); };

// keeps a short price history so a price rise can be spotted
function notePrice(it, before) {
  if (it.kind !== 'sub') return;
  it.prices = Array.isArray(it.prices) ? it.prices : [];
  // first time Kalendae sees a change on an older subscription: remember the old price too
  if (!it.prices.length && before && before.amount && before.amount !== it.amount) it.prices.push({ d: isoDay(addDays(day0(), -1)), v: before.amount });
  if (!it.prices.length || it.prices[it.prices.length - 1].v !== it.amount) it.prices.push({ d: todayISO(), v: it.amount });
  it.prices = it.prices.slice(-12);
}

function subSignals(it) {
  const cur = itemCur(it);
  const month = perMonth(it);
  const sig = [];
  // usage
  const u = USAGE[it.usage];
  if (!u) sig.push(['r', 'Usage', 'Not rated yet. How often do you use it?']);
  else {
    const per = it.usage === 'daily' ? month / 30 : it.usage === 'weekly' ? month / 4.3 : it.usage === 'monthly' ? month : null;
    sig.push([u[1], 'Usage', `${u[0]}${per ? ` → about ${fmt(per, cur)} each time` : ''}`]);
  }
  // price
  const yearAgo = isoDay(addDays(day0(), -365));
  const hist = (it.prices || []).filter(p => p.d >= yearAgo);
  const first = hist[0];
  if (first && it.amount > first.v + 0.005) sig.push(['r', 'Price', `Up ${fmt(it.amount - first.v, cur)} since ${fromISO(first.d).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })}`]);
  else sig.push(['k', 'Price', hist.length > 1 ? 'Same price for a year or more' : 'No price change Kalendae knows of']);
  // plan
  if (it.alt > 0 && it.alt < month * 12 - 0.5 && (REPEATS[it.repeat] || REPEATS.month)[1] !== 'year')
    sig.push(['r', 'Plan', `A ${fmt(it.alt, cur)} yearly plan saves ${fmt(month * 12 - it.alt, cur)} a year`]);
  else if (it.altMonthly > 0 && it.altMonthly < month - 0.5) sig.push(['r', 'Plan', `The cheaper plan saves ${fmt((month - it.altMonthly) * 12, cur)} a year`]);
  else sig.push(['k', 'Plan', it.alt || it.altMonthly ? 'You’re already on the best plan you listed' : 'No cheaper plan listed']);
  // overlap
  const groups = subGroups(it);
  const others = liveItems().filter(o => o.kind === 'sub' && o.id !== it.id && !o.paused && subGroups(o).some(g => groups.includes(g)));
  if (others.length) sig.push(['r', 'Overlap', `${others.map(o => o.name).slice(0, 2).join(' and ')} also ${others.length > 1 ? 'cover' : 'covers'} ${groups.find(g => subGroups(others[0]).includes(g))}`]);
  else sig.push(['k', 'Overlap', groups.length ? `Your only ${groups[0]} subscription` : 'Nothing else does the same job']);
  return sig;
}

function subVerdict(it) {
  const s = subSignals(it).map(x => x[0]);
  const c = s.filter(v => v === 'c').length, r = s.filter(v => v === 'r').length;
  if (c && (c + r) >= 2) return 'c';
  if (c || r >= 2) return 'r';
  return 'k';
}
const VERDICT = { k: ['Keep', 'var(--good)'], r: ['Review', 'var(--warn)'], c: ['Cancel?', 'var(--bad)'] };
