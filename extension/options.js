// GNS3 Management Proxy — Options / Config page

const DEFAULTS = {
  proxyHost: '127.0.0.1',
  proxyPort: 3090,
  mgmtCidrs: ['172.16.40.0/23'],
  proxyUser: 'admin',
  proxyPass: '',
  controllerPort: 3080,
  controllerProtocol: '',
  totpSecret: '',
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
const controllerPort = $('controllerPort');
const btnBindTotp = $('btnBindTotp');
const btnUnbindTotp = $('btnUnbindTotp');
const totpStatus = $('totpStatus');

// ── Load saved config ─────────────────────────────────────────────

function loadConfig() {
  browser.storage.local.get(Object.keys(DEFAULTS), (data) => {
    proxyHost.value = data.proxyHost || DEFAULTS.proxyHost;
    proxyPort.value = data.proxyPort || DEFAULTS.proxyPort;
    proxyUser.value = data.proxyUser || DEFAULTS.proxyUser;
    proxyPass.value = data.proxyPass || '';
    controllerPort.value = data.controllerPort || DEFAULTS.controllerPort;

    const cidrs = Array.isArray(data.mgmtCidrs) ? data.mgmtCidrs : DEFAULTS.mgmtCidrs;
    mgmtCidrs.value = cidrs.join('\n');

    updateTotpStatus(data.totpSecret);
  });
}

function updateTotpStatus(secret) {
  const bound = !!secret;
  totpStatus.textContent = bound ? _('labelTotpBound') : _('labelTotpUnbound');
  totpStatus.className = 'totp-status ' + (bound ? 'bound' : 'unbound');
}

// ── Save config ───────────────────────────────────────────────────

function saveConfig(e) {
  e.preventDefault();

  const host = proxyHost.value.trim();
  const port = parseInt(proxyPort.value, 10);
  const cidrLines = parseCidrLines(mgmtCidrs.value);
  const user = proxyUser.value.trim();
  const pass = proxyPass.value;
  const cport = parseInt(controllerPort.value, 10);

  const errors = [];
  if (!host) errors.push(_('errServerEmpty'));
  if (isNaN(port) || port < 1 || port > 65535) errors.push(_('errPortRange'));
  if (cidrLines === null) errors.push(_('errCidrFormat'));
  if (!user) errors.push(_('errUserEmpty'));
  if (isNaN(cport) || cport < 1 || cport > 65535) errors.push(_('errControllerPortRange'));

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
      controllerPort: cport,
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
  saveStatus.textContent = msg;
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

// ── TOTP binding (controller API) ────────────────────────────────

// Try logging in with a specific scheme. Distinguishes three outcomes:
// ok / authFail (scheme works but bad credentials, e.g. 401) / connError
// (network, TLS, or an unaccepted self-signed certificate).
async function loginWithProtocol(protocol, host, port, user, pass) {
  const origin = protocol + '://' + host + ':' + port;
  try {
    const r = await fetch(origin + '/v3/access/users/authenticate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: user, password: pass }),
    });
    if (!r.ok) return { ok: false, authFail: r.status === 401 };
    return { ok: true, origin, token: (await r.json()).access_token };
  } catch (_e) {
    return { ok: false, connError: true };
  }
}

// Validate fields, request host permission, then auto-detect the scheme
// (http vs https). The last-known scheme is tried first, then https, then
// http. If none respond with HTTP, the controller is likely HTTPS with an
// unaccepted self-signed certificate — open its URL so the user can accept
// the cert, then they retry Bind.
async function prepareController() {
  const host = proxyHost.value.trim();
  const cport = parseInt(controllerPort.value, 10);
  const user = proxyUser.value.trim();
  const pass = proxyPass.value;

  if (!host) { showStatus(_('errServerEmpty'), 'error'); return null; }
  if (isNaN(cport) || cport < 1 || cport > 65535) { showStatus(_('errControllerPortRange'), 'error'); return null; }
  if (!user || !pass) { showStatus(_('errLoginFail'), 'error'); return null; }

  // Match patterns ignore the port, so both schemes cover the controller port.
  const granted = await browser.permissions.request({
    origins: ['http://' + host + '/*', 'https://' + host + '/*'],
  });
  if (!granted) { showStatus(_('errPermissionDenied'), 'error'); return null; }

  const stored = await browser.storage.local.get('controllerProtocol');
  const order = [];
  if (stored.controllerProtocol) order.push(stored.controllerProtocol);
  for (const p of ['https', 'http']) if (!order.includes(p)) order.push(p);

  let sawAuthFail = false;
  for (const proto of order) {
    const res = await loginWithProtocol(proto, host, cport, user, pass);
    if (res.ok) {
      browser.storage.local.set({ controllerProtocol: proto });
      return { origin: res.origin, token: res.token, pass };
    }
    if (res.authFail) sawAuthFail = true;
  }

  if (sawAuthFail) {
    showStatus(_('errLoginFail'), 'error');
  } else {
    showStatus(_('errConnectFail'), 'error');
    browser.tabs.create({ url: 'https://' + host + ':' + cport + '/' });
  }
  return null;
}

async function bindTotp() {
  try {
    const ctx = await prepareController();
    if (!ctx) return;

    // Already bound locally → require explicit unbind first.
    const stored = await browser.storage.local.get('totpSecret');
    if (stored.totpSecret) { showStatus(_('msgAlreadyBound'), 'error'); return; }

    const r = await fetch(ctx.origin + '/v3/access/users/me/totp', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + ctx.token, 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: ctx.pass }),
    });
    if (r.status === 409) { showStatus(_('msgAlreadyBound'), 'error'); return; }
    if (r.status === 401) { showStatus(_('errLoginFail'), 'error'); return; }
    if (!r.ok) { showStatus(_('msgBindFail') + ' (' + r.status + ')', 'error'); return; }

    const data = await r.json();
    browser.storage.local.set({ totpSecret: data.secret }, () => {
      updateTotpStatus(data.secret);
      showStatus(_('msgBindSuccess'), 'success');
    });
  } catch (e) {
    showStatus(_('msgBindFail') + ': ' + e.message, 'error');
  }
}

async function unbindTotp() {
  try {
    const ctx = await prepareController();
    if (!ctx) return;

    const r = await fetch(ctx.origin + '/v3/access/users/me/totp', {
      method: 'DELETE',
      headers: { Authorization: 'Bearer ' + ctx.token, 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: ctx.pass }),
    });
    if (r.status === 204 || r.ok) {
      browser.storage.local.set({ totpSecret: '' }, () => {
        updateTotpStatus('');
        showStatus(_('msgUnbindSuccess'), 'success');
      });
    } else if (r.status === 401) {
      showStatus(_('errLoginFail'), 'error');
    } else {
      showStatus(_('msgUnbindFail') + ' (' + r.status + ')', 'error');
    }
  } catch (e) {
    showStatus(_('msgUnbindFail') + ': ' + e.message, 'error');
  }
}

// ── Events ───────────────────────────────────────────────────────

form.addEventListener('submit', saveConfig);
btnReset.addEventListener('click', resetConfig);
btnBindTotp.addEventListener('click', bindTotp);
btnUnbindTotp.addEventListener('click', unbindTotp);
document.addEventListener('DOMContentLoaded', loadConfig);
