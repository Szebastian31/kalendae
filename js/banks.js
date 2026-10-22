// Banks and money services from around the world, for the "Bank or service" field.
// It's only a list of suggestions: you can always type any name.
const PROVIDERS = {
  'Poland': ['PKO BP', 'Pekao', 'mBank', 'ING Bank Śląski', 'Santander Bank Polska', 'BNP Paribas', 'Millennium', 'Alior Bank', 'Credit Agricole', 'Citi Handlowy', 'VeloBank', 'Nest Bank', 'Bank Pocztowy', 'BOŚ Bank', 'Inteligo', 'Toyota Bank', 'Plus Bank', 'Bank Spółdzielczy'],
  'United Kingdom': ['Barclays', 'HSBC UK', 'Lloyds', 'NatWest', 'Santander UK', 'Halifax', 'Nationwide', 'TSB', 'Monzo', 'Starling', 'Metro Bank', 'First Direct', 'Chase UK', 'Virgin Money', 'Co-operative Bank', 'RBS', 'Kroo', 'Chip'],
  'Ireland': ['AIB', 'Bank of Ireland', 'PTSB'],
  'Germany': ['Deutsche Bank', 'Commerzbank', 'Sparkasse', 'Volksbank', 'DKB', 'ING Deutschland', 'Comdirect', 'Postbank', 'HypoVereinsbank', 'Consorsbank', 'C24', 'Tomorrow', 'Trade Republic'],
  'France': ['BNP Paribas', 'Crédit Agricole', 'Société Générale', 'LCL', 'Crédit Mutuel', 'La Banque Postale', 'Caisse d’Epargne', 'Banque Populaire', 'BoursoBank', 'Fortuneo', 'Hello bank!', 'Shine', 'Lydia'],
  'Spain': ['Santander', 'BBVA', 'CaixaBank', 'Sabadell', 'Bankinter', 'ING España', 'Unicaja', 'Openbank', 'Abanca', 'Kutxabank', 'Bizum'],
  'Portugal': ['Millennium bcp', 'Caixa Geral de Depósitos', 'Novo Banco', 'Santander Totta', 'BPI', 'ActivoBank', 'MB Way'],
  'Italy': ['Intesa Sanpaolo', 'UniCredit', 'BPER', 'Banco BPM', 'Fineco', 'Poste Italiane', 'Monte dei Paschi', 'Mediolanum', 'Hype', 'Satispay'],
  'Netherlands & Belgium': ['ING', 'ABN AMRO', 'Rabobank', 'SNS', 'ASN Bank', 'Triodos', 'Knab', 'KBC', 'Belfius', 'BNP Paribas Fortis', 'Argenta', 'Tikkie'],
  'Switzerland & Austria': ['UBS', 'PostFinance', 'Raiffeisen', 'Zürcher Kantonalbank', 'Neon', 'Yuh', 'Twint', 'Erste Bank', 'Bank Austria', 'BAWAG', 'George'],
  'Nordics & Baltics': ['Nordea', 'Danske Bank', 'SEB', 'Swedbank', 'Handelsbanken', 'DNB', 'Lunar', 'OP', 'Jyske Bank', 'Sparebank 1', 'Luminor', 'LHV', 'Swish', 'Vipps MobilePay'],
  'Central & Eastern Europe': ['Česká spořitelna', 'ČSOB', 'Komerční banka', 'Air Bank', 'Moneta', 'Fio banka', 'Tatra banka', 'Slovenská sporiteľňa', 'OTP Bank', 'K&H', 'MBH Bank', 'Banca Transilvania', 'BCR', 'BRD', 'ING România', 'DSK Bank', 'Zagrebačka banka', 'NLB', 'Raiffeisen Bank'],
  'Ukraine': ['PrivatBank', 'Monobank', 'Oschadbank', 'Raiffeisen Bank Aval', 'PUMB', 'Sense Bank'],
  'Greece, Cyprus & Turkey': ['Alpha Bank', 'Eurobank', 'Piraeus Bank', 'National Bank of Greece', 'Bank of Cyprus', 'Ziraat Bankası', 'İş Bankası', 'Garanti BBVA', 'Akbank', 'Yapı Kredi', 'QNB', 'DenizBank', 'Papara'],
  'United States': ['Chase', 'Bank of America', 'Wells Fargo', 'Citi', 'Capital One', 'U.S. Bank', 'PNC', 'Truist', 'TD Bank', 'Ally', 'Discover', 'Charles Schwab', 'American Express', 'Navy Federal', 'USAA', 'Chime', 'SoFi', 'Marcus', 'Citizens', 'Fifth Third', 'KeyBank', 'Regions', 'Huntington', 'Synchrony', 'Varo', 'Current'],
  'Canada': ['RBC', 'TD Canada Trust', 'Scotiabank', 'BMO', 'CIBC', 'National Bank', 'Desjardins', 'Tangerine', 'Simplii', 'EQ Bank', 'Wealthsimple', 'KOHO', 'Interac'],
  'Latin America': ['Nubank', 'Itaú', 'Bradesco', 'Banco do Brasil', 'Caixa', 'Inter', 'PicPay', 'BBVA México', 'Banorte', 'Santander México', 'Banco de Chile', 'BancoEstado', 'Bancolombia', 'Galicia', 'Ualá', 'Mercado Pago'],
  'Australia & New Zealand': ['Commonwealth Bank', 'Westpac', 'ANZ', 'NAB', 'Macquarie', 'ING Australia', 'Up', 'Ubank', 'ASB', 'BNZ', 'Kiwibank'],
  'Asia': ['DBS', 'OCBC', 'UOB', 'HSBC', 'Standard Chartered', 'Maybank', 'CIMB', 'Bangkok Bank', 'Kasikornbank', 'SCB', 'BDO', 'BPI', 'GCash', 'Maya', 'BCA', 'Mandiri', 'BRI', 'MUFG', 'SMBC', 'Mizuho', 'Japan Post Bank', 'Rakuten Bank', 'PayPay', 'KB Kookmin', 'Shinhan', 'KakaoBank', 'Toss', 'ICBC', 'China Construction Bank', 'Bank of China', 'Agricultural Bank of China', 'Alipay', 'WeChat Pay', 'HDFC Bank', 'ICICI Bank', 'SBI', 'Axis Bank', 'Kotak', 'Paytm', 'PhonePe', 'Vietcombank', 'Techcombank', 'MoMo'],
  'Middle East': ['Bank Hapoalim', 'Bank Leumi', 'Emirates NBD', 'First Abu Dhabi Bank', 'ADCB', 'Mashreq', 'Al Rajhi', 'SNB', 'QNB', 'Kuwait Finance House'],
  'Africa': ['Standard Bank', 'FNB', 'Absa', 'Nedbank', 'Capitec', 'TymeBank', 'Discovery Bank', 'Equity Bank', 'KCB', 'M-Pesa', 'Access Bank', 'GTBank', 'Zenith Bank', 'OPay', 'Moniepoint', 'CIB Egypt', 'Attijariwafa'],
  'Online banks & e-money': ['Revolut', 'Wise', 'N26', 'Zen', 'Curve', 'bunq', 'Monzo', 'Starling', 'Vivid', 'Paysera', 'Payoneer', 'Skrill', 'Neteller', 'Lunar', 'Openbank'],
  'Wallet apps': ['PayPal', 'Cash App', 'Venmo', 'Zelle', 'Apple Cash', 'Google Wallet', 'Samsung Wallet', 'Amazon Pay', 'BLIK', 'Alipay', 'WeChat Pay', 'GCash', 'M-Pesa', 'Mercado Pago', 'Paytm', 'PhonePe', 'PayPay', 'Kakao Pay', 'Satispay', 'Twint', 'Vipps MobilePay', 'Swish', 'Bizum', 'Lydia', 'Revolut', 'Skrill'],
  'Investing & savings': ['Trading 212', 'XTB', 'Interactive Brokers', 'eToro', 'DEGIRO', 'Trade Republic', 'Scalable Capital', 'Vanguard', 'Fidelity', 'Charles Schwab', 'Robinhood', 'Freetrade', 'Hargreaves Lansdown', 'Moneybox', 'Raisin', 'Bossa', 'mBank eMakler', 'Lightyear', 'Bitpanda', 'Coinbase'],
  'Cash': ['Wallet', 'Drawer', 'Piggy bank', 'Safe', 'Envelope', 'Travel cash', 'Coin jar'],
};

