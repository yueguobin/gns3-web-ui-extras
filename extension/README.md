# GNS3 Management Proxy — Firefox Extension

Route browser traffic to the web management interfaces of in-topology devices (CSR1000v, pfSense, etc.) through the GNS3 server's **port 3090 SOCKS5 proxy**. Install the extension once and the browser automatically proxies traffic destined for the management network ranges — no system proxy configuration needed, normal browsing is unaffected.

## Browser support — Firefox only

This extension currently supports **Firefox only**. Chrome and Edge are not supported.

The reason is SOCKS5 authentication: this extension authenticates to the GNS3 SOCKS5 proxy by injecting a username/password into the proxy descriptor returned from `browser.proxy.onRequest`. Firefox's WebExtension API supports this directly, but Chromium (Chrome/Edge) has no equivalent — its extension proxy API cannot supply credentials for a SOCKS5 proxy (`webRequest.onAuthRequired` only covers HTTP/HTTPS proxies). Since authentication against the GNS3 proxy is required, the extension cannot function on Chromium-based browsers.

## How it works

```
Firefox
  │ browser.proxy.onRequest: match management-network IPs → SOCKS5 + auth
  │ username/password injected during the SOCKS5 handshake
  ▼
gns3server:3090 (SOCKS5 + auth)
  → validate username/password
  → transparently forward TCP to the device
```

Implemented purely as an extension — no native host, no system proxy configuration required.

## Installation

### Temporary load (development)

1. In Firefox, open `about:debugging#/runtime/this-firefox`
2. Click "Load Temporary Add-on"
3. Select the `manifest.json` in this directory

### Package for release

```bash
cd extension/
./build.sh
# → dist/gns3-proxy-firefox-<version>.zip
```

Upload the generated zip to [AMO](https://addons.mozilla.org/) (addons.mozilla.org).

## Configuration

| Field | Default | Description |
|---|---|---|
| GNS3 Server address | `127.0.0.1` | Hostname or IP of gns3server |
| Proxy port | `3090` | SOCKS5 port |
| Management networks | `172.16.40.0/23` | One CIDR per line; matching IPs are proxied |
| Username | `admin` | GNS3 login username (used for SOCKS5 auth) |
| Password | (empty) | GNS3 login password |
| Enable proxy | off | One-click toggle |

The UI language follows the browser language (`browser.i18n`; `en` / `zh_CN` are bundled).

## Technical notes

- Uses `browser.proxy.onRequest` to make a per-request proxy decision
- For management-network destinations, returns `{ type: "socks", host, port, username, password, proxyDNS: true }`
- Traffic outside the management networks connects directly, leaving normal browsing untouched
- SOCKS5 authentication is performed during the protocol handshake, so `webRequest.onAuthRequired` is not needed

## Testing

1. Confirm the gns3server SOCKS5 proxy on port 3090 is running
2. On the extension options page, configure the server address, management networks, username, and password
3. Enable the proxy
4. Open a device page (e.g. `https://172.16.40.2/`) → it should load normally
5. Open an external address (e.g. `example.com`) → it should connect directly, bypassing the proxy

## Project structure

```
extension/
├── manifest.json       # Extension manifest (Firefox MV3)
├── build.sh            # Packaging script
├── background.js       # Background — proxy.onRequest SOCKS5 + auth
├── i18n.js             # i18n helper (data-i18n attributes)
├── popup.html / .js    # Toolbar popup panel
├── options.html / .js  # Options page
├── styles.css          # Theme (follows browser light/dark)
├── icons/              # Extension icons (PNG)
└── _locales/           # Locales (en, zh_CN)
```
