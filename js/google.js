// Conexión con Google, sin servidor propio:
//  · Drive (carpeta privada de la app) guarda una copia para sincronizar PC y iPhone.
//  · Calendar recibe cada parcial, entrega o recordatorio como evento con sus alertas.
// El permiso dura 1 hora (límite de Google para apps sin servidor); después se reconecta con un toque.
import { data, device, saveDevice, merge, replaceData, snapshot, persist, typeOf, addDays, pad, DEMO } from './store.js';

const SCOPES = [
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/drive.appdata',
  'https://www.googleapis.com/auth/userinfo.email',
].join(' ');
const FILE_NAME = 'mivida.json';
const OAUTH_KEY = 'mivida.oauth';
const GCAL_KEY = 'mivida.gcal';

export const clientId = () => (device.clientId || (window.MIVIDA_CONFIG && window.MIVIDA_CONFIG.googleClientId) || '').trim();
export const redirectUri = () => location.origin + location.pathname.replace(/index\.html$/, '');
export const linked = () => !!device.google;
export const connected = () => !!device.google && device.google.exp > Date.now();
export const account = () => (device.google && device.google.email) || '';

export const state = { status: 'idle', error: '' }; // idle | syncing | error
const watchers = new Set();
export const onState = fn => watchers.add(fn);
const setState = (status, error = '') => { state.status = status; state.error = error; watchers.forEach(fn => fn()); };

// Reconexión automática: cuando el permiso de 1 hora venció, la app va sola a Google con
// prompt=none (sin pantallas) y vuelve con uno nuevo. Si Google exige que intervengas,
// responde con un error y queda el botón "Reconectar"; no se reintenta por 6 horas.
const SILENT_RETRY = 6 * 3600e3, SILENT_GAP = 5 * 60e3;
export const autoReconnect = () => device.autoReconnect !== false;
export function shouldSilent() {
  if (DEMO || !autoReconnect() || !linked() || connected() || !clientId() || !navigator.onLine) return false;
  const now = Date.now();
  return now - (device.silentFail || 0) > SILENT_RETRY && now - (device.silentAt || 0) > SILENT_GAP;
}

export function connect({ silent = false, resume = false } = {}) {
  if (!clientId() || DEMO) return false;
  const st = Array.from(crypto.getRandomValues(new Uint8Array(16)), b => b.toString(16).padStart(2, '0')).join('');
  try { localStorage.setItem(OAUTH_KEY, JSON.stringify({ st, back: location.hash, silent })); } catch { /* sin almacenamiento */ }
  const q = new URLSearchParams({
    client_id: clientId(), redirect_uri: redirectUri(), response_type: 'token', scope: SCOPES,
    state: st, include_granted_scopes: 'true',
  });
  if (silent) {
    q.set('prompt', 'none');
    device.silentAt = Date.now();
    // Si la app ya estaba desbloqueada, al volver (en menos de 1 min) no pide el PIN otra vez.
    device.resumeUntil = resume ? Date.now() + 60000 : 0;
    saveDevice();
  }
  if (account()) q.set('login_hint', account());
  location.assign('https://accounts.google.com/o/oauth2/v2/auth?' + q);
  return true;
}

// Al volver de Google el permiso llega en la dirección (#access_token=…).
export function handleRedirect() {
  const h = location.hash.slice(1);
  if (!/(^|&)(access_token|error)=/.test(h)) return null;
  const p = new URLSearchParams(h);
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem(OAUTH_KEY) || '{}'); localStorage.removeItem(OAUTH_KEY); } catch { /* nada */ }
  history.replaceState(null, '', location.pathname + location.search + (saved.back || '#ajustes'));
  const silent = !!saved.silent;
  if (p.get('error')) {
    if (silent) { device.silentFail = Date.now(); saveDevice(); }
    return { ok: false, silent, error: p.get('error') };
  }
  if (!saved.st || saved.st !== p.get('state')) return { ok: false, silent, error: 'La respuesta de Google no coincide con la solicitud. Vuelve a conectar.' };
  device.silentFail = 0;
  device.google = {
    token: p.get('access_token'),
    exp: Date.now() + (Number(p.get('expires_in') || 3600) - 90) * 1000,
    email: account(),
  };
  saveDevice();
  return { ok: true, silent };
}

