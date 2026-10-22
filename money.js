// Kalendae money: currencies, 30-day average exchange rates and formatting.
// Rates come from the National Bank of Poland's free public table A (no key, no account):
// the last 30 published days are averaged, so one jumpy day doesn't swing your budget.
// Everything is stored as "złoty per 1 unit", and converted through złoty.
const RATES_KEY = 'kalendae-rates';
const NBP_URL = 'https://api.nbp.pl/api/exchangerates/tables/A/last/30/?format=json';

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
const NO_DECIMALS = ['JPY', 'HUF', 'KRW', 'IDR', 'CLP', 'ISK'];

// Used until the first successful download (and if NBP can't be reached). Approximate, autumn 2026.
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

// Downloads at most once a day; quietly keeps the last good copy when offline.
async function refreshRates(force) {
  const today = new Date().toISOString().slice(0, 10);
  if (!force && RATES.fetched === today) return false;
  try {
    let tables;
    if (window.KalendaeNative && KalendaeNative.fetchRates) {
      const text = await new Promise(r => setTimeout(() => r(KalendaeNative.fetchRates(NBP_URL)), 0));
      if (!text) throw new Error('offline');
      tables = JSON.parse(text);
    } else {
      const res = await fetch(NBP_URL, { cache: 'no-store' });
      if (!res.ok) throw new Error(res.status);
      tables = await res.json();
    }
    const seen = {};
    tables.forEach(t => t.rates.forEach(r => (seen[r.code] = seen[r.code] || []).push(r.mid)));
    const avg = { PLN: 1 }, spread = { PLN: 0 };
    Object.entries(seen).forEach(([code, mids]) => {
      const mean = mids.reduce((s, v) => s + v, 0) / mids.length;
      avg[code] = mean;
      spread[code] = ((Math.max(...mids) - Math.min(...mids)) / 2) / mean * 100;
    });
    RATES = { source: 'NBP', from: tables[0].effectiveDate, to: tables[tables.length - 1].effectiveDate, fetched: today,
      days: tables.length, avg: Object.assign({}, FALLBACK, avg), spread };
    localStorage.setItem(RATES_KEY, JSON.stringify(RATES));
    return true;
  } catch (e) {
    return false;
  }
}

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
  if (RATES.source !== 'NBP') return 'Using built-in estimates until the first download from the National Bank of Poland.';
  const d = s => new Date(s).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  return `Average of ${RATES.days} NBP tables, ${d(RATES.from)} – ${d(RATES.to)}.`;
}
function parseAmount(str) {
  const v = parseFloat(String(str).replace(/\s/g, '').replace(/[^\d,.\-−]/g, '').replace('−', '-').replace(',', '.'));
  return isNaN(v) ? null : v;
}
