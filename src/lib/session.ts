export const SESSION_COOKIE_NAME = "cc_session";

export type SessionPayload = {
  sub: string;
  email: string;
  exp: number;
};

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function toBase64Url(bytes: Uint8Array) {
  const binary = Array.from(bytes)
    .map((value) => String.fromCharCode(value))
    .join("");
  const base64 = btoa(binary);
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromBase64Url(input: string) {
  const padded = input.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(input.length / 4) * 4, "=");
  const binary = atob(padded);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

async function getHmacKey(secret: string) {
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

export async function issueSessionToken(
  payload: Omit<SessionPayload, "exp">,
  secret: string,
  ttlSeconds: number,
) {
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
  const sessionPayload: SessionPayload = {
    ...payload,
    exp,
  };

  const payloadBytes = encoder.encode(JSON.stringify(sessionPayload));
  const payloadEncoded = toBase64Url(payloadBytes);

  const key = await getHmacKey(secret);
  const signatureBuffer = await crypto.subtle.sign("HMAC", key, encoder.encode(payloadEncoded));
  const signatureEncoded = toBase64Url(new Uint8Array(signatureBuffer));

  return `${payloadEncoded}.${signatureEncoded}`;
}

export async function verifySessionToken(token: string, secret: string) {
  const [payloadPart, signaturePart] = token.split(".");
  if (!payloadPart || !signaturePart) {
    return null;
  }

  const key = await getHmacKey(secret);
  const signature = fromBase64Url(signaturePart);
  const valid = await crypto.subtle.verify(
    "HMAC",
    key,
    signature,
    encoder.encode(payloadPart),
  );

  if (!valid) {
    return null;
  }

  const payloadBytes = fromBase64Url(payloadPart);
  const payload = JSON.parse(decoder.decode(payloadBytes)) as SessionPayload;

  if (!payload.exp || payload.exp <= Math.floor(Date.now() / 1000)) {
    return null;
  }

  return payload;
}