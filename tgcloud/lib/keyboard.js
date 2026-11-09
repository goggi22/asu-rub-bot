// нативные rich-кнопки (<tg-button>) прямо в теле сообщения

import { neko } from './emoji.js';

export function scheduleButtonsHtml(notifyOn = true) {
  return [
    '<tg-button-row align="center">',
    `  <tg-button type="callback_data" style="primary" data="day:today">${neko('🐾')} Сегодня</tg-button>`,
    `  <tg-button type="callback_data" data="day:tomorrow">${neko('✨')} Завтра</tg-button>`,
    `  <tg-button type="callback_data" data="day:week">${neko('🔥')} Неделя</tg-button>`,
    '</tg-button-row>',
    '<tg-button-row align="center">',
    `  <tg-button type="callback_data" data="act:reset">${neko('🏃‍♂️')} Сменить группу</tg-button>`,
    `  <tg-button type="callback_data" style="${notifyOn ? 'success' : 'danger'}" data="act:notify">${notifyOn ? neko('⚡️') : neko('😴')} Напоминания: ${notifyOn ? 'вкл' : 'выкл'}</tg-button>`,
    '</tg-button-row>',
  ].join('');
}

export function groupsButtonsHtml(groups) {
  return groups.slice(0, 40)
    .map(g => `<tg-button-row align="center"><tg-button type="callback_data" data="set:${g.id}:${g.name}">${esc(g.name)}</tg-button></tg-button-row>`)
    .join('');
}

// inline-подборка для plain-fallback
export function scheduleButtonsMarkup(notifyOn = true) {
  return {
    inline_keyboard: [
      [
        { text: '📅 Сегодня', callback_data: 'day:today' },
        { text: '⏭ Завтра', callback_data: 'day:tomorrow' },
        { text: '🗓 Неделя', callback_data: 'day:week' },
      ],
      [
        { text: '🔄 Сменить группу', callback_data: 'act:reset' },
        { text: notifyOn ? '🔔 Вкл' : '🔕 Выкл', callback_data: 'act:notify' },
      ],
    ],
  };
}

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
