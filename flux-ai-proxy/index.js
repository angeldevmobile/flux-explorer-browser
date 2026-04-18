const express = require('express');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const app = express();
app.use(express.json({ limit: '20mb' }));

const API_KEY = process.env.GEMINI_API_KEY;
if (!API_KEY) {
  console.error('[flux-ai-proxy] ERROR: GEMINI_API_KEY no configurada');
  process.exit(1);
}

const genAI = new GoogleGenerativeAI(API_KEY);

// Health check
app.get('/health', (_req, res) => res.json({ ok: true }));

// Generacion de texto
app.post('/ai/generate', async (req, res) => {
  try {
    const { prompt, model = 'gemini-2.0-flash' } = req.body;
    if (!prompt) return res.status(400).json({ error: 'prompt requerido' });

    const m = genAI.getGenerativeModel({ model });
    const result = await m.generateContent(prompt);
    res.json({ text: result.response.text() });
  } catch (err) {
    console.error('[flux-ai-proxy] /ai/generate error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Generacion con imagen (vision)
app.post('/ai/generate-vision', async (req, res) => {
  try {
    const { imageBase64, mimeType, prompt, model = 'gemini-2.0-flash' } = req.body;
    if (!imageBase64 || !prompt) return res.status(400).json({ error: 'imageBase64 y prompt requeridos' });

    const m = genAI.getGenerativeModel({ model });
    const result = await m.generateContent([
      { inlineData: { data: imageBase64, mimeType: mimeType || 'image/jpeg' } },
      prompt,
    ]);
    res.json({ text: result.response.text() });
  } catch (err) {
    console.error('[flux-ai-proxy] /ai/generate-vision error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`[flux-ai-proxy] Corriendo en puerto ${PORT}`));
