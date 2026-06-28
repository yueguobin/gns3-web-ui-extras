// GNS3 Management Proxy — Background Service Worker / Event Page (MV3)
// Compatible with both Chrome and Firefox.

// ── Browser compatibility shim ────────────────────────────────────
// Firefox exposes the global `browser`; Chrome exposes `chrome`.
// Use whichever is available so one file runs in both.
const api = typeof browser !== 'undefined' ? browser : chrome;
const isFirefox = typeof browser !== 'undefined';

const DEFAULT_CONFIG = {
  proxyHost: '127.0.0.1',
  proxyPort: 3090,
  mgmtCidr: '172.16.40.0/23',
  mgmtNetwork: '172.16.40.0',
  mgmtMask: '255.255.254.0',
  proxyUser: 'admin',
  proxyPass: '',
  enabled: false,
};

let currentConfig = { ...DEFAULT_CONFIG };

// ── CIDR → netmask ─────────────────────────────────────────────────

function cidrToMask(prefixLen) {
  const mask = ~0 << (32 - Math.min(Math.max(prefixLen, 0), 32));
  return [
    (mask >>> 24) & 0xff,
    (mask >>> 16) & 0xff,
    (mask >>> 8) & 0xff,
    mask & 0xff,
  ].join('.');
}

// ── PAC script generation ──────────────────────────────────────────

function buildPacScript(host, port, network, mask) {
  return `
    function FindProxyForURL(url, host) {
      if (isInNet(host, "${network}", "${mask}"))
        return "PROXY ${host}:${port}";
      return "DIRECT";
    }
  `;
}

// ── Apply proxy settings ──────────────────────────────────────────
// Chrome uses `mode: "pac_script"` with inline `pacScript.data`.
// Firefox uses `proxyType: "autoConfig"` with a `data:` URL for the PAC.

function applyProxy(config) {
  const { proxyHost, proxyPort, mgmtNetwork, mgmtMask, enabled } = config;

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

  const pacScript = buildPacScript(proxyHost, proxyPort, mgmtNetwork, mgmtMask);

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
        console.log(`[GNS3 Proxy] PAC applied: ${mgmtNetwork}/${mgmtMask} → ${proxyHost}:${proxyPort}`);
      }
    },
  );
}

// Firefox path — proxy.settings uses proxyType + autoConfigUrl.
function applyProxyFirefox(config) {
  const { proxyHost, proxyPort, mgmtNetwork, mgmtMask, enabled } = config;

  if (!enabled) {
    api.proxy.settings.set({ value: { proxyType: 'none' } });
    console.log('[GNS3 Proxy] Disabled, set to NONE (Firefox)');
    return;
  }

  const pacScript = buildPacScript(proxyHost, proxyPort, mgmtNetwork, mgmtMask);
  const autoConfigUrl = 'data:text/javascript,' + encodeURIComponent(pacScript);

  api.proxy.settings.set({
    value: { proxyType: 'autoConfig', autoConfigUrl },
  });
  console.log(`[GNS3 Proxy] PAC applied (Firefox): ${mgmtNetwork}/${mgmtMask} → ${proxyHost}:${proxyPort}`);
}

// ── Auth handler (proxy CONNECT authentication) ─────────────────────
// Chrome uses asyncBlocking (callback-style).
// Firefox uses blocking mode and returns the value directly.

function handleAuth(details) {
  if (!details.isProxy) {
    return isFirefox ? {} : undefined;
  }

  // For Chrome async path we need async storage access; handled in listener below.
  // Firefox is synchronous-friendly with blocking, but storage may still be async,
  // so we read from the cached currentConfig instead.
  const user = currentConfig.proxyUser || 'admin';
  const pass = currentConfig.proxyPass || '';
  return { authCredentials: { username: user, password: pass } };
}

if (isFirefox) {
  // Firefox: blocking listener. Reads from currentConfig (kept in sync via storage.onChanged).
  api.webRequest.onAuthRequired.addListener(
    (details) => handleAuth(details),
    { urls: ['<all_urls>'] },
    ['blocking'],
  );
} else {
  // Chrome: asyncBlocking with callback.
  api.webRequest.onAuthRequired.addListener(
    (details, callback) => {
      if (!details.isProxy) {
        callback();
        return;
      }

      api.storage.local.get(['proxyUser', 'proxyPass'], (data) => {
        const user = data.proxyUser || currentConfig.proxyUser || 'admin';
        const pass = data.proxyPass || currentConfig.proxyPass || '';
        callback({
          authCredentials: { username: user, password: pass },
        });
      });

      // Return true to indicate async callback (required for asyncBlocking)
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

    // Merge stored values into defaults
    currentConfig = {
      ...DEFAULT_CONFIG,
      ...stored,
    };

    // Fallback: derive mask from CIDR string if mask wasn't stored
    if (stored.mgmtCidr && !stored.mgmtMask) {
      const m = String(stored.mgmtCidr).match(/\/(\d+)$/);
      if (m) currentConfig.mgmtMask = cidrToMask(parseInt(m[1], 10));
    }

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

  // If mgmtCidr changed but mgmtMask didn't, derive mask from CIDR string
  if (changes.mgmtCidr && !changes.mgmtMask) {
    const m = String(changes.mgmtCidr.newValue).match(/\/(\d+)$/);
    if (m) {
      currentConfig.mgmtMask = cidrToMask(parseInt(m[1], 10));
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
