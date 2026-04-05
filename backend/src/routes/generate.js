const { Router } = require('express');
const { generateText } = require('../services/openai');

const router = Router();

router.post('/', async (req, res) => {
  try {
    const { content, promptId } = req.body;
    if (!content || !promptId) {
      return res.status(400).json({ error: 'Content and promptId required' });
    }

    const prompt = await req.prisma.prompt.findUnique({ where: { id: promptId } });
    if (!prompt) {
      return res.status(404).json({ error: 'Prompt not found' });
    }

    // Replace any placeholder in the prompt with the actual content
    let systemPrompt = prompt.promptText;
    if (systemPrompt.includes('{PASTE_SELECTED_WEBSITE_TEXT}')) {
      systemPrompt = systemPrompt.replace('{PASTE_SELECTED_WEBSITE_TEXT}', content);
    }

    const data = await generateText(req.prisma, systemPrompt, content);
    const text = data.choices?.[0]?.message?.content || '';
    res.json({ result: text });
  } catch (err) {
    console.error('Generation error:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/prompts (non-admin view — no promptText exposed)
router.get('/', async (req, res) => {
  try {
    const { category } = req.query;
    const where = category ? { category } : {};

    const prompts = await req.prisma.prompt.findMany({
      where,
      select: { id: true, name: true, category: true, sortOrder: true },
      orderBy: { sortOrder: 'asc' },
    });

    res.json(prompts);
  } catch (err) {
    console.error('List prompts error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
