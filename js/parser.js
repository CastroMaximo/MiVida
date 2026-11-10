// Buscador inteligente: convierte una línea escrita a mano en un registro.
//   "Parcial Física 15 nov 14:00"   -> parcial de Física, Universidad
//   "Turno dentista viernes 10hs"   -> turno, Salud
//   "gasto 4500 almuerzo"           -> gasto en Comida
//   "nota ideas para el TP"         -> nota
// Es una función pura: recibe el texto y el contexto, no toca nada más.

const strip = s => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const pad = n => String(n).padStart(2, '0');
const ymd = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

const MONTHS = { ene: 0, enero: 0, feb: 1, febrero: 1, mar: 2, marzo: 2, abr: 3, abril: 3, may: 4, mayo: 4, jun: 5, junio: 5,
  jul: 6, julio: 6, ago: 7, agosto: 7, sep: 8, sept: 8, set: 8, septiembre: 8, setiembre: 8, oct: 9, octubre: 9,
  nov: 10, noviembre: 10, dic: 11, diciembre: 11 };
const WEEKDAYS = { domingo: 0, lunes: 1, martes: 2, miercoles: 3, jueves: 4, viernes: 5, sabado: 6 };
const MONTH_RE = Object.keys(MONTHS).sort((a, b) => b.length - a.length).join('|');
const WD_RE = Object.keys(WEEKDAYS).join('|');

// palabra clave -> tipo. El orden importa: las frases largas primero.
const TYPE_WORDS = [
  ['trabajo practico', 'practica'], ['parcialito', 'parcial'], ['parcial', 'parcial'], ['examen final', 'final'],
  ['final', 'final'], ['recuperatorio', 'recuperatorio'], ['recu', 'recuperatorio'], ['examen', 'parcial'],
  ['quiz', 'parcial'], ['practica', 'practica'], ['practico', 'practica'], ['laboratorio', 'practica'],
  ['lab', 'practica'], ['tp', 'practica'], ['exposicion', 'exposicion'], ['expo', 'exposicion'],
  ['presentacion', 'presentacion'], ['entrega', 'entrega'], ['entregar', 'entrega'], ['clase', 'clase'],
  ['tarea', 'tarea'], ['reunion', 'reunion'], ['meet', 'reunion'], ['turno', 'turno'], ['cita', 'turno'],
  ['cumpleanos', 'cumple'], ['cumple', 'cumple'], ['pagar', 'pago'], ['pago', 'pago'], ['vence', 'pago'],
  ['evento', 'evento'], ['recordatorio', 'recordatorio'], ['recordar', 'recordatorio'],
];
// Si se quita la palabra clave del título o se deja (p. ej. "Pagar alquiler" se lee mejor entero).
const KEEP_WORD = new Set(['pagar', 'vence', 'entregar', 'recordar', 'cumple', 'cumpleanos']);

const CAT_HINTS = {
  comida: ['almuerzo', 'cena', 'desayuno', 'comida', 'super', 'supermercado', 'verduleria', 'cafe', 'delivery', 'pedidosya', 'rappi', 'kiosco', 'merienda', 'pizza'],
  transporte: ['sube', 'colectivo', 'bondi', 'subte', 'taxi', 'uber', 'cabify', 'nafta', 'tren', 'peaje', 'pasaje'],
  alquiler: ['alquiler', 'expensas'],
  servicios: ['luz', 'gas', 'agua', 'internet', 'wifi', 'celular', 'telefono', 'spotify', 'netflix', 'suscripcion'],
  estudio: ['apunte', 'apuntes', 'fotocopia', 'fotocopias', 'libro', 'cuota', 'matricula', 'curso', 'facultad'],
  salud: ['farmacia', 'medico', 'remedio', 'remedios', 'dentista', 'obra social', 'prepaga', 'gimnasio', 'gym'],
  ocio: ['cine', 'salida', 'bar', 'boliche', 'juego', 'recital', 'birra', 'regalo'],
  sueldo: ['sueldo', 'salario', 'pago trabajo', 'honorarios'],
  beca: ['beca'],
  familia: ['mama', 'papa', 'viejos', 'familia', 'mesada'],
};

