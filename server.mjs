import { createServer } from 'node:http';

const port = Number(process.env.PORT || 8787);
const botToken = process.env.TG_BOT_TOKEN || '';
const chatIds = String(process.env.TG_CHAT_IDS || '')
  .split(',')
  .map((id) => id.trim())
  .filter(Boolean);

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    ...corsHeaders(),
  });
  res.end(JSON.stringify(payload));
}

async function sendToTelegram(text) {
  const requests = chatIds.map((chatId) => fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
    }),
  }));

  const responses = await Promise.all(requests);
  if (responses.some((response) => !response.ok)) {
    throw new Error('Failed to send Telegram message');
  }
}

const server = createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, corsHeaders());
    res.end();
    return;
  }

  if (req.method === 'GET' && req.url === '/health') {
    sendJson(res, 200, { ok: true });
    return;
  }

  if (req.method === 'POST' && req.url === '/api/lead') {
    if (!botToken || chatIds.length === 0) {
      sendJson(res, 500, { ok: false, error: 'Server Telegram config is missing' });
      return;
    }

    try {
      let raw = '';
      for await (const chunk of req) {
        raw += chunk;
      }

      const payload = JSON.parse(raw || '{}');
      const name = String(payload.name || '').trim();
      const contact = String(payload.contact || '').trim();
      const goal = String(payload.goal || '').trim();

      if (!name || !contact || !goal) {
        sendJson(res, 400, { ok: false, error: 'Invalid payload' });
        return;
      }

      const text = [
        `Імʼя: ${name}`,
        `Контакт: ${contact}`,
        `Ціль: ${goal}`,
      ].join('\n\n');

      await sendToTelegram(text);
      sendJson(res, 200, { ok: true });
      return;
    } catch {
      sendJson(res, 500, { ok: false, error: 'Failed to send message' });
      return;
    }
  }

  sendJson(res, 404, { ok: false, error: 'Not found' });
});

server.listen(port, () => {
  console.log(`API listening on http://localhost:${port}`);
});
