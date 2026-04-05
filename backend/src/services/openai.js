const { decrypt } = require('./encryption');

async function generateText(prisma, systemPrompt, userContent) {
  const setting = await prisma.setting.findUnique({ where: { key: 'openai_api_key' } });
  if (!setting) {
    throw new Error('OpenAI API key not configured');
  }

  const apiKey = decrypt(setting.valueEncrypted);

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userContent },
      ],
      max_tokens: 1000,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`OpenAI API error: ${response.status} ${text}`);
  }

  return response.json();
}

module.exports = { generateText };
