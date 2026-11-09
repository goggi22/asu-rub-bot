import { fetch } from 'sdk';
import { neko } from './emoji.js';

const API = 'https://asu.rub22.ru';
const TZ = 7 * 3600 * 1000; // Барнаул/Рубцовск UTC+7

export const TYPE_GROUP = 3;

async function getJson(path) {
  const res = await fetch(API + path);
  if (!res.ok) throw new Error(`asu.rub22.ru ${path}: ${res.status}`);
  const data = await res.json();
  if (data.error) throw new Error(data.error);
  return data;
}

let groupsCache = { at: 0, items: null };
const CACHE_TTL = 6 * 3600 * 1000;

export async function getGroups() {
  const now = Date.now();
  if (groupsCache.items && now - groupsCache.at < CACHE_TTL) return groupsCache.items;
  const data = await getJson('/api/selectors?kind=groups');
  groupsCache = { at: now, items: data.items };
  return groupsCache.items;
}

export async function getSchedule(type, value, date, interval = '2') {
  const data = await getJson(`/api/schedule?type=${type}&value=${encodeURIComponent(value)}&date=${date}&interval=${interval}`);
  return data.days;
}

// ---------- даты по Рубцовску ----------

export function localDate(shiftDays = 0) {
  const d = new Date(Date.now() + TZ + shiftDays * 86400000);
  return `${String(d.getUTCDate()).padStart(2, '0')}.${String(d.getUTCMonth() + 1).padStart(2, '0')}.${d.getUTCFullYear()}`;
}

// ---------- расписание звонков ----------

export const SLOTS = [
  { n: 1, start: '08:00', end: '09:30' },
  { n: 2, start: '09:40', end: '11:10' },
  { n: 3, start: '11:20', end: '12:50' },
  { n: 4, start: '13:20', end: '14:50' },
  { n: 5, start: '15:00', end: '16:30' },
  { n: 6, start: '16:40', end: '18:10' },
  { n: 7, start: '18:20', end: '19:40' },
  { n: 8, start: '19:50', end: '21:10' },
];

export function toMin(t) {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

// текущее состояние дня по времени Рубцовска: { now, slot, phase, nextLesson }
export function dayState(lessons) {
  const d = new Date(Date.now() + TZ);
  const now = d.getUTCHours() * 60 + d.getUTCMinutes();
  const nowStr = `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
  let phase = 'before'; // before | lesson | break | after
  let currentSlot = null;
  for (const s of SLOTS) {
    if (now >= toMin(s.start) && now < toMin(s.end)) { phase = 'lesson'; currentSlot = s; break; }
    if (now >= toMin(s.end) && now < toMin((SLOTS.find(x => x.n === s.n + 1) || s).start)) {
      if (s.n === SLOTS.length) { phase = 'after'; break; }
      phase = 'break'; currentSlot = s; break;
    }
  }
  if (now < toMin(SLOTS[0].start)) phase = 'before';
  if (now >= toMin(SLOTS[SLOTS.length - 1].end)) phase = 'after';
  return { now: nowStr, nowMin: now, phase, currentSlot, lessons };
}

// ---------- rich (html для sendRichMessage) ----------

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export { esc };

export function richDay(day, opts = {}) {
  const parts = [];
  const title = `${day.weekday}, ${prettyDate(day.date)}`;
  if (!day.lessons.length) {
    parts.push(`<h3>${esc(title)}</h3>`);
    parts.push(`<p>${neko('😴')} Пар нет — свободен</p>`);
    return parts.join('');
  }
  if (opts.compact) {
    const rows = day.lessons.map(l => {
      const it = l.items[0];
      const subj = esc(it.subject || 'Занятие');
      const kind = it.kind ? ` <i>(${esc(it.kind.toLowerCase())})</i>` : '';
      const room = it.rooms.length ? ` · ауд. ${esc(it.rooms.join(', '))}` : '';
      const who = it.teachers.length ? `<br/><small>${esc(it.teachers.map(shortName).join(', '))}</small>` : '';
      return `<tr><td><b>${l.start}</b>–${l.end}</td><td>${subj}${kind}${room}${who}</td></tr>`;
    }).join('');
    return `<h4>${esc(title)}</h4><table compact>${rows}</table>`;
  }
  parts.push(`<h3>${esc(title)}</h3>`);
  parts.push('<table>');
  parts.push('<tr><th>Время</th><th>Пара</th><th>Ауд.</th><th>Преподаватель</th></tr>');
  for (const l of day.lessons) {
    for (const it of l.items) {
      parts.push(
        `<tr><td><b>${l.start}</b>–${l.end}</td>` +
        `<td>${esc(it.subject || 'Занятие')}${it.kind ? ` <i>(${esc(it.kind.toLowerCase())})</i>` : ''}</td>` +
        `<td>${esc(it.rooms.join(', '))}</td>` +
        `<td>${esc(it.teachers.map(shortName).join(', '))}</td></tr>`
      );
    }
  }
  parts.push('</table>');
  return parts.join('');
}

export function richDays(days, title, opts = {}) {
  const parts = [`<h2>${esc(title)}</h2>`];
  const shown = opts.onlyWithLessons ? days.filter(d => d.lessons.length) : days;
  for (const d of shown) parts.push(richDay(d, opts));
  if (!shown.length) parts.push(`<p>На этой неделе пар нет ${neko('🎉')}</p>`);
  return parts.join('<hr/>');
}

// plain-text уведомление о паре
export function lessonLine(l) {
  const it = l.items[0];
  const bits = [it.subject || 'Занятие'];
  if (it.kind) bits.push(`(${it.kind.toLowerCase()})`);
  if (it.rooms.length) bits.push(`ауд. ${it.rooms.join(', ')}`);
  if (it.teachers.length) bits.push(shortName(it.teachers[0]));
  return bits.join(', ');
}

// ---------- форматирование plain ----------

const MONTHS = ['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'];

export function prettyDate(date) {
  const [d, m] = date.split('.');
  return `${+d} ${MONTHS[+m - 1]}`;
}

function shortName(full) {
  const p = full.trim().split(/\s+/);
  if (p.length < 2) return full;
  return `${p[0]} ${p.slice(1).map(x => x[0] + '.').join('')}`;
}

export function escapeHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function formatDay(day) {
  const lines = [`\n📅 <b>${day.weekday}, ${prettyDate(day.date)}</b>`];
  if (!day.lessons.length) {
    lines.push(`${neko('😴')} пар нет — свободен`);
    return lines.join('\n');
  }
  for (const l of day.lessons) {
    for (const it of l.items) {
      const bits = [];
      if (it.rooms.length) bits.push(`ауд. ${it.rooms.join(', ')}`);
      if (it.teachers.length) bits.push(escapeHtml(it.teachers.map(shortName).join(', ')));
      const kind = it.kind ? ` <i>(${escapeHtml(it.kind.toLowerCase())})</i>` : '';
      lines.push(`\n<b>${l.start}–${l.end}</b> ${escapeHtml(it.subject || 'Занятие')}${kind}`);
      if (bits.length) lines.push(`   ${bits.join(' · ')}`);
    }
  }
  return lines.join('\n');
}

export function formatDays(days, title) {
  const out = [`<b>${escapeHtml(title)}</b>`];
  for (const d of days) out.push(formatDay(d));
  return out.join('\n');
}
