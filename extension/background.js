// GNS3 Management Proxy — Background Script (Firefox MV3)
// Uses browser.proxy.onRequest for per-request SOCKS5 with authentication.
// No PAC script, no native host — pure extension.

const DEFAULT_CONFIG = {
  proxyHost: '127.0.0.1',
  proxyPort: 3090,
  mgmtCidrs: ['172.16.40.0/23'],
  proxyUser: 'admin',
  proxyPass: '',
  enabled: false,
};

let currentConfig = { ...DEFAULT_CONFIG };

// ── CIDR helpers ──────────────────────────────────────────────────

function cidrToMask(prefixLen) {
  const mask = ~0 << (32 - Math.min(Math.max(prefixLen, 0), 32));
  return [
    (mask >>> 24) & 0xff,
    (mask >>> 16) & 0xff,
    (mask >>> 8) & 0xff,
    mask & 0xff,
  ].join('.');
}

function parseCidrStr(s) {
  const m = String(s).trim().match(/^([\d.]+)\/(\d+)$/);
  if (!m) return null;
  const network = m[1];
  const prefix = parseInt(m[2], 10);
  const parts = network.split('.').map(Number);
  const valid =
    parts.length === 4 &&
    parts.every((p) => !isNaN(p) && p >= 0 && p <= 255) &&
    prefix >= 0 && prefix <= 32;
  if (!valid) return null;
  return { network, mask: cidrToMask(prefix) };
}

function parseCidrList(arr) {
  if (!Array.isArray(arr)) return [];
  const out = [];
  for (const s of arr) {
    const p = parseCidrStr(s);
    if (p) out.push(p);
  }
  return out;
}

// ── IP / subnet matching ──────────────────────────────────────────

function ipToInt(ip) {
  return ip.split('.').reduce((acc, oct) => (acc << 8) | parseInt(oct, 10), 0) >>> 0;
}

function isIPv4(s) {
  return /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(s);
}

function isHostInNetwork(host, network, mask) {
  if (!isIPv4(host)) return false;
  return (ipToInt(host) & ipToInt(mask)) === ipToInt(network);
}

// ── Proxy request handler (SOCKS5 with auth) ──────────────────────

function handleProxyRequest(details) {
  if (!currentConfig.enabled) {
    return { type: 'direct' };
  }

  let host = '';

  try {
    const url = new URL(details.url);
    host = url.hostname;
    const entries = parseCidrList(currentConfig.mgmtCidrs);
    if (entries.length === 0) {
      console.warn('[GNS3 Proxy] No CIDR entries loaded (mgmtCidrs:', JSON.stringify(currentConfig.mgmtCidrs), ')');
    }

    if (isIPv4(host)) {
      console.log(`[GNS3 Proxy]  CHECK ${host} →`, JSON.stringify(currentConfig.mgmtCidrs));
    }
    for (const entry of entries) {
      if (isHostInNetwork(host, entry.network, entry.mask)) {
        console.log(`[GNS3 Proxy] → SOCKS5 ${currentConfig.proxyHost}:${currentConfig.proxyPort}  ${host}`);
        return {
          type: 'socks',
          host: currentConfig.proxyHost,
          port: parseInt(currentConfig.proxyPort, 10),
          username: currentConfig.proxyUser || 'admin',
          password: currentConfig.proxyPass || '',
          proxyDNS: true,
        };
      }
    }
  } catch (_e) {
    // Invalid URL, fall through to direct
    host = details.url || 'unknown';
  }

  console.log(`[GNS3 Proxy] → DIRECT  ${host}`);
  return { type: 'direct' };
}

// ── Register proxy.onRequest ──────────────────────────────────────

browser.proxy.onRequest.addListener(handleProxyRequest, { urls: ['<all_urls>'] });

// ── Load / watch config ───────────────────────────────────────────

function loadConfig() {
  browser.storage.local.get(null, (stored) => {
    if (browser.runtime.lastError) {
      console.error('[GNS3 Proxy] Storage read error:', browser.runtime.lastError);
    }
    currentConfig = { ...DEFAULT_CONFIG, ...stored };
    console.log('[GNS3 Proxy] State:', currentConfig.enabled ? 'enabled' : 'disabled');
  });
}

browser.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local') return;
  let changed = false;
  for (const key of Object.keys(DEFAULT_CONFIG)) {
    if (changes[key]) {
      currentConfig[key] = changes[key].newValue;
      changed = true;
    }
  }
  if (changed) {
    console.log('[GNS3 Proxy] Config changed:', currentConfig.enabled ? 'enabled' : 'disabled');
  }
});

browser.runtime.onInstalled.addListener(() => loadConfig());
browser.runtime.onStartup.addListener(() => loadConfig());
loadConfig();
