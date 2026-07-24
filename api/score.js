// Vercel serverless function. Runs server-side only, so GROK_API_KEY
// (no VITE_ prefix) never reaches the client bundle.
import { scoreSubmission } from './_lib/scoreLogic.js';

const GROK_API_KEY = (process.env.GROK_API_KEY || '').replace(/[^\x20-\x7E]/g, '').trim();

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { features, peerScore, activeEventText, screenshotUrl, project } = req.body || {};
  if (!features || typeof features !== 'string') {
    res.status(400).json({ error: 'features is required' });
    return;
  }

  const result = await scoreSubmission(
    features,
    Number(peerScore) || 5,
    activeEventText || 'Нет активного события',
    screenshotUrl || null,
    GROK_API_KEY,
    project || null
  );
  res.status(200).json(result);
}
