const { decrypt } = require('./encryption');

async function sendWhatsApp(prisma, phone, message) {
  const sessionSetting = await prisma.setting.findUnique({ where: { key: 'walytic_session_id' } });

  if (!sessionSetting) {
    throw new Error('Walytic session ID not configured');
  }

  const sessionId = decrypt(sessionSetting.valueEncrypted);

  const response = await fetch(`https://api.walytic.com/api/whatsapp/${encodeURIComponent(sessionId)}/send`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ number: phone, message }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Walytic API error: ${response.status} ${text}`);
  }

  return response.json();
}

module.exports = { sendWhatsApp };
