// Приём изменений расписания от снапшоттера на VPS и рассылка уведомлений.
// Вызов: npx tgcloud run endpoints/diff '{"changes": [...]}'
//
// Формат changes: [{ groupId, groupName, date, weekday,
//   removed: [{n, start, end, subject}],   // пары которых не стало
//   added:   [{n, start, end, subject}],   // новые пары
//   changed: [{n, before, after}] }]       // изменённые (subject/room/teacher)

import { db, api } from 'sdk';
import { eq } from 'sdk/db';
import { users } from '../schema.js';
import { neko } from '../lib/emoji.js';

function fmtLesson(l) {
  let s = `${l.start}–${l.end} ${l.subject || 'Занятие'}`;
  if (l.room) s += ` · ауд. ${l.room}`;
  if (l.teacher) s += ` · ${l.teacher}`;
  return s;
}

export default async function (payload) {
  const changes = payload?.changes || [];
  const results = { groups: 0, sent: 0, skipped: 0 };

  for (const ch of changes) {
    if (!ch.groupId) continue;
    results.groups++;

    const lines = [`${neko('‼️')} <b>Изменения в расписании — ${ch.groupName}</b>`];
    lines.push(`<b>${ch.weekday || ''}, ${ch.date}</b>\n`);

    if (ch.removed?.length) {
      lines.push(`${neko('❌')} <b>Убраны:</b>`);
      for (const l of ch.removed) lines.push(`   ${fmtLesson(l)}`);
    }
    if (ch.added?.length) {
      if (ch.removed?.length) lines.push('');
      lines.push(`${neko('✅')} <b>Добавлены:</b>`);
      for (const l of ch.added) lines.push(`   ${fmtLesson(l)}`);
    }
    if (ch.changed?.length) {
      if (ch.removed?.length || ch.added?.length) lines.push('');
      lines.push('🔄 <b>Изменены:</b>');
      for (const c of ch.changed) {
        lines.push(`   было: ${fmtLesson(c.before)}`);
        lines.push(`   стало: ${fmtLesson(c.after)}`);
      }
    }
    const text = lines.join('\n');

    const members = await db.select().from(users)
      .where(eq(users.notify, true)).all();

    for (const u of members) {
      if (u.groupId !== ch.groupId) continue;
      try {
        await api.sendMessage({ chat_id: u.tgId, text, parse_mode: 'HTML' });
        results.sent++;
      } catch (e) {
        results.skipped++;
        console.error('diff send', u.tgId, e.message);
      }
    }
  }

  console.log(JSON.stringify(results));
  return results;
}
