const { decrypt } = require('./encryption');

async function sendWhatsApp(prisma, phone, message) {
  const sessionSetting = await prisma.setting.findUnique({ where: { key: 'walytic_session_id' } });
  const keySetting = await prisma.setting.findUnique({ where: { key: 'walytic_api_key' } });

  if (!sessionSetting) {
    throw new Error('Walytic session ID not configured');
  }
  if (!keySetting) {
    throw new Error('Walytic API key not configured');
  }

  const sessionId = decrypt(sessionSetting.valueEncrypted);
  const apiKey = decrypt(keySetting.valueEncrypted);

  const response = await fetch('https://api.walytic.com/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId, apiKey, phone, message }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Walytic API error: ${response.status} ${text}`);
  }

  return response.json();
}

module.exports = { sendWhatsApp };