export function parseAmount(raw) {
  let s = strip(String(raw)).replace(/[$\s]/g, '');
  let mult = 1;
  const suf = s.match(/(k|mil|m|millon|millones)$/);
  if (suf) { mult = suf[1] === 'k' || suf[1] === 'mil' ? 1e3 : 1e6; s = s.slice(0, -suf[1].length); }
  if (!/^\d[\d.,]*$/.test(s)) return NaN;
  const hasDot = s.includes('.'), hasComma = s.includes(',');
  if (hasDot && hasComma) s = s.replace(/\./g, '').replace(',', '.');   // 1.250,50
  else if (hasComma) s = s.replace(',', '.');                            // 4500,50
  else if (hasDot && /^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, ''); // 4.500
  const n = parseFloat(s) * mult;
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : NaN;
}

// Busca una fecha en el texto ya normalizado. Devuelve {date, cut:[ini,fin]} o null.
function findDate(t, now) {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const at = n => { const d = new Date(today); d.setDate(d.getDate() + n); return d; };
  const withYear = (day, month, year) => {
    if (month < 0 || month > 11 || day < 1 || day > 31) return null;
    let y = year;
    if (y == null) {
      y = today.getFullYear();
      // Sin año: si ya pasó hace más de una semana, es del año que viene.
      if (new Date(y, month, day) < at(-7)) y++;
    } else if (y < 100) y += 2000;
    const d = new Date(y, month, day);
    return d.getMonth() === month ? d : null; // descarta 31 de febrero y similares
  };
  let m;
  if ((m = /\bpasado\s+manana\b/.exec(t))) return { date: at(2), cut: [m.index, m.index + m[0].length] };
  if ((m = /\b(hoy|manana|ayer|anteayer)\b/.exec(t))) return { date: at({ hoy: 0, manana: 1, ayer: -1, anteayer: -2 }[m[1]]), cut: [m.index, m.index + m[0].length] };
  if ((m = /\b(?:en|dentro de)\s+(\d{1,3})\s+(dias?|semanas?|mes(?:es)?)\b/.exec(t))) {
    const n = +m[1];
    let d;
    if (m[2].startsWith('dia')) d = at(n);
    else if (m[2].startsWith('semana')) d = at(n * 7);
    else { d = new Date(today); d.setMonth(d.getMonth() + n); }
    return { date: d, cut: [m.index, m.index + m[0].length] };
  }
  // 15 de noviembre de 2026 · 15 nov · 15nov
  if ((m = new RegExp(`\\b(?:el\\s+|dia\\s+)?(\\d{1,2})\\s*(?:de\\s+)?(${MONTH_RE})\\b(?:\\s*(?:de\\s+|del\\s+)?(\\d{4}))?`).exec(t))) {
    const d = withYear(+m[1], MONTHS[m[2]], m[3] ? +m[3] : null);
    if (d) return { date: d, cut: [m.index, m.index + m[0].length] };
  }
  // noviembre 15
  if ((m = new RegExp(`\\b(${MONTH_RE})\\s+(\\d{1,2})\\b(?!\\s*(?::|hs|h\\b))`).exec(t))) {
    const d = withYear(+m[2], MONTHS[m[1]], null);
    if (d) return { date: d, cut: [m.index, m.index + m[0].length] };
  }
  // 15/11 · 15-11-2026
  if ((m = /\b(?:el\s+)?(\d{1,2})[/\-](\d{1,2})(?:[/\-](\d{2,4}))?\b/.exec(t))) {
    const d = withYear(+m[1], +m[2] - 1, m[3] ? +m[3] : null);
    if (d) return { date: d, cut: [m.index, m.index + m[0].length] };
  }
  // lunes · el viernes · próximo martes · viernes que viene
  if ((m = new RegExp(`\\b(?:(?:el|este|proximo|prox)\\s+)*(${WD_RE})(\\s+que\\s+viene|\\s+proximo)?\\b`).exec(t))) {
    const target = WEEKDAYS[m[1]];
    let diff = (target - today.getDay() + 7) % 7;
    if (diff === 0) diff = 7;
    return { date: at(diff), cut: [m.index, m.index + m[0].length] };
  }
  // "15 11" al final: día y mes sueltos (el formato "x día x mes")
  if ((m = /\b(\d{1,2})\s+(\d{1,2})\s*$/.exec(t))) {
    const d = withYear(+m[1], +m[2] - 1, null);
    if (d) return { date: d, cut: [m.index, m.index + m[0].length] };
  }
  // "el 15" · "dia 15": ese día de este mes, o del siguiente si ya pasó
  if ((m = /\b(?:el|dia)\s+(\d{1,2})\b(?!\s*(?::|hs|h\b|am|pm))/.exec(t))) {
    const day = +m[1];
    if (day >= 1 && day <= 31) {
      let d = new Date(today.getFullYear(), today.getMonth(), day);
      if (d < today) d = new Date(today.getFullYear(), today.getMonth() + 1, day);
      if (d.getDate() === day) return { date: d, cut: [m.index, m.index + m[0].length] };
    }
  }
  return null;
}

