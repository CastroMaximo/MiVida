// Sesiones de estudio. El tiempo se calcula con la hora de fin, no contando
// segundos: así no se desfasa si el teléfono suspende la app.
import { device, saveDevice, get, all, put, ymd, data } from './store.js';

const MIN = 60000;
export const timer = () => device.timer;
export const presetOf = id => get('presets', id) || all('presets')[0];

function phaseMs(t) {
  const p = presetOf(t.preset);
  return (t.phase === 'focus' ? p.focus : t.phase === 'long' ? p.long : p.rest) * MIN;
}
export function remaining(now = Date.now()) {
  const t = device.timer;
  if (!t) return 0;
  return t.running ? Math.max(0, t.endsAt - now) : t.left;
}
export function progress(now = Date.now()) {
  const t = device.timer;
  if (!t) return 0;
  const total = phaseMs(t);
  return total ? 1 - remaining(now) / total : 0;
}

export function start(preset, subject) {
  const p = presetOf(preset);
  device.timer = { preset: p.id, subject: subject || '', phase: 'focus', cycle: 1, running: true, left: 0, endsAt: Date.now() + p.focus * MIN, began: Date.now() };
  saveDevice();
}
export function pause() {
  const t = device.timer;
  if (!t || !t.running) return;
  t.left = remaining(); t.running = false; saveDevice();
}
export function resume() {
  const t = device.timer;
  if (!t || t.running) return;
  t.endsAt = Date.now() + t.left; t.running = true;
  if (!t.began) t.began = Date.now();
  saveDevice();
}

function log(t, ms) {
  const min = Math.round(ms / MIN);
  if (min < 1) return null;
  const p = presetOf(t.preset);
  return put('sessions', { date: ymd(new Date(t.began || Date.now())), at: t.began || Date.now(), min, subject: t.subject, preset: p ? p.name : '' });
}

// Cierra la fase actual y prepara la siguiente. `auto` decide si arranca sola.
function advance(auto, from = Date.now()) {
  const t = device.timer;
  const p = presetOf(t.preset);
  let ended = t.phase;
  if (t.phase === 'focus') {
    log(t, phaseMs(t) - remaining());
    t.phase = t.cycle % (p.every || 4) === 0 ? 'long' : 'rest';
  } else {
    t.phase = 'focus';
    t.cycle += 1;
  }
  const ms = phaseMs(t);
  t.began = auto ? from : 0;
  t.running = !!auto; t.left = ms; t.endsAt = from + ms;
  saveDevice();
  return ended;
}

// Llamar cada medio segundo. Devuelve la fase que acaba de terminar, o null.
export function tick(now = Date.now()) {
  const t = device.timer;
  if (!t || !t.running || now < t.endsAt) return null;
  // Si la app estuvo suspendida más de 90 s tras el final, la fase siguiente espera al usuario
  // en vez de contar sola un tiempo que nadie estudió.
  const late = now - t.endsAt > 90000;
  const endsAt = t.endsAt;
  const ended = advance(!late && data.settings.autoNext !== false, late ? now : endsAt);
  return { ended, next: t.phase, late };
}
export function skip() {
  const t = device.timer;
  if (!t) return;
  advance(true);
}
export function stop() {
  const t = device.timer;
  if (!t) return null;
  let saved = null;
  if (t.phase === 'focus' && t.began) saved = log(t, phaseMs(t) - remaining());
  device.timer = null; saveDevice();
  return saved;
}
