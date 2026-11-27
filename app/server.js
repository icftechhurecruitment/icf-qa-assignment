'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = Number(process.env.PORT) || 4173;
const PUBLIC = path.join(__dirname, 'public');
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
};

// ---------- seeded randomness ----------
function hash(str) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return h >>> 0;
}
function mulberry32(a) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function shuffle(arr, rnd) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ---------- catalog & business rules ----------
const NAMES = ['Aurora Vale', 'Nova Quill', 'Milo Park', 'Juniper Ash', 'Kai Rivers', 'Sage Holloway',
  'Ember Cole', 'Rowan Fox', 'Indigo Lane', 'Wren Hale', 'Atlas Reed', 'Skye Marlow'];
const TAGLINES = ['Daily sketches and process videos', 'Live cooking every Friday', 'Indie game dev diaries',
  'Fitness routines you can actually keep', 'Street photography walks', 'Music production breakdowns',
  'Cozy book club livestreams', 'Travel stories from the road'];

const TIERS = [
  { id: 'monthly', label: 'Monthly', months: 1, discountPct: 0 },
  { id: 'quarterly', label: '3 Months', months: 3, discountPct: 10 },
  { id: 'annual', label: 'Annual', months: 12, discountPct: 20 },
];
// integer maths in cents; rounded to nearest cent (half up)
const planPriceCents = (baseCents, t) => Math.round((baseCents * t.months * (100 - t.discountPct)) / 100);

function buildCatalog(seed) {
  const rnd = mulberry32(hash('catalog:' + seed));
  return shuffle(NAMES, rnd).slice(0, 8).map((name) => ({
    id: name.toLowerCase().replace(/\s+/g, '-'),
    name,
    tagline: TAGLINES[Math.floor(rnd() * TAGLINES.length)],
    baseCents: (5 + Math.floor(rnd() * 21)) * 100 + [0, 49, 99][Math.floor(rnd() * 3)],
  }));
}
const withPlans = (c) => ({
  id: c.id, name: c.name, tagline: c.tagline,
  plans: TIERS.map((t) => ({
    id: t.id, label: t.label, discountPct: t.discountPct, priceCents: planPriceCents(c.baseCents, t),
  })),
});

// ---------- state ----------
const takenEmails = new Set();   // global for the whole server run
const sessions = new Map();      // per browser session
function getSession(id) {
  if (!sessions.has(id)) sessions.set(id, { seed: null, user: null, balanceCents: 0, subs: [] });
  return sessions.get(id);
}

// ---------- helpers ----------
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const send = (res, status, body) => {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(body));
};
const readJson = (req) => new Promise((resolve) => {
  let raw = '';
  req.on('data', (c) => (raw += c));
  req.on('end', () => { try { resolve(JSON.parse(raw || '{}')); } catch { resolve({}); } });
});
const dollars = (cents) => '$' + (cents / 100).toFixed(2);

// ---------- API ----------
async function handleApi(req, res, url) {
  await sleep(150 + Math.random() * 450); // realistic latency
  const s = getSession(String(req.headers['x-session'] || 'anon').slice(0, 64));
  const body = req.method === 'POST' ? await readJson(req) : {};

  switch (`${req.method} ${url.pathname}`) {
    case 'GET /api/me':
      return send(res, 200, { user: s.user, balanceCents: s.balanceCents, subscriptions: s.subs });

    case 'GET /api/creators': {
      const seed = url.searchParams.get('seed') || 'default';
      const order = url.searchParams.get('order') || 'default';
      s.seed = seed;
      const creators = shuffle(buildCatalog(seed), mulberry32(hash(`order:${seed}:${order}`))).map(withPlans);
      const promoDelayMs = 3000 + Math.floor(mulberry32(hash(`promo:${seed}:${order}`))() * 7000);
      return send(res, 200, { creators, promoDelayMs });
    }

    case 'POST /api/signup': {
      if (s.user) return send(res, 400, { errors: { form: 'You are already signed in.' } });
      const rawEmail = String(body.email || '').trim();
      const email = rawEmail.toLowerCase();
      const errors = {};
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = 'Enter a valid email address.';
      if (String(body.password || '').length < 8) errors.password = 'Password must be at least 8 characters.';
      if (Object.keys(errors).length) return send(res, 400, { errors });
      if (takenEmails.has(email)) return send(res, 409, { errors: { email: 'That email is already registered.' } });
      takenEmails.add(email);
      const rnd = mulberry32(hash('start:' + (s.seed || 'none')));
      s.user = { email: rawEmail };
      s.balanceCents = 2000 + Math.floor(rnd() * 81) * 50; // $20.00 – $60.00
      s.subs = [];
      return send(res, 200, { user: s.user, balanceCents: s.balanceCents });
    }

    case 'POST /api/topup': {
      if (!s.user) return send(res, 401, { error: 'Please sign up first.' });
      const cents = Number(body.amountCents);
      if (!Number.isInteger(cents)) return send(res, 400, { error: 'Enter a valid amount.' });
      if (cents < 1000) return send(res, 400, { error: 'Minimum top-up is $10.00.' });
      if (cents > 50000) return send(res, 400, { error: 'Maximum top-up is $500.00.' });
      s.balanceCents += cents;
      return send(res, 200, { amountCents: cents, balanceCents: s.balanceCents });
    }

    case 'POST /api/subscribe': {
      if (!s.user) return send(res, 401, { error: 'Please sign up to subscribe.' });
      const creator = buildCatalog(s.seed || 'default').find((c) => c.id === body.creatorId);
      const tier = TIERS.find((t) => t.id === body.planId);
      if (!creator || !tier) return send(res, 400, { error: 'Unknown creator or plan.' });
      if (s.subs.some((x) => x.creatorId === creator.id)) {
        return send(res, 409, { error: `You already have an active subscription to ${creator.name}.` });
      }
      const price = planPriceCents(creator.baseCents, tier);
      if (s.balanceCents < price) {
        return send(res, 402, { error: `Insufficient balance. You need ${dollars(price - s.balanceCents)} more.` });
      }
      s.balanceCents -= price;
      s.subs.push({ creatorId: creator.id, creatorName: creator.name, planId: tier.id, planLabel: tier.label, priceCents: price });
      return send(res, 200, { chargedCents: price, balanceCents: s.balanceCents, subscriptions: s.subs });
    }

    default:
      return send(res, 404, { error: 'Not found' });
  }
}

// ---------- server ----------
http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname.startsWith('/api/')) return await handleApi(req, res, url);
    const rel = url.pathname === '/' ? '/index.html' : url.pathname;
    const file = path.normalize(path.join(PUBLIC, rel));
    if (!file.startsWith(PUBLIC) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
      res.writeHead(404); return res.end('Not found');
    }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    fs.createReadStream(file).pipe(res);
  } catch (e) {
    console.error(e); res.writeHead(500); res.end('Server error');
  }
}).listen(PORT, () => console.log(`Creator Shop running on http://localhost:${PORT}`));