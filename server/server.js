/**
 * server/server.js
 * ----------------
 * Express-API für:
 *   1. HeyGen-Streaming-Token  (GET  /api/get-access-token)
 *   2. OpenAI-Chat-Antwort     (POST /api/message)
 *
 * Benötigte .env-Variablen (im Ordner server/ hinterlegen):
 *   PORT=3000
 *   HEYGEN_API_KEY=sk-heygen-...
 *   OPENAI_API_KEY=sk-openai-...
 *   CORS_ORIGIN=https://dein-frontend.onrender.com
 */

import 'dotenv/config';          // .env laden
import express from 'express';
import cors    from 'cors';
import OpenAI  from 'openai';

const allowed = (process.env.CORS_ORIGIN ?? '').split(',').map(o => o.trim());
// --------------------------------------------------
// Grund-Setup
// --------------------------------------------------
const app  = express();
const port = process.env.PORT || 3000;

// CORS nur für dein Frontend erlauben
app.use(cors({
  origin: (origin, cb) => {
    if (!origin || allowed.includes(origin)) return cb(null, true);
    cb(new Error('Not allowed by CORS'));
  },
  credentials: true,
}));

// JSON-Body parsen
app.use(express.json());

// --------------------------------------------------
// 1) OpenAI-Endpunkt  (Chatbot)
// --------------------------------------------------
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

app.post('/api/message', async (req, res) => {
  const { message } = req.body;

  if (typeof message !== 'string' || !message.trim()) {
    return res.status(400).json({ error: '`message` fehlt oder leer' });
  }

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [{ role: 'user', content: message }],
    });

    const reply = completion.choices?.[0]?.message?.content?.trim() ?? '';
    return res.json({ response: reply });
  } catch (err) {
    console.error('❌ OpenAI-Error:', err);
    return res.status(500).json({ error: 'OpenAI-Anfrage fehlgeschlagen' });
  }
});

// --------------------------------------------------
// 2) HeyGen-Endpunkt  (Streaming-Avatar)
// --------------------------------------------------
app.get('/api/get-access-token', async (_req, res) => {
  const apiKey = process.env.HEYGEN_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'HEYGEN_API_KEY fehlt' });
  }

  try {
    const response = await fetch(
      'https://api.heygen.com/v1/streaming.create_token',
      { method: 'POST', headers: { 'x-api-key': apiKey } },
    );
    const json = await response.json();

    if (!response.ok || !json?.data?.token) {
      return res.status(500).json({
        error:   'Token konnte nicht erstellt werden',
        details: json,
      });
    }

    return res.json({ token: json.data.token });
  } catch (err) {
    console.error('❌ HeyGen-Token-Error:', err);
    return res.status(500).json({ error: 'Interner Serverfehler' });
  }
});

// --------------------------------------------------
// Fallback 404
// --------------------------------------------------
app.use((_req, res) => res.status(404).json({ error: 'Nicht gefunden' }));

// --------------------------------------------------
// Serverstart
// --------------------------------------------------
app.listen(port, () => {
  console.log(`🚀 API-Server läuft auf http://localhost:${port}`);
});
