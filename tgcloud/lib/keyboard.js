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

// список групп с пагинацией: по 10 на страницу, стрелки-навигация
export function groupsButtonsHtml(groups, opts = {}) {
  const pageSize = 10;
  const page = Math.max(0, opts.page || 0);
  const query = (opts.query || '').slice(0, 24);
  const pages = Math.max(1, Math.ceil(groups.length / pageSize));
  const cur = Math.min(page, pages - 1);
  const slice = groups.slice(cur * pageSize, cur * pageSize + pageSize);

  const rows = slice
    .map(g => `<tg-button-row align="center"><tg-button type="callback_data" data="set:${g.id}:${g.name}">${esc(g.name)}</tg-button></tg-button-row>`)
    .join('');

  if (pages <= 1) return rows;

  const nav = [
    '<tg-button-row align="center">',
    cur > 0
      ? `  <tg-button type="callback_data" data="grp:${cur - 1}:${query}">${neko('🐾')} Назад</tg-button>`
      : '  <tg-button type="disabled">·</tg-button>',
    `  <tg-button type="disabled">${cur + 1} / ${pages}</tg-button>`,
    cur < pages - 1
      ? `  <tg-button type="callback_data" data="grp:${cur + 1}:${query}">Вперёд ${neko('✨')}</tg-button>`
      : '  <tg-button type="disabled">·</tg-button>',
    '</tg-button-row>',
  ].join('');

  return rows + nav;
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
