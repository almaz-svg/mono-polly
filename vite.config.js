import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { scoreSubmission } from './api/_lib/scoreLogic.js'

// `vercel dev` runs api/score.js for real, but `npm run dev` (plain Vite)
// has no serverless runtime at all — without this, POST /api/score 404s
// and every AI scoring call silently falls back to a flat score.
function apiScoreDevMiddleware(mode) {
  return {
    name: 'api-score-dev-middleware',
    configureServer(server) {
      const env = loadEnv(mode, process.cwd(), '');
      const apiKey = (env.GROK_API_KEY || '').replace(/[^\x20-\x7E]/g, '').trim();

      server.middlewares.use('/api/score', (req, res, next) => {
        if (req.method !== 'POST') return next();

        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', async () => {
          try {
            const { features, peerScore, activeEventText, screenshotUrl, project } = JSON.parse(body || '{}');
            if (!features || typeof features !== 'string') {
              res.writeHead(400, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'features is required' }));
              return;
            }
            const result = await scoreSubmission(
              features,
              Number(peerScore) || 5,
              activeEventText || 'Нет активного события',
              screenshotUrl || null,
              apiKey,
              project || null
            );
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(result));
          } catch (err) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: String(err) }));
          }
        });
      });
    },
  };
}

export default defineConfig(({ mode }) => ({
  plugins: [react(), tailwindcss(), apiScoreDevMiddleware(mode)],
}))
