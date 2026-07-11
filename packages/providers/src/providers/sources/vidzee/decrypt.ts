/**
 * VidZee decryption utilities using the Web Crypto API (browser + Bun compatible).
 *
 * Flow:
 *  1. Fetch raw key string from core.vidzee.wtf/api-key
 *  2. deriveKey(rawKey)  → AES-GCM decrypt → usable key string
 *  3. decrypt(encUrl, derivedKey) → AES-CBC decrypt → plaintext stream URL
 */

/**
 * Decrypt a single encrypted stream URL.
 * encryptedData format: base64(base64(iv) + ":" + base64(ciphertext))
 */
export async function decrypt(encryptedData: string, decryptionKey: string): Promise<string> {
  try {
    if (!encryptedData || !decryptionKey) return '';

    const decoded = atob(encryptedData);
    const [ivBase64, cipherBase64] = decoded.split(':');
    if (!ivBase64 || !cipherBase64) return '';

    const iv = Uint8Array.from(atob(ivBase64), (c) => c.charCodeAt(0));
    const cipherBytes = Uint8Array.from(atob(cipherBase64), (c) => c.charCodeAt(0));

    // Key is a UTF-8 string, padded/truncated to 32 bytes (CryptoJS-compatible)
    const encoded = new TextEncoder().encode(decryptionKey);
    const keyBytes = new Uint8Array(32);
    keyBytes.set(encoded.slice(0, 32));

    const cryptoKey = await crypto.subtle.importKey('raw', keyBytes, { name: 'AES-CBC' }, false, ['decrypt']);
    const decrypted = await crypto.subtle.decrypt({ name: 'AES-CBC', iv }, cryptoKey, cipherBytes);

    return new TextDecoder().decode(decrypted);
  } catch {
    return '';
  }
}

/**
 * Derive the usable decryption key from the raw API key blob.
 * The API returns a base64 blob that is itself AES-GCM encrypted.
 */
export async function deriveKey(rawKey: string): Promise<string> {
  try {
    if (!rawKey) return '';

    const base64ToBytes = (s: string): Uint8Array => {
      const t = atob(s.replace(/\s+/g, ''));
      const r = new Uint8Array(t.length);
      for (let i = 0; i < t.length; i++) r[i] = t.charCodeAt(i);
      return r;
    };

    const t = base64ToBytes(rawKey);
    if (t.length <= 28) return '';

    const nonce = t.slice(0, 12);
    const tag = t.slice(12, 28);
    const payload = t.slice(28);

    // Re-join payload and tag for AES-GCM (tag appended at end)
    const cipherWithTag = new Uint8Array(payload.length + tag.length);
    cipherWithTag.set(payload, 0);
    cipherWithTag.set(tag, payload.length);

    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('4f2a9c7d1e8b3a6f0d5c2e9a7b1f4d8c'));

    const aesKey = await crypto.subtle.importKey('raw', digest, { name: 'AES-GCM' }, false, ['decrypt']);

    const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: nonce, tagLength: 128 }, aesKey, cipherWithTag);

    return new TextDecoder().decode(plaintext);
  } catch {
    return '';
  }
}
