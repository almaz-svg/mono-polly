// AI scoring runs server-side (api/score.js) so the Grok API key never
// reaches the client bundle.
export async function scoreSubmission(features, peerScore, activeEventText, screenshotUrl = null, project = null) {
  try {
    const response = await fetch('/api/score', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ features, peerScore, activeEventText, screenshotUrl, project }),
    });
    if (response.ok) return await response.json();
  } catch (err) {
    console.error('Scoring request failed:', err);
  }
  return { score: 5, reason: 'Не удалось получить оценку, выставлена нейтральная оценка.' };
}
