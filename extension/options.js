// GNS3 Management Proxy — Options / Config page

const DEFAULTS = {
  proxyHost: '127.0.0.1',
  proxyPort: 3090,
  mgmtNetwork: '172.16.40.0',
  mgmtCidr: 23,
  mgmtMask: '255.255.254.0',
  proxyUser: 'admin',
  proxyPass: '',
  enabled: false,
};

// ── Helpers ───────────────────────────────────────────────────────

function cidrToMask(prefix) {
  const mask = ~0 << (32 - Math.min(Math.max(prefix, 0), 32));
  return [
    (mask >>> 24) & 0xff,
    (mask >>> 16) & 0xff,
    (mask >>> 8) & 0xff,
    mask & 0xff,
  ].join('.');
}

function maskToCidr(mask) {
  const parts = mask.split('.').map(Number);
  if (parts.length !== 4 || parts.some((p) => isNaN(p) || p < 0 || p > 255)) return 0;
  const bin = (parts[0] << 24 | parts[1] << 16 | parts[2] << 8 | parts[3]) >>> 0;
  return bin === 0 ? 0 : 32 - Math.clz32(bin);
}

function isValidIPv4(s) {
  const parts = s.split('.').map(Number);
  return parts.length === 4 && parts.every((p) => !isNaN(p) && p >= 0 && p <= 255 && String(p) === parts);
}

// ── DOM refs ──────────────────────────────────────────────────────

const $ = (id) => document.getElementById(id);
const proxyHost = $('proxyHost');
const proxyPort = $('proxyPort');
const mgmtNetwork = $('mgmtNetwork');
const mgmtCidr = $('mgmtCidr');
const maskDisplay = $('maskDisplay');
const proxyUser = $('proxyUser');
const proxyPass = $('proxyPass');
const btnTogglePass = $('btnTogglePass');
const saveStatus = $('saveStatus');
const form = $('configForm');
const btnReset = $('btnReset');

// ── Load saved config ─────────────────────────────────────────────

function loadConfig() {
  chrome.storage.local.get(Object.keys(DEFAULTS), (data) => {
    proxyHost.value = data.proxyHost || DEFAULTS.proxyHost;
    proxyPort.value = data.proxyPort || DEFAULTS.proxyPort;
    mgmtNetwork.value = data.mgmtNetwork || DEFAULTS.mgmtNetwork;
    proxyUser.value = data.proxyUser || DEFAULTS.proxyUser;
    proxyPass.value = data.proxyPass || '';

    // Compute CIDR from stored mask or use default
    let cidr = maskToCidr(data.mgmtMask || DEFAULTS.mgmtMask);
    if (data.mgmtCidr !== undefined) cidr = parseInt(data.mgmtCidr, 10);
    mgmtCidr.value = isNaN(cidr) ? DEFAULTS.mgmtCidr : cidr;
    updateMaskDisplay();
  });
}

// ── Update mask display when CIDR changes ─────────────────────────

function updateMaskDisplay() {
  const cidr = parseInt(mgmtCidr.value, 10);
  if (!isNaN(cidr) && cidr >= 0 && cidr <= 32) {
    maskDisplay.textContent = cidrToMask(cidr);
  } else {
    maskDisplay.textContent = '—';
  }
}

mgmtCidr.addEventListener('input', updateMaskDisplay);

// ── Save config ───────────────────────────────────────────────────

function saveConfig(e) {
  e.preventDefault();

  // Validate
  const host = proxyHost.value.trim();
  const port = parseInt(proxyPort.value, 10);
  const network = mgmtNetwork.value.trim();
  const cidr = parseInt(mgmtCidr.value, 10);
  const user = proxyUser.value.trim();
  const pass = proxyPass.value;

  const errors = [];
  if (!host) errors.push('Server 地址不能为空');
  if (isNaN(port) || port < 1 || port > 65535) errors.push('端口需在 1-65535 之间');
  if (!isValidIPv4(network)) errors.push('管理网段 IP 格式不正确 (例: 172.16.40.0)');
  if (isNaN(cidr) || cidr < 0 || cidr > 32) errors.push('子网前缀需在 0-32 之间');
  if (!user) errors.push('用户名不能为空');

  if (errors.length) {
    showStatus(errors.join('<br>'), 'error');
    return;
  }

  const mask = cidrToMask(cidr);

  chrome.storage.local.set(
    {
      proxyHost: host,
      proxyPort: port,
      mgmtNetwork: network,
      mgmtCidr: cidr,
      mgmtMask: mask,
      proxyUser: user,
      proxyPass: pass,
    },
    () => {
      if (chrome.runtime.lastError) {
        showStatus('保存失败: ' + chrome.runtime.lastError.message, 'error');
      } else {
        showStatus('配置已保存，代理规则已更新。', 'success');
      }
    },
  );
}

// ── Reset to defaults ─────────────────────────────────────────────

function resetConfig() {
  chrome.storage.local.set(DEFAULTS, () => {
    loadConfig();
    showStatus('已恢复默认配置。', 'success');
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
  btnTogglePass.textContent = isPassword ? '隐藏' : '显示';
});

// ── Events ───────────────────────────────────────────────────────

form.addEventListener('submit', saveConfig);
btnReset.addEventListener('click', resetConfig);
document.addEventListener('DOMContentLoaded', loadConfig);
