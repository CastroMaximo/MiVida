// Datos de MiVida: todo vive en este dispositivo (localStorage) y, si conectas
// Google, se fusiona registro por registro con una copia en tu Drive.

// Vista previa: dentro de un marco o con ?demo se usan datos de ejemplo aparte, sin bloqueo.
export const DEMO = (() => {
  try { return window.self !== window.top || new URLSearchParams(location.search).has('demo'); } catch { return true; }
})();
const KEY = DEMO ? 'mivida.demo.data.v1' : 'mivida.data.v1';
const DEVICE_KEY = DEMO ? 'mivida.demo.device.v1' : 'mivida.device.v1';
export const COLLECTIONS = ['items', 'notes', 'moves', 'bills', 'sessions', 'presets', 'scopes', 'subjects', 'cats'];
const TOMBSTONE_DAYS = 60;

export const uid = () =>
  (crypto.randomUUID ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 3) | 8).toString(16);
  }));

export const pad = n => String(n).padStart(2, '0');
export const ymd = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const ym = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
export const parseYmd = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
export const addDays = (s, n) => { const d = parseYmd(s); d.setDate(d.getDate() + n); return ymd(d); };

export const TYPES = [
  { id: 'parcial', label: 'Parcial', scope: 'uni', academic: true, rem: [10080, 1440, 120], dur: 120 },
  { id: 'final', label: 'Final', scope: 'uni', academic: true, rem: [10080, 1440, 120], dur: 120 },
  { id: 'recuperatorio', label: 'Recuperatorio', scope: 'uni', academic: true, rem: [10080, 1440, 120], dur: 120 },
  { id: 'practica', label: 'Práctica', scope: 'uni', academic: true, rem: [1440, 120], dur: 120 },
  { id: 'exposicion', label: 'Exposición', scope: 'uni', academic: true, rem: [4320, 1440, 120], dur: 60 },
  { id: 'presentacion', label: 'Presentación', scope: 'uni', academic: true, rem: [4320, 1440, 120], dur: 60 },
  { id: 'entrega', label: 'Entrega', scope: 'uni', academic: true, rem: [4320, 1440, 120], dur: 30 },
  { id: 'clase', label: 'Clase', scope: 'uni', academic: true, rem: [30], dur: 120 },
  { id: 'tarea', label: 'Tarea', scope: 'personal', rem: [1440], dur: 30 },
  { id: 'reunion', label: 'Reunión', scope: 'trabajo', rem: [1440, 30], dur: 60 },
  { id: 'turno', label: 'Turno', scope: 'salud', rem: [1440, 120], dur: 60 },
  { id: 'cumple', label: 'Cumpleaños', scope: 'personal', rem: [1440, 0], dur: 60 },
  { id: 'pago', label: 'Pago', scope: 'finanzas', rem: [1440, 0], dur: 30 },
  { id: 'evento', label: 'Evento', scope: 'personal', rem: [1440, 60], dur: 120 },
  { id: 'recordatorio', label: 'Recordatorio', scope: 'personal', rem: [0], dur: 30 },
];
export const typeOf = id => TYPES.find(t => t.id === id) || TYPES[TYPES.length - 1];

export const REMINDERS = [
  { m: 0, label: 'A la hora', allDay: 'Ese día, 9:00' },
  { m: 30, label: '30 min antes' },
  { m: 60, label: '1 h antes' },
  { m: 120, label: '2 h antes' },
  { m: 1440, label: '1 día antes' },
  { m: 4320, label: '3 días antes' },
  { m: 10080, label: '1 semana antes' },
];

export const COLORS = ['blue', 'orange', 'aqua', 'yellow', 'magenta', 'green', 'violet', 'red'];

function defaults() {
  const u = 1; // marca muy vieja: cualquier cambio real le gana al fusionar
  return {
    v: 1,
    items: [], notes: [], moves: [], bills: [], sessions: [], subjects: [],
    presets: [
      { id: 'pomodoro', name: 'Pomodoro', focus: 25, rest: 5, long: 15, every: 4, u },
      { id: 'profundo', name: 'Profundo', focus: 50, rest: 10, long: 20, every: 3, u },
      { id: 'bloque', name: 'Bloque largo', focus: 90, rest: 20, long: 30, every: 2, u },
    ],
    scopes: [
      { id: 'uni', name: 'Universidad', color: 'blue', u },
      { id: 'personal', name: 'Personal', color: 'aqua', u },
      { id: 'trabajo', name: 'Trabajo', color: 'violet', u },
      { id: 'salud', name: 'Salud', color: 'magenta', u },
      { id: 'finanzas', name: 'Finanzas', color: 'yellow', u },
      { id: 'hogar', name: 'Hogar', color: 'orange', u },
    ],
    cats: [
      ...['Comida', 'Transporte', 'Alquiler', 'Servicios', 'Estudio', 'Salud', 'Ocio', 'Otros']
        .map(n => ({ id: 'out-' + n.toLowerCase(), name: n, kind: 'out', u })),
      ...['Sueldo', 'Beca', 'Familia', 'Otros']
        .map(n => ({ id: 'in-' + n.toLowerCase(), name: n, kind: 'in', u })),
    ],
    settings: { u, currency: 'ARS', budget: 0, theme: 'auto', autoNext: true, sound: true },
  };
}

function read(key) {
  try { return JSON.parse(localStorage.getItem(key) || 'null'); } catch { return null; }
}
function write(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch { return false; }
}

