// GNS3 Management Proxy — Popup

const api = typeof browser !== 'undefined' ? browser : chrome;

document.addEventListener('DOMContentLoaded', () => {
  const statusDot = document.getElementById('statusDot');
  const statusText = document.getElementById('statusText');
  const infoProxy = document.getElementById('infoProxy');
  const infoNetwork = document.getElementById('infoNetwork');
  const btnToggle = document.getElementById('btnToggle');

  function updateUI(config) {
    const enabled = !!config.enabled;
    const count = Array.isArray(config.mgmtCidrs) ? config.mgmtCidrs.length : 1;

    statusDot.className = 'status-dot' + (enabled ? ' active' : '');
    statusText.textContent = enabled
      ? api.i18n.getMessage('statusEnabled')
      : api.i18n.getMessage('statusDisabled');
    btnToggle.textContent = enabled
      ? api.i18n.getMessage('actionDisable')
      : api.i18n.getMessage('actionEnable');

    infoProxy.textContent = enabled
      ? `${config.proxyHost || '127.0.0.1'}:${config.proxyPort || 3090}`
      : '—';
    infoNetwork.textContent = enabled ? `${count} entries` : '—';
  }

  // Load current config
  api.storage.local.get(
    ['enabled', 'proxyHost', 'proxyPort', 'mgmtCidrs'],
    (data) => {
      updateUI({
        enabled: data.enabled || false,
        proxyHost: data.proxyHost || '127.0.0.1',
        proxyPort: data.proxyPort || 3090,
        mgmtCidrs: Array.isArray(data.mgmtCidrs) ? data.mgmtCidrs : ['172.16.40.0/23'],
      });
    },
  );

  // Toggle proxy
  btnToggle.addEventListener('click', () => {
    api.storage.local.get(
      ['enabled', 'proxyHost', 'proxyPort', 'mgmtCidrs'],
      (data) => {
        const newState = !data.enabled;
        api.storage.local.set({ enabled: newState }, () => {
          updateUI({
            enabled: newState,
            proxyHost: data.proxyHost || '127.0.0.1',
            proxyPort: data.proxyPort || 3090,
            mgmtCidrs: Array.isArray(data.mgmtCidrs) ? data.mgmtCidrs : ['172.16.40.0/23'],
          });
        });
      },
    );
  });
});
