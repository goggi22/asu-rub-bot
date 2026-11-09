// Тик для крона с vps: утренняя сводка + напоминания о парах + погода.
// Вызов: npx tgcloud run endpoints/tick '{}'

import { db, api } from 'sdk';
import { eq } from 'sdk/db';
import { users } from '../schema.js';
import { getSchedule, localDate, lessonLine, richDay, toMin } from '../lib/asu.js';
import { scheduleButtonsHtml } from '../lib/keyboard.js';
import { neko } from '../lib/emoji.js';

const TZ = 7 * 3600 * 1000; // Рубцовск UTC+7
const PRE_MINUTES = 10; // за сколько минут до пары предупреждать
const WEATHER_URL = 'https://api.open-meteo.com/v1/forecast?latitude=51.4989&longitude=82.2139&current=temperature_2m,weather_code&daily=temperature_2m_max,temperature_2m_min,weather_code,wind_speed_10m_max&timezone=Asia%2FBarnaul&forecast_days=1';

// WMO-коды → описание
const WMO = {
  0: ['☀️', 'ясно'], 1: ['🌤', 'малооблачно'], 2: ['⛅', 'переменная облачность'], 3: ['☁️', 'пасмурно'],
  45: ['🌫', 'туман'], 48: ['🌫', 'изморозь'],
  51: ['🌦', 'морось'], 53: ['🌦', 'морось'], 55: ['🌧', 'сильная морось'],
  61: ['🌦', 'небольшой дождь'], 63: ['🌧', 'дождь'], 65: ['🌧', 'сильный дождь'],
  66: ['🌧', 'ледяной дождь'], 67: ['🌧', 'ледяной дождь'],
  71: ['🌨', 'небольшой снег'], 73: ['❄️', 'снег'], 75: ['❄️', 'сильный снег'], 77: ['🌨', 'снежные зёрна'],
  80: ['🌦', 'ливни'], 81: ['🌧', 'ливни'], 82: ['⛈', 'сильные ливни'],
  85: ['🌨', 'снегопад'], 86: ['❄️', 'сильный снегопад'],
  95: ['⛈', 'гроза'], 96: ['⛈', 'гроза с градом'], 99: ['⛈', 'гроза с градом'],
};

async function getWeatherLine() {
  try {
    const { fetch } = await import('sdk');
    const r = await fetch(WEATHER_URL);
    if (!r.ok) return '';
    const j = await r.json();
    const code = j.daily?.weather_code?.[0];
    const tmin = Math.round(j.daily?.temperature_2m_min?.[0]);
    const tmax = Math.round(j.daily?.temperature_2m_max?.[0]);
    const wind = Math.round(j.daily?.wind_speed_10m_max?.[0]);
    const [emoji, desc] = WMO[code] || ['🌡', ''];
    const rng = tmin === tmax ? `${tmax}°` : `${tmin}…${tmax}°`;
    return `${emoji} погода: ${rng}, ${desc}, ветер до ${wind} км/ч`;
  } catch {
    return '';
  }
}

function nowLocal() {
  const d = new Date(Date.now() + TZ);
  return {
    hhmm: `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`,
    date: `${String(d.getUTCDate()).padStart(2, '0')}.${String(d.getUTCMonth() + 1).padStart(2, '0')}.${d.getUTCFullYear()}`,
    weekday: ['Воскресенье','Понедельник','Вторник','Среда','Четверг','Пятница','Суббота'][d.getUTCDay()],
    minutes: d.getUTCHours() * 60 + d.getUTCMinutes(),
  };
}

export default async function () {
  const now = nowLocal();
  const results = { morning: 0, pre: 0, start: 0, at: now.hhmm };
  const withGroup = await db.select().from(users)
    .where(eq(users.notify, true)).all();

  // группируем по группе, чтобы не дёргать апи на каждого
  const byGroup = {};
  for (const u of withGroup) {
    if (!u.groupId) continue;
    (byGroup[u.groupId] ||= []).push(u);
  }

  for (const [groupId, members] of Object.entries(byGroup)) {
    let days;
    try {
      days = await getSchedule(3, groupId, now.date, '1');
    } catch (e) {
      console.error('schedule fetch failed', groupId, e.message);
      continue;
    }
    const today = days.find(d => d.date === now.date);
    if (!today) continue;
    const lessons = today.lessons || [];

    for (const u of members) {
      // 1) утренняя сводка в 07:30
      if (now.hhmm === '07:30' && u.lastMorning !== now.date) {
        await db.update(users).set({ lastMorning: now.date }).where(eq(users.tgId, u.tgId)).run();
        if (lessons.length) {
          try {
            const weather = await getWeatherLine();
            const wHtml = weather ? `<p><small>${weather}</small></p>` : '';
            await api.sendRichMessage({
              chat_id: u.tgId,
              rich_message: { html: richDay(today, { compact: true }) + wHtml + scheduleButtonsHtml(u.notify) },
            });
            results.morning++;
          } catch (e) { console.error('morning send', u.tgId, e.message); }
        } else {
          try {
            const weather = await getWeatherLine();
            await api.sendMessage({
              chat_id: u.tgId,
              text: `${neko('😴')} ${now.weekday}, ${today.date}. Пар нет — спи дальше!` + (weather ? `\n\n${weather}` : ''),
              parse_mode: 'HTML',
            });
            results.morning++;
          } catch (e) { console.error('morning send', u.tgId, e.message); }
        }
        continue;
      }

      // 2) напоминания по парам
      for (const l of lessons) {
        const startMin = toMin(l.start);
        const keyPre = `${now.date}:pre:${l.n}`;
        const keyStart = `${now.date}:start:${l.n}`;

        // за 10 минут до начала
        if (now.minutes >= startMin - PRE_MINUTES && now.minutes < startMin && u.lastNotify !== keyPre) {
          await db.update(users).set({ lastNotify: keyPre }).where(eq(users.tgId, u.tgId)).run();
          try {
            await api.sendMessage({
              chat_id: u.tgId,
              text: `⏰ Через ${startMin - now.minutes} мин, ${l.start} — ${lessonLine(l)}`,
            });
            results.pre++;
          } catch (e) { console.error('pre send', u.tgId, e.message); }
          break;
        }

        // старт пары
        if (now.minutes >= startMin && now.minutes < startMin + 2 && u.lastNotify !== keyStart) {
          await db.update(users).set({ lastNotify: keyStart }).where(eq(users.tgId, u.tgId)).run();
          try {
            await api.sendMessage({
              chat_id: u.tgId,
              text: `🔔 Пара началась: ${lessonLine(l)}`,
            });
            results.start++;
          } catch (e) { console.error('start send', u.tgId, e.message); }
          break;
        }
      }
    }
  }

  console.log(JSON.stringify(results));
  return results;
}