export let data = normalize(read(KEY));
// Lo que NO se sincroniza: bloqueo, sesión de Google, temporizador, avisos ya mostrados.
export let device = Object.assign(
  { pin: null, bio: null, autolock: 1, google: null, clientId: '', timer: null, fired: [], lastSync: 0, lastPushed: '' },
  read(DEVICE_KEY) || {},
);

function normalize(d) {
  const base = defaults();
  if (!d || typeof d !== 'object') return base;
  for (const c of COLLECTIONS) if (!Array.isArray(d[c])) d[c] = base[c];
  d.settings = Object.assign(base.settings, d.settings || {});
  d.v = 1;
  return d;
}

const listeners = new Set();
// fn(origen): 'local' si el cambio se hizo aquí, 'remote' si llegó al sincronizar.
export const onChange = fn => listeners.add(fn);

export function persist(source = 'local') {
  write(KEY, data);
  listeners.forEach(fn => fn(source));
}
export function saveDevice() { write(DEVICE_KEY, device); }

// Acceso a los registros vivos (sin los borrados)
export const all = c => data[c].filter(r => !r.del);
export const get = (c, id) => data[c].find(r => r.id === id && !r.del);

export function put(c, rec) {
  rec.u = Date.now();
  if (!rec.id) rec.id = uid();
  const i = data[c].findIndex(r => r.id === rec.id);
  if (i >= 0) data[c][i] = rec; else data[c].push(rec);
  persist();
  return rec;
}
export function remove(c, id) {
  const r = data[c].find(x => x.id === id);
  if (!r) return;
  // Deja una lápida para que el borrado llegue al otro dispositivo.
  const stone = { id, del: true, u: Date.now() };
  if (c === 'items') stone.gone = !!r.cu; // había evento en Google que borrar
  data[c][data[c].indexOf(r)] = stone;
  persist();
}
export function setSettings(patch) {
  Object.assign(data.settings, patch, { u: Date.now() });
  persist();
}

// Fusión por registro: gana el cambio más reciente.
export function merge(local, remote) {
  const out = normalize(JSON.parse(JSON.stringify(local)));
  if (!remote || typeof remote !== 'object') return out;
  const limit = Date.now() - TOMBSTONE_DAYS * 864e5;
  for (const c of COLLECTIONS) {
    const map = new Map(out[c].map(r => [r.id, r]));
    for (const r of Array.isArray(remote[c]) ? remote[c] : []) {
      if (!r || !r.id) continue;
      const mine = map.get(r.id);
      if (!mine || (r.u || 0) > (mine.u || 0)) map.set(r.id, r);
    }
    out[c] = [...map.values()].filter(r => !(r.del && !r.gone && (r.u || 0) < limit));
  }
  if (remote.settings && (remote.settings.u || 0) > (out.settings.u || 0)) out.settings = Object.assign(out.settings, remote.settings);
  return out;
}

export function replaceData(next, source = 'remote') {
  data = normalize(next);
  persist(source);
}
export function snapshot() { return JSON.stringify(data); }

export function wipe() {
  try { localStorage.removeItem(KEY); } catch { /* sin almacenamiento */ }
  data = defaults();
  persist();
}

// ---- consultas que usan varias pantallas ----
export const scopeOf = id => get('scopes', id) || all('scopes')[0] || { id: 'x', name: 'General', color: 'blue' };

export function itemStart(it) {
  if (!it.date) return null;
  const d = parseYmd(it.date);
  if (it.time) { const [h, m] = it.time.split(':').map(Number); d.setHours(h, m, 0, 0); }
  else d.setHours(9, 0, 0, 0); // referencia de los avisos para eventos de todo el día
  return d;
}

export function billsFor(month) {
  return all('bills').filter(b => b.active !== false && (!b.from || b.from <= month));
}
export function billPayment(billId, month) {
  return all('moves').find(m => m.billId === billId && m.month === month);
}
export function monthMoves(month) {
  return all('moves').filter(m => m.date.slice(0, 7) === month);
}
export function monthTotals(month) {
  const mv = monthMoves(month);
  const inc = mv.filter(m => m.kind === 'in').reduce((s, m) => s + m.amount, 0);
  const out = mv.filter(m => m.kind === 'out').reduce((s, m) => s + m.amount, 0);
  const pending = billsFor(month).filter(b => !billPayment(b.id, month));
  const pendingSum = pending.reduce((s, b) => s + b.amount, 0);
  return { inc, out, balance: inc - out, pending, pendingSum };
}

export function studyMinutes(fromYmd, toYmd) {
  return all('sessions').filter(s => s.date >= fromYmd && s.date <= toYmd).reduce((t, s) => t + s.min, 0);
}
export function weekStart(d = new Date()) {
  const x = new Date(d); const wd = (x.getDay() + 6) % 7; // lunes = 0
  x.setDate(x.getDate() - wd); return ymd(x);
}
export function studyStreak() {
  const days = new Set(all('sessions').map(s => s.date));
  let d = ymd(), n = 0;
  if (!days.has(d)) d = addDays(d, -1);
  while (days.has(d)) { n++; d = addDays(d, -1); }
  return n;
}

export function ensureSubject(name) {
  const clean = (name || '').trim();
  if (!clean) return '';
  const key = norm(clean);
  const found = all('subjects').find(s => norm(s.name) === key);
  if (found) return found.name;
  put('subjects', { name: clean });
  return clean;
}
export const norm = s => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
