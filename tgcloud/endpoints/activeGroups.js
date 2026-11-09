// Возвращает строку "groupId|groupName;..." — список групп с включёнными напоминаниями.
// Дёргается снапшоттером на VPS: npx tgcloud run endpoints/activeGroups '{}'

import { db } from 'sdk';
import { eq } from 'sdk/db';
import { users } from '../schema.js';

export default async function () {
  const rows = await db.select().from(users)
    .where(eq(users.notify, true)).all();
  const seen = new Set();
  const parts = [];
  for (const u of rows) {
    if (!u.groupId || seen.has(u.groupId)) continue;
    seen.add(u.groupId);
    parts.push(`${u.groupId}|${u.groupName || u.groupId}`);
  }
  return parts.join(';');
}
