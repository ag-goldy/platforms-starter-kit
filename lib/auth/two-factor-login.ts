export const TWO_FACTOR_LOGIN_COOKIE = 'two_factor_login';

const DEFAULT_TTL_MINUTES = 10;
const TOKEN_VERSION = 1;

type TwoFactorLoginPayload = {
  v: number;
  userId: string;
  exp: number;
  nonce: string;
};

function getLoginTokenSecret(): string {
  const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;
  if (secret) {
    return secret;
  }

  if (process.env.NODE_ENV !== 'production') {
    return 'dev-two-factor-login-secret';
  }

  throw new Error('AUTH_SECRET or NEXTAUTH_SECRET must be set');
}

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

function encodeBase64(bytes: Uint8Array): string {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(bytes).toString('base64');
  }
  if (typeof btoa !== 'undefined') {
    let binary = '';
    bytes.forEach((byte) => {
      binary += String.fromCharCode(byte);
    });
    return btoa(binary);
  }
  throw new Error('Base64 encoding not supported in this runtime');
}

function decodeBase64(base64: string): Uint8Array {
  if (typeof Buffer !== 'undefined') {
    return new Uint8Array(Buffer.from(base64, 'base64'));
  }
  if (typeof atob !== 'undefined') {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }
  throw new Error('Base64 decoding not supported in this runtime');
}

function base64UrlEncode(input: ArrayBuffer | Uint8Array | string): string {
  const bytes =
    typeof input === 'string'
      ? textEncoder.encode(input)
      : input instanceof Uint8Array
        ? input
        : new Uint8Array(input);
  return encodeBase64(bytes)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function base64UrlToBytes(input: string): Uint8Array {
  const padding = input.length % 4;
  const normalized = padding === 0 ? input : input + '='.repeat(4 - padding);
  const base64 = normalized.replace(/-/g, '+').replace(/_/g, '/');
  return decodeBase64(base64);
}

function base64UrlDecode(input: string): string {
  return textDecoder.decode(base64UrlToBytes(input));
}

let hmacKeyPromise: Promise<CryptoKey> | null = null;

async function getHmacKey(): Promise<CryptoKey> {
  if (!hmacKeyPromise) {
    const secret = new TextEncoder().encode(getLoginTokenSecret());
    hmacKeyPromise = crypto.subtle.importKey(
      'raw',
      secret,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign', 'verify']
    );
  }
  return hmacKeyPromise;
}

async function signPayload(payloadBase64: string): Promise<string> {
  const key = await getHmacKey();
  const data = new TextEncoder().encode(payloadBase64);
  const signature = await crypto.subtle.sign('HMAC', key, data);
  return base64UrlEncode(signature);
}

function randomHex(bytes: number): string {
  const array = new Uint8Array(bytes);
  crypto.getRandomValues(array);
  return Array.from(array)
    .map((value) => value.toString(16).padStart(2, '0'))
    .join('');
}

export async function createTwoFactorLoginToken(
  userId: string,
  ttlMinutes: number = DEFAULT_TTL_MINUTES
): Promise<string> {
  const payload: TwoFactorLoginPayload = {
    v: TOKEN_VERSION,
    userId,
    exp: Math.floor(Date.now() / 1000) + ttlMinutes * 60,
    nonce: randomHex(16),
  };
  const payloadBase64 = base64UrlEncode(JSON.stringify(payload));
  const signature = await signPayload(payloadBase64);
  return `${payloadBase64}.${signature}`;
}

export async function verifyTwoFactorLoginToken(
  token: string
): Promise<{ userId: string } | null> {
  const [payloadBase64, signature] = token.split('.');
  if (!payloadBase64 || !signature) {
    return null;
  }

  const key = await getHmacKey();
  const data = new TextEncoder().encode(payloadBase64);
  const signatureBytes = base64UrlToBytes(signature);
  const isValid = await crypto.subtle.verify('HMAC', key, signatureBytes, data);
  if (!isValid) {
    return null;
  }

  try {
    const payload = JSON.parse(base64UrlDecode(payloadBase64)) as TwoFactorLoginPayload;
    if (payload.v !== TOKEN_VERSION) {
      return null;
    }
    if (!payload.userId || payload.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }
    return { userId: payload.userId };
  } catch {
    return null;
  }
}
