import {
  data, device, saveDevice, onChange, all, get, put, remove, setSettings, merge, replaceData, snapshot, wipe, DEMO,
  TYPES, typeOf, REMINDERS, COLORS, scopeOf, itemStart, billsFor, billPayment, monthMoves, monthTotals,
  studyMinutes, weekStart, studyStreak, ensureSubject, norm, ymd, ym, parseYmd, addDays, pad,
} from './store.js';
import { parseCapture, parseAmount } from './parser.js';
import * as lock from './lock.js';
import * as G from './google.js';
import * as N from './notify.js';
import * as T from './timer.js';

// ---------- utilidades ----------
const $ = (s, r = document) => r.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const svg = d => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const I = {
  today: svg('<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="2.3" fill="currentColor" stroke="none"/>'),
  cal: svg('<rect x="3.5" y="5" width="17" height="15.5" rx="3"/><path d="M3.5 10h17M8 3v4M16 3v4"/>'),
  note: svg('<path d="M6 3.5h8l4.5 4.5v10a2.5 2.5 0 0 1-2.5 2.5H6A2.5 2.5 0 0 1 3.5 18V6A2.5 2.5 0 0 1 6 3.5Z" transform="translate(1 0)"/><path d="M9 12.5h6M9 16h4"/>'),
  wallet: svg('<rect x="3" y="6" width="18" height="13.5" rx="3"/><path d="M3 10h18M16 14.75h1.5"/>'),
  timer: svg('<circle cx="12" cy="13.5" r="7.5"/><path d="M12 9.5v4l2.5 1.5M9.5 2.75h5"/>'),
  gear: svg('<circle cx="12" cy="12" r="3"/><path d="M12 2.8v2.4M12 18.8v2.4M2.8 12h2.4M18.8 12h2.4M5.5 5.5l1.7 1.7M16.8 16.8l1.7 1.7M5.5 18.5l1.7-1.7M16.8 7.2l1.7-1.7"/>'),
  plus: svg('<path d="M12 5v14M5 12h14"/>'),
  check: svg('<path d="m5 12.5 4.5 4.5L19 7.5" stroke-width="2.4"/>'),
  left: svg('<path d="m14.5 6-6 6 6 6"/>'),
  right: svg('<path d="m9.5 6 6 6-6 6"/>'),
  x: svg('<path d="M6 6l12 12M18 6 6 18"/>'),
  search: svg('<circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5"/>'),
  back: svg('<path d="M20 5H9.5L3 12l6.5 7H20a1.5 1.5 0 0 0 1.5-1.5v-11A1.5 1.5 0 0 0 20 5Z"/><path d="m12 9.5 5 5M17 9.5l-5 5"/>'),
  face: svg('<path d="M4 8V6.5A2.5 2.5 0 0 1 6.5 4H8M16 4h1.5A2.5 2.5 0 0 1 20 6.5V8M20 16v1.5a2.5 2.5 0 0 1-2.5 2.5H16M8 20H6.5A2.5 2.5 0 0 1 4 17.5V16M9 9.5v1.5M15 9.5v1.5M12 9.5v3.5h-1M9 15.5c1.8 1.4 4.2 1.4 6 0"/>'),
  pin: svg('<path d="M9 4h6l-1 6 3.5 3.5h-11L10 10 9 4ZM12 13.5V20"/>'),
};

