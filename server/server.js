import 'dotenv/config';
import express from 'express';
import cors from 'cors';

const app  = express();
const port = process.env.PORT || 3000;

// CORS erlauben – in Produktion setzt du hier deine Static-Site-URL
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',  
  credentials: true
}));

// JSON-Parsing (falls benötigt)
app.use(express.json());

// API-Route für HeyGen-Token
app.get('/api/get-access-token', async (_req, res) => {
  const apiKey = process.env.HEYGEN_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'HEYGEN_API_KEY fehlt' });
  }

  try {
    const response = await fetch(
      'https://api.heygen.com/v1/streaming.create_token',
      { method: 'POST', headers: { 'x-api-key': apiKey } }
    );
    const json = await response.json();

    if (!response.ok || !json?.data?.token) {
      return res.status(500).json({
        error:   'Token konnte nicht erstellt werden',
        details: json
      });
    }

    return res.json({ token: json.data.token });
  } catch (err) {
    console.error('❌ Token-Request-Error:', err);
    return res.status(500).json({ error: 'Interner Serverfehler' });
  }
});

// Falls andere Routen aufgerufen werden:
app.use((_req, res) => res.status(404).json({ error: 'Nicht gefunden' }));

app.listen(port, () => {
  console.log(`🚀 API-Server läuft auf http://localhost:${port}`);
});
