const fs = require('fs');

const CONFIG = {
  arabicaSymbol: 'KC=F',
  robustaSymbol: 'RM=F',
  kursUrl: 'https://open.er-api.com/v6/latest/USD',
  outputFile: 'prices.json'
};

async function fetchYahooPrice(symbol) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=1d`;
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const result = data.chart?.result?.[0];
    if (!result) throw new Error('No result');

    const meta = result.meta;
    const price = meta.regularMarketPrice || meta.previousClose || 0;
    const prev = meta.previousClose || meta.chartPreviousClose || price;

    return {
      symbol,
      price: parseFloat(price.toFixed(2)),
      previousClose: parseFloat(prev.toFixed(2)),
      change: parseFloat((price - prev).toFixed(2)),
      changePercent: prev ? parseFloat(((price - prev) / prev * 100).toFixed(2)) : 0,
      currency: meta.currency || 'USD',
      timestamp: new Date().toISOString()
    };
  } catch (err) {
    console.error(`Failed to fetch ${symbol}:`, err.message);
    return null;
  }
}

async function fetchKursIDR() {
  try {
    const res = await fetch(CONFIG.kursUrl);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const rate = data.rates?.IDR;
    if (!rate) throw new Error('IDR rate not found');

    return {
      from: 'USD',
      to: 'IDR',
      rate: Math.round(rate),
      source: 'open.er-api.com',
      timestamp: new Date().toISOString()
    };
  } catch (err) {
    console.error('Failed to fetch kurs:', err.message);
    return null;
  }
}

async function main() {
  console.log('Fetching coffee prices...');

  const [arabica, robusta, kurs] = await Promise.all([
    fetchYahooPrice(CONFIG.arabicaSymbol),
    fetchYahooPrice(CONFIG.robustaSymbol),
    fetchKursIDR()
  ]);

  let existing = {};
  try {
    existing = JSON.parse(fs.readFileSync(CONFIG.outputFile, 'utf8'));
  } catch (e) { }

  const output = {
    lastUpdated: new Date().toISOString(),
    source: 'Yahoo Finance + open.er-api.com',
    arabica: arabica || existing.arabica || {
      symbol: 'KC=F', price: 275.70, unit: 'cents/lb', note: 'fallback/default'
    },
    robusta: robusta || existing.robusta || {
      symbol: 'RM=F', price: 3487, unit: 'USD/ton', note: 'fallback/default'
    },
    kurs: kurs || existing.kurs || {
      from: 'USD', to: 'IDR', rate: 17570, note: 'fallback/default'
    }
  };

  if (!output.arabica.unit) output.arabica.unit = 'cents/lb';
  if (!output.robusta.unit) output.robusta.unit = 'USD/ton';

  fs.writeFileSync(CONFIG.outputFile, JSON.stringify(output, null, 2));
  console.log('Saved to', CONFIG.outputFile);
  console.log('Arabica:', output.arabica.price, '¢/lb');
  console.log('Robusta:', output.robusta.price, '$/ton');
  console.log('Kurs IDR:', output.kurs.rate);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
