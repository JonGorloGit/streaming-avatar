import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';

const app  = express();
const port = process.env.PORT || 3000;

// CORS konfigurieren: nur deinen Dev-Host erlauben
app.use(cors({
  origin: 'http://localhost:5173',  // oder '*' für alle Origins
  credentials: true                 // falls du später Cookies/Session brauchst
}));

// JSON-Parsing (falls du POST-Endpunkte hast)
app.use(express.json());

// Dein bestehender Code bleibt unverändert:
app.get('/api/get-access-token', async (_req, res) => {
  const apiKey = process.env.HEYGEN_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'HEYGEN_API_KEY fehlt' });

  try {
    const response = await fetch(
      'https://api.heygen.com/v1/streaming.create_token',
      { method: 'POST', headers: { 'x-api-key': apiKey } }
    );
    const json = await response.json();
    if (!response.ok || !json?.data?.token) {
      return res.status(500).json({ error: 'Token konnte nicht erstellt werden', details: json });
    }
    return res.json({ token: json.data.token });
  } catch (err) {
    console.error('❌ Token-Request-Error:', err);
    return res.status(500).json({ error: 'Interner Serverfehler' });
  }
});

// Statics und SPA-Fallback...
const clientDist = path.resolve(process.cwd(), 'client/dist');
app.use(express.static(clientDist));
app.use((req, res) => {
  if (req.method === 'GET') {
    res.sendFile(path.join(clientDist, 'index.html'));
  } else {
    res.status(404).end();
  }
});

app.listen(port, () => {
  console.log(`🚀 Server läuft auf http://localhost:${port}`);
});
