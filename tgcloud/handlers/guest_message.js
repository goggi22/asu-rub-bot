// guest mode: бот отвечает в чатах, где его нет (нужно включить у BotFather)
import { db, api } from 'sdk';
import { eq } from 'sdk/db';
import { users } from '../schema.js';
import { getSchedule, richDay, localDate, TYPE_GROUP } from '../lib/asu.js';
import { scheduleButtonsHtml } from '../lib/keyboard.js';

export default async function (message) {
  const queryId = message.guest_query_id;
  if (!queryId) return;
  const userId = message.from?.id;
  const chatId = message.chat?.id;

  let result;
  try {
    const [user] = userId
      ? await db.select().from(users).where(eq(users.tgId, userId)).all()
      : [];

    if (user?.groupId) {
      const date = localDate(0);
      const days = await getSchedule(TYPE_GROUP, user.groupId, date, '1');
      const today = days.find(d => d.date === date);
      const html = today
        ? richDay(today, { compact: true })
        : '<p>Расписание недоступно 😕</p>';
      result = {
        type: 'article',
        id: `g${userId}`,
        title: `Расписание · ${user.groupName}`,
        description: today?.lessons?.length ? `${today.weekday}, ${today.date}` : 'на сегодня',
        input_message_content: { rich_message: { html: html + scheduleButtonsHtml(true) } },
      };
    } else {
      result = {
        type: 'article',
        id: `n${userId}`,
        title: 'Не знаю твою группу',
        description: 'напиши боту в личку номер группы',
        input_message_content: {
          message_text: 'Напиши мне в личку номер группы (например 1235) — и я запомню её. Потом сможешь вызывать меня в любом чате!',
        },
      };
    }
  } catch (e) {
    console.error('guest handler', e.message);
    result = {
      type: 'article',
      id: `e${userId}`,
      title: 'Ошибка',
      input_message_content: { message_text: 'Не получилось вытянуть расписание 😕' },
    };
  }

  try {
    await api.answerGuestQuery({ guest_query_id: queryId, result });
  } catch (e) {
    console.error('answerGuestQuery', e.message);
  }
}
