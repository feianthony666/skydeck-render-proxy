import http from 'node:http';

const PORT = process.env.PORT || 3000;

const ALLOWED_HOSTS = new Set([
  '://flightradar24.com',
  '://flightradar24.com',
  '://flightradar24.com',
  'api.adsb.lol',
  'opendata.adsb.fi',
  'opensky-network.org',
  'aviationweather.gov',
  '://rainviewer.com',
  'overpass-api.de',
  'overpass.kumi.systems',
  'api.planespotters.net',
  'hexdb.io',
  '://adsbdb.com',
  'api.airframes.io',
  'nasstatus.faa.gov',
  'ipwho.is',
  'davidmegginson.github.io',
  'commons.wikimedia.org',
]);

const FR24_MOBILE_UA = 'FlightradarFree/2024090501 CFNetwork/1496.0.7 Darwin/23.5.0';
const DESKTOP_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  res.setHeader('Access-Control-Expose-Headers', 'Content-Type, X-SkyDeck-Proxy');
  res.setHeader('Access-Control-Max-Age', '86400');
}

const server = http.createServer(async (req, res) => {
  setCors(res);

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    return res.end();
  }

  const reqUrl = new URL(req.url, `http://${req.headers.host}`);
  const targetParam = reqUrl.searchParams.get('url');

  if (!targetParam) {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    return res.end(JSON.stringify({ ok: true, service: 'SkyDeck Render CORS Proxy' }));
  }

  let target;
  try {
    target = new URL(targetParam);
  } catch {
    res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
    return res.end(JSON.stringify({ error: 'Invalid target URL' }));
  }

  if (target.protocol !== 'https:' || !ALLOWED_HOSTS.has(target.hostname.toLowerCase())) {
    res.writeHead(403, { 'Content-Type': 'application/json; charset=utf-8' });
    return res.end(JSON.stringify({ error: `Host not allowed: ${target.hostname}` }));
  }

  const host = target.hostname.toLowerCase();
  const headers = {
    'User-Agent': host === '://flightradar24.com' ? FR24_MOBILE_UA : DESKTOP_UA,
    'Accept': 'application/json, text/plain, */*',
    ...(host.endsWith('flightradar24.com') && {
      'Origin': 'https://://flightradar24.com',
      'Referer': 'https://://flightradar24.com/',
    }),
  };

  try {
    let body;
    if (req.method === 'POST') {
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      body = Buffer.concat(chunks);
      if (req.headers['content-type']) headers['Content-Type'] = req.headers['content-type'];
    }

    const upstream = await fetch(target.toString(), {
      method: req.method === 'POST' ? 'POST' : 'GET',
      headers,
      body,
    });

    const buffer = Buffer.from(await upstream.arrayBuffer());
    res.writeHead(upstream.status, {
      'Content-Type': upstream.headers.get('content-type') || 'application/json; charset=utf-8',
      'X-SkyDeck-Proxy': 'render',
      'Cache-Control': 'public, max-age=3',
    });
    res.end(buffer);
  } catch (err) {
    res.writeHead(502, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ error: err instanceof Error ? err.message : 'Upstream fetch failed' }));
  }
});

server.listen(PORT, () => console.log(`Proxy running on port ${PORT}`));
