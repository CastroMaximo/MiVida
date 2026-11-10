// Bloqueo de la app: PIN en cualquier dispositivo y, donde el equipo lo permite,
// Face ID / huella a través de WebAuthn (la llave nunca sale del dispositivo).
import { device, saveDevice } from './store.js';

const enc = new TextEncoder();
const b64 = buf => btoa(String.fromCharCode(...new Uint8Array(buf)));
const unb64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
const ITER = 200000;

async function derive(pin, salt) {
  const key = await crypto.subtle.importKey('raw', enc.encode(pin), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: ITER }, key, 256);
  return b64(bits);
}

export const hasPin = () => !!device.pin;
export const pinLength = () => (device.pin ? device.pin.len : 0);

export async function setPin(pin) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  device.pin = { salt: b64(salt), hash: await derive(pin, salt), len: pin.length, fails: 0, until: 0 };
  saveDevice();
}

// Devuelve { ok } o { ok:false, wait: segundos } si hubo demasiados intentos.
export async function checkPin(pin) {
  const p = device.pin;
  if (!p) return { ok: true };
  const now = Date.now();
  if (p.until > now) return { ok: false, wait: Math.ceil((p.until - now) / 1000) };
  const ok = (await derive(pin, unb64(p.salt))) === p.hash;
  if (ok) { p.fails = 0; p.until = 0; }
  else {
    p.fails = (p.fails || 0) + 1;
    // A partir del 5.º error, cada intento espera más: 30 s, 1 min, 2 min… hasta 15 min.
    if (p.fails >= 5) p.until = now + Math.min(30000 * 2 ** (p.fails - 5), 900000);
  }
  saveDevice();
  return { ok, wait: p.until > now ? Math.ceil((p.until - now) / 1000) : 0, fails: p.fails };
}

export const isIOS = () => /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
export const bioName = () => (isIOS() ? 'Face ID' : /Mac/.test(navigator.platform) ? 'Touch ID' : 'biometría del equipo');

export async function bioAvailable() {
  try {
    return !!window.PublicKeyCredential && (await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable());
  } catch { return false; }
}
export const bioEnabled = () => !!device.bio;

export async function bioRegister() {
  const cred = await navigator.credentials.create({
    publicKey: {
      challenge: crypto.getRandomValues(new Uint8Array(32)),
      rp: { name: 'MiVida' },
      user: { id: crypto.getRandomValues(new Uint8Array(16)), name: 'mivida', displayName: 'MiVida' },
      pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
      authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required', residentKey: 'discouraged' },
      timeout: 60000,
      attestation: 'none',
    },
  });
  device.bio = { id: b64(cred.rawId) };
  saveDevice();
}
export function bioDisable() { device.bio = null; saveDevice(); }

// Pide Face ID / huella. Si el sistema la valida, la promesa se resuelve.
export async function bioUnlock() {
  if (!device.bio) return false;
  try {
    const res = await navigator.credentials.get({
      publicKey: {
        challenge: crypto.getRandomValues(new Uint8Array(32)),
        allowCredentials: [{ type: 'public-key', id: unb64(device.bio.id), transports: ['internal'] }],
        userVerification: 'required',
        timeout: 60000,
      },
    });
    return !!res;
  } catch { return false; }
}