function findTime(t) {
  let m;
  const ok = (h, mi) => h >= 0 && h <= 23 && mi >= 0 && mi <= 59;
  if ((m = /\b(?:a\s+las?\s+|alas\s+)?(\d{1,2})[:.](\d{2})\s*(am|pm|hs|h)?\b/.exec(t))) {
    let h = +m[1]; const mi = +m[2];
    if (m[3] === 'pm' && h < 12) h += 12;
    if (m[3] === 'am' && h === 12) h = 0;
    if (ok(h, mi)) return { time: `${pad(h)}:${pad(mi)}`, cut: [m.index, m.index + m[0].length] };
  }
  if ((m = /\b(?:a\s+las?\s+|alas\s+)?(\d{1,2})\s*(am|pm|hs|h)\b/.exec(t))) {
    let h = +m[1];
    if (m[2] === 'pm' && h < 12) h += 12;
    if (m[2] === 'am' && h === 12) h = 0;
    if (ok(h, 0)) return { time: `${pad(h)}:00`, cut: [m.index, m.index + m[0].length] };
  }
  if ((m = /\ba\s+las?\s+(\d{1,2})\b/.exec(t))) {
    const h = +m[1];
    if (ok(h, 0)) return { time: `${pad(h)}:00`, cut: [m.index, m.index + m[0].length] };
  }
  if ((m = /\b(mediodia|medianoche)\b/.exec(t))) return { time: m[1] === 'mediodia' ? '12:00' : '00:00', cut: [m.index, m.index + m[0].length] };
  return null;
}

// Quita un tramo de las dos cadenas (original y normalizada) a la vez.
// strip() conserva la longitud letra por letra, así los índices coinciden.
function cutBoth(state, [a, b]) {
  state.raw = state.raw.slice(0, a) + ' ' + state.raw.slice(b);
  state.t = state.t.slice(0, a) + ' ' + state.t.slice(b);
}
const tidy = s => s.replace(/\s+/g, ' ').replace(/^[\s,;:·\-–]+|[\s,;:·\-–]+$/g, '').trim();
const dropEdgeFillers = s => tidy(s.replace(/^(?:(?:de|del|el|la|los|las|para|con|en)\s+)+/i, '').replace(/(?:\s+(?:de|del|el|la|a|para|con|en))+$/i, ''));
const cap = s => (s ? s[0].toUpperCase() + s.slice(1) : s);