export async function disconnect() {
  const token = device.google && device.google.token;
  device.google = null; device.lastSync = 0; saveDevice();
  try { localStorage.removeItem(GCAL_KEY); } catch { /* nada */ }
  if (token) fetch('https://oauth2.googleapis.com/revoke?token=' + encodeURIComponent(token), { method: 'POST' }).catch(() => {});
  setState('idle');
}

async function api(url, opts = {}) {
  if (!connected()) throw new Error('expired');
  const res = await fetch(url, { ...opts, headers: { Authorization: 'Bearer ' + device.google.token, ...(opts.headers || {}) } });
  if (res.status === 401) { device.google.exp = 0; saveDevice(); throw new Error('expired'); }
  return res;
}
async function okJson(res, what) {
  if (res.ok) return res.status === 204 ? null : res.json();
  let msg = '';
  try { msg = (await res.json()).error.message; } catch { /* sin detalle */ }
  throw new Error(`${what}: ${msg || 'error ' + res.status}`);
}

// ---------- Drive ----------
async function findFile() {
  const q = encodeURIComponent(`name='${FILE_NAME}'`);
  const r = await okJson(await api(`https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&q=${q}&fields=files(id,modifiedTime)&orderBy=modifiedTime desc`), 'Drive');
  return r.files[0] || null;
}
async function upload(fileId, text) {
  if (fileId) {
    await okJson(await api(`https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`,
      { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: text }), 'Drive');
    return;
  }
  const boundary = 'mivida' + Date.now();
  const body = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify({ name: FILE_NAME, parents: ['appDataFolder'] })}\r\n` +
    `--${boundary}\r\nContent-Type: application/json\r\n\r\n${text}\r\n--${boundary}--`;
  await okJson(await api('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
    { method: 'POST', headers: { 'Content-Type': `multipart/related; boundary=${boundary}` }, body }), 'Drive');
}

// ---------- Calendar ----------
const eventId = id => 'mv' + id.replace(/[^0-9a-v]/g, '');
const tz = () => Intl.DateTimeFormat().resolvedOptions().timeZone;
const local = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:00`;

export function itemLabel(it) {
  const t = typeOf(it.type);
  if (['tarea', 'recordatorio', 'evento'].includes(t.id) || !it.title) return it.title || t.label;
  const low = it.title.toLowerCase();
  return low.startsWith(t.label.toLowerCase().slice(0, 4)) ? it.title : `${t.label} · ${it.title}`;
}

function eventBody(it) {
  const t = typeOf(it.type);
  const body = {
    summary: itemLabel(it),
    description: [it.notes, 'Creado con MiVida'].filter(Boolean).join('\n\n'),
    extendedProperties: { private: { mivida: it.id } },
    status: 'confirmed',
  };
  if (it.time) {
    const [y, m, d] = it.date.split('-').map(Number);
    const [h, mi] = it.time.split(':').map(Number);
    const start = new Date(y, m - 1, d, h, mi);
    const end = new Date(start.getTime() + (t.dur || 60) * 60000);
    body.start = { dateTime: local(start), timeZone: tz() };
    body.end = { dateTime: local(end), timeZone: tz() };
  } else {
    body.start = { date: it.date };
    body.end = { date: addDays(it.date, 1) };
  }
  // Las alertas de un evento de todo el día cuentan desde las 0:00; en la app, desde las 9:00.
  const mins = [...new Set((it.rem || []).map(m => (it.time ? m : m - 540)).filter(m => m >= 0 && m <= 40320))].slice(0, 5);
  body.reminders = { useDefault: false, overrides: mins.map(minutes => ({ method: 'popup', minutes })) };
  return body;
}

