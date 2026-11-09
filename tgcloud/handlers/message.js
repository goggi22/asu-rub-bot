import { api, db } from 'sdk';
import { eq } from 'sdk/db';
import { users } from '../schema.js';
import { getGroups, esc } from '../lib/asu.js';
import { groupsButtonsHtml } from '../lib/keyboard.js';
import { sendSchedule, sendRich } from '../lib/schedule.js';
import { neko } from '../lib/emoji.js';

let BOT_USERNAME = null;
let MENTION_RE = /^$/;

async function ensureMention() {
  if (BOT_USERNAME) return;
  const me = await api.getMe();
  BOT_USERNAME = me.username;
  MENTION_RE = new RegExp(`@${BOT_USERNAME}\\b`, 'i');
}

export default async function (message) {
  if (!message.text) return;
  const t0 = Date.now();
  const chat = message.chat;
  const chatId = chat.id;
  const isGroup = chat.type === 'group' || chat.type === 'supergroup';
  const text = message.text.trim();

  // ---------- группы ----------
  if (isGroup) {
    await ensureMention();
    const addressed = text.startsWith('/') || MENTION_RE.test(text) || /^расписание/i.test(text);
    if (!addressed) return;
    const cmd = text.replace(/@[\w_]+/g, '').trim().toLowerCase();

    if (/^\/ping/.test(cmd)) return ping(chatId, t0);

    if (/^\/start|^расписание/.test(cmd) && !/сегодня|завтра|недел/.test(cmd)) {
      return api.sendMessage({
        chat_id: chatId,
        text: 'Привет! Напишите номер группы (например «1235») — запомню её для этого чата. Дальше: /today, /tomorrow, /week.',
      });
    }
    return respond(chatId, parseWhen(cmd), true);
  }

  // ---------- личка ----------
  if (text.startsWith('/start')) {
    await sendRich(chatId,
      `<h3>Расписание РИ (филиала) АлтГУ ${neko('❤️')}</h3>` +
      `<p>${neko('👋')} Напиши номер группы (например <b>1235</b>) — и я запомню её. Дальше всё кнопками прямо здесь.</p>` +
      `<p>Утром в 7:30 — сводка на день, за 10 минут до пары и на старте — напоминание.</p>` +
      `<footer>${neko('🐾')} данные с rb.asu.ru</footer>`);
    return;
  }

  if (/^\/?(notify|напоминания)/i.test(text)) {
    return toggleNotify(chatId, message.from.id, !/off|выкл/i.test(text));
  }

  if (text.startsWith('/ping')) return ping(chatId, t0);

  if (text.startsWith('/today')) return respond(chatId, 'today');
  if (text.startsWith('/tomorrow')) return respond(chatId, 'tomorrow');
  if (text.startsWith('/week')) return respond(chatId, 'week');

  if (text.startsWith('/help')) {
    return sendRich(chatId,
      `<h3>Как пользоваться</h3>` +
      `<p>Напиши номер группы (например <b>1235</b>) — запомню её.</p>` +
      `<p>Дальше кнопками: сегодня / завтра / неделя, смена группы, напоминания.</p>` +
      `<p>Команды: /today, /tomorrow, /week, /notify on|off</p>`,
      { noButtons: true });
  }

  // всё остальное — поиск группы
  return searchGroups(chatId, text);
}

// /ping — латентность: round-trip до Telegram API + полное время обработки
async function ping(chatId, t0) {
  const t1 = Date.now();
  await api.getMe();
  const apiMs = Date.now() - t1;
  const totalMs = Date.now() - t0;
  return sendRich(chatId,
    `<h3>${neko('⚡️')} pong</h3>` +
    `<p>api: <b>${apiMs} мс</b> · обработка: <b>${totalMs} мс</b></p>`,
    { noButtons: true });
}

function parseWhen(cmd) {
  if (/tomorrow|завтра/.test(cmd)) return 'tomorrow';
  if (/week|недел/.test(cmd)) return 'week';
  return 'today';
}

async function respond(chatId, when, isGroup = false) {
  const [user] = await db.select().from(users).where(eq(users.tgId, chatId)).all();
  if (!user || !user.groupId) {
    return searchGroups(chatId, '');
  }
  if (!isGroup) await api.sendChatAction({ chat_id: chatId, action: 'typing' });
  try {
    await sendSchedule(chatId, user.groupId, when, { notifyOn: user.notify });
  } catch (e) {
    console.error(e);
    await api.sendMessage({ chat_id: chatId, text: `Не смог вытащить расписание с rb.asu.ru ${neko('😥')} попробуй ещё раз.`, parse_mode: 'HTML' });
  }
}

async function toggleNotify(chatId, tgId, enable) {
  const [user] = await db.select().from(users).where(eq(users.tgId, tgId)).all();
  if (!user || !user.groupId) {
    return api.sendMessage({ chat_id: chatId, text: `Сначала выбери группу ${neko('😛')}`, parse_mode: 'HTML' });
  }
  await db.update(users).set({ notify: enable }).where(eq(users.tgId, tgId)).run();
  return api.sendMessage({
    chat_id: chatId,
    parse_mode: 'HTML',
    text: enable
      ? `${neko('⚡️')} Напоминания включены: утром сводка, за 10 минут до пары и в начале пары.`
      : `${neko('😴')} Напоминания выключены.`,
  });
}

async function searchGroups(chatId, query) {
  await api.sendChatAction({ chat_id: chatId, action: 'typing' });
  const groups = await getGroups();
  const q = query.trim().toLowerCase().replace(/\s+/g, '');
  const found = q
    ? groups.filter(g => g.name.toLowerCase().replace(/\s+/g, '').includes(q))
    : groups;

  if (found.length === 0) {
    return api.sendMessage({
      chat_id: chatId,
      parse_mode: 'HTML',
      text: `Группы «${esc(query)}» не нашёл ${neko('🥺')} попробуй ещё раз, например «1235».`,
    });
  }
  if (found.length === 1) {
    return saveGroup(chatId, found[0], false);
  }
  return sendRich(chatId,
    `<h4>Нашёл ${found.length} — выбирай:</h4>` + groupsButtonsHtml(found, { page: 0, query: q }),
    { noButtons: true });
}

export async function saveGroup(chatId, group, isChat) {
  await db.insert(users)
    .values({ tgId: chatId, groupId: group.id, groupName: group.name, isChat, notify: true })
    .onConflictDoUpdate({
      target: users.tgId,
      set: { groupId: group.id, groupName: group.name, isChat },
    })
    .run();
  await sendSchedule(chatId, group.id, 'today', { notifyOn: true });
}
