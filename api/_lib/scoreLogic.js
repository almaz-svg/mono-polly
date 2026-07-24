// Shared between the Vercel serverless handler (api/score.js) and the
// Vite dev-server middleware (vite.config.js), so `npm run dev` and a
// real deploy behave the same way instead of the dev server silently
// 404-ing on AI scoring.
const GROK_URL = 'https://api.groq.com/openai/v1/chat/completions';

const TECH_KEYWORDS = ['auth', 'авторизац', 'регистрац', 'api', 'база', 'database', 'ai', 'ии', 'фильтр', 'filter', 'поиск', 'search', 'профил', 'profile', 'чат', 'chat', 'аналитик', 'analytics', 'dashboard', 'дашборд', 'уведомлен', 'notification', 'оплат', 'payment', 'карт', 'map', 'тест', 'deploy', 'докер', 'docker', 'кэш', 'cache', 'websocket', 'реалтайм', 'realtime'];

// Веса критериев (см. ТЗ): понимание сути кейса 20%, оригинальность 30%,
// реализуемость 25%, обоснованность монетизации 25%. Общие для всех кейсов.
const WEIGHTS = { understanding: 0.2, originality: 0.3, feasibility: 0.25, monetization: 0.25 };

function weightedTotal(scores) {
  return (
    scores.understanding * WEIGHTS.understanding +
    scores.originality * WEIGHTS.originality +
    scores.feasibility * WEIGHTS.feasibility +
    scores.monetization * WEIGHTS.monetization
  );
}

function smartFallbackScore(features, peerScore, project) {
  const text = features.toLowerCase();
  const words = text.split(/\s+/).filter(w => w.length > 2);
  const uniqueWords = new Set(words).size;

  let techScore = 0;
  TECH_KEYWORDS.forEach(kw => { if (text.includes(kw)) techScore += 1; });

  const lengthSignal = Math.min(1, words.length / 30); // 0..1
  const techSignal = Math.min(1, techScore / 5); // 0..1
  const peerSignal = Math.min(1, Math.max(0, (peerScore - 1) / 9)); // 0..1
  const noise = () => (Math.random() - 0.5) * 12;

  // Понимание сути исходного проекта — пересечение слов заявки со словами
  // брифа кейса; без проекта считаем нейтрально.
  let relevanceSignal = 0.5;
  if (project) {
    const projectWords = `${project.title} ${project.whatIs} ${project.keyFeature} ${project.tasks}`
      .toLowerCase()
      .split(/\s+/)
      .filter(w => w.length > 4);
    const overlap = new Set(projectWords.filter(w => text.includes(w))).size;
    relevanceSignal = Math.min(1, overlap / 4);
  }

  const clamp = n => Math.round(Math.min(100, Math.max(0, n)));
  const scores = {
    understanding: clamp(40 + relevanceSignal * 55 + noise()),
    originality: clamp(35 + lengthSignal * 30 + techSignal * 25 + noise()),
    feasibility: clamp(45 + lengthSignal * 25 + techSignal * 20 + noise()),
    monetization: clamp(40 + peerSignal * 35 + techSignal * 15 + noise()),
  };

  const totalScore = Math.round(weightedTotal(scores));
  const score = Math.round(Math.min(10, Math.max(1, totalScore / 10)) * 10) / 10;

  const reasons = [];
  if (techScore >= 3) reasons.push('хорошее разнообразие технических фич');
  else if (techScore === 0) reasons.push('мало конкретики в описании');
  if (words.length < 10) reasons.push('описание слишком короткое');
  if (words.length > 30) reasons.push('подробное описание');
  if (project) reasons.push(relevanceSignal >= 0.5 ? 'идея явно развивает исходный кейс' : 'слабая видимая связь с исходным кейсом');
  const feedback = reasons.length > 0
    ? `Локальная оценка: ${reasons.join(', ')}.`
    : 'Локальная оценка на основе описания.';

  return {
    score,
    reason: feedback,
    source: 'fallback',
    breakdown: {
      ...scores,
      totalScore,
      feedback,
      strongPoint: techScore >= 3 ? 'Техническое разнообразие фич' : 'Заявка сдана вовремя',
      weakPoint: words.length < 10 ? 'Слишком короткое описание' : 'Нет данных от AI — оценка приблизительная',
    },
  };
}

