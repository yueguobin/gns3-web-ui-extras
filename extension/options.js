// GNS3 Management Proxy — Options / Config page

const DEFAULTS = {
  proxyHost: '127.0.0.1',
  proxyPort: 3090,
  mgmtCidrs: ['172.16.40.0/23'],
  proxyUser: 'admin',
  proxyPass: '',
  enabled: false,
};

const _ = browser.i18n.getMessage.bind(browser.i18n);

// ── Helpers ───────────────────────────────────────────────────────

function isValidIPv4(s) {
  const parts = String(s).split('.');
  if (parts.length !== 4) return false;
  return parts.every((part) => {
    const n = Number(part);
    return !isNaN(n) && n >= 0 && n <= 255 && String(n) === part;
  });
}

function cidrToMask(prefix) {
  const mask = ~0 << (32 - Math.min(Math.max(prefix, 0), 32));
  return [
    (mask >>> 24) & 0xff,
    (mask >>> 16) & 0xff,
    (mask >>> 8) & 0xff,
    mask & 0xff,
  ].join('.');
}

/**
 * Parse "172.16.40.0/23" → { network, prefix, mask }
 * Returns null on invalid input.
 */
function parseCidr(input) {
  const s = String(input).trim();
  const m = s.match(/^([\d.]+)\/(\d+)$/);
  if (!m) return null;
  const network = m[1];
  const prefix = parseInt(m[2], 10);
  if (!isValidIPv4(network) || prefix < 0 || prefix > 32) return null;
  return { network, prefix, mask: cidrToMask(prefix) };
}

/**
 * Split multi-line text into CIDR array. Returns null if any line is invalid.
 */
function parseCidrLines(text) {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  if (!lines.length) return [];
  for (const line of lines) {
    if (!parseCidr(line)) return null;
  }
  return lines;
}

// ── DOM refs ──────────────────────────────────────────────────────

const $ = (id) => document.getElementById(id);
const proxyHost = $('proxyHost');
const proxyPort = $('proxyPort');
const mgmtCidrs = $('mgmtCidrs');
const proxyUser = $('proxyUser');
const proxyPass = $('proxyPass');
const btnTogglePass = $('btnTogglePass');
const saveStatus = $('saveStatus');
const form = $('configForm');
const btnReset = $('btnReset');

// ── Load saved config ─────────────────────────────────────────────

function loadConfig() {
  browser.storage.local.get(Object.keys(DEFAULTS), (data) => {
    proxyHost.value = data.proxyHost || DEFAULTS.proxyHost;
    proxyPort.value = data.proxyPort || DEFAULTS.proxyPort;
    proxyUser.value = data.proxyUser || DEFAULTS.proxyUser;
    proxyPass.value = data.proxyPass || '';

    const cidrs = Array.isArray(data.mgmtCidrs) ? data.mgmtCidrs : DEFAULTS.mgmtCidrs;
    mgmtCidrs.value = cidrs.join('\n');
  });
}

// ── Save config ───────────────────────────────────────────────────

function saveConfig(e) {
  e.preventDefault();

  const host = proxyHost.value.trim();
  const port = parseInt(proxyPort.value, 10);
  const cidrLines = parseCidrLines(mgmtCidrs.value);
  const user = proxyUser.value.trim();
  const pass = proxyPass.value;

  const errors = [];
  if (!host) errors.push(_('errServerEmpty'));
  if (isNaN(port) || port < 1 || port > 65535) errors.push(_('errPortRange'));
  if (cidrLines === null) errors.push(_('errCidrFormat'));
  if (!user) errors.push(_('errUserEmpty'));

  if (errors.length) {
    showStatus(errors.join('<br>'), 'error');
    return;
  }

  browser.storage.local.set(
    {
      proxyHost: host,
      proxyPort: port,
      mgmtCidrs: cidrLines,
      proxyUser: user,
      proxyPass: pass,
    },
    () => {
      if (browser.runtime.lastError) {
        showStatus(_('msgSaveFail') + ': ' + browser.runtime.lastError.message, 'error');
      } else {
        showStatus(_('msgSaveSuccess'), 'success');
      }
    },
  );
}

// ── Reset to defaults ─────────────────────────────────────────────

function resetConfig() {
  browser.storage.local.set(DEFAULTS, () => {
    loadConfig();
    showStatus(_('msgResetDone'), 'success');
  });
}

// ── Status message ───────────────────────────────────────────────

function showStatus(msg, type) {
  saveStatus.innerHTML = msg;
  saveStatus.className = 'save-status ' + type;
  clearTimeout(showStatus._timer);
  showStatus._timer = setTimeout(() => {
    saveStatus.className = 'save-status';
  }, 5000);
}

// ── Toggle password visibility ────────────────────────────────────

btnTogglePass.addEventListener('click', () => {
  const isPassword = proxyPass.type === 'password';
  proxyPass.type = isPassword ? 'text' : 'password';
  btnTogglePass.textContent = isPassword ? _('btnHide') : _('btnShow');
});

// ── Events ───────────────────────────────────────────────────────

form.addEventListener('submit', saveConfig);
btnReset.addEventListener('click', resetConfig);
document.addEventListener('DOMContentLoaded', loadConfig);
