// GNS3 Management Proxy — Popup

document.addEventListener('DOMContentLoaded', () => {
  const statusDot = document.getElementById('statusDot');
  const statusText = document.getElementById('statusText');
  const infoProxy = document.getElementById('infoProxy');
  const infoNetwork = document.getElementById('infoNetwork');
  const btnToggle = document.getElementById('btnToggle');

  function updateUI(config) {
    const enabled = !!config.enabled;

    statusDot.className = 'status-dot' + (enabled ? ' active' : '');
    statusText.textContent = enabled
      ? chrome.i18n.getMessage('statusEnabled')
      : chrome.i18n.getMessage('statusDisabled');
    btnToggle.textContent = enabled
      ? chrome.i18n.getMessage('actionDisable')
      : chrome.i18n.getMessage('actionEnable');

    infoProxy.textContent = enabled
      ? `${config.proxyHost || '127.0.0.1'}:${config.proxyPort || 3090}`
      : '—';
    infoNetwork.textContent = enabled
      ? (config.mgmtCidr || `${config.mgmtNetwork}/${maskToCidr(config.mgmtMask)}`)
      : '—';
  }

  function maskToCidr(mask) {
    if (!mask) return '';
    const parts = String(mask).split('.').map(Number);
    if (parts.length !== 4 || parts.some((p) => isNaN(p) || p < 0 || p > 255)) return '';
    const bin = (parts[0] << 24 | parts[1] << 16 | parts[2] << 8 | parts[3]) >>> 0;
    return bin === 0 ? '0' : String(32 - Math.clz32(bin));
  }

  // Load current config
  chrome.storage.local.get(
    ['enabled', 'proxyHost', 'proxyPort', 'mgmtCidr', 'mgmtNetwork', 'mgmtMask'],
    (data) => {
      updateUI({
        enabled: data.enabled || false,
        proxyHost: data.proxyHost || '127.0.0.1',
        proxyPort: data.proxyPort || 3090,
        mgmtCidr: data.mgmtCidr,
        mgmtNetwork: data.mgmtNetwork || '172.16.40.0',
        mgmtMask: data.mgmtMask || '255.255.254.0',
      });
    },
  );

  // Toggle proxy
  btnToggle.addEventListener('click', () => {
    chrome.storage.local.get(
      ['enabled', 'proxyHost', 'proxyPort', 'mgmtCidr', 'mgmtNetwork', 'mgmtMask'],
      (data) => {
        const newState = !data.enabled;
        chrome.storage.local.set({ enabled: newState }, () => {
          updateUI({
            enabled: newState,
            proxyHost: data.proxyHost || '127.0.0.1',
            proxyPort: data.proxyPort || 3090,
            mgmtCidr: data.mgmtCidr,
            mgmtNetwork: data.mgmtNetwork || '172.16.40.0',
            mgmtMask: data.mgmtMask || '255.255.254.0',
          });
        });
      },
    );
  });
});
