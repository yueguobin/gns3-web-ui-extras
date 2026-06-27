// GNS3 Management Proxy — Popup

document.addEventListener('DOMContentLoaded', () => {
  const statusDot = document.getElementById('statusDot');
  const statusText = document.getElementById('statusText');
  const infoProxy = document.getElementById('infoProxy');
  const infoNetwork = document.getElementById('infoNetwork');
  const btnToggle = document.getElementById('btnToggle');

  function fmt(network, mask) {
    if (!network) return '—';
    // Try to show as CIDR notation if mask is known
    const parts = (mask || '').split('.').map(Number);
    if (parts.length === 4) {
      const bin = (parts[0] << 24 | parts[1] << 16 | parts[2] << 8 | parts[3]) >>> 0;
      const cidr = bin === 0 ? 0 : 32 - Math.clz32(bin);
      return `${network}/${cidr}`;
    }
    return network;
  }

  function updateUI(config) {
    const enabled = !!config.enabled;

    statusDot.className = 'status-dot' + (enabled ? ' active' : '');
    statusText.textContent = enabled ? '代理已启用' : '代理已关闭';
    btnToggle.textContent = enabled ? '禁用代理' : '启用代理';

    infoProxy.textContent = enabled
      ? `${config.proxyHost || '127.0.0.1'}:${config.proxyPort || 3090}`
      : '—';
    infoNetwork.textContent = enabled
      ? fmt(config.mgmtNetwork, config.mgmtMask)
      : '—';
  }

  // Load current config
  chrome.storage.local.get(
    ['enabled', 'proxyHost', 'proxyPort', 'mgmtNetwork', 'mgmtMask'],
    (data) => {
      const config = {
        enabled: data.enabled || false,
        proxyHost: data.proxyHost || '127.0.0.1',
        proxyPort: data.proxyPort || 3090,
        mgmtNetwork: data.mgmtNetwork || '172.16.40.0',
        mgmtMask: data.mgmtMask || '255.255.254.0',
      };
      updateUI(config);
    },
  );

  // Toggle proxy
  btnToggle.addEventListener('click', () => {
    chrome.storage.local.get(['enabled'], (data) => {
      const newState = !data.enabled;
      chrome.storage.local.set({ enabled: newState }, () => {
        // UI will update when onChanged fires in background + reload
        // For immediate feedback, update locally
        chrome.storage.local.get(
          ['enabled', 'proxyHost', 'proxyPort', 'mgmtNetwork', 'mgmtMask'],
          (d) => {
            updateUI({
              enabled: d.enabled || false,
              proxyHost: d.proxyHost || '127.0.0.1',
              proxyPort: d.proxyPort || 3090,
              mgmtNetwork: d.mgmtNetwork || '172.16.40.0',
              mgmtMask: d.mgmtMask || '255.255.254.0',
            });
          },
        );
      });
    });
  });
});
