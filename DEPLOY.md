# Деплой на Vercel

## 1. Зайди на vercel.com

Нажми **New Project** → выбери репозиторий `mono-polly` из GitHub.

---

## 2. Добавь переменные окружения

Перед нажатием Deploy нажми **Environment Variables** и добавь 4 строки:

```
VITE_SUPABASE_URL        = https://dvdtxbdspledcuhueyrj.supabase.co
VITE_SUPABASE_ANON_KEY   = eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR2ZHR4YmRzcGxlZGN1aHVleXJqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI3MDQxMjUsImV4cCI6MjA5ODI4MDEyNX0.MPaNDXMlwPU5xyYlwbEGl0QNUvGhuyWN-EIf-sk8D6A
VITE_GEMINI_API_KEY      = (твой ключ с aistudio.google.com/apikey)
VITE_ADMIN_PASSWORD      = marketwars2024
```

---

## 3. Нажми Deploy

Vercel сам соберёт проект. Через ~1 минуту сайт будет доступен по ссылке:

```
https://mono-polly.vercel.app
```

---

## Если нужно обновить переменные после деплоя

Vercel → твой проект → **Settings → Environment Variables** → изменить → **Redeploy**.
о