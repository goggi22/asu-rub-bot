# asu-rub-bot

Telegram-бот расписания [РИ (филиала) АлтГУ](https://rb.asu.ru) — на [Telegram Serverless](https://core.telegram.org/bots/serverless) (@tgcloud): без сервера, код исполняется прямо в облаке Telegram.

Данные тянет через открытое API [asu-rub-api](https://github.com/goggi22/asu-rub-api) (можно поднять своё).

## Фичи

- 🔍 поиск группы по номеру — запоминает для лички/чата
- 📊 **rich-таблицы** (`sendRichMessage`) с нативными кнопками `<tg-button>` прямо в теле сообщения
- 📅 сегодня / завтра / неделя — кнопками или командами
- 🔔 **напоминания о парах**: утренняя сводка в 7:30, за 10 минут до пары, на старте пары
- 👥 работа в групповых чатах (команды / @упоминания / «расписание»)
- 🌐 guest mode — бот отвечает через упоминание в чатах, где его даже нет
- 💾 встроенная база (sdk/db) — пользователи, группы, флаги напоминаний

Слоты звонков зашиты: 1: 08:00–09:30 · 2: 09:40–11:10 · 3: 11:20–12:50 · 4: 13:20–14:50 · 5: 15:00–16:30 · 6: 16:40–18:10 · 7: 18:20–19:40 · 8: 19:50–21:10. Часовой пояс — Рубцовск, UTC+7.

## Структура

```
tgcloud/
├── schema.js               # таблица users (tg_id, группа, notify, last_*)
├── lib/
│   ├── asu.js              # клиент API + rich-форматтеры + слоты звонков
│   ├── keyboard.js         # <tg-button> rich-кнопки (+ inline fallback)
│   └── schedule.js         # отправка расписания rich-сообщением
├── handlers/
│   ├── message.js          # личка + группы, поиск группы
│   ├── callback_query.js   # нажатия кнопок
│   └── guest_message.js    # guest mode (answerGuestQuery)
└── endpoints/
    └── tick.js             # тик для крона: сводка + напоминания
```

## Деплой

```bash
# 1. создать бота у @BotFather, взять токен
# 2. scaffold проекта
npm create @tgcloud/bot@latest my-bot
cd my-bot

# 3. скопировать сюда папку tgcloud/ из этого репо
# 4. задеплоить (токен можно передавать env-ом, login не нужен)
export TGCLOUD_TOKEN="app...:..."
npx tgcloud push
npx tgcloud migrate --yes
```

В @BotFather включить **Group Mode** и **Guest Mode** (Bot Settings), чтобы работали чаты и упоминания.

### Напоминания (cron)

Serverless не имеет таймеров — тик дёргается кроном с любой машины:

```cron
* * * * * cd /path/to/my-bot && TGCLOUD_TOKEN="app...:..." npx tgcloud run endpoints/tick '{}' --ctx '{ initData: { user: { id: 1 } } }' >> /var/log/tick.log 2>&1
```

Тик идемпотентен (`last_notify` в базе): двойной запуск ничего не задублирует.

### Свой API вместо asu.rub22.ru

В `tgcloud/lib/asu.js` поменять `API` на свой инстанс [asu-rub-api](https://github.com/goggi22/asu-rub-api). Прямой `fetch` к `rb.asu.ru` из инфраструктуры Telegram не проходит — апстрим блокирует, поэтому прокси нужен.

## Команды

| команда | что делает |
|---------|-----------|
| `/start` | приветствие + кнопки |
| номер группы (`1235`) | найти и запомнить |
| `/today` `/tomorrow` `/week` | расписание |
| `/notify on\|off` | напоминания |

Проект не связан с АлтГУ. Данные — публичное расписание rb.asu.ru.

## License

MIT
