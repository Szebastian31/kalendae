// Kalendae money: currencies, 30-day average exchange rates and formatting.
// Rates come from three free public sources (no key, no account), each averaged over the last 30 days,
// and then averaged together, so no single table or jumpy day swings your budget:
//  - the National Bank of Poland's table A (official, published on working days)
//  - Frankfurter (the ECB and other central banks, every day)
//  - currency-api (market rates, sampled every ten days or so)
// Everything is stored as "złoty per 1 unit", and converted through złoty.
const RATES_KEY = 'kalendae-rates';
const NBP_URL = 'https://api.nbp.pl/api/exchangerates/tables/A/last/30/?format=json';
const FRANK_URL = from => `https://api.frankfurter.dev/v2/rates?base=PLN&from=${from}&quotes=${Object.keys(CURRENCIES).filter(c => c !== 'PLN').join(',')}`;
const CAPI_URL = tag => `https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@${tag}/v1/currencies/pln.json`;

const CURRENCIES = {
  PLN: ['Polish złoty', 'pl-PL'], EUR: ['Euro', 'de-DE'], USD: ['US dollar', 'en-US'], GBP: ['British pound', 'en-GB'],
  CHF: ['Swiss franc', 'de-CH'], CZK: ['Czech koruna', 'cs-CZ'], SEK: ['Swedish krona', 'sv-SE'], NOK: ['Norwegian krone', 'nb-NO'],
  DKK: ['Danish krone', 'da-DK'], HUF: ['Hungarian forint', 'hu-HU'], UAH: ['Ukrainian hryvnia', 'uk-UA'], RON: ['Romanian leu', 'ro-RO'],
  BGN: ['Bulgarian lev', 'bg-BG'], TRY: ['Turkish lira', 'tr-TR'], CAD: ['Canadian dollar', 'en-CA'], AUD: ['Australian dollar', 'en-AU'],
  NZD: ['New Zealand dollar', 'en-NZ'], JPY: ['Japanese yen', 'ja-JP'], CNY: ['Chinese yuan', 'zh-CN'], KRW: ['South Korean won', 'ko-KR'],
  INR: ['Indian rupee', 'en-IN'], SGD: ['Singapore dollar', 'en-SG'], HKD: ['Hong Kong dollar', 'zh-HK'], THB: ['Thai baht', 'th-TH'],
  IDR: ['Indonesian rupiah', 'id-ID'], MYR: ['Malaysian ringgit', 'ms-MY'], PHP: ['Philippine peso', 'en-PH'], ILS: ['Israeli shekel', 'he-IL'],
  ZAR: ['South African rand', 'en-ZA'], MXN: ['Mexican peso', 'es-MX'], BRL: ['Brazilian real', 'pt-BR'], CLP: ['Chilean peso', 'es-CL'],
  ISK: ['Icelandic króna', 'is-IS'],
};
// currency names in the app's language ("Euro", "euro", "Евро"…), from the phone's own dictionary
let CUR_DN = null;
try { CUR_DN = new Intl.DisplayNames([LOCALE], { type: 'currency' }); } catch (e) {}
const curName = c => { try { return (CUR_DN && CUR_DN.of(c)) || CURRENCIES[c][0]; } catch (e) { return (CURRENCIES[c] || [c])[0]; } };
const NO_DECIMALS = ['JPY', 'HUF', 'KRW', 'IDR', 'CLP', 'ISK'];

// Used until the first successful download (and if no source can be reached). Approximate, autumn 2026.
const FALLBACK = { PLN: 1, EUR: 4.27, USD: 3.68, GBP: 4.93, CHF: 4.58, CZK: 0.171, SEK: 0.345, NOK: 0.338, DKK: 0.572, HUF: 0.0104,
  UAH: 0.088, RON: 0.858, BGN: 2.18, TRY: 0.093, CAD: 2.66, AUD: 2.42, NZD: 2.2, JPY: 0.0245, CNY: 0.515, KRW: 0.0027, INR: 0.043,
  SGD: 2.84, HKD: 0.473, THB: 0.112, IDR: 0.00023, MYR: 0.86, PHP: 0.064, ILS: 0.99, ZAR: 0.205, MXN: 0.19, BRL: 0.67, CLP: 0.0039, ISK: 0.027 };

let RATES = loadRates();

function loadRates() {
  try {
    const r = JSON.parse(localStorage.getItem(RATES_KEY));
    if (r && r.avg) return r;
  } catch (e) {}
  return { source: 'built-in', from: null, to: null, fetched: null, avg: Object.assign({}, FALLBACK), spread: {} };
}

