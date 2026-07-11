/**
 * Tulnex 4-layer decryption pipeline.
 * Credit: originally from https://github.com/vyla-entertainment/stream-api (cinezo.js)
 * Ported from Node.js Buffer to Web Crypto / atob for browser+Bun compatibility.
 *
 * Layer order (decrypt → innermost first):
 *   payload → L4 (HMAC-SHA512 verify) → L3 (AES-CBC) → L2 (binary decode) → L1 (XOR) → JSON
 */

const L1_KEY = 'U24wMHBEMGcjTDFfWDBSX000c3QzckszeSEyMDI2c2V4';
const L1_SALT = 'eEs5IW1SMkBwTDUjblE4c2V4';
const L3_KEY = 'U24wMHBEMGcjTDNfQUVTX1MzY3VyM0szeUAyMDI2JHNleA==';
const L4_KEY = 'U24wMHBEMGcjTDRfSE1BQ19GMW40bFc0bGwjMjAyNiFzZXg=';

function base64ToBuffer(b64: string): ArrayBuffer {
  const bin = atob(b64);
  const buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  return buf.buffer;
}

function bufferToHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function strToBuffer(str: string): ArrayBuffer {
  return new TextEncoder().encode(str).buffer;
}

function bufferToStr(buf: ArrayBuffer): string {
  return new TextDecoder().decode(buf);
}

function hexToUint8(hex: string): Uint8Array {
  const arr = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) arr[i / 2] = parseInt(hex.substr(i, 2), 16);
  return arr;
}

async function pbkdf2(
  pass: string,
  salt: string,
  iterations: number,
  keyLen: number,
  hash: string,
): Promise<Uint8Array<ArrayBuffer>> {
  const keyMat = await crypto.subtle.importKey(
    'raw',
    strToBuffer(pass) as ArrayBuffer,
    { name: 'PBKDF2' },
    false,
    ['deriveKey'],
  );
  const derived = await crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: strToBuffer(salt) as ArrayBuffer, iterations, hash },
    keyMat,
    { name: 'AES-GCM', length: keyLen * 8 },
    true,
    ['encrypt', 'decrypt'],
  );
  return new Uint8Array(await crypto.subtle.exportKey('raw', derived) as ArrayBuffer);
}

function xorDecrypt(hexStr: string, keyBytes: Uint8Array): string {
  const src = hexToUint8(hexStr);
  const out = new Uint8Array(src.length);
  for (let i = 0; i < src.length; i++) out[i] = src[i] ^ keyBytes[i % 32];
  return bufferToStr(out.buffer);
}

function binaryDecode(encoded: string): string {
  return atob(encoded)
    .split(' ')
    .map((s) => String.fromCharCode(parseInt(s, 2)))
    .join('');
}

async function decodeL3(data: string): Promise<string> {
  const parts = data.split('.');
  if (parts.length !== 3) throw new Error('L3 invalid format');
  const [ivB64, saltB64, ctB64] = parts;
  const salt = atob(saltB64);
  const keyBytes = await pbkdf2(atob(L3_KEY), salt, 100000, 32, 'SHA-512');
  const aesKey = await crypto.subtle.importKey('raw', keyBytes, { name: 'AES-CBC' }, false, ['decrypt']);
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-CBC', iv: new Uint8Array(base64ToBuffer(ivB64)) },
    aesKey,
    base64ToBuffer(ctB64),
  );
  return bufferToStr(decrypted);
}

async function decodeL4(data: string): Promise<string> {
  const sep = data.indexOf('|');
  if (sep === -1) throw new Error('L4 missing separator');
  const receivedHmac = data.slice(0, sep);
  const payload = data.slice(sep + 1);
  const payloadStr = bufferToStr(base64ToBuffer(payload));
  const hmacKey = await crypto.subtle.importKey(
    'raw',
    strToBuffer(atob(L4_KEY)),
    { name: 'HMAC', hash: 'SHA-512' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', hmacKey, new TextEncoder().encode(payloadStr));
  if (receivedHmac !== bufferToHex(sig)) throw new Error('L4 HMAC mismatch');
  return payloadStr;
}

export async function decryptPayload(payload: string): Promise<unknown> {
  const xorKey = await pbkdf2(atob(L1_KEY), atob(L1_SALT), 50000, 32, 'SHA-256');
  const l4out = await decodeL4(payload);
  const l3out = await decodeL3(l4out);
  const l2out = binaryDecode(l3out);
  return JSON.parse(xorDecrypt(l2out, xorKey));
}
