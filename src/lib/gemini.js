// Очищаем ключ от невидимых символов и кодируем для URL
const GEMINI_API_KEY = (import.meta.env.VITE_GEMINI_API_KEY || '').replace(/[^\x20-\x7E]/g, '').trim();
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${encodeURIComponent(GEMINI_API_KEY)}`;

export async function scoreSubmission(features, peerScore, activeEventText) {
  if (!GEMINI_API_KEY) {
    return { score: 5.0, reason: 'Gemini API ключ не настроен' };
  }

  const prompt = `You are a strict hackathon judge evaluating a team's project progress.

The team claims to have built these features this round:
"${features}"

Competitor teams rated this submission: ${peerScore}/10

Current market trend: "${activeEventText}"

Evaluate on:
1. Feature completeness (are these features realistic for 20 minutes of work?)
2. Technical complexity (how hard are these to build?)
3. Market relevance (do these features match the current market trend?)

Return ONLY a valid JSON object, no markdown, no explanation outside JSON:
{"score": 7.5, "reason": "Good feature set with relevant AI integration, but login system seems basic."}`;

  try {
    const response = await fetch(GEMINI_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.3 }
      })
    });

    if (!response.ok) {
      console.error('Gemini API error:', response.status);
      return { score: 5.0, reason: 'Ошибка API: ' + response.status };
    }

    const data = await response.json();

    if (!data.candidates?.[0]?.content?.parts?.[0]?.text) {
      return { score: 5.0, reason: 'Пустой ответ от AI' };
    }

    const text = data.candidates[0].content.parts[0].text;
    const clean = text.replace(/```json|```/g, '').trim();
    return JSON.parse(clean);
  } catch (err) {
    console.error('Gemini scoring failed:', err);
    return { score: 5.0, reason: 'AI недоступен, выставлена средняя оценка' };
  }
}
