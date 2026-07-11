# Privacy Policy — GNS3 Management Proxy

_Last updated: 2026-07-11_

The GNS3 Management Proxy browser extension ("the extension") is designed to
collect as little information as possible. This page explains what data exists,
where it is stored, and how it is used.

## Data we do NOT collect

The extension does **not** collect, transmit, sell, or share any personal data
with the developer or any third party. Specifically, it does **not**:

- send your browsing history, URLs, or page contents anywhere;
- include analytics, telemetry, advertising, or tracking SDKs;
- communicate with any server other than the GNS3 server you configure yourself.

## Data stored locally on your device

All data the extension keeps lives only in your browser's local extension
storage (`browser.storage.local`) and never leaves your device except as
described under "Proxy credentials and traffic" below:

- **Proxy configuration** — the GNS3 server address, SOCKS5 port, management
  network ranges (CIDRs), username, and password that you enter on the options
  page.
- **Connection records** — counts of recently proxied destination hosts, kept
  only to show connection status in the toolbar popup. These expire after a
  short time (about 30 seconds) and are not persisted anywhere outside local
  storage.
- **TOTP secret** — if you bind TOTP, the shared secret returned by your GNS3
  controller is stored locally and used to derive a SOCKS5 password that
  rotates every 30 seconds. The secret itself never leaves your device; only
  the derived one-time code is sent to your own GNS3 SOCKS5 proxy.

You can erase all of this at any time by removing the extension or by clearing
the extension's data in your browser.

## Proxy credentials and traffic

The username and password you enter are sent **only** to the GNS3 server you
configured, during the SOCKS5 authentication handshake — exactly as if you had
configured that proxy manually. They are never sent to any other destination.

The extension decides, per request, whether to route traffic through your GNS3
SOCKS5 proxy or connect directly. It does not read or modify request or
response bodies.

## Permissions

| Permission | Why it is needed |
|---|---|
| `proxy` | Decide, per request, whether to use the SOCKS5 proxy or connect directly. |
| `storage` | Save your configuration and local connection records on your device. |
| `optional_host_permissions` | Optional. Requested only when you click **Bind TOTP**, scoped to the GNS3 controller host you configure, and used solely to call that controller's TOTP bind/unbind API. |

The extension declares **no mandatory host permissions**. An optional host
permission is requested at runtime — only for your GNS3 controller host, and
only when you bind or unbind a TOTP secret.

## Source code

The extension is open source under the [GNU AGPL v3.0](LICENSE). You are free
to inspect, audit, and modify it.

## Contact

To report issues, use the project's issue tracker at
<https://github.com/yueguobin/gns3-web-ui-extras/issues>.
