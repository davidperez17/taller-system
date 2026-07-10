// Firma y verificación del token de sesión con Web Crypto (crypto.subtle),
// para que funcione idéntico en runtime Node (server actions) y Edge (proxy.ts).
//
// Formato: base64url(`${userId}.${expiraMs}.${tokenVersion}`) + "." + base64url(HMAC-SHA256)
// tokenVersion permite revocar sesiones: al cambiar la contraseña se incrementa
// users.token_version y los tokens viejos dejan de coincidir (se compara en
// getSessionUser, no aquí — el proxy no consulta la BD).

const encoder = new TextEncoder();

let warned = false;
function secret(): string {
  const s = process.env.SESSION_SECRET;
  if (s) return s;
  if (process.env.NODE_ENV === "production") {
    throw new Error("SESSION_SECRET no está definido; es obligatorio en producción.");
  }
  if (!warned) {
    warned = true;
    console.warn("⚠ SESSION_SECRET no definido — usando secreto de desarrollo.");
  }
  return "dev-secret-change-me";
}

function hmacKey(usage: KeyUsage): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    [usage]
  );
}

function b64urlEncode(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlDecode(s: string): Uint8Array | null {
  try {
    const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/"));
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  } catch {
    return null;
  }
}

export async function createToken(
  userId: number,
  tokenVersion: number,
  maxAgeMs: number
): Promise<string> {
  const payload = `${userId}.${Date.now() + maxAgeMs}.${tokenVersion}`;
  const key = await hmacKey("sign");
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
  return `${b64urlEncode(encoder.encode(payload))}.${b64urlEncode(new Uint8Array(sig))}`;
}

export type TokenData = { userId: number; tokenVersion: number };

export async function verifyToken(token: string): Promise<TokenData | null> {
  const [b64, sigB64] = token.split(".");
  if (!b64 || !sigB64) return null;
  const payloadBytes = b64urlDecode(b64);
  const sig = b64urlDecode(sigB64);
  if (!payloadBytes || !sig) return null;
  const key = await hmacKey("verify");
  const valid = await crypto.subtle.verify(
    "HMAC",
    key,
    sig as BufferSource,
    payloadBytes as BufferSource
  );
  if (!valid) return null;
  const [id, exp, version] = new TextDecoder().decode(payloadBytes).split(".");
  if (!id || !exp || Number(exp) < Date.now()) return null;
  return { userId: Number(id), tokenVersion: Number(version ?? 0) };
}
