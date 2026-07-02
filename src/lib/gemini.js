const GROK_API_KEY = (import.meta.env.VITE_GROK_API_KEY || '').replace(/[^\x20-\x7E]/g, '').trim();
const GROK_URL = 'https://api.x.ai/v1/chat/completions';

const TECH_KEYWORDS = ['auth', 'авторизац', 'регистрац', 'api', 'база', 'database', 'ai', 'ии', 'фильтр', 'filter', 'поиск', 'search', 'профил', 'profile', 'чат', 'chat', 'аналитик', 'analytics', 'dashboard', 'дашборд', 'уведомлен', 'notification', 'оплат', 'payment', 'карт', 'map', 'тест', 'deploy', 'докер', 'docker', 'кэш', 'cache', 'websocket', 'реалтайм', 'realtime'];

function smartFallbackScore(features, peerScore) {
  const text = features.toLowerCase();
  const words = text.split(/\s+/).filter(w => w.length > 2);
  const uniqueWords = new Set(words).size;

  let techScore = 0;
  TECH_KEYWORDS.forEach(kw => { if (text.includes(kw)) techScore += 1; });

  const lengthScore = Math.min(3, words.length / 15);
  const keywordScore = Math.min(4, techScore * 0.8);
  const peerBonus = (peerScore - 5) * 0.3;
  const noise = (Math.random() - 0.5) * 1.5;

  const raw = 4 + lengthScore + keywordScore + peerBonus + noise;
  const score = Math.round(Math.min(10, Math.max(1, raw)) * 10) / 10;

  const reasons = [];
  if (techScore >= 3) reasons.push('хорошее разнообразие технических фич');
  else if (techScore === 0) reasons.push('мало конкретики в описании');
  if (words.length < 10) reasons.push('описание слишком короткое');
  if (words.length > 30) reasons.push('подробное описание');
  if (peerScore >= 7) reasons.push('высокая оценка от команд');
  if (peerScore <= 4) reasons.push('низкая оценка от команд');
  if (uniqueWords > 20) reasons.push('широкий охват функций');

  const reason = reasons.length > 0
    ? `Локальная оценка: ${reasons.join(', ')}.`
    : 'Локальная оценка на основе описания.';

  return { score, reason };
}

export async function scoreSubmission(features, peerScore, activeEventText, screenshotUrl = null) {
  if (GROK_API_KEY) {
    const prompt = `Ты строгий судья хакатона. Оцени прогресс команды за 20 минут работы.

Команда сделала:
"${features}"

Оценка других команд: ${peerScore}/10
Текущий тренд рынка: "${activeEventText}"

Критерии оценки:
1. Реалистичность — можно ли это реально сделать за 20 минут?
2. Техническая сложность реализованных фич
3. Соответствие текущему тренду рынка
${screenshotUrl ? '4. Качество UI/UX дизайна (оцени по скриншоту)' : ''}

Верни ТОЛЬКО JSON без markdown:
{"score": 7.5, "reason": "Причина на русском языке."}`;

    try {
      const content = screenshotUrl
        ? [
            { type: 'image_url', image_url: { url: screenshotUrl } },
            { type: 'text', text: prompt },
          ]
        : prompt;

      const response = await fetch(GROK_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${GROK_API_KEY}`,
        },
        body: JSON.stringify({
          model: screenshotUrl ? 'grok-2-vision-1212' : 'grok-3-mini',
          messages: [{ role: 'user', content }],
          temperature: 0.4,
        })
      });

      if (response.ok) {
        const data = await response.json();
        const text = data.choices?.[0]?.message?.content;
        if (text) {
          const clean = text.replace(/```json|```/g, '').trim();
          return JSON.parse(clean);
        }
      }
    } catch (err) {
      console.error('Grok failed, using fallback:', err);
    }
  }

  return smartFallbackScore(features, peerScore);
}