// In the Android app NBP's table comes through Android itself, as before; the other two sources use fetch,
// with Android as the fallback. In a browser everything uses fetch.
async function getJSON(url, nativeFirst) {
  const native = window.KalendaeNative && KalendaeNative.fetchRates;
  const viaNative = async () => {
    if (!native) throw new Error('offline');
    const text = await new Promise(r => setTimeout(() => r(KalendaeNative.fetchRates(url)), 0));
    if (!text) throw new Error('offline');
    return JSON.parse(text);
  };
  if (nativeFirst && native) return viaNative();
  try {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error(res.status);
    return await res.json();
  } catch (e) {
    return viaNative();
  }
}
// each source gives { name, seen: { EUR: [złoty per euro, one per day…] }, from, to }
async function ratesNBP() {
  const tables = await getJSON(NBP_URL, true);
  const seen = {};
  tables.forEach(t => t.rates.forEach(r => (seen[r.code] = seen[r.code] || []).push(r.mid)));
  return { name: 'NBP', seen, from: tables[0].effectiveDate, to: tables[tables.length - 1].effectiveDate };
}
async function ratesFrankfurter() {
  const rows = await getJSON(FRANK_URL(new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10)));
  const seen = {}, days = [];
  (Array.isArray(rows) ? rows : []).forEach(r => {
    if (!(r.rate > 0) || !CURRENCIES[r.quote]) return;
    (seen[r.quote] = seen[r.quote] || []).push(1 / r.rate); // 1 złoty = rate × quote, so 1 quote = 1 / rate złoty
    days.push(r.date);
  });
  if (!days.length) throw new Error('empty');
  days.sort();
  return { name: 'Frankfurter', seen, from: days[0], to: days[days.length - 1] };
}
async function ratesCurrencyApi() {
  const tag = n => { const d = new Date(Date.now() - n * 864e5); return `${d.getUTCFullYear()}.${d.getUTCMonth() + 1}.${d.getUTCDate()}`; };
  const got = await Promise.all(['latest', tag(10), tag(20), tag(29)].map(x => getJSON(CAPI_URL(x)).catch(() => null)));
  const seen = {}, days = [];
  got.filter(g => g && g.pln).forEach(g => {
    days.push(g.date);
    Object.keys(CURRENCIES).forEach(c => { const v = g.pln[c.toLowerCase()]; if (c !== 'PLN' && v > 0) (seen[c] = seen[c] || []).push(1 / v); });
  });
  if (!days.length) throw new Error('empty');
  days.sort();
  return { name: 'currency-api', seen, from: days[0], to: days[days.length - 1] };
}

// Downloads at most once a day; quietly keeps the last good copy when offline.
async function refreshRates(force) {
  const today = new Date().toISOString().slice(0, 10);
  if (!force && RATES.fetched === today) return false;
  const got = (await Promise.all([ratesNBP(), ratesFrankfurter(), ratesCurrencyApi()].map(p => p.catch(() => null)))).filter(Boolean);
  if (!got.length) return false;
  const mean = xs => xs.reduce((s, v) => s + v, 0) / xs.length;
  const avg = { PLN: 1 }, spread = { PLN: 0 };
  Object.keys(CURRENCIES).filter(c => c !== 'PLN').forEach(code => {
    // each source's own 30-day average first, so a source with more days doesn't count for more
    let means = got.filter(g => g.seen[code] && g.seen[code].length).map(g => ({ m: mean(g.seen[code]), all: g.seen[code] }));
    if (!means.length) return;
    // with three sources, leave out one that's more than 10% away from the middle one (a broken table)
    if (means.length >= 3) {
      const mid = means.map(x => x.m).sort((a, b) => a - b)[1];
      means = means.filter(x => Math.abs(x.m - mid) / mid <= 0.1);
    }
    const all = [].concat(...means.map(x => x.all));
    avg[code] = mean(means.map(x => x.m));
    spread[code] = ((Math.max(...all) - Math.min(...all)) / 2) / avg[code] * 100;
  });
  RATES = { source: got.map(g => g.name).join(', '), sources: got.map(g => g.name), from: got.map(g => g.from).sort()[0],
    to: got.map(g => g.to).sort().pop(), fetched: today, avg: Object.assign({}, FALLBACK, avg), spread };
  try { localStorage.setItem(RATES_KEY, JSON.stringify(RATES)); } catch (e) {}
  return true;
}

const ratesLive = () => RATES.source !== 'built-in';
const rate = cur => RATES.avg[cur] || FALLBACK[cur] || 1;
const rateSpread = cur => RATES.spread[cur] != null ? RATES.spread[cur] : 1;
// v in currency `from` → the currency budgets are shown in (or `to`)
function conv(v, from, to = S.settings.display) { return from === to ? v : v * rate(from) / rate(to); }

function fmt(v, cur = S.settings.display, opts = {}) {
  const loc = (CURRENCIES[cur] || [])[1] || 'en-GB';
  const dec = NO_DECIMALS.includes(cur) ? 0 : opts.cents ? 2 : (Math.abs(v) < 100 && Math.round(v) !== v ? 2 : 0);
  try {
    return new Intl.NumberFormat(loc, { style: 'currency', currency: cur, minimumFractionDigits: dec, maximumFractionDigits: dec })
      .format(dec ? v : Math.round(v)).replace('-', '−');
  } catch (e) {
    return (v < 0 ? '−' : '') + Math.abs(v).toFixed(dec) + ' ' + cur;
  }
}
// an amount in its own currency, plus "≈ …" in the display currency when they differ
function fmtBoth(v, cur) {
  const d = S.settings.display;
  return cur === d ? { main: fmt(v, cur), approx: '' } : { main: fmt(v, cur), approx: '≈ ' + fmt(conv(v, cur), d) };
}
function rateLine(cur, base = S.settings.display) {
  const r = rate(cur) / rate(base);
  const n = r >= 100 ? r.toFixed(0) : r >= 1 ? r.toFixed(3) : r.toPrecision(3);
  return `1 ${cur} = ${n} ${base}`;
}
function ratesNote() {
  if (!ratesLive()) return t('Using built-in estimates until the first download.');
  const d = s => new Date(s).toLocaleDateString(LOCALE, { day: 'numeric', month: 'short' });
  return t('30-day average from {names}, {from} – {to}.', { names: (RATES.sources || [RATES.source]).join(', '), from: d(RATES.from), to: d(RATES.to) });
}
function parseAmount(str) {
  const v = parseFloat(String(str).replace(/\s/g, '').replace(/[^\d,.\-−]/g, '').replace('−', '-').replace(',', '.'));
  return isNaN(v) ? null : v;
}
