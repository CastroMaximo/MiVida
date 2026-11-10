// Avisos de la app. Suenan mientras la app está abierta (o recién minimizada);
// con la app cerrada el aviso lo da la alerta del evento en Google Calendar.
import { all, device, saveDevice, itemStart, billsFor, billPayment, ym, ymd, parseYmd, DEMO } from './store.js';
import { itemLabel } from './google.js';

export const supported = () => 'Notification' in window && !DEMO;
export const permission = () => (supported() ? Notification.permission : 'unsupported');

export async function ask() {
  if (!supported()) return 'unsupported';
  try { return await Notification.requestPermission(); } catch { return 'denied'; }
}

export async function show(title, body, tag) {
  if (permission() !== 'granted') return false;
  try {
    const reg = 'serviceWorker' in navigator ? await navigator.serviceWorker.getRegistration() : null;
    const opts = { body, tag, icon: 'icons/icon-192.png', badge: 'icons/icon-192.png' };
    if (reg) await reg.showNotification(title, opts); else new Notification(title, opts);
    return true;
  } catch { return false; }
}

const WINDOW = 12 * 3600e3; // un aviso atrasado más de 12 h ya no se muestra

function when(start, now) {
  const days = Math.round((new Date(start.getFullYear(), start.getMonth(), start.getDate()) - new Date(now.getFullYear(), now.getMonth(), now.getDate())) / 864e5);
  const day = days === 0 ? 'Hoy' : days === 1 ? 'Mañana' : days > 1 ? `En ${days} días` : 'Ya pasó';
  return day;
}

// Devuelve los avisos que tocan ahora y los marca como mostrados.
export function due(now = new Date()) {
  const out = [];
  const fired = new Set(device.fired || []);
  const t = now.getTime();
  for (const it of all('items')) {
    if (it.done || !it.date) continue;
    const start = itemStart(it);
    if (start.getTime() < t - 3600e3) continue;
    for (const m of it.rem || []) {
      const at = start.getTime() - m * 60000;
      const key = `${it.id}|${m}|${start.getTime()}`;
      if (at <= t && t - at < WINDOW && !fired.has(key)) {
        fired.add(key);
        out.push({ key, id: it.id, title: itemLabel(it), body: `${when(start, now)}${it.time ? ' · ' + it.time : ''}` });
      }
    }
  }
  // Gastos fijos sin pagar: el día anterior y el día del vencimiento, desde las 9:00.
  const month = ym(now);
  const last = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  for (const b of billsFor(month)) {
    if (!b.day || billPayment(b.id, month)) continue;
    const dueDay = Math.min(b.day, last);
    for (const before of [1, 0]) {
      const at = parseYmd(`${month}-${String(dueDay).padStart(2, '0')}`); at.setDate(at.getDate() - before); at.setHours(9, 0, 0, 0);
      const key = `bill|${b.id}|${month}|${before}`;
      if (at.getTime() <= t && t - at.getTime() < WINDOW && ymd(at).slice(0, 7) === month && !fired.has(key)) {
        fired.add(key);
        out.push({ key, bill: b.id, title: `${before ? 'Vence mañana' : 'Vence hoy'}: ${b.name}`, body: 'Gasto fijo sin pagar' });
      }
    }
  }
  if (out.length) { device.fired = [...fired].slice(-400); saveDevice(); }
  return out;
}
