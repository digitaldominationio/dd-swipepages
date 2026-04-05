const { decrypt } = require('./encryption');

async function validateEmail(prisma, email) {
  const setting = await prisma.setting.findUnique({ where: { key: 'reoon_api_key' } });
  if (!setting) {
    throw new Error('Reoon API key not configured');
  }

  const apiKey = decrypt(setting.valueEncrypted);

  const params = new URLSearchParams({ email, key: apiKey, mode: 'power' });
  const response = await fetch(`https://emailverifier.reoon.com/api/v1/verify?${params}`);

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Reoon API error: ${response.status} ${text}`);
  }

  return response.json();
}

module.exports = { validateEmail };
