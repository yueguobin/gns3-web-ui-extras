// GNS3 Management Proxy — Background Service Worker / Event Page (MV3)
// Compatible with both Chrome and Firefox.

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

// ── PAC script generation ──────────────────────────────────────────
// entries: [{ network, mask }]

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

// ── Apply proxy settings ──────────────────────────────────────────

function applyProxy(config) {
  const { proxyHost, proxyPort, mgmtCidrs, enabled } = config;

  if (isFirefox) {
    applyProxyFirefox(config);
    return;
  }

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

// Firefox path — proxy.settings uses proxyType + autoConfigUrl.
function applyProxyFirefox(config) {
  const { proxyHost, proxyPort, mgmtCidrs, enabled } = config;

  if (!enabled) {
    api.proxy.settings.set({ value: { proxyType: 'none' } });
    console.log('[GNS3 Proxy] Disabled, set to NONE (Firefox)');
    return;
  }

  const entries = parseCidrList(mgmtCidrs);
  if (!entries.length) {
    console.error('[GNS3 Proxy] No valid CIDR entries, disabling proxy');
    api.proxy.settings.set({ value: { proxyType: 'none' } });
    return;
  }

  const pacScript = buildPacScript(proxyHost, proxyPort, entries);
  const autoConfigUrl = 'data:text/javascript,' + encodeURIComponent(pacScript);

  api.proxy.settings.set({ value: { proxyType: 'autoConfig', autoConfigUrl } });
  console.log(`[GNS3 Proxy] PAC applied (Firefox): ${entries.length} entries → ${proxyHost}:${proxyPort}`);
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

// ── Auth handler (proxy CONNECT authentication) ─────────────────────

function handleAuth(details) {
  if (!details.isProxy) {
    return isFirefox ? {} : undefined;
  }
  const user = currentConfig.proxyUser || 'admin';
  const pass = currentConfig.proxyPass || '';
  return { authCredentials: { username: user, password: pass } };
}

if (isFirefox) {
  api.webRequest.onAuthRequired.addListener(
    (details) => handleAuth(details),
    { urls: ['<all_urls>'] },
    ['blocking'],
  );
} else {
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
