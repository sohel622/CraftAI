// Entry point: `npm start`
import { createApp } from './app.js';
import { config, readiness } from './config/env.js';

const app = createApp();

app.listen(config.port, () => {
  const r = readiness();
  console.log(`CraftAI backend running on http://localhost:${config.port}`);
  console.log(`Gemini: ${r.gemini ? 'ready' : 'MISSING KEY'} | Supabase: ${r.supabase ? 'ready' : 'MISSING'} | GitHub: ${r.github ? 'ready' : 'MISSING'}`);
});