// which lists to show first, by the kind of account
const PROVIDER_ORDER = {
  bank: null, savings: ['Investing & savings'], card: ['Online banks & e-money'],
  wallet: ['Wallet apps'], emoney: ['Online banks & e-money', 'Wallet apps'], cash: ['Cash'], other: null, invest: ['Investing & savings'],
};
// your region first, guessed from the currency you show money in
const REGION_BY_CUR = {
  PLN: 'Poland', GBP: 'United Kingdom', USD: 'United States', CAD: 'Canada', AUD: 'Australia & New Zealand', NZD: 'Australia & New Zealand',
  CHF: 'Switzerland & Austria', SEK: 'Nordics & Baltics', NOK: 'Nordics & Baltics', DKK: 'Nordics & Baltics', ISK: 'Nordics & Baltics',
  CZK: 'Central & Eastern Europe', HUF: 'Central & Eastern Europe', RON: 'Central & Eastern Europe', BGN: 'Central & Eastern Europe',
  UAH: 'Ukraine', TRY: 'Greece, Cyprus & Turkey', BRL: 'Latin America', MXN: 'Latin America', CLP: 'Latin America', ZAR: 'Africa', ILS: 'Middle East',
  JPY: 'Asia', CNY: 'Asia', KRW: 'Asia', INR: 'Asia', SGD: 'Asia', HKD: 'Asia', THB: 'Asia', IDR: 'Asia', MYR: 'Asia', PHP: 'Asia',
};

const fold = s => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/ł/g, "l");

// up to `max` names: matches for what you've typed, or the most likely ones for this kind of account
function providerSuggestions(type, query, max = 12) {
  const first = (PROVIDER_ORDER[type] || []).slice();
  const home = REGION_BY_CUR[S.settings.display];
  if (type === 'bank' || type === 'savings' || type === 'card') { if (home) first.unshift(home); }
  const regions = first.concat(Object.keys(PROVIDERS).filter(r => !first.includes(r) && (type !== 'cash' || r === 'Cash')));
  const q = fold(query || '').trim();
  const out = [];
  for (const r of regions) {
    for (const name of PROVIDERS[r]) {
      if (out.includes(name)) continue;
      if (!q || fold(name).includes(q)) out.push(name);
      if (out.length >= max) return out;
    }
    if (!q && out.length >= max) break;
  }
  return out;
}
