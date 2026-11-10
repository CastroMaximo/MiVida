// Datos de ejemplo para la vista previa. No se cargan en la app real.
import { put, ymd, ym, addDays, pad } from './store.js';

export function seed() {
  const t = ymd(), m = ym(), d = n => addDays(t, n), day = n => `${m}-${pad(n)}`;
  ['Física II', 'Análisis Matemático', 'Algoritmos', 'Química', 'Historia'].forEach(name => put('subjects', { name }));
  const item = (title, type, scope, subject, date, time, rem, notes = '') => put('items', { title, type, scope, subject, date, time, rem, notes, done: false, cal: true });
  item('Química', 'practica', 'uni', 'Química', d(0), '16:00', [120], 'Laboratorio 3. Llevar guardapolvo.');
  item('Llamar al banco', 'recordatorio', 'personal', '', d(0), '', [0]);
  item('TP Algoritmos', 'entrega', 'uni', 'Algoritmos', d(2), '23:59', [1440, 120], 'Subir al campus en PDF.');
  item('Dentista', 'turno', 'salud', '', d(3), '10:30', [1440, 120]);
  item('Física II', 'parcial', 'uni', 'Física II', d(5), '14:00', [10080, 1440, 120], 'Unidades 3 a 5: trabajo, energía y cantidad de movimiento.');
  item('Historia', 'exposicion', 'uni', 'Historia', d(9), '09:00', [4320, 1440]);
  item('Cumple de Sofi', 'cumple', 'personal', '', d(12), '', [1440, 0]);
  item('Análisis Matemático', 'final', 'uni', 'Análisis Matemático', d(24), '08:00', [10080, 1440]);
  item('Comprar regalo para mamá', 'tarea', 'personal', '', '', '', []);
  item('Renovar la SUBE estudiantil', 'tarea', 'personal', '', d(-2), '', [0]);

  put('notes', { title: 'Temas del parcial de Física', body: '- Trabajo y energía\n- Conservación de la cantidad de movimiento\n- Choques elásticos e inelásticos\n\nRepasar los ejercicios 12 a 20 de la guía 4.', scope: 'uni', pin: true });
  put('notes', { title: 'Ideas para la exposición', body: 'Abrir con una pregunta al curso. Diez diapositivas como máximo, una idea por diapositiva.', scope: 'uni', pin: false });
  put('notes', { title: 'Lista del súper', body: 'Yerba, arroz, huevos, tomate, café.', scope: 'hogar', pin: false });

  const bill = (name, amount, dueDay, cat) => put('bills', { name, amount, day: dueDay, cat, from: '2000-01', active: true });
  const today = +t.slice(8);
  const bills = [bill('Alquiler', 180000, 5, 'out-alquiler'), bill('Internet', 22000, 10, 'out-servicios'), bill('Celular', 14500, 12, 'out-servicios'),
    bill('Gimnasio', 25000, 18, 'out-salud'), bill('Cuota facultad', 60000, 20, 'out-estudio'), bill('Spotify', 3300, 26, 'out-ocio')];
  const mv = (kind, amount, cat, date, desc, extra = {}) => put('moves', { kind, amount, cat, date, desc, ...extra });
  bills.slice(0, 2).forEach(b => { if (b.day <= today) mv('out', b.amount, b.cat, day(b.day), b.name, { billId: b.id, month: m }); });
  mv('in', 320000, 'in-sueldo', day(1), 'Trabajo part-time');
  mv('in', 150000, 'in-beca', day(Math.min(3, today)), 'Beca');
  [[4500, 'out-comida', 0, 'Almuerzo'], [12000, 'out-transporte', 1, 'Carga SUBE'], [38500, 'out-comida', 2, 'Supermercado'], [6800, 'out-estudio', 3, 'Fotocopias'],
    [9000, 'out-ocio', 4, 'Cine'], [3200, 'out-comida', 5, 'Café'], [15400, 'out-comida', 7, 'Verdulería y carnicería']]
    .forEach(([a, c, back, desc]) => { const dt = d(-back); if (dt.slice(0, 7) === m) mv('out', a, c, dt, desc); });

  const subs = ['Física II', 'Algoritmos', 'Análisis Matemático', 'Química'];
  for (let back = 1; back <= 24; back++) {
    const date = d(-back);
    const r = (back * 37) % 11;
    if (r < 3) continue; // días sin estudio
    put('sessions', { date, at: new Date(date + 'T16:00').getTime(), min: 25 * (1 + (r % 4)), subject: subs[back % 4], preset: 'Pomodoro' });
    if (r > 7) put('sessions', { date, at: new Date(date + 'T20:00').getTime(), min: 50, subject: subs[(back + 1) % 4], preset: 'Profundo' });
  }
  put('sessions', { date: t, at: Date.now() - 3 * 3600e3, min: 50, subject: 'Física II', preset: 'Profundo' });
}