async function upsertEvent(it) {
  const base = 'https://www.googleapis.com/calendar/v3/calendars/primary/events';
  const json = { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(eventBody(it)) };
  let res = await api(`${base}/${eventId(it.id)}`, json);
  if (res.status === 404) {
    res = await api(base, { ...json, method: 'POST', body: JSON.stringify({ id: eventId(it.id), ...eventBody(it) }) });
    if (res.status === 409) res = await api(`${base}/${eventId(it.id)}`, json);
  }
  await okJson(res, 'Calendar');
}
async function deleteEvent(id) {
  const res = await api(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId(id)}`, { method: 'DELETE' });
  if (!res.ok && ![404, 410].includes(res.status)) await okJson(res, 'Calendar');
}

async function pushCalendar() {
  let changed = 0;
  for (const it of data.items) {
    const stamp = () => { it.u = Date.now(); changed++; };
    if (it.del) {
      if (it.gone) { await deleteEvent(it.id); it.gone = false; stamp(); }
      continue;
    }
    const wants = !!it.date && it.cal !== false;
    if ((it.cu || 0) >= (it.u || 0)) continue;       // sin cambios desde el último envío
    if (wants) { await upsertEvent(it); stamp(); it.cu = it.u; }
    else if (it.cu) { await deleteEvent(it.id); stamp(); it.cu = 0; } // se le quitó la fecha: se borra el evento
  }
  if (changed) persist('remote');
  return changed;
}

// Tus otros eventos de Google, para verlos en la agenda (solo lectura).
async function pullEvents() {
  const from = new Date(Date.now() - 7 * 864e5).toISOString();
  const to = new Date(Date.now() + 120 * 864e5).toISOString();
  const r = await okJson(await api(`https://www.googleapis.com/calendar/v3/calendars/primary/events?singleEvents=true&orderBy=startTime&maxResults=250&timeMin=${from}&timeMax=${to}` +
    '&fields=items(id,summary,start,end,htmlLink,status,extendedProperties)'), 'Calendar');
  const list = (r.items || [])
    .filter(e => e.status !== 'cancelled' && !(e.extendedProperties && e.extendedProperties.private && e.extendedProperties.private.mivida))
    .map(e => {
      const s = e.start || {};
      if (s.date) return { id: e.id, title: e.summary || '(sin título)', date: s.date, time: '', link: e.htmlLink };
      const d = new Date(s.dateTime);
      return { id: e.id, title: e.summary || '(sin título)', date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
        time: `${pad(d.getHours())}:${pad(d.getMinutes())}`, link: e.htmlLink };
    });
  try { localStorage.setItem(GCAL_KEY, JSON.stringify(list)); } catch { /* nada */ }
}
export function googleEvents() {
  if (!linked()) return [];
  try { return JSON.parse(localStorage.getItem(GCAL_KEY) || '[]'); } catch { return []; }
}

// Enlace para añadir un evento a mano cuando Google no está conectado.
export function calendarLink(it) {
  const c = s => s.replace(/[-:]/g, '');
  let dates;
  if (it.time) {
    const b = eventBody(it);
    dates = `${c(b.start.dateTime)}/${c(b.end.dateTime)}`;
  } else dates = `${c(it.date)}/${c(addDays(it.date, 1))}`;
  const q = new URLSearchParams({ action: 'TEMPLATE', text: itemLabel(it), dates, details: it.notes || '', ctz: tz() });
  return 'https://calendar.google.com/calendar/render?' + q;
}

// ---------- Sincronización ----------
let running = null;
export function sync() {
  if (!connected() || !navigator.onLine) return Promise.resolve({ ok: false, skipped: true });
  if (running) return running;
  running = (async () => {
    setState('syncing');
    try {
      if (!device.google.email) {
        const me = await okJson(await api('https://www.googleapis.com/oauth2/v3/userinfo'), 'Google');
        device.google.email = me.email || ''; saveDevice();
      }
      const file = await findFile();
      let remoteText = '';
      if (file) {
        const res = await api(`https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`);
        if (res.ok) remoteText = await res.text();
      }
      let remote = null;
      try { remote = remoteText ? JSON.parse(remoteText) : null; } catch { remote = null; }
      const before = snapshot();
      const merged = merge(data, remote);
      if (JSON.stringify(merged) !== before) replaceData(merged, 'remote');
      await pushCalendar();
      const text = snapshot();
      if (text !== remoteText) await upload(file && file.id, text);
      await pullEvents();
      device.lastSync = Date.now(); saveDevice();
      setState('idle');
      return { ok: true };
    } catch (e) {
      const expired = e.message === 'expired';
      setState(expired ? 'idle' : 'error', expired ? '' : e.message);
      return { ok: false, error: e.message };
    } finally { running = null; }
  })();
  return running;
}