const DAY = new Intl.DateTimeFormat('es-AR', { weekday: 'short', day: 'numeric', month: 'short' });
const fmtDay = s => DAY.format(parseYmd(s)).replace(/[.,]/g, '');
const fmtLong = d => new Intl.DateTimeFormat('es-AR', { weekday: 'long', day: 'numeric', month: 'long' }).format(d);
const cap1 = s => s.charAt(0).toUpperCase() + s.slice(1);
const fmtMonth = m => cap1(new Intl.DateTimeFormat('es-AR', { month: 'long', year: 'numeric' }).format(parseYmd(m + '-01')).replace(' de ', ' '));
const monthName = m => new Intl.DateTimeFormat('es-AR', { month: 'long' }).format(parseYmd(m + '-01'));
const shiftMonth = (m, n) => { const d = parseYmd(m + '-01'); d.setMonth(d.getMonth() + n); return ym(d); };
const dayDiff = s => Math.round((parseYmd(s) - parseYmd(ymd())) / 864e5);
const rel = s => { const n = dayDiff(s); return n === 0 ? 'Hoy' : n === 1 ? 'Mañana' : n === -1 ? 'Ayer' : n > 1 ? `en ${n} días` : `hace ${-n} días`; };
const money = n => new Intl.NumberFormat('es-AR', { style: 'currency', currency: data.settings.currency || 'ARS', maximumFractionDigits: Number.isInteger(n) ? 0 : 2 }).format(n);
const dur = m => (m < 60 ? `${m} min` : `${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60} min` : ''}`);
const clock = ms => { const s = Math.ceil(ms / 1000); return `${pad(Math.floor(s / 60))}:${pad(s % 60)}`; };
const ago = t => { const m = Math.round((Date.now() - t) / 60000); return m < 1 ? 'recién' : m < 60 ? `hace ${m} min` : m < 1440 ? `hace ${Math.round(m / 60)} h` : `hace ${Math.round(m / 1440)} días`; };
const catName = id => (get('cats', id) || {}).name || 'Otros';
const subjects = () => all('subjects').map(s => s.name).sort((a, b) => a.localeCompare(b, 'es'));
const options = (list, sel) => list.map(([v, l]) => `<option value="${esc(v)}"${v === sel ? ' selected' : ''}>${esc(l)}</option>`).join('');

const lockEl = $('#lock'), appEl = $('#app'), navEl = $('#nav'), viewEl = $('#view'), sheetEl = $('#sheet'), toastsEl = $('#toasts'), tipEl = $('#tip');
const ROUTES = [['hoy', 'Hoy', I.today], ['agenda', 'Agenda', I.cal], ['notas', 'Notas', I.note], ['dinero', 'Dinero', I.wallet], ['estudio', 'Estudio', I.timer]];
const ui = {
  agenda: { filter: 'all', mode: 'list', month: ym(), day: ymd(), done: false },
  notes: { q: '', filter: 'all' },
  money: { month: ym() },
  study: { month: ym(), preset: null, subject: '' },
};
let locked = true;

function toast(msg, action, fn, ms = 4500) {
  const el = document.createElement('div');
  el.className = 'toast';
  el.innerHTML = `<span>${esc(msg)}</span>${action ? `<button type="button">${esc(action)}</button>` : ''}`;
  if (action) el.querySelector('button').onclick = () => { el.remove(); fn(); };
  toastsEl.append(el);
  setTimeout(() => el.remove(), ms);
}

// ---------- bloqueo ----------
let ls = null; // estado de la pantalla de bloqueo
function showLock(mode = 'unlock', then = null) {
  ls = { mode, pin: '', first: '', msg: '', err: false, then, busy: false };
  locked = mode === 'unlock' || !lock.hasPin();
  lockEl.hidden = false;
  if (locked) appEl.hidden = true;
  paintLock();
  if (mode === 'unlock' && lock.bioEnabled()) tryBio();
}
function paintLock() {
  const s = ls;
  if (s.mode === 'bio') {
    lockEl.innerHTML = `<div class="mark"><i></i></div><h1>¿Entrar con ${esc(lock.bioName())}?</h1>
      <p>Tu PIN sigue funcionando como respaldo.</p>
      <div class="stack" style="width:min(100%,280px);gap:10px">
        <button class="btn block" data-a="bio-on">Activar ${esc(lock.bioName())}</button>
        <button class="btn ghost block" data-a="bio-skip">Ahora no</button></div>`;
    return;
  }
  const titles = { unlock: 'MiVida', create: lock.hasPin() ? 'Nuevo PIN' : 'Crea tu PIN', confirm: 'Repite el PIN' };
  const hints = { unlock: 'Ingresa tu PIN', create: 'De 4 a 6 dígitos. Protege la app en este dispositivo.', confirm: 'Para confirmar que lo escribiste bien.' };
  const n = s.mode === 'unlock' ? lock.pinLength() : s.mode === 'confirm' ? s.first.length : 4;
  const dots = Array.from({ length: Math.max(n, s.pin.length) }, (_, i) => `<i class="${i < s.pin.length ? 'on' : ''}"></i>`).join('');
  const leftKey = s.mode === 'unlock'
    ? (lock.bioEnabled() ? `<button class="flat" data-k="bio" aria-label="Usar ${esc(lock.bioName())}">${I.face}</button>` : '<span></span>')
    : s.mode === 'create' && s.pin.length >= 4 ? '<button class="flat" data-k="ok">Listo</button>'
    : s.then ? '<button class="flat" data-k="cancel">Cancelar</button>' : '<span></span>';
  lockEl.innerHTML = `<div class="mark"><i></i></div><h1>${titles[s.mode]}</h1>
    <div class="pin-dots${s.err ? ' shake' : ''}" aria-label="${s.pin.length} dígitos ingresados">${dots}</div>
    <p class="${s.err ? 'err' : ''}" role="status">${esc(s.msg || hints[s.mode])}</p>
    <div class="keys">${[1, 2, 3, 4, 5, 6, 7, 8, 9].map(k => `<button data-k="${k}">${k}</button>`).join('')}
      ${leftKey}<button data-k="0">0</button><button class="flat" data-k="del" aria-label="Borrar">${I.back}</button></div>`;
  s.err = false;
}
async function tryBio() {
  if (ls.busy) return;
  ls.busy = true;
  const ok = await lock.bioUnlock();
  ls.busy = false;
  if (ok) unlock();
}
async function lockKey(k) {
  const s = ls;
  if (!s || s.busy || s.mode === 'bio') return;
  if (k === 'bio') return tryBio();
  if (k === 'cancel') { lockEl.hidden = true; return; }
  if (k === 'del') s.pin = s.pin.slice(0, -1);
  else if (k === 'ok') return lockSubmit();
  else if (/^\d$/.test(k) && s.pin.length < 6) s.pin += k;
  s.msg = '';
  paintLock();
  if ((s.mode === 'unlock' && s.pin.length === lock.pinLength()) || (s.mode === 'confirm' && s.pin.length === s.first.length) || (s.mode === 'create' && s.pin.length === 6)) lockSubmit();
}
async function lockSubmit() {
  const s = ls;
  if (s.mode === 'unlock') {
    s.busy = true;
    const r = await lock.checkPin(s.pin);
    s.busy = false;
    if (r.ok) return unlock();
    s.pin = ''; s.err = true;
    s.msg = r.wait ? `Demasiados intentos. Espera ${r.wait >= 60 ? Math.ceil(r.wait / 60) + ' min' : r.wait + ' s'}.` : 'PIN incorrecto';
  } else if (s.mode === 'create') {
    if (s.pin.length < 4) { s.err = true; s.msg = 'Usa al menos 4 dígitos'; }
    else { s.first = s.pin; s.pin = ''; s.mode = 'confirm'; }
  } else if (s.mode === 'confirm') {
    if (s.pin !== s.first) { s.pin = ''; s.first = ''; s.mode = 'create'; s.err = true; s.msg = 'No coinciden. Empieza de nuevo.'; }
    else {
      const first = !lock.hasPin();
      await lock.setPin(s.pin);
      if (s.then) { lockEl.hidden = true; return s.then(); }
      if (first && (await lock.bioAvailable())) { s.mode = 'bio'; return paintLock(); }
      return unlock();
    }
  }
  paintLock();
}
function unlock() {
  locked = false;
  lockEl.hidden = true; appEl.hidden = false;
  render();
  afterUnlock();
}
lockEl.addEventListener('click', async e => {
  const k = e.target.closest('[data-k]');
  if (k) return lockKey(k.dataset.k);
  const a = e.target.closest('[data-a]');
  if (!a) return;
  if (a.dataset.a === 'bio-on') {
    try { await lock.bioRegister(); toast(`${lock.bioName()} activado`); } catch { toast(`No se pudo activar ${lock.bioName()}. Puedes hacerlo luego en Ajustes.`); }
  }
  unlock();
});
document.addEventListener('keydown', e => {
  if (!lockEl.hidden && ls && ls.mode !== 'bio') {
    if (/^\d$/.test(e.key)) lockKey(e.key);
    else if (e.key === 'Backspace') lockKey('del');
    else if (e.key === 'Enter' && ls.mode === 'create') lockKey('ok');
    return;
  }
  if (e.key === 'Escape' && !sheetEl.hidden) return closeSheet();
  const typing = /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName);
  if (!typing && e.key && (e.key === '/' || (e.key.toLowerCase() === 'k' && (e.metaKey || e.ctrlKey)))) {
    e.preventDefault();
    if (!$('#capture')) { location.hash = '#hoy'; setTimeout(() => $('#capture') && $('#capture').focus(), 30); } else $('#capture').focus();
  }
});
let hiddenAt = 0;
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { hiddenAt = Date.now(); return; }
  const relock = !locked && lock.hasPin() && !DEMO && hiddenAt && Date.now() - hiddenAt >= (device.autolock ?? 1) * 60000;
  // Permiso de Google vencido: se renueva solo, salvo que haya un formulario abierto o una sesión de estudio en curso.
  if (sheetEl.hidden && !T.timer() && G.shouldSilent() && G.connect({ silent: true, resume: !locked && !relock })) return;
  if (relock) return showLock('unlock');
  if (!locked) { tickTimer(); checkReminders(); G.sync(); keepAwake(); }
});

// ---------- navegación ----------
const route = () => { const r = location.hash.slice(1); return r === 'ajustes' || ROUTES.some(x => x[0] === r) ? r : 'hoy'; };
window.addEventListener('hashchange', () => { viewEl.scrollTop = 0; render(); });

function syncLabel() {
  if (DEMO) return 'Vista previa';
  if (!G.linked()) return 'Datos en este dispositivo';
  if (G.state.status === 'syncing') return 'Sincronizando…';
  if (G.state.status === 'error') return 'Error al sincronizar';
  if (!G.connected()) return 'Google: reconectar';
  return device.lastSync ? `Sincronizado ${ago(device.lastSync)}` : 'Google conectado';
}
let lastRoute = '';
function render() {
  if (locked) return;
  const r = route();
  const act = document.activeElement;
  const keep = act && act.id && viewEl.contains(act) ? { id: act.id, v: act.value, a: act.selectionStart, b: act.selectionEnd } : null;
  const top = r === lastRoute ? viewEl.scrollTop : 0;
  lastRoute = r;
  navEl.innerHTML = `<div class="brand"><span class="dot" style="--c:var(--accent);width:10px;height:10px"></span>MiVida</div>` +
    ROUTES.map(([id, label, icon]) => `<a href="#${id}"${id === r ? ' aria-current="page"' : ''}>${icon}<span>${label}</span></a>`).join('') +
    `<a href="#ajustes" class="only-wide"${r === 'ajustes' ? ' aria-current="page"' : ''}>${I.gear}<span>Ajustes</span></a>
     <div class="nav-foot">${esc(syncLabel())}</div>`;
  viewEl.innerHTML = `<div class="page">${VIEWS[r]()}</div>`;
  viewEl.scrollTop = top;
  if (keep) {
    const el = document.getElementById(keep.id);
    if (el) { el.value = keep.v; el.focus(); try { el.setSelectionRange(keep.a, keep.b); } catch { /* no aplica */ } if (el.id === 'capture') paintPreview(); }
  }
  if (r === 'estudio') paintTimer();
}

// ---------- piezas compartidas ----------
const head = (title, sub, actions = '') => `<header class="head"><div><h1>${title}</h1>${sub ? `<p class="sub">${sub}</p>` : ''}</div><div class="head-actions">${actions}</div></header>`;
const gearBtn = `<a class="icon-btn only-narrow" href="#ajustes" aria-label="Ajustes">${I.gear}</a>`;
const section = (title, body, meta = '') => `<section class="sec"><div class="sec-title"><h2>${title}</h2><span class="meta">${meta}</span></div>${body}</section>`;
const captureBar = () => `<form class="capture" data-form="capture" autocomplete="off">
  <div class="capture-row">${I.search}<input id="capture" enterkeyhint="done" aria-label="Agregar rápido" placeholder="Parcial Física 15 nov 14:00">
  <button class="icon-btn" aria-label="Agregar">${I.plus}</button></div><div class="capture-preview" id="capture-preview" aria-live="polite"></div></form>`;
const monthNav = (key, m) => `<div class="month-nav"><button class="icon-btn" data-a="month" data-key="${key}" data-n="-1" aria-label="Mes anterior">${I.left}</button>
  <b>${esc(fmtMonth(m))}</b><button class="icon-btn" data-a="month" data-key="${key}" data-n="1" aria-label="Mes siguiente">${I.right}</button></div>`;
const scopeChips = (cur, action) => `<div class="chips scroll" role="group" aria-label="Filtrar por ámbito">
  <button class="chip" aria-pressed="${cur === 'all'}" data-a="${action}" data-id="all">Todo</button>
  ${all('scopes').map(s => `<button class="chip" aria-pressed="${cur === s.id}" data-a="${action}" data-id="${s.id}"><i class="dot" style="--c:var(--c-${s.color})"></i>${esc(s.name)}</button>`).join('')}</div>`;

function googleBanner() {
  if (DEMO) return `<div class="banner"><span>Vista previa con datos de ejemplo. El bloqueo, la instalación y Google funcionan en la app publicada.</span></div>`;
  if (G.linked() && !G.connected()) return `<div class="banner"><span>Google necesita que confirmes el permiso para seguir sincronizando.</span><button class="btn sm" data-a="g-connect">Reconectar</button></div>`;
  if (G.state.status === 'error') return `<div class="banner"><span>No se pudo sincronizar: ${esc(G.state.error)}</span><button class="btn sm ghost" data-a="g-sync">Reintentar</button></div>`;
  return '';
}

function itemRow(it, { day = false } = {}) {
  const sc = scopeOf(it.scope), t = typeOf(it.type);
  const late = !it.done && it.date && it.date < ymd();
  const title = it.title || t.label;
  const end = it.date
    ? (day ? `${it.time || 'Todo el día'}` : `${esc(fmtDay(it.date))}${it.time ? ' · ' + it.time : ''}<small>${late ? 'Atrasado · ' : ''}${rel(it.date)}</small>`)
    : '<small>Sin fecha</small>';
  return `<div class="row${it.done ? ' done' : ''}${late ? ' late' : ''}">
    <button class="check" role="checkbox" aria-checked="${!!it.done}" aria-label="Hecho: ${esc(title)}" data-a="toggle-item" data-id="${it.id}">${I.check}</button>
    <button class="row-main" data-a="edit-item" data-id="${it.id}"><span class="row-title">${esc(title)}</span>
      <span class="row-sub"><span class="pill"><i class="dot" style="--c:var(--c-${sc.color})"></i>${esc(t.label)}</span>
      <span>${esc(it.subject && norm(it.subject) !== norm(title) ? it.subject : sc.name)}</span></span></button>
    <span class="row-end when">${end}</span></div>`;
}
const gRow = (ev, { day = false } = {}) => `<a class="row" href="${esc(ev.link || 'https://calendar.google.com')}" target="_blank" rel="noopener" style="text-decoration:none;color:inherit">
  <span class="check sq" aria-hidden="true" style="box-shadow:inset 0 0 0 1.5px var(--line)"></span>
  <span class="row-main"><span class="row-title">${esc(ev.title)}</span><span class="row-sub"><span class="pill">Google Calendar</span></span></span>
  <span class="row-end when">${day ? (ev.time || 'Todo el día') : `${esc(fmtDay(ev.date))}${ev.time ? ' · ' + ev.time : ''}<small>${rel(ev.date)}</small>`}</span></a>`;
const byWhen = (a, b) => (a.date + (a.time || '99')).localeCompare(b.date + (b.time || '99'));
const listOf = rows => `<div class="list">${rows.join('')}</div>`;
const rowsFor = (items, events, opt) => [...items.map(i => ({ ...i, _i: 1 })), ...events].sort(byWhen).map(x => (x._i ? itemRow(x, opt) : gRow(x, opt)));

// ---------- Hoy ----------
function viewHoy() {
  const today = ymd(), week = addDays(today, 7), month = ym();
  const items = all('items'), gev = G.googleEvents();
  const late = items.filter(i => !i.done && i.date && i.date < today).sort(byWhen);
  const todays = rowsFor(items.filter(i => i.date === today && !i.done), gev.filter(e => e.date === today), { day: true });
  const next = rowsFor(items.filter(i => !i.done && i.date > today && i.date <= week), gev.filter(e => e.date > today && e.date <= week));
  const loose = items.filter(i => !i.done && !i.date);
  const tot = monthTotals(month);
  const pend = tot.pending.slice().sort((a, b) => (a.day || 99) - (b.day || 99));
  const t = T.timer();
  const left = `
    ${late.length ? section('Atrasado', listOf(late.map(i => itemRow(i))), `${late.length}`) : ''}
    ${section('Hoy', todays.length ? listOf(todays) : `<div class="card empty"><b>Nada para hoy</b><span>Escribe arriba algo como “Entrega TP Redes viernes 23:59”.</span></div>`)}
    ${section('Próximos 7 días', next.length ? listOf(next) : `<div class="card empty"><span>Sin pendientes esta semana.</span></div>`, next.length ? `${next.length}` : '')}
    ${loose.length ? section('Sin fecha', listOf(loose.slice(0, 5).map(i => itemRow(i))), loose.length > 5 ? `<a class="link" href="#agenda">Ver ${loose.length}</a>` : '') : ''}`;
  const right = `
    ${section(`Dinero · ${esc(monthName(month))}`, `<div class="stats">
        <div class="stat"><span>Ingresos</span><b class="num">${money(tot.inc)}</b></div>
        <div class="stat"><span>Gastos</span><b class="num">${money(tot.out)}</b></div>
        <div class="stat ${tot.balance < 0 ? 'bad' : ''}"><span>Balance</span><b class="num">${money(tot.balance)}</b></div></div>
      ${pend.length ? listOf(pend.slice(0, 4).map(b => billRow(b, month))) : ''}`,
      pend.length ? `<a class="link" href="#dinero">${pend.length} sin pagar · ${money(tot.pendingSum)}</a>` : `<a class="link" href="#dinero">Ver todo</a>`)}
    ${section('Estudio', `<div class="stats">
        <div class="stat"><span>Hoy</span><b class="num">${dur(studyMinutes(today, today))}</b></div>
        <div class="stat"><span>Semana</span><b class="num">${dur(studyMinutes(weekStart(), today))}</b></div>
        <div class="stat"><span>Mes</span><b class="num">${dur(studyMinutes(month + '-01', month + '-31'))}</b></div></div>
      <a class="btn soft block" href="#estudio">${I.timer}${t ? `${t.phase === 'focus' ? 'Enfoque' : 'Descanso'} en curso · <span id="mini-clock" class="num">${clock(T.remaining())}</span>` : 'Empezar una sesión'}</a>`)}`;
  return `${head('Hoy', esc(fmtLong(new Date())), gearBtn)}${googleBanner()}${captureBar()}
    <div class="grid-2"><div class="stack">${left}</div><div class="stack">${right}</div></div>`;
}

// ---------- Agenda ----------
function viewAgenda() {
  const a = ui.agenda, today = ymd();
  const pass = i => a.filter === 'all' || i.scope === a.filter;
  const items = all('items').filter(pass);
  const gev = a.filter === 'all' ? G.googleEvents() : [];
  let body;
  if (a.mode === 'list') {
    const open = items.filter(i => !i.done);
    const groups = [
      ['Atrasado', open.filter(i => i.date && i.date < today), []],
      ['Hoy', open.filter(i => i.date === today), gev.filter(e => e.date === today)],
      ['Mañana', open.filter(i => i.date === addDays(today, 1)), gev.filter(e => e.date === addDays(today, 1))],
      ['Esta semana', open.filter(i => i.date > addDays(today, 1) && i.date <= addDays(today, 7)), gev.filter(e => e.date > addDays(today, 1) && e.date <= addDays(today, 7))],
      ['Más adelante', open.filter(i => i.date > addDays(today, 7)), gev.filter(e => e.date > addDays(today, 7))],
      ['Sin fecha', open.filter(i => !i.date), []],
    ].filter(g => g[1].length + g[2].length);
    const done = items.filter(i => i.done).sort((x, y) => (y.doneAt || 0) - (x.doneAt || 0));
    body = groups.map(([t, its, evs]) => section(t, listOf(rowsFor(its, evs, { day: t === 'Hoy' || t === 'Mañana' })), `${its.length + evs.length}`)).join('') ||
      `<div class="card empty"><b>Agenda vacía</b><span>Usa el buscador: escribe el tipo, la materia y la fecha, y la app lo ordena sola.</span></div>`;
    if (done.length) body += section('Hecho', a.done ? listOf(done.slice(0, 40).map(i => itemRow(i))) : '', `<button class="link" data-a="toggle-done">${a.done ? 'Ocultar' : `Mostrar ${done.length}`}</button>`);
  } else {
    const first = parseYmd(a.month + '-01');
    const start = addDays(a.month + '-01', -((first.getDay() + 6) % 7));
    const weeks = Math.ceil((((first.getDay() + 6) % 7) + new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate()) / 7);
    const cells = Array.from({ length: weeks * 7 }, (_, n) => {
      const d = addDays(start, n);
      const marks = [...items.filter(i => i.date === d && !i.done).map(i => scopeOf(i.scope).color), ...gev.filter(e => e.date === d).map(() => '')].slice(0, 3);
      return `<button class="${d.slice(0, 7) !== a.month ? 'out ' : ''}${d === today ? 'today' : ''}" aria-pressed="${d === a.day}" data-a="pick-day" data-id="${d}" aria-label="${esc(fmtDay(d))}, ${marks.length} pendientes">
        ${+d.slice(8)}<span class="dots">${marks.map(c => `<i style="${c ? `--c:var(--c-${c})` : ''}"></i>`).join('')}</span></button>`;
    }).join('');
    const dayRows = rowsFor(items.filter(i => i.date === a.day), gev.filter(e => e.date === a.day), { day: true });
    body = `<div class="grid-2"><div class="card"><div class="set-row" style="padding-bottom:0">${monthNav('agenda', a.month)}<button class="btn sm ghost" data-a="go-today">Hoy</button></div>
      <div class="cal">${['L', 'M', 'M', 'J', 'V', 'S', 'D'].map(w => `<span class="wd">${w}</span>`).join('')}${cells}</div></div>
      ${section(esc(fmtDay(a.day)), dayRows.length ? listOf(dayRows) : `<div class="card empty"><span>Nada este día.</span><button class="btn sm ghost" data-a="new-item" data-date="${a.day}">${I.plus}Agregar</button></div>`, rel(a.day))}</div>`;
  }
  return `${head('Agenda', '', `<div class="seg" role="group" aria-label="Vista"><button aria-pressed="${a.mode === 'list'}" data-a="agenda-mode" data-id="list">Lista</button><button aria-pressed="${a.mode === 'month'}" data-a="agenda-mode" data-id="month">Mes</button></div>
    <button class="btn sm" data-a="new-item">${I.plus}Nuevo</button>`)}${captureBar()}${scopeChips(a.filter, 'agenda-filter')}${body}`;
}

// ---------- Notas ----------
function notesGrid() {
  const { q, filter } = ui.notes, k = norm(q);
  const list = all('notes').filter(n => (filter === 'all' || n.scope === filter) && (!k || norm(n.title + ' ' + n.body).includes(k)))
    .sort((a, b) => (b.pin ? 1 : 0) - (a.pin ? 1 : 0) || b.u - a.u);
  if (!list.length) return `<div class="card empty" style="grid-column:1/-1"><b>${q ? 'Sin resultados' : 'Todavía no hay notas'}</b><span>${q ? 'Prueba con otra palabra.' : 'Crea una con el botón Nueva o escribe “nota …” en el buscador.'}</span></div>`;
  return list.map(n => { const sc = n.scope ? scopeOf(n.scope) : null; return `<button class="card note" data-a="edit-note" data-id="${n.id}">
    <h3>${esc(n.title || 'Sin título')}</h3>${n.body ? `<p>${esc(n.body.slice(0, 260))}</p>` : ''}
    <span class="row-sub">${n.pin ? '<span class="pill">Fijada</span>' : ''}${sc ? `<span class="pill"><i class="dot" style="--c:var(--c-${sc.color})"></i>${esc(sc.name)}</span>` : ''}<span>${ago(n.u)}</span></span></button>`; }).join('');
}
function viewNotas() {
  return `${head('Notas', '', `<button class="btn sm" data-a="new-note">${I.plus}Nueva</button>`)}
    <div class="capture"><div class="capture-row">${I.search}<input id="note-q" type="search" placeholder="Buscar en tus notas" aria-label="Buscar en tus notas" value="${esc(ui.notes.q)}"></div></div>
    ${scopeChips(ui.notes.filter, 'notes-filter')}<div class="notes" id="notes-grid">${notesGrid()}</div>`;
}

// ---------- Dinero ----------
function billRow(b, month) {
  const pay = billPayment(b.id, month), now = ym(), day = new Date().getDate();
  const late = !pay && (month < now || (month === now && b.day && b.day < day));
  const sub = pay ? `Pagado el ${esc(fmtDay(pay.date))}` : b.day ? `${late ? 'Venció' : 'Vence'} el ${b.day}` : 'Sin vencimiento';
  return `<div class="row${pay ? ' done' : ''}${late ? ' late' : ''}">
    <button class="check sq" role="checkbox" aria-checked="${!!pay}" aria-label="Pagado: ${esc(b.name)}" data-a="toggle-bill" data-id="${b.id}" data-month="${month}">${I.check}</button>
    <button class="row-main" data-a="edit-bill" data-id="${b.id}"><span class="row-title">${esc(b.name)}</span><span class="row-sub ${late ? 'late-text' : ''}">${sub}</span></button>
    <span class="row-end num">${money(pay ? pay.amount : b.amount)}</span></div>`;
}
function viewDinero() {
  const m = ui.money.month, tot = monthTotals(m), bills = billsFor(m), mv = monthMoves(m);
  const paid = bills.filter(b => billPayment(b.id, m));
  const sorted = bills.slice().sort((a, b) => (billPayment(a.id, m) ? 1 : 0) - (billPayment(b.id, m) ? 1 : 0) || (a.day || 99) - (b.day || 99));
  const budget = data.settings.budget || 0;
  const cats = {};
  mv.filter(x => x.kind === 'out').forEach(x => { const n = catName(x.cat); cats[n] = (cats[n] || 0) + x.amount; });
  const catList = Object.entries(cats).sort((a, b) => b[1] - a[1]);
  const max = catList.length ? catList[0][1] : 1;
  const days = {};
  mv.slice().sort((a, b) => b.date.localeCompare(a.date) || b.u - a.u).forEach(x => (days[x.date] = days[x.date] || []).push(x));
  const moves = Object.entries(days).map(([d, list]) => section(esc(fmtDay(d)), listOf(list.map(x => `<button class="row" data-a="edit-move" data-id="${x.id}">
      <span class="row-main"><span class="row-title">${esc(x.desc || catName(x.cat))}</span><span class="row-sub">${esc(catName(x.cat))}${x.billId ? ' · Gasto fijo' : ''}</span></span>
      <span class="row-end num" style="${x.kind === 'in' ? 'color:var(--good)' : ''}">${x.kind === 'in' ? '+' : '−'}${money(x.amount)}</span></button>`)),
      money(list.reduce((s, x) => s + (x.kind === 'in' ? x.amount : -x.amount), 0)))).join('');
  const left = `
    ${section('Gastos fijos', bills.length ? `<div class="card pad" style="display:flex;flex-direction:column;gap:8px">
        <div class="sec-title"><b>${paid.length} de ${bills.length} pagados</b><span class="meta num">${tot.pendingSum ? `faltan ${money(tot.pendingSum)}` : 'todo al día'}</span></div>
        <div class="meter" role="img" aria-label="${paid.length} de ${bills.length} pagados"><i style="width:${(paid.length / bills.length) * 100}%"></i></div></div>${listOf(sorted.map(b => billRow(b, m)))}`
      : `<div class="card empty"><b>Tu lista de pagos del mes</b><span>Carga una vez alquiler, internet, cuota… Cada mes aparecen aquí y los tildas al pagar.</span></div>`,
      `<button class="link" data-a="new-bill">Agregar gasto fijo</button>`)}
    ${catList.length ? section('Gastos por categoría', `<div class="card pad hbars">${catList.map(([n, v]) => `<div class="hbar" data-tip="${esc(n)}: ${money(v)} · ${Math.round((v / tot.out) * 100)}% del gasto">
        <span>${esc(n)}</span><span class="val num">${money(v)}</span><div class="track"><i style="width:${(v / max) * 100}%"></i></div></div>`).join('')}</div>`) : ''}`;
  const right = `<div class="sec"><div class="sec-title"><h2>Movimientos</h2><span class="meta">${mv.length}</span></div>
      <div class="chips"><button class="btn sm" data-a="new-move" data-kind="out">${I.plus}Gasto</button><button class="btn sm ghost" data-a="new-move" data-kind="in">${I.plus}Ingreso</button></div></div>
    ${moves || `<div class="card empty"><span>Sin movimientos en ${esc(monthName(m))}. También puedes escribir “gasto 4500 almuerzo” en el buscador.</span></div>`}`;
  return `${head('Dinero', '', monthNav('money', m))}
    <div class="stats"><div class="stat good"><span>Ingresos</span><b class="num">${money(tot.inc)}</b></div>
      <div class="stat"><span>Gastos</span><b class="num">${money(tot.out)}</b></div>
      <div class="stat ${tot.balance < 0 ? 'bad' : ''}"><span>Balance</span><b class="num">${money(tot.balance)}</b></div></div>
    <div class="card pad" style="display:flex;flex-direction:column;gap:8px">
      <div class="sec-title"><span>Disponible después de los fijos pendientes</span><b class="num" style="${tot.balance - tot.pendingSum < 0 ? 'color:var(--bad)' : ''}">${money(tot.balance - tot.pendingSum)}</b></div>
      ${budget ? `<div class="meter${tot.out > budget ? ' over' : ''}" role="img" aria-label="Gastaste ${money(tot.out)} de ${money(budget)}"><i style="width:${Math.min(100, (tot.out / budget) * 100)}%"></i></div>
        <div class="sec-title"><span class="hint">${tot.out > budget ? `Te pasaste ${money(tot.out - budget)} del presupuesto` : `Te quedan ${money(budget - tot.out)} de ${money(budget)}`}</span><button class="link" data-a="edit-budget">Cambiar</button></div>`
      : `<button class="link" style="text-align:left" data-a="edit-budget">Definir un presupuesto mensual</button>`}</div>
    <div class="grid-2"><div class="stack">${left}</div><div class="stack">${right}</div></div>`;
}

// ---------- Estudio ----------
function viewEstudio() {
  const s = ui.study, t = T.timer(), today = ymd(), m = s.month;
  const presets = all('presets');
  if (!presets.some(p => p.id === s.preset)) s.preset = presets[0] && presets[0].id;
  const p = T.presetOf(t ? t.preset : s.preset);
  const idle = `<div class="chips" style="justify-content:center">${presets.map(x => `<button class="chip" aria-pressed="${x.id === s.preset}" data-a="pick-preset" data-id="${x.id}">${esc(x.name)} <span class="num">${x.focus}/${x.rest}</span></button>`).join('')}
      <button class="chip" data-a="new-preset">${I.plus.replace('<svg', '<svg width="14" height="14"')}Formato</button></div>
    <div class="phase">Listo para empezar</div><div class="clock" id="t-clock">${pad(p ? p.focus : 25)}:00</div>
    <p class="hint">${p ? `${p.focus} min de enfoque · ${p.rest} de descanso · descanso largo de ${p.long} cada ${p.every} ciclos` : ''} <button class="link" data-a="edit-preset" data-id="${p ? p.id : ''}">Editar</button></p>
    <select class="input" id="study-subject" aria-label="Materia">${options([['', 'Sin materia'], ...subjects().map(x => [x, x])], s.subject)}</select>
    <div class="actions"><button class="btn" data-a="t-start">Empezar</button><button class="btn ghost" data-a="new-session">Registrar a mano</button></div>`;
  const running = t ? `<div class="phase on" id="t-phase"></div><div class="clock" id="t-clock"></div>
    <div class="meter"><i id="t-bar" style="width:0"></i></div><p class="hint">${esc(p ? p.name : '')}${t.subject ? ' · ' + esc(t.subject) : ''}</p>
    <div class="actions"><button class="btn" data-a="t-toggle" id="t-toggle"></button><button class="btn ghost" data-a="t-skip">Saltar</button><button class="btn ghost" data-a="t-stop">Terminar</button></div>` : '';
  const last = new Date(+m.slice(0, 4), +m.slice(5), 0).getDate();
  const perDay = Array(last).fill(0), bySub = {};
  const sess = all('sessions').filter(x => x.date.slice(0, 7) === m).sort((a, b) => b.at - a.at);
  sess.forEach(x => { perDay[+x.date.slice(8) - 1] += x.min; const k = x.subject || 'Sin materia'; bySub[k] = (bySub[k] || 0) + x.min; });
  const total = perDay.reduce((a, b) => a + b, 0), top = Math.max(60, ...perDay), active = perDay.filter(Boolean).length;
  const subs = Object.entries(bySub).sort((a, b) => b[1] - a[1]);
  const streak = studyStreak();
  const chart = `<div class="card pad"><div class="bars-cap"><span>Minutos por día</span><span class="num">${dur(top)}</span></div>
    <div class="bars" role="img" aria-label="Minutos de estudio por día en ${esc(fmtMonth(m))}: ${dur(total)} en ${active} días">${perDay.map((v, i) =>
      `<div class="bar" data-tip="${i + 1} ${esc(monthName(m).slice(0, 3))}: ${v ? dur(v) : 'sin estudio'}"><i style="height:${(v / top) * 100}%"></i></div>`).join('')}</div>
    <div class="bars-x">${perDay.map((_, i) => `<span>${i === 0 || (i + 1) % 5 === 0 ? i + 1 : ''}</span>`).join('')}</div></div>`;
  return `${head('Estudio', streak > 1 ? `Racha de ${streak} días seguidos` : '', '')}
    <div class="grid-2"><div class="stack"><div class="card timer">${t ? running : idle}</div>
      <div class="stats"><div class="stat"><span>Hoy</span><b class="num">${dur(studyMinutes(today, today))}</b></div>
        <div class="stat"><span>Esta semana</span><b class="num">${dur(studyMinutes(weekStart(), today))}</b></div>
        <div class="stat"><span>${esc(cap1(monthName(ym())))}</span><b class="num">${dur(studyMinutes(ym() + '-01', ym() + '-31'))}</b></div></div></div>
    <div class="stack">${section('Registro del mes', chart, monthNav('study', m))}
      <div class="card pad sec-title"><span>Total de ${esc(monthName(m))}</span><b class="num">${dur(total)} · ${active} ${active === 1 ? 'día' : 'días'}</b></div>
      ${subs.length ? section('Por materia', `<div class="card pad hbars">${subs.map(([n, v]) => `<div class="hbar" data-tip="${esc(n)}: ${dur(v)} · ${Math.round((v / total) * 100)}% del mes">
        <span>${esc(n)}</span><span class="val num">${dur(v)}</span><div class="track"><i style="width:${(v / subs[0][1]) * 100}%"></i></div></div>`).join('')}</div>`) : ''}
      ${sess.length ? section('Sesiones', listOf(sess.slice(0, 30).map(x => `<button class="row" data-a="edit-session" data-id="${x.id}"><span class="row-main"><span class="row-title">${esc(x.subject || 'Sin materia')}</span>
        <span class="row-sub">${esc(fmtDay(x.date))}${x.preset ? ' · ' + esc(x.preset) : ''}</span></span><span class="row-end num">${dur(x.min)}</span></button>`)), `${sess.length}`) : ''}</div></div>`;
}
function paintTimer() {
  const t = T.timer();
  const mini = $('#mini-clock');
  if (mini && t) mini.textContent = clock(T.remaining());
  if (!t) { document.title = 'MiVida'; return; }
  const label = t.phase === 'focus' ? `Enfoque · ciclo ${t.cycle}` : t.phase === 'long' ? 'Descanso largo' : 'Descanso';
  document.title = `${clock(T.remaining())} · ${t.phase === 'focus' ? 'Enfoque' : 'Descanso'}`;
  if (!$('#t-phase')) return;
  $('#t-phase').textContent = t.running ? label : `${label} · en pausa`;
  $('#t-clock').textContent = clock(T.remaining());
  $('#t-bar').style.width = `${T.progress() * 100}%`;
  $('#t-toggle').textContent = t.running ? 'Pausar' : 'Continuar';
}

// ---------- Ajustes ----------
function viewAjustes() {
  const set = (title, sub, control) => `<div class="set-row"><div class="row-main"><span class="row-title">${title}</span>${sub ? `<span class="row-sub">${sub}</span>` : ''}</div>${control}</div>`;
  const perm = N.permission();
  const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  let google;
  if (DEMO) google = set('Google Calendar y sincronización', 'Disponible en la app publicada, no en esta vista previa.', '');
  else if (!G.clientId()) google = `<div class="set-row" style="flex-direction:column;align-items:stretch;gap:10px">
      <div class="row-main"><span class="row-title">Conectar Google (una sola vez)</span><span class="row-sub">Sincroniza la PC y el iPhone y envía tus fechas a Google Calendar.</span></div>
      <ol class="steps"><li>En Google Cloud Console crea un proyecto y activa <b>Google Calendar API</b> y <b>Google Drive API</b>.</li>
        <li>Configura la pantalla de consentimiento como <b>Externa</b>, en modo de prueba, y agrégate como usuario de prueba.</li>
        <li>Crea una credencial <b>ID de cliente de OAuth → Aplicación web</b> con esta dirección como origen y como URI de redireccionamiento:</li></ol>
      <div class="code">${esc(G.redirectUri())}</div>
      <form data-form="client-id" class="cols" style="grid-template-columns:1fr auto"><input class="input" name="id" placeholder="Pega aquí el ID de cliente" aria-label="ID de cliente de Google"><button class="btn">Guardar</button></form></div>`;
  else if (!G.linked()) google = set('Google', 'ID de cliente guardado. Falta dar permiso con tu cuenta.', `<div class="chips"><button class="btn sm" data-a="g-connect">Conectar</button><button class="btn sm ghost" data-a="g-forget">Cambiar ID</button></div>`);
  else google = set(G.connected() ? `Conectado${G.account() ? ' como ' + esc(G.account()) : ''}` : 'Permiso vencido',
    G.connected() ? esc(syncLabel()) : 'Google pide que confirmes el permiso. Reconecta con un toque.',
    `<div class="chips">${G.connected() ? '<button class="btn sm" data-a="g-sync">Sincronizar ahora</button>' : '<button class="btn sm" data-a="g-connect">Reconectar</button>'}<button class="btn sm ghost" data-a="g-disconnect">Desconectar</button></div>`) +
    set('Reconexión automática', 'El permiso de Google dura 1 hora. Al abrir la app se renueva solo, sin tocar nada.',
      `<select class="input" data-change="autoReconnect" aria-label="Reconexión automática">${options([['1', 'Sí'], ['0', 'No']], G.autoReconnect() ? '1' : '0')}</select>`);
  const tagList = (c, list, extra = () => '') => `<div class="list">${list.map(x => `<div class="set-row"><div class="row-main"><span class="row-title">${extra(x)}${esc(x.name)}</span></div>
      <div class="chips">${c === 'scopes' ? `<button class="btn sm ghost" data-a="edit-scope" data-id="${x.id}">Editar</button>` : `<button class="icon-btn" data-a="del-tag" data-c="${c}" data-id="${x.id}" aria-label="Eliminar ${esc(x.name)}">${I.x}</button>`}</div></div>`).join('')}
    <form class="set-row" data-form="add-tag" data-c="${c}"><input class="input" name="name" style="flex:1;min-height:38px" placeholder="Agregar…" aria-label="Nuevo nombre"><button class="btn sm">Agregar</button></form></div>`;
  return `${head('Ajustes', '')}
    <div class="grid-2"><div class="stack">
    ${section('Seguridad', `<div class="list">
      ${set('PIN', DEMO ? 'Desactivado en la vista previa.' : 'Se pide al abrir la app en este dispositivo.', DEMO ? '' : `<button class="btn sm ghost" data-a="change-pin">Cambiar</button>`)}
      ${DEMO ? '' : set(esc(lock.bioName()), bioOk ? 'Entra sin escribir el PIN.' : 'Este dispositivo o navegador no ofrece biometría.', bioOk ? `<button class="btn sm ${lock.bioEnabled() ? 'ghost' : ''}" data-a="bio-toggle">${lock.bioEnabled() ? 'Desactivar' : 'Activar'}</button>` : '')}
      ${set('Bloqueo automático', 'Al volver después de este tiempo fuera.', `<select class="input" data-change="autolock" aria-label="Bloqueo automático">${options([['0', 'Al salir'], ['1', '1 minuto'], ['5', '5 minutos'], ['15', '15 minutos']], String(device.autolock ?? 1))}</select>`)}</div>`)}
    ${section('Google', `<div class="list">${google}</div>`)}
    ${section('Avisos', `<div class="list">${set('Notificaciones de la app',
        perm === 'granted' ? 'Activadas. Suenan con la app abierta; con la app cerrada te avisa Google Calendar.' : perm === 'denied' ? 'Bloqueadas. Actívalas desde los ajustes del navegador o del iPhone.'
        : perm === 'unsupported' ? (lock.isIOS() && !standalone ? 'En iPhone se activan después de agregar la app a la pantalla de inicio.' : 'Este navegador no las admite.') : 'Para parciales, entregas y vencimientos.',
        perm === 'default' ? `<button class="btn sm" data-a="notify-on">Activar</button>` : '')}
      ${set('Pasar sola a la fase siguiente', 'En las sesiones de estudio.', `<select class="input" data-change="autoNext" aria-label="Pasar sola a la fase siguiente">${options([['1', 'Sí'], ['0', 'No']], data.settings.autoNext === false ? '0' : '1')}</select>`)}
      ${set('Sonido al terminar una fase', '', `<select class="input" data-change="sound" aria-label="Sonido al terminar una fase">${options([['1', 'Sí'], ['0', 'No']], data.settings.sound === false ? '0' : '1')}</select>`)}</div>`)}
    ${section('Apariencia y moneda', `<div class="list">
      ${set('Tema', '', `<select class="input" data-change="theme" aria-label="Tema">${options([['auto', 'Automático'], ['light', 'Claro'], ['dark', 'Oscuro']], data.settings.theme)}</select>`)}
      ${set('Moneda', '', `<select class="input" data-change="currency" aria-label="Moneda">${options([['ARS', 'Peso argentino'], ['USD', 'Dólar'], ['COP', 'Peso colombiano'], ['EUR', 'Euro'], ['UYU', 'Peso uruguayo'], ['CLP', 'Peso chileno'], ['MXN', 'Peso mexicano']], data.settings.currency)}</select>`)}</div>`)}
    ${lock.isIOS() && !standalone ? section('Instalar en el iPhone', `<div class="card pad"><ol class="steps"><li>Abre esta página en Safari.</li><li>Toca Compartir y elige <b>Agregar a inicio</b>.</li><li>Abre MiVida desde el ícono: ahí funcionan Face ID y las notificaciones.</li></ol></div>`) : ''}
    ${section('Tus datos', `<div class="list">
      ${set('Copia de seguridad', 'Un archivo con todo lo que cargaste.', `<div class="chips"><button class="btn sm ghost" data-a="export">Exportar</button><label class="btn sm ghost">Importar<input type="file" accept="application/json,.json" data-change="import" hidden></label></div>`)}
      ${set('Borrar todo', 'Elimina los datos de este dispositivo.', `<button class="btn sm danger" data-a="wipe">Borrar</button>`)}</div>`)}
    </div><div class="stack">
    ${section('Ámbitos', tagList('scopes', all('scopes'), x => `<i class="dot" style="--c:var(--c-${x.color});display:inline-block;margin-right:8px"></i>`))}
    ${section('Materias', tagList('subjects', all('subjects').slice().sort((a, b) => a.name.localeCompare(b.name, 'es'))))}
    ${section('Categorías de gastos', tagList('cats-out', all('cats').filter(c => c.kind === 'out')))}
    ${section('Categorías de ingresos', tagList('cats-in', all('cats').filter(c => c.kind === 'in')))}
    </div></div>`;
}
let bioOk = false;
const VIEWS = { hoy: viewHoy, agenda: viewAgenda, notas: viewNotas, dinero: viewDinero, estudio: viewEstudio, ajustes: viewAjustes };

// ---------- hojas (formularios) ----------
function openSheet(title, body, { tall = false } = {}) {
  sheetEl.innerHTML = `<div class="sheet${tall ? ' tall' : ''}" role="dialog" aria-modal="true" aria-label="${esc(title)}">
    <div class="sheet-head"><h2>${esc(title)}</h2><button class="icon-btn" data-a="close-sheet" aria-label="Cerrar">${I.x}</button></div>${body}</div>`;
  sheetEl.hidden = false;
  const first = sheetEl.querySelector('[autofocus]');
  if (first && matchMedia('(min-width: 640px)').matches) first.focus();
}
function closeSheet() { sheetEl.hidden = true; sheetEl.innerHTML = ''; }
sheetEl.addEventListener('mousedown', e => { if (e.target === sheetEl) closeSheet(); });
const field = (label, control) => `<label class="field"><span>${label}</span>${control}</label>`;
const foot = (id, del, save = 'Guardar') => `<div class="sheet-foot">${id ? `<button type="button" class="btn danger" data-a="${del}" data-id="${id}">Eliminar</button>` : '<span></span>'}<button class="btn">${save}</button></div>`;
function confirmSheet(title, text, label, fn) {
  openSheet(title, `<p style="color:var(--ink-2)">${esc(text)}</p><div class="sheet-foot"><button class="btn ghost" data-a="close-sheet">Cancelar</button><button class="btn danger" id="confirm-ok">${esc(label)}</button></div>`);
  $('#confirm-ok').onclick = () => { closeSheet(); fn(); };
}

const defaultRem = (type, time) => (time ? typeOf(type).rem : [...new Set([...typeOf(type).rem.filter(m => m >= 1440), 0])]);
function openItem(id, preset = {}) {
  const it = id ? get('items', id) : { type: 'tarea', scope: ui.agenda.filter !== 'all' ? ui.agenda.filter : 'personal', date: '', time: '', rem: null, cal: true, ...preset };
  if (!it) return;
  const rem = it.rem || defaultRem(it.type, it.time);
  openSheet(id ? 'Editar' : 'Nuevo', `<form data-form="item"><input type="hidden" name="id" value="${esc(it.id || '')}">
    ${field('Título', `<input class="input" name="title" value="${esc(it.title || '')}" placeholder="Física II" required autofocus>`)}
    <div class="cols">${field('Tipo', `<select class="input" name="type">${options(TYPES.map(t => [t.id, t.label]), it.type)}</select>`)}
      ${field('Ámbito', `<select class="input" name="scope">${options(all('scopes').map(s => [s.id, s.name]), scopeOf(it.scope).id)}</select>`)}</div>
    ${field('Materia (opcional)', `<input class="input" name="subject" list="dl-subjects" value="${esc(it.subject || '')}"><datalist id="dl-subjects">${subjects().map(s => `<option value="${esc(s)}">`).join('')}</datalist>`)}
    <div class="cols">${field('Fecha', `<input class="input" type="date" name="date" value="${esc(it.date || '')}">`)}${field('Hora', `<input class="input" type="time" name="time" value="${esc(it.time || '')}">`)}</div>
    <div class="field"><span>Avisarme</span><div class="chips">${REMINDERS.map(r => `<label class="chip"><input type="checkbox" name="rem" value="${r.m}"${rem.includes(r.m) ? ' checked' : ''} hidden>${r.label}</label>`).join('')}</div>
      <span class="hint">Sin hora, los avisos toman las 9:00 como referencia.</span></div>
    ${field('Notas', `<textarea class="input" name="notes" placeholder="Temas, aula, enlace…">${esc(it.notes || '')}</textarea>`)}
    ${DEMO ? '' : G.linked() ? `<label class="chip" style="align-self:flex-start"><input type="checkbox" name="cal"${it.cal !== false ? ' checked' : ''} hidden>Enviar a Google Calendar</label>`
      : (id && it.date ? `<a class="link" target="_blank" rel="noopener" href="${esc(G.calendarLink(it))}">Añadir a Google Calendar</a>` : '')}
    ${foot(it.id, 'del-item')}</form>`);
}
function openNote(id) {
  const n = id ? get('notes', id) : { title: '', body: '', scope: ui.notes.filter !== 'all' ? ui.notes.filter : '', pin: false };
  if (!n) return;
  openSheet(id ? 'Nota' : 'Nueva nota', `<form data-form="note"><input type="hidden" name="id" value="${esc(n.id || '')}">
    <input class="input title-input" name="title" value="${esc(n.title)}" placeholder="Título" aria-label="Título"${id ? '' : ' autofocus'}>
    <textarea class="input" name="body" placeholder="Escribe aquí…" aria-label="Contenido">${esc(n.body)}</textarea>
    <div class="cols"><select class="input" name="scope" aria-label="Ámbito">${options([['', 'Sin ámbito'], ...all('scopes').map(s => [s.id, s.name])], n.scope || '')}</select>
      <label class="chip" style="justify-content:center;min-height:44px"><input type="checkbox" name="pin"${n.pin ? ' checked' : ''} hidden>Fijar arriba</label></div>
    ${foot(n.id, 'del-note', 'Listo')}</form>`, { tall: true });
}
function openMove(id, kind = 'out') {
  const m = id ? get('moves', id) : { kind, amount: '', cat: '', date: ui.money.month === ym() ? ymd() : ui.money.month + '-01', desc: '' };
  if (!m) return;
  openSheet(id ? 'Movimiento' : m.kind === 'in' ? 'Nuevo ingreso' : 'Nuevo gasto', `<form data-form="move"><input type="hidden" name="id" value="${esc(m.id || '')}">
    <div class="seg" role="group" aria-label="Tipo" style="align-self:flex-start"><label><input type="radio" name="kind" value="out"${m.kind === 'out' ? ' checked' : ''} hidden><span>Gasto</span></label><label><input type="radio" name="kind" value="in"${m.kind === 'in' ? ' checked' : ''} hidden><span>Ingreso</span></label></div>
    ${field('Monto', `<input class="input num" name="amount" inputmode="decimal" value="${m.amount === '' ? '' : String(m.amount).replace('.', ',')}" placeholder="0" required autofocus>`)}
    <div class="cols">${field('Categoría', `<select class="input" name="cat" id="move-cat">${options(all('cats').filter(c => c.kind === m.kind).map(c => [c.id, c.name]), m.cat)}</select>`)}
      ${field('Fecha', `<input class="input" type="date" name="date" value="${esc(m.date)}" required>`)}</div>
    ${field('Descripción', `<input class="input" name="desc" value="${esc(m.desc || '')}" placeholder="Almuerzo, apuntes…">`)}
    ${foot(m.id, 'del-move')}</form>`);
}
function openBill(id) {
  const b = id ? get('bills', id) : { name: '', amount: '', day: '', cat: '' };
  if (!b) return;
  openSheet(id ? 'Gasto fijo' : 'Nuevo gasto fijo', `<form data-form="bill"><input type="hidden" name="id" value="${esc(b.id || '')}">
    ${field('Nombre', `<input class="input" name="name" value="${esc(b.name)}" placeholder="Alquiler, internet, cuota…" required autofocus>`)}
    <div class="cols">${field('Monto mensual', `<input class="input num" name="amount" inputmode="decimal" value="${b.amount === '' ? '' : String(b.amount).replace('.', ',')}" required>`)}
      ${field('Día de vencimiento', `<input class="input num" name="day" type="number" min="1" max="31" value="${esc(b.day || '')}" placeholder="10">`)}</div>
    ${field('Categoría', `<select class="input" name="cat">${options(all('cats').filter(c => c.kind === 'out').map(c => [c.id, c.name]), b.cat)}</select>`)}
    <p class="hint">Aparece todos los meses en tu lista. Al tildarlo se anota solo como gasto de ese mes.</p>${foot(b.id, 'del-bill')}</form>`);
}
function openPreset(id) {
  const p = id ? get('presets', id) : { name: '', focus: 45, rest: 10, long: 20, every: 3 };
  if (!p) return;
  const numf = (l, n, v, max) => field(l, `<input class="input num" type="number" name="${n}" min="1" max="${max}" value="${v}" required>`);
  openSheet(id ? 'Formato de sesión' : 'Nuevo formato', `<form data-form="preset"><input type="hidden" name="id" value="${esc(p.id || '')}">
    ${field('Nombre', `<input class="input" name="name" value="${esc(p.name)}" placeholder="Repaso, Lectura…" required autofocus>`)}
    <div class="cols">${numf('Enfoque (min)', 'focus', p.focus, 240)}${numf('Descanso (min)', 'rest', p.rest, 120)}</div>
    <div class="cols">${numf('Descanso largo (min)', 'long', p.long, 180)}${numf('Cada cuántos ciclos', 'every', p.every, 12)}</div>
    ${foot(all('presets').length > 1 ? p.id : '', 'del-preset')}</form>`);
}
function openSession(id) {
  const s = id ? get('sessions', id) : { date: ymd(), min: 30, subject: ui.study.subject };
  if (!s) return;
  openSheet(id ? 'Sesión' : 'Registrar sesión', `<form data-form="session"><input type="hidden" name="id" value="${esc(s.id || '')}">
    <div class="cols">${field('Fecha', `<input class="input" type="date" name="date" value="${esc(s.date)}" max="${ymd()}" required>`)}
      ${field('Minutos', `<input class="input num" type="number" name="min" min="1" max="900" value="${s.min}" required autofocus>`)}</div>
    ${field('Materia', `<select class="input" name="subject">${options([['', 'Sin materia'], ...subjects().map(x => [x, x])], s.subject || '')}</select>`)}
    ${foot(s.id, 'del-session')}</form>`);
}
function openScope(id) {
  const s = id ? get('scopes', id) : { name: '', color: COLORS.find(c => !all('scopes').some(x => x.color === c)) || 'blue' };
  if (!s) return;
  const names = { blue: 'Azul', orange: 'Naranja', aqua: 'Verde agua', yellow: 'Amarillo', magenta: 'Rosa', green: 'Verde', violet: 'Violeta', red: 'Rojo' };
  openSheet(id ? 'Ámbito' : 'Nuevo ámbito', `<form data-form="scope"><input type="hidden" name="id" value="${esc(s.id || '')}">
    ${field('Nombre', `<input class="input" name="name" value="${esc(s.name)}" required autofocus>`)}
    <div class="field"><span>Color</span><div class="swatches">${COLORS.map(c => `<input type="radio" name="color" id="sw-${c}" value="${c}"${c === s.color ? ' checked' : ''}><label for="sw-${c}" style="--c:var(--c-${c})" title="${names[c]}"><span hidden>${names[c]}</span></label>`).join('')}</div></div>
    ${foot(all('scopes').length > 1 ? s.id : '', 'del-scope')}</form>`);
}

// ---------- buscador ----------
const ctx = () => ({ scopes: all('scopes'), subjects: all('subjects').map(s => s.name), cats: all('cats') });
function paintPreview() {
  const inp = $('#capture'), box = $('#capture-preview');
  if (!inp || !box) return;
  const p = parseCapture(inp.value, ctx());
  if (!p) { box.innerHTML = ''; return; }
  const sep = '<span class="sep">·</span>';
  let parts;
  if (p.kind === 'item') {
    const sc = scopeOf(p.scope);
    parts = [`<span class="pill"><i class="dot" style="--c:var(--c-${sc.color})"></i>${esc(typeOf(p.type).label)}</span>`, `<b>${esc(p.title || typeOf(p.type).label)}</b>`,
      p.date ? `${esc(fmtDay(p.date))} (${rel(p.date).toLowerCase()})` : 'sin fecha', p.time, esc(sc.name)];
  } else if (p.kind === 'move') {
    parts = [`<span class="pill">${p.move === 'in' ? 'Ingreso' : 'Gasto'}</span>`, `<b class="num">${money(p.amount)}</b>`, esc(p.desc), esc(catName(p.cat)), esc(fmtDay(p.date))];
  } else parts = ['<span class="pill">Nota</span>', `<b>${esc(p.title)}</b>`, p.scope ? esc(scopeOf(p.scope).name) : ''];
  box.innerHTML = parts.filter(Boolean).join(sep) + `<span style="margin-left:auto" class="kbd only-wide">Enter</span>`;
}
function addCapture(text) {
  const p = parseCapture(text, ctx());
  if (!p) return;
  if (p.kind === 'item') {
    const subject = p.subject ? ensureSubject(p.subject) : '';
    const rec = put('items', { title: p.title || typeOf(p.type).label, type: p.type, scope: p.scope, subject, date: p.date, time: p.time, rem: p.date ? defaultRem(p.type, p.time) : [], notes: '', done: false, cal: true });
    toast(`Agregado: ${G.itemLabel(rec)}${p.date ? ' · ' + fmtDay(p.date) : ''}`, 'Editar', () => openItem(rec.id));
  } else if (p.kind === 'move') {
    const rec = put('moves', { kind: p.move, amount: p.amount, cat: p.cat, date: p.date, desc: p.desc });
    toast(`${p.move === 'in' ? 'Ingreso' : 'Gasto'} anotado: ${money(p.amount)}`, 'Editar', () => openMove(rec.id));
  } else {
    const rec = put('notes', { title: p.title, body: p.body, scope: p.scope || '', pin: false });
    toast('Nota guardada', 'Abrir', () => openNote(rec.id));
  }
}

// ---------- acciones ----------
function undoable(c, id, msg) {
  const copy = { ...get(c, id) };
  remove(c, id);
  closeSheet();
  toast(msg, 'Deshacer', () => put(c, copy));
}
const A = {
  'close-sheet': closeSheet,
  'new-item': el => openItem(null, el.dataset.date ? { date: el.dataset.date } : {}),
  'edit-item': el => openItem(el.dataset.id),
  'toggle-item': el => { const it = get('items', el.dataset.id); if (it) { it.done = !it.done; it.doneAt = it.done ? Date.now() : 0; put('items', it); } },
  'del-item': el => undoable('items', el.dataset.id, 'Eliminado'),
  'agenda-filter': el => { ui.agenda.filter = el.dataset.id; render(); },
  'agenda-mode': el => { ui.agenda.mode = el.dataset.id; render(); },
  'toggle-done': () => { ui.agenda.done = !ui.agenda.done; render(); },
  'pick-day': el => { ui.agenda.day = el.dataset.id; if (el.dataset.id.slice(0, 7) !== ui.agenda.month) ui.agenda.month = el.dataset.id.slice(0, 7); render(); },
  'go-today': () => { ui.agenda.day = ymd(); ui.agenda.month = ym(); render(); },
  month: el => { const k = el.dataset.key; ui[k].month = shiftMonth(ui[k].month, +el.dataset.n); render(); },
  'new-note': () => openNote(), 'edit-note': el => openNote(el.dataset.id),
  'del-note': el => undoable('notes', el.dataset.id, 'Nota eliminada'),
  'notes-filter': el => { ui.notes.filter = el.dataset.id; render(); },
  'new-move': el => openMove(null, el.dataset.kind), 'edit-move': el => openMove(el.dataset.id),
  'del-move': el => undoable('moves', el.dataset.id, 'Movimiento eliminado'),
  'new-bill': () => openBill(), 'edit-bill': el => openBill(el.dataset.id),
  'del-bill': el => confirmSheet('Eliminar gasto fijo', 'Deja de aparecer en tu lista mensual. Los pagos que ya anotaste se conservan.', 'Eliminar', () => remove('bills', el.dataset.id)),
  'toggle-bill': el => {
    const b = get('bills', el.dataset.id), month = el.dataset.month, pay = billPayment(el.dataset.id, month);
    if (pay) return remove('moves', pay.id);
    const date = month === ym() ? ymd() : `${month}-${pad(Math.min(b.day || 1, 28))}`;
    put('moves', { kind: 'out', amount: b.amount, cat: b.cat, date, desc: b.name, billId: b.id, month });
    toast(`${b.name} pagado · ${money(b.amount)}`, 'Cambiar monto', () => openMove(billPayment(b.id, month).id));
  },
  'edit-budget': () => openSheet('Presupuesto mensual', `<form data-form="budget">${field('Tope de gastos por mes', `<input class="input num" name="budget" inputmode="decimal" value="${data.settings.budget || ''}" placeholder="0 para quitarlo" autofocus>`)}
    <div class="sheet-foot"><span></span><button class="btn">Guardar</button></div></form>`),
  'pick-preset': el => { ui.study.preset = el.dataset.id; render(); },
  'new-preset': () => openPreset(), 'edit-preset': el => openPreset(el.dataset.id),
  'del-preset': el => { remove('presets', el.dataset.id); closeSheet(); },
  'new-session': () => openSession(), 'edit-session': el => openSession(el.dataset.id),
  'del-session': el => undoable('sessions', el.dataset.id, 'Sesión eliminada'),
  't-start': () => { ui.study.subject = $('#study-subject').value; T.start(ui.study.preset, ui.study.subject); audio(); keepAwake(); render(); },
  't-toggle': () => { T.timer().running ? T.pause() : T.resume(); audio(); keepAwake(); render(); },
  't-skip': () => { T.skip(); render(); },
  't-stop': () => { const s = T.stop(); keepAwake(); if (s) toast(`Sesión guardada: ${dur(s.min)}`); render(); },
  'edit-scope': el => openScope(el.dataset.id),
  'del-scope': el => { remove('scopes', el.dataset.id); closeSheet(); },
  'del-tag': el => remove(el.dataset.c.startsWith('cats') ? 'cats' : el.dataset.c, el.dataset.id),
  'change-pin': () => showLock('create', () => { toast('PIN actualizado'); }),
  'bio-toggle': async () => {
    if (lock.bioEnabled()) lock.bioDisable();
    else { try { await lock.bioRegister(); toast(`${lock.bioName()} activado`); } catch { toast('No se pudo activar. Inténtalo de nuevo.'); } }
    render();
  },
  'notify-on': async () => { const r = await N.ask(); if (r === 'granted') N.show('MiVida', 'Los avisos quedaron activados.', 'hello'); render(); },
  'g-connect': () => { if (!G.connect()) location.hash = '#ajustes'; },
  'g-sync': async () => { const r = await G.sync(); if (r.ok) toast('Sincronizado'); },
  'g-disconnect': () => confirmSheet('Desconectar Google', 'La app sigue funcionando con los datos de este dispositivo. Los eventos ya creados quedan en tu calendario.', 'Desconectar', async () => { await G.disconnect(); render(); }),
  'g-forget': () => { device.clientId = ''; saveDevice(); if (window.MIVIDA_CONFIG) window.MIVIDA_CONFIG.googleClientId = ''; render(); },
  export: () => {
    const url = URL.createObjectURL(new Blob([snapshot()], { type: 'application/json' }));
    const a = Object.assign(document.createElement('a'), { href: url, download: `mivida-${ymd()}.json` });
    document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 2000);
  },
  wipe: () => confirmSheet('Borrar todo', 'Se eliminan agenda, notas, dinero y estudio de este dispositivo. Si Google está conectado, desconéctalo antes para no borrar también la copia.', 'Borrar todo', () => { wipe(); toast('Datos borrados'); }),
};
document.addEventListener('click', e => {
  if (!lockEl.hidden) return;
  const el = e.target.closest('[data-a]');
  if (el && A[el.dataset.a]) { if (el.tagName !== 'A') e.preventDefault(); A[el.dataset.a](el); }
});

const amountOf = v => { const n = parseAmount(v); return Number.isFinite(n) && n >= 0 ? n : null; };
const F = {
  capture: (f) => { const inp = $('#capture'); if (!inp.value.trim()) return; addCapture(inp.value); const again = $('#capture'); if (again) { again.value = ''; paintPreview(); again.focus(); } },
  item: (f, d) => {
    const it = d.id ? get('items', d.id) : {};
    const rem = [...f.querySelectorAll('[name=rem]:checked')].map(x => +x.value);
    Object.assign(it, { title: d.title.trim(), type: d.type, scope: d.scope, subject: d.subject ? ensureSubject(d.subject) : '', date: d.date, time: d.date ? d.time : '', rem: d.date ? rem : [], notes: d.notes.trim() });
    if (f.querySelector('[name=cal]')) it.cal = !!d.cal;
    put('items', it); closeSheet();
  },
  note: (f, d) => {
    if (!d.title.trim() && !d.body.trim()) return closeSheet();
    const n = d.id ? get('notes', d.id) : {};
    put('notes', Object.assign(n, { title: d.title.trim() || d.body.trim().split('\n')[0].slice(0, 60), body: d.body, scope: d.scope, pin: !!d.pin })); closeSheet();
  },
  move: (f, d) => {
    const amount = amountOf(d.amount);
    if (!amount) return toast('Escribe un monto válido, por ejemplo 4500 o 4.500,50');
    const m = d.id ? get('moves', d.id) : {};
    put('moves', Object.assign(m, { kind: d.kind, amount, cat: d.cat, date: d.date, desc: d.desc.trim() })); closeSheet();
  },
  bill: (f, d) => {
    const amount = amountOf(d.amount);
    if (!amount) return toast('Escribe un monto válido');
    const b = d.id ? get('bills', d.id) : { from: ui.money.month, active: true };
    put('bills', Object.assign(b, { name: d.name.trim(), amount, day: Math.min(31, Math.max(0, +d.day || 0)), cat: d.cat })); closeSheet();
  },
  budget: (f, d) => { setSettings({ budget: amountOf(d.budget || '0') || 0 }); closeSheet(); },
  preset: (f, d) => {
    const p = d.id ? get('presets', d.id) : {};
    const rec = put('presets', Object.assign(p, { name: d.name.trim(), focus: +d.focus, rest: +d.rest, long: +d.long, every: +d.every }));
    ui.study.preset = rec.id; closeSheet(); render();
  },
  session: (f, d) => {
    const s = d.id ? get('sessions', d.id) : { at: parseYmd(d.date).getTime() + 12 * 3600e3, preset: 'A mano' };
    put('sessions', Object.assign(s, { date: d.date, min: +d.min, subject: d.subject })); closeSheet();
  },
  scope: (f, d) => { const s = d.id ? get('scopes', d.id) : {}; put('scopes', Object.assign(s, { name: d.name.trim(), color: d.color || 'blue' })); closeSheet(); },
  'add-tag': (f, d) => {
    const name = d.name.trim(), c = f.dataset.c;
    if (!name) return;
    if (c === 'scopes') put('scopes', { name, color: COLORS.find(x => !all('scopes').some(s => s.color === x)) || 'blue' });
    else if (c === 'subjects') ensureSubject(name);
    else put('cats', { name, kind: c === 'cats-in' ? 'in' : 'out' });
  },
  'client-id': (f, d) => { device.clientId = d.id.trim(); saveDevice(); render(); },
};
document.addEventListener('submit', e => {
  const f = e.target.closest('[data-form]');
  if (!f) return;
  e.preventDefault();
  F[f.dataset.form](f, Object.fromEntries(new FormData(f)));
});
document.addEventListener('input', e => {
  if (e.target.id === 'capture') paintPreview();
  else if (e.target.id === 'note-q') { ui.notes.q = e.target.value; $('#notes-grid').innerHTML = notesGrid(); }
});
document.addEventListener('change', async e => {
  const el = e.target, k = el.dataset.change;
  if (el.name === 'kind' && $('#move-cat')) $('#move-cat').innerHTML = options(all('cats').filter(c => c.kind === el.value).map(c => [c.id, c.name]), '');
  if (el.id === 'study-subject') ui.study.subject = el.value;
  if (!k) return;
  if (k === 'autolock') { device.autolock = +el.value; saveDevice(); }
  else if (k === 'autoReconnect') { device.autoReconnect = el.value === '1'; device.silentFail = 0; saveDevice(); }
  else if (k === 'theme') { setSettings({ theme: el.value }); applyTheme(); }
  else if (k === 'currency') setSettings({ currency: el.value });
  else if (k === 'autoNext' || k === 'sound') setSettings({ [k]: el.value === '1' });
  else if (k === 'import' && el.files[0]) {
    try { replaceData(merge(data, JSON.parse(await el.files[0].text())), 'local'); toast('Copia importada'); }
    catch { toast('Ese archivo no es una copia de MiVida'); }
  }
});
// Información al pasar el cursor o tocar una barra de un gráfico
const showTip = el => { const r = el.getBoundingClientRect(); tipEl.textContent = el.dataset.tip; tipEl.hidden = false;
  tipEl.style.left = `${Math.min(innerWidth - 90, Math.max(90, r.left + r.width / 2))}px`; tipEl.style.top = `${r.top - 6}px`; };
document.addEventListener('pointerover', e => { const el = e.target.closest('[data-tip]'); if (el) showTip(el); else tipEl.hidden = true; });
viewEl.addEventListener('scroll', () => { tipEl.hidden = true; }, { passive: true });

function applyTheme() {
  const t = data.settings.theme;
  if (t === 'light' || t === 'dark') document.documentElement.dataset.theme = t;
  else if (!DEMO) delete document.documentElement.dataset.theme; // en la vista previa manda el tema del visor
}

// ---------- temporizador, avisos, sincronización ----------
let actx = null;
function audio() { try { actx = actx || new (window.AudioContext || window.webkitAudioContext)(); if (actx.state === 'suspended') actx.resume(); } catch { /* sin audio */ } }
function beep() {
  if (data.settings.sound === false || !actx) return;
  try { [0, 0.22, 0.44].forEach((d, i) => { const o = actx.createOscillator(), g = actx.createGain(); o.frequency.value = i === 2 ? 880 : 660; o.connect(g); g.connect(actx.destination);
    g.gain.setValueAtTime(0.0001, actx.currentTime + d); g.gain.exponentialRampToValueAtTime(0.25, actx.currentTime + d + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, actx.currentTime + d + 0.18);
    o.start(actx.currentTime + d); o.stop(actx.currentTime + d + 0.2); }); } catch { /* sin audio */ }
}
let wake = null;
async function keepAwake() { // pantalla encendida mientras corre una fase
  const t = T.timer();
  try {
    if (t && t.running && !document.hidden) { if (!wake && navigator.wakeLock) { wake = await navigator.wakeLock.request('screen'); wake.addEventListener('release', () => { wake = null; }); } }
    else if (wake) { await wake.release(); wake = null; }
  } catch { wake = null; }
}
function tickTimer() {
  const r = T.tick();
  if (r) {
    const msg = r.ended === 'focus' ? '¡Enfoque completado! Toca descansar.' : 'Terminó el descanso. A enfocarse.';
    beep(); toast(msg); N.show('MiVida · Estudio', msg, 'timer'); keepAwake();
    if (!locked) render();
  }
  if (!locked) paintTimer();
}
function checkReminders() {
  if (locked) return;
  for (const r of N.due()) { toast(`${r.title} · ${r.body}`, r.id ? 'Ver' : 'Pagos', () => (r.id ? openItem(r.id) : (location.hash = '#dinero')), 9000); N.show(r.title, r.body, r.key); }
}
let syncTimer = null;
onChange(src => {
  if (!locked) render();
  if (src === 'local') { clearTimeout(syncTimer); syncTimer = setTimeout(() => G.sync(), 2500); }
});
G.onState(() => { if (!locked) render(); });

function afterUnlock() {
  checkReminders();
  G.sync();
  lock.bioAvailable().then(ok => { bioOk = ok; if (route() === 'ajustes') render(); });
}

// ---------- arranque ----------
async function boot() {
  applyTheme();
  const back = G.handleRedirect();
  if ('serviceWorker' in navigator && !DEMO && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
  if (navigator.storage && navigator.storage.persist && !DEMO) navigator.storage.persist().catch(() => {}); // pide al navegador no borrar los datos
  setInterval(tickTimer, 500);
  setInterval(checkReminders, 30000);
  setInterval(() => { if (!locked && !document.hidden) G.sync(); }, 5 * 60000);
  window.addEventListener('online', () => G.sync());
  // Permiso de Google vencido: se renueva antes de pedir el PIN, así se desbloquea una sola vez.
  if (!back && lock.hasPin() && G.shouldSilent() && G.connect({ silent: true })) return;
  const resume = back && back.ok && back.silent && lock.hasPin() && (device.resumeUntil || 0) > Date.now();
  if (device.resumeUntil) { device.resumeUntil = 0; saveDevice(); }
  if (DEMO) {
    const { seed } = await import('./demo.js');
    if (!all('items').length && !all('moves').length) seed();
    unlock();
  } else if (!lock.hasPin()) showLock('create');
  else if (resume) unlock();
  else showLock('unlock');
  if (back && !back.silent) setTimeout(() => toast(back.ok ? 'Google conectado' : `No se pudo conectar: ${back.error}`), 400);
}
boot();
