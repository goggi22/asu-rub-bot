// Возвращает мапу emoji → custom_emoji_id из пака CuteNeko_Emoji.
// Вызов: npx tgcloud run endpoints/emojiMap '{}'

import { api } from 'sdk';

export default async function () {
  try {
    const set = await api.getStickerSet({ name: 'CuteNeko_Emoji' });
    const map = {};
    for (const s of set.stickers || []) {
      if (s.type === 'custom_emoji' && s.custom_emoji_id) {
        // emoji может быть списком вида "😀|😄" — берём первый
        const first = (s.emoji || '').split('|')[0];
        map[first] = s.custom_emoji_id;
      }
    }
    return { title: set.title, count: Object.keys(map).length, map };
  } catch (e) {
    return { err: e.message };
  }
}