export function parseCapture(text, ctx = {}) {
  const now = ctx.now || new Date();
  const scopes = ctx.scopes || [];
  const subjects = ctx.subjects || [];
  const cats = ctx.cats || [];
  const original = (text || '').trim();
  if (!original) return null;

  // strip() puede cambiar la longitud con caracteres raros; en ese caso se trabaja sin tildes.
  const st = { raw: original, t: strip(original) };
  if (st.raw.length !== st.t.length) st.raw = st.t;

  // --- nota ---
  let m = /^(nota|anotar|apunte)\b[:\s]*/.exec(st.t);
  if (m) {
    cutBoth(st, [0, m[0].length]);
    const tag = extractScope(st, scopes);
    const body = tidy(st.raw);
    return { kind: 'note', title: cap(body.slice(0, 80)), body: body.length > 80 ? body : '', scope: tag ? tag.id : null };
  }

  // --- dinero ---
  m = /^(gasto|gaste|pague|compre|ingreso|cobre|recibi|me pagaron|[+-])\s*/.exec(st.t);
  if (m) {
    const word = m[1];
    const kind = ['ingreso', 'cobre', 'recibi', 'me pagaron', '+'].includes(word) ? 'in' : 'out';
    cutBoth(st, [0, m[0].length]);
    const am = /(?:^|\s)\$?\s*(\d[\d.,]*\s*(?:k|mil|millones|millon|m)?)(?=\s|$)/.exec(st.t);
    const amount = am ? parseAmount(am[1]) : NaN;
    if (am && Number.isFinite(amount)) {
      cutBoth(st, [am.index, am.index + am[0].length]);
      const d = findDate(st.t, now);
      if (d) cutBoth(st, d.cut);
      const desc = cap(dropEdgeFillers(tidy(st.raw)));
      const dn = strip(desc);
      let cat = null;
      for (const c of cats.filter(c => c.kind === kind)) {
        const key = strip(c.name);
        if (dn.includes(key) || (CAT_HINTS[key] || []).some(h => new RegExp(`\\b${h}\\b`).test(dn))) { cat = c.id; break; }
      }
      if (!cat) cat = (cats.find(c => c.kind === kind && strip(c.name) === 'otros') || cats.find(c => c.kind === kind) || {}).id || null;
      return { kind: 'move', move: kind, amount, desc, cat, date: ymd(d ? d.date : now) };
    }
    // no había monto: sigue como recordatorio normal
    st.raw = original; st.t = strip(original);
    if (st.raw.length !== st.t.length) st.raw = st.t;
  }

  // --- agenda ---
  const tag = extractScope(st, scopes);
  const time = findTime(st.t);
  if (time) cutBoth(st, time.cut);
  const date = findDate(st.t, now);
  if (date) cutBoth(st, date.cut);

  // El tipo es la palabra clave que aparece primero en la frase.
  let type = null, best = null;
  for (const [word, id] of TYPE_WORDS) {
    const hit = new RegExp(`\\b${word}\\b`).exec(st.t);
    if (hit && (!best || hit.index < best.index || (hit.index === best.index && word.length > best.word.length))) best = { index: hit.index, word, id };
  }
  if (best) {
    type = best.id;
    if (!KEEP_WORD.has(best.word)) cutBoth(st, [best.index, best.index + best.word.length]);
  }

  let title = dropEdgeFillers(tidy(st.raw));
  const tnorm = strip(title);
  // ¿coincide con una materia que ya existe?
  let subject = '';
  const known = subjects.map(s => ({ name: s, key: strip(s) })).sort((a, b) => b.key.length - a.key.length)
    .find(s => s.key && (tnorm === s.key || new RegExp(`\\b${s.key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(tnorm)));
  const academic = ['parcial', 'final', 'recuperatorio', 'practica', 'exposicion', 'presentacion', 'entrega', 'clase'].includes(type);
  if (known) {
    subject = known.name;
    if (tnorm === known.key) title = known.name;
    if (!type) type = 'tarea';
  } else if (academic && title) {
    // "Parcial Física": lo que queda es la materia. En "Entrega TP Algoritmos" la materia es "Algoritmos".
    let rest = tnorm, shown = title;
    for (const [word] of TYPE_WORDS) {
      const hit = new RegExp(`\\b${word}\\b`).exec(rest);
      if (hit) { rest = rest.slice(0, hit.index) + ' ' + rest.slice(hit.index + word.length); shown = shown.slice(0, hit.index) + ' ' + shown.slice(hit.index + word.length); }
    }
    subject = cap(dropEdgeFillers(tidy(shown.length === rest.length ? shown : rest)));
  }
  if (!type) type = date || time ? 'recordatorio' : 'tarea';
  title = cap(title);

  const DEFAULT_SCOPE = { parcial: 'uni', final: 'uni', recuperatorio: 'uni', practica: 'uni', exposicion: 'uni', presentacion: 'uni',
    entrega: 'uni', clase: 'uni', tarea: 'personal', reunion: 'trabajo', turno: 'salud', cumple: 'personal', pago: 'finanzas',
    evento: 'personal', recordatorio: 'personal' };
  let scope = tag ? tag.id : (known ? 'uni' : DEFAULT_SCOPE[type]);
  if (scopes.length && !scopes.some(s => s.id === scope)) scope = scopes[0].id;

  // Con hora pero sin fecha: hoy, o mañana si esa hora ya pasó.
  let dateStr = date ? ymd(date.date) : '';
  if (!dateStr && time) {
    const [h, mi] = time.time.split(':').map(Number);
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, mi);
    if (d < now) d.setDate(d.getDate() + 1);
    dateStr = ymd(d);
  }

  return { kind: 'item', type, title, subject, scope, date: dateStr, time: time ? time.time : '' };
}

function extractScope(st, scopes) {
  const m = /(?:^|\s)#([a-z0-9_]+)/.exec(st.t);
  if (!m) return null;
  const key = m[1];
  const hit = scopes.find(s => strip(s.name).replace(/\s+/g, '').startsWith(key)) || scopes.find(s => s.id === key);
  const start = m.index + (m[0].startsWith('#') ? 0 : 1);
  cutBoth(st, [start, m.index + m[0].length]);
  return hit || null;
}
