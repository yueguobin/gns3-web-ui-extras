// GNS3 Management Proxy — Background Service Worker / Event Page (MV3)
// Compatible with both Chrome and Firefox.
//
// Chrome: PAC script + onAuthRequired (HTTP CONNECT)
// Firefox: proxy.onRequest → SOCKS5 with auth per-request

// ── Browser compatibility shim ────────────────────────────────────
const api = typeof browser !== 'undefined' ? browser : chrome;
const isFirefox = typeof browser !== 'undefined';

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

// ── IP / subnet matching (used by Firefox onRequest) ──────────────

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

// ── PAC script generation (Chrome only) ───────────────────────────

function buildPacScript(host, port, entries) {
  const nets = entries.map((e) => `["${e.network}","${e.mask}"]`).join(',');
  return `
    function FindProxyForURL(url, host) {
      var nets = [${nets}];
      for (var i = 0; i < nets.length; i++) {
        if (isInNet(host, nets[i][0], nets[i][1]))
          return "PROXY ${host}:${port}";
      }
      return "DIRECT";
    }
  `;
}

// ── Apply proxy settings (Chrome path) ────────────────────────────

function applyProxyChrome(config) {
  const { proxyHost, proxyPort, mgmtCidrs, enabled } = config;

  if (!enabled) {
    api.proxy.settings.set(
      { value: { mode: 'direct' }, scope: 'regular' },
      () => console.log('[GNS3 Proxy] Disabled, set to DIRECT'),
    );
    return;
  }

  const entries = parseCidrList(mgmtCidrs);
  if (!entries.length) {
    console.error('[GNS3 Proxy] No valid CIDR entries, disabling proxy');
    api.proxy.settings.set({ value: { mode: 'direct' }, scope: 'regular' });
    return;
  }

  const pacScript = buildPacScript(proxyHost, proxyPort, entries);

  api.proxy.settings.set(
    {
      value: {
        mode: 'pac_script',
        pacScript: { data: pacScript },
      },
      scope: 'regular',
    },
    () => {
      if (api.runtime.lastError) {
        console.error('[GNS3 Proxy] Failed to set PAC:', api.runtime.lastError);
      } else {
        console.log(`[GNS3 Proxy] PAC applied: ${entries.length} entries → ${proxyHost}:${proxyPort}`);
      }
    },
  );
}

// ── Firefox path: proxy.onRequest → SOCKS5 with auth ──────────────

function handleFirefoxProxyRequest(details) {
  if (!currentConfig.enabled) {
    return { type: 'direct' };
  }

  try {
    const url = new URL(details.url);
    const host = url.hostname;
    const entries = parseCidrList(currentConfig.mgmtCidrs);

    for (const entry of entries) {
      if (isHostInNetwork(host, entry.network, entry.mask)) {
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
  }

  return { type: 'direct' };
}

// ── Apply proxy — dispatch to browser-specific path ───────────────

function applyProxy(config) {
  if (isFirefox) {
    // Firefox uses proxy.onRequest (registered once at init); no settings to push.
    console.log('[GNS3 Proxy] State:', config.enabled ? 'enabled' : 'disabled');
    return;
  }
  applyProxyChrome(config);
}

// ── Auth handler (Chrome only: HTTP CONNECT proxy auth) ───────────

if (!isFirefox) {
  api.webRequest.onAuthRequired.addListener(
    (details, callback) => {
      if (!details.isProxy) {
        callback();
        return;
      }
      api.storage.local.get(['proxyUser', 'proxyPass'], (data) => {
        const user = data.proxyUser || currentConfig.proxyUser || 'admin';
        const pass = data.proxyPass || currentConfig.proxyPass || '';
        callback({ authCredentials: { username: user, password: pass } });
      });
      return true;
    },
    { urls: ['<all_urls>'] },
    ['asyncBlocking'],
  );
}

// ── Register Firefox proxy.onRequest ──────────────────────────────

if (isFirefox && api.proxy && api.proxy.onRequest) {
  api.proxy.onRequest.addListener(handleFirefoxProxyRequest, { urls: ['<all_urls>'] });
}

// ── Load config from storage and apply ─────────────────────────────

function loadAndApplyConfig() {
  api.storage.local.get(null, (stored) => {
    if (api.runtime.lastError) {
      console.error('[GNS3 Proxy] Storage read error:', api.runtime.lastError);
    }
    currentConfig = { ...DEFAULT_CONFIG, ...stored };
    applyProxy(currentConfig);
  });
}

// ── Watch for config changes from options page ─────────────────────

api.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local') return;

  let changed = false;
  for (const key of Object.keys(DEFAULT_CONFIG)) {
    if (changes[key]) {
      currentConfig[key] = changes[key].newValue;
      changed = true;
    }
  }

  if (changed) {
    console.log('[GNS3 Proxy] Config changed, reapplying PAC');
    applyProxy(currentConfig);
  }
});

// ── Installation & runtime events ─────────────────────────────────

api.runtime.onInstalled.addListener(({ reason }) => {
  console.log(`[GNS3 Proxy] Installed, reason: ${reason}`);
  loadAndApplyConfig();
});

api.runtime.onStartup.addListener(() => {
  console.log('[GNS3 Proxy] Browser startup');
  loadAndApplyConfig();
});

// ── Initial load ──────────────────────────────────────────────────

loadAndApplyConfig();
