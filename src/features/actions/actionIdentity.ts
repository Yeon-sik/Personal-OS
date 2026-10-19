// Namespace URL from RFC 9562; the versioned JSON array is the application namespace.
const URL_NAMESPACE = "6ba7b8119dad11d180b400c04fd430c8";
export async function actionId(ownerScope: string, namespace: string, externalKey: string): Promise<string> {
  const prefix = Uint8Array.from(URL_NAMESPACE.match(/../g)!, part => parseInt(part, 16));
  const name = new TextEncoder().encode(JSON.stringify(["personal-os.action-id.v1", ownerScope, namespace, externalKey]));
  const bytes = new Uint8Array(prefix.length + name.length);
  bytes.set(prefix); bytes.set(name, prefix.length);
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-1", bytes)).slice(0, 16);
  digest[6] = (digest[6] & 0x0f) | 0x50;
  digest[8] = (digest[8] & 0x3f) | 0x80;
  const hex = Array.from(digest, byte => byte.toString(16).padStart(2, "0")).join("");
  return [hex.slice(0, 8), hex.slice(8, 12), hex.slice(12, 16), hex.slice(16, 20), hex.slice(20)].join("-");
}
