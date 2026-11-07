# TapKarta — сайт

Структура:
- `index.html` — сайт (каталог, видео, форма заказа)
- `media/` — видео и обложки к ним
- `netlify/functions/order.mjs` — отправляет заказ с сайта тебе в Telegram
- `netlify.toml` — настройки для Netlify

Переменные окружения в Netlify (Site configuration → Environment variables):
- `BOT_TOKEN` — токен бота (тот же, что на Render)
- `ADMIN_ID` — 601357387

Цены, названия и фото карт меняются в одном файле: `catalog.json`.
Фото карт лежат в `media/cards/`.
