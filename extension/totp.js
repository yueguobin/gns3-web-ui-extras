// GNS3 Management Proxy — synchronous TOTP (RFC 6238)
//
// Pure-JS HMAC-SHA1. Web Crypto is async and cannot run inside the
// synchronous proxy.onRequest handler, so SHA-1 is implemented directly.
// Loaded before background.js via manifest background.scripts; both
// scripts share the same global scope, so background.js calls totpNow().

// ── Base32 decode (RFC 4648; padding/spaces ignored) ─────────────
const _B32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
function base32Decode(str) {
  const s = String(str).toUpperCase().replace(/[^A-Z2-7]/g, '');
  let bits = 0;
  let value = 0;
  const out = [];
  for (let i = 0; i < s.length; i++) {
    value = (value << 5) | _B32_ALPHABET.indexOf(s[i]);
    bits += 5;
    if (bits >= 8) {
      bits -= 8;
      out.push((value >>> bits) & 0xff);
    }
  }
  return new Uint8Array(out);
}

// ── SHA-1 (FIPS 180-4) ───────────────────────────────────────────
function _rotl32(n, b) {
  return ((n << b) | (n >>> (32 - b))) >>> 0;
}

function _sha1(data) {
  const ml = data.length;
  const bitLen = ml * 8;
  const zeros = (56 - ((ml + 1) % 64) + 64) % 64;
  const padded = new Uint8Array(ml + 1 + zeros + 8);
  padded.set(data);
  padded[ml] = 0x80;
  const dv = new DataView(padded.buffer);
  dv.setUint32(padded.length - 4, bitLen >>> 0); // 64-bit length (high 32 = 0)

  let h0 = 0x67452301;
  let h1 = 0xefcdab89;
  let h2 = 0x98badcfe;
  let h3 = 0x10325476;
  let h4 = 0xc3d2e1f0;
  const w = new Int32Array(80);

  for (let off = 0; off < padded.length; off += 64) {
    for (let i = 0; i < 16; i++) w[i] = dv.getInt32(off + i * 4);
    for (let i = 16; i < 80; i++) {
      w[i] = _rotl32(w[i - 3] ^ w[i - 8] ^ w[i - 14] ^ w[i - 16], 1);
    }

    let a = h0;
    let b = h1;
    let c = h2;
    let d = h3;
    let e = h4;
    for (let i = 0; i < 80; i++) {
      let f;
      let k;
      if (i < 20) {
        f = (b & c) | (~b & d);
        k = 0x5a827999;
      } else if (i < 40) {
        f = b ^ c ^ d;
        k = 0x6ed9eba1;
      } else if (i < 60) {
        f = (b & c) | (b & d) | (c & d);
        k = 0x8f1bbcdc;
      } else {
        f = b ^ c ^ d;
        k = 0xca62c1d6;
      }
      const t = (_rotl32(a, 5) + f + e + k + w[i]) >>> 0;
      e = d;
      d = c;
      c = _rotl32(b, 30);
      b = a;
      a = t;
    }
    h0 = (h0 + a) >>> 0;
    h1 = (h1 + b) >>> 0;
    h2 = (h2 + c) >>> 0;
    h3 = (h3 + d) >>> 0;
    h4 = (h4 + e) >>> 0;
  }

  const out = new Uint8Array(20);
  const odv = new DataView(out.buffer);
  odv.setUint32(0, h0);
  odv.setUint32(4, h1);
  odv.setUint32(8, h2);
  odv.setUint32(12, h3);
  odv.setUint32(16, h4);
  return out;
}

// ── HMAC-SHA1 (RFC 2104) ─────────────────────────────────────────
function _hmacSha1(key, msg) {
  let k = key;
  if (k.length > 64) k = _sha1(k);
  const block = new Uint8Array(64);
  block.set(k);
  const inner = new Uint8Array(64 + msg.length);
  const outer = new Uint8Array(64 + 20);
  for (let i = 0; i < 64; i++) {
    inner[i] = block[i] ^ 0x36;
    outer[i] = block[i] ^ 0x5c;
  }
  inner.set(msg, 64);
  outer.set(_sha1(inner), 64);
  return _sha1(outer);
}

// ── HOTP (RFC 4226) / TOTP (RFC 6238) ────────────────────────────
// Params MUST match the GNS3 server exactly: HMAC-SHA1, 6 digits, 30s.
function hotp(secretBase32, counter, digits = 6) {
  const key = base32Decode(secretBase32);
  const msg = new Uint8Array(8);
  new DataView(msg.buffer).setBigUint64(0, BigInt(counter));
  const h = _hmacSha1(key, msg);
  const offset = h[19] & 0x0f; // dynamic truncation
  const bin =
    ((h[offset] & 0x7f) << 24) |
    ((h[offset + 1] & 0xff) << 16) |
    ((h[offset + 2] & 0xff) << 8) |
    (h[offset + 3] & 0xff);
  return String(bin % 10 ** digits).padStart(digits, '0');
}

function totpNow(secretBase32) {
  const counter = Math.floor(Date.now() / 1000 / 30);
  return hotp(secretBase32, counter, 6);
}
