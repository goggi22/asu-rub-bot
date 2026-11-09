import { api, db } from 'sdk';
import { eq } from 'sdk/db';
import { users } from '../schema.js';
import { getGroups } from '../lib/asu.js';
import { sendSchedule, sendRich } from '../lib/schedule.js';
import { groupsButtonsHtml } from '../lib/keyboard.js';

export default async function (query) {
  const chatId = query.message?.chat?.id ?? query.from.id;
  const tgId = query.from.id;
  const data = query.data || '';

  try {
    // листание списка групп
    if (data.startsWith('grp:')) {
      await api.answerCallbackQuery({ callback_query_id: query.id });
      const [, pageRaw, ...rest] = data.split(':');
      const page = Math.max(0, parseInt(pageRaw, 10) || 0);
      const query = rest.join(':');
      const groups = await getGroups();
      const q = query.trim().toLowerCase().replace(/\s+/g, '');
      const found = q
        ? groups.filter(g => g.name.toLowerCase().replace(/\s+/g, '').includes(q))
        : groups;
      try { await api.deleteMessage({ chat_id: chatId, message_id: query.message.message_id }); } catch {}
      return sendRich(chatId,
        `<h4>Группы ${found.length} — выбирай:</h4>` + groupsButtonsHtml(found, { page, query: q }),
        { noButtons: true });
    }

    // выбор группы из списка
    if (data.startsWith('set:')) {
      const [, groupId, ...rest] = data.split(':');
      const groupName = rest.join(':');
      await db.insert(users)
        .values({ tgId, groupId, groupName, notify: true })
        .onConflictDoUpdate({ target: users.tgId, set: { groupId, groupName } })
        .run();
      await api.answerCallbackQuery({ callback_query_id: query.id, text: `Группа ${groupName}` });
      try { await api.deleteMessage({ chat_id: chatId, message_id: query.message.message_id }); } catch {}
      await sendSchedule(chatId, groupId, 'today', { notifyOn: true });
      return;
    }

    // сегодня / завтра / неделя
    if (data.startsWith('day:')) {
      const when = data.slice(4);
      const [user] = await db.select().from(users).where(eq(users.tgId, chatId)).all();
      await api.answerCallbackQuery({ callback_query_id: query.id });
      if (!user?.groupId) {
        return searchGroupsList(chatId);
      }
      // старое сообщение убираем, чтобы чат не засорять
      try { await api.deleteMessage({ chat_id: chatId, message_id: query.message.message_id }); } catch {}
      try {
        await sendSchedule(chatId, user.groupId, when, { notifyOn: user.notify });
      } catch (e) {
        console.error(e);
        await api.sendMessage({ chat_id: chatId, text: 'Не смог вытащить расписание 😕 попробуй ещё раз.' });
      }
      return;
    }

    // сменить группу
    if (data === 'act:reset') {
      await api.answerCallbackQuery({ callback_query_id: query.id });
      try { await api.deleteMessage({ chat_id: chatId, message_id: query.message.message_id }); } catch {}
      return searchGroupsList(chatId);
    }

    // переключить напоминания — тост, без нового сообщения
    if (data === 'act:notify') {
      const [user] = await db.select().from(users).where(eq(users.tgId, tgId)).all();
      const enable = !(user?.notify ?? true);
      await db.update(users).set({ notify: enable }).where(eq(users.tgId, tgId)).run();
      await api.answerCallbackQuery({
        callback_query_id: query.id,
        text: enable ? '🔔 Напоминания включены' : '🔕 Напоминания выключены',
      });
      return;
    }

    await api.answerCallbackQuery({ callback_query_id: query.id });
  } catch (e) {
    console.error(e);
    try { await api.answerCallbackQuery({ callback_query_id: query.id, text: 'Ошибка, попробуй ещё раз' }); } catch {}
  }
}

async function searchGroupsList(chatId) {
  const groups = await getGroups();
  return sendRich(chatId,
    `<h4>Выбери группу (${groups.length}):</h4>` + groupsButtonsHtml(groups, { page: 0, query: '' }),
    { noButtons: true });
}