function parseGrokJson(text) {
  const stripped = text.replace(/```json|```/g, '').trim();
  const match = stripped.match(/\{[\s\S]*\}/);
  const parsed = JSON.parse(match ? match[0] : stripped);

  const clamp100 = n => Math.round(Math.min(100, Math.max(0, Number(n) || 0)));
  const raw = parsed.scores || {};
  const scores = {
    understanding: clamp100(raw.understanding),
    originality: clamp100(raw.originality),
    feasibility: clamp100(raw.feasibility),
    monetization: clamp100(raw.monetization),
  };
  const totalScore = Number.isFinite(Number(parsed.totalScore))
    ? clamp100(parsed.totalScore)
    : Math.round(weightedTotal(scores));

  const score = Math.round(Math.min(10, Math.max(1, totalScore / 10)) * 10) / 10;
  const feedback = typeof parsed.feedback === 'string' && parsed.feedback.trim()
    ? parsed.feedback.trim()
    : 'Оценка от AI.';

  return {
    score,
    reason: feedback,
    source: 'grok',
    breakdown: {
      ...scores,
      totalScore,
      feedback,
      strongPoint: typeof parsed.strongPoint === 'string' ? parsed.strongPoint.trim() : '',
      weakPoint: typeof parsed.weakPoint === 'string' ? parsed.weakPoint.trim() : '',
    },
  };
}

export async function scoreSubmission(features, peerScore, activeEventText, screenshotUrl, apiKey, project) {
  if (apiKey) {
    const projectSection = project
      ? `ИСХОДНЫЙ ПРОЕКТ:
Название: ${project.title}
Описание: ${project.whatIs}
Ключевая фишка: ${project.keyFeature}

ЗАДАЧИ, которые должна была раскрыть команда:
${project.tasks}

`
      : '';

    const prompt = `Ты — эксперт-жюри в игре "Стартап Монополия". ${project ? 'Тебе дан кейс исходного проекта и питч команды, которая предложила, как этот проект можно развить.' : 'Оцени прогресс команды за 20 минут работы (кейс не назначен).'}

${projectSection}ПИТЧ КОМАНДЫ:
"${features}"

Оценка других команд: ${peerScore}/10
Текущий тренд рынка: "${activeEventText}"
${screenshotUrl ? 'Учти также качество UI/UX дизайна по приложенному скриншоту.' : ''}

Оцени питч по 4 критериям (от 0 до 100 по каждому):
1. Понимание сути исходного проекта (вес 20%)
2. Оригинальность предложенного развития (вес 30%)
3. Реализуемость идеи за 20 минут (вес 25%)
4. Обоснованность монетизации (вес 25%)

Ответь СТРОГО в формате JSON, без преамбулы и без markdown-разметки:
{
  "scores": {
    "understanding": число,
    "originality": число,
    "feasibility": число,
    "monetization": число
  },
  "totalScore": число (взвешенное среднее по весам выше),
  "feedback": "краткий комментарий на русском, 2-3 предложения",
  "strongPoint": "самая сильная сторона питча",
  "weakPoint": "что стоит улучшить"
}`;

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
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: screenshotUrl ? 'meta-llama/llama-4-scout-17b-16e-instruct' : 'llama-3.3-70b-versatile',
          messages: [{ role: 'user', content }],
          temperature: 0.4,
        })
      });

      if (response.ok) {
        const data = await response.json();
        const text = data.choices?.[0]?.message?.content;
        if (text) return parseGrokJson(text);
        console.error('Grok response had no message content:', JSON.stringify(data).slice(0, 500));
      } else {
        console.error('Grok API error:', response.status, await response.text().catch(() => ''));
      }
    } catch (err) {
      console.error('Grok call failed, using fallback:', err);
    }
  }

  return smartFallbackScore(features, peerScore, project);
}
