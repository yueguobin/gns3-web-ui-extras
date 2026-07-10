# Privacy Policy — GNS3 Management Proxy

_Last updated: 2026-07-10_

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

The extension intentionally requests **no host permissions**.

## Source code

The extension is open source under the [GNU AGPL v3.0](LICENSE). You are free
to inspect, audit, and modify it.

## Contact

To report issues, use the project's issue tracker at
<https://github.com/yueguobin/gns3-web-ui-extras/issues>.
