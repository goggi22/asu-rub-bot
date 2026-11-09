import { api } from 'sdk';
import { getSchedule, richDays, localDate, TYPE_GROUP } from './asu.js';
import { scheduleButtonsHtml, scheduleButtonsMarkup } from './keyboard.js';

// расписание rich-таблицей, кнопки прямо в теле сообщения
export async function sendSchedule(chatId, groupId, when, opts = {}) {
  let days, title;
  if (when === 'week') {
    days = await getSchedule(TYPE_GROUP, groupId, localDate(0), '2');
    title = 'Расписание на неделю';
  } else {
    const shift = when === 'tomorrow' ? 1 : 0;
    const date = localDate(shift);
    const all = await getSchedule(TYPE_GROUP, groupId, date, '1');
    days = all.filter(d => d.date === date);
    title = shift ? 'На завтра' : 'На сегодня';
  }
  await sendRich(chatId, richDays(days, title, { compact: when !== 'week' }), opts);
}

// универсальная отправка rich с кнопками и plain-fallback
export async function sendRich(chatId, htmlBody, opts = {}) {
  const html = opts.noButtons ? htmlBody : htmlBody + scheduleButtonsHtml(opts.notifyOn);
  try {
    await api.sendRichMessage({ chat_id: chatId, rich_message: { html } });
  } catch (e) {
    console.error('rich failed, falling back to text', e.message);
    const text = htmlToPlain(htmlBody);
    await api.sendMessage({
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
      ...(opts.noButtons ? {} : { reply_markup: scheduleButtonsMarkup(opts.notifyOn) }),
    });
  }
}

function htmlToPlain(html) {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|h[1-6]|tr|li|div|blockquote)>/gi, '\n')
    .replace(/<hr\s*\/?>/gi, '\n———\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, 4000);
}
