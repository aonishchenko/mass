/**
 * First-party encryption for everything written to 0G Storage.
 * Plaintext never reaches the network (§8.1).
 *
 * AES-256-GCM via WebCrypto — available in Workers with no Node shim.
 */

const IV_BYTES = 12;

async function importKey(secret: string): Promise<CryptoKey> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(secret));
  return crypto.subtle.importKey("raw", digest, "AES-GCM", false, ["encrypt", "decrypt"]);
}

export async function encrypt(plaintext: string, secret: string): Promise<Uint8Array> {
  const key = await importKey(secret);
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const ct = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    new TextEncoder().encode(plaintext)
  );
  // iv || ciphertext
  const out = new Uint8Array(IV_BYTES + ct.byteLength);
  out.set(iv, 0);
  out.set(new Uint8Array(ct), IV_BYTES);
  return out;
}

export async function decrypt(blob: Uint8Array, secret: string): Promise<string> {
  const key = await importKey(secret);
  const iv = blob.slice(0, IV_BYTES);
  const ct = blob.slice(IV_BYTES);
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ct);
  return new TextDecoder().decode(plain);
}
