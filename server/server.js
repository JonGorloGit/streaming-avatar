/**
 * API-Server
 * ----------
 * GET  /api/get-access-token      → HeyGen-Token
 * GET  /api/hr-prompt?style=...   → HR-Prompt
 * POST /api/message               → OpenAI-Antwort  (inkl. Verlauf)
 */

import 'dotenv/config';
import express from 'express';
import cors    from 'cors';
import fetch   from 'node-fetch';
import OpenAI  from 'openai';
import { buildPrompt } from './hrKnowledge.js';

const app  = express();
const port = process.env.PORT || 3000;

/* ---- CORS ---- */
const allowed = (process.env.CORS_ORIGIN ?? '')
  .split(',')
  .map(o => o.trim())
  .filter(Boolean);

app.use(cors({
  origin: (origin, cb) => {
    if (!origin || allowed.includes(origin)) return cb(null, true);
    cb(new Error('Not allowed by CORS'));
  },
  credentials: true,
}));

app.use(express.json());

/* ---- OpenAI ---- */
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/**
 *  POST /api/message
 *  Body: { message:string, history:Array<{role,content}>, style:'soc'|'ins' }
 */
app.post('/api/message', async (req, res) => {
  const { message, history = [], style = 'soc' } = req.body;

  if (typeof message !== 'string' || !message.trim()) {
    return res.status(400).json({ error: '`message` fehlt oder leer' });
  }
  if (!Array.isArray(history)) {
    return res.status(400).json({ error: '`history` muss ein Array sein' });
  }

  /* Systemprompt + bisheriger Verlauf + neue Nutzerfrage */
  const messages = [
    { role: 'system', content: buildPrompt(style) },
    ...history,                                     // nur user/assistant-Einträge
    { role: 'user', content: message.trim() },
  ];

  try {
    const completion = await openai.chat.completions.create({
      model   : 'gpt-3.5-turbo',      // ersatzweise gpt-4o
      messages,
    });
    const answer = completion.choices[0]?.message?.content?.trim() ?? '';
    return res.json({ response: answer });
  } catch (err) {
    console.error('OpenAI-Error:', err);
    return res.status(500).json({ error: 'OpenAI-Anfrage fehlgeschlagen' });
  }
});

/* ---- HeyGen-Token ---- */
app.get('/api/get-access-token', async (_req, res) => {
  const apiKey = process.env.HEYGEN_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'HEYGEN_API_KEY fehlt' });

  try {
    const r    = await fetch('https://api.heygen.com/v1/streaming.create_token', {
      method : 'POST',
      headers: { 'x-api-key': apiKey },
    });
    const json = await r.json();
    if (!r.ok || !json?.data?.token) {
      return res.status(502).json({ error: 'Token-Erstellung fehlgeschlagen', details: json });
    }
    res.json({ token: json.data.token });
  } catch (err) {
    console.error('HeyGen-Token-Error:', err);
    res.status(500).json({ error: 'Interner Serverfehler' });
  }
});

/* ---- HR-Prompt (Avatar) ---- */
app.get('/api/hr-prompt', (req, res) => {
  const style = req.query.style === 'ins' ? 'ins' : 'soc';
  res.json({ knowledgeBase: buildPrompt(style) });
});

/* ---- 404 ---- */
app.use((_req, res) => res.status(404).json({ error: 'Nicht gefunden' }));

/* ---- Start ---- */
app.listen(port, () =>
  console.log(`🚀 API-Server läuft auf http://localhost:${port}`)
);
