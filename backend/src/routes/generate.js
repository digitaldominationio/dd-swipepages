const { Router } = require('express');
const { generateText } = require('../services/openai');
const { logActivity } = require('../middleware/activityLog');

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
    await logActivity(req.prisma, req.user.id, 'generate', 'ai_generation', promptId);
    res.json({ result: text });
  } catch (err) {
    console.error('Generation error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/generate/proposal — Upwork proposal writer
router.post('/proposal', async (req, res) => {
  try {
    const { jobTitle, jobDescription, tone, highlights, budget, skills } = req.body;
    if (!jobDescription) {
      return res.status(400).json({ error: 'Job description required' });
    }

    const toneMap = {
      professional: 'professional and polished',
      friendly: 'warm and friendly yet professional',
      confident: 'confident and assertive',
      concise: 'concise, direct, and to-the-point',
    };
    const toneDesc = toneMap[tone] || toneMap.professional;

    const systemPrompt = `You are an expert Upwork freelancer proposal writer. Write a compelling, personalized proposal that:
- Opens with a hook that shows you understand the client's specific problem
- Demonstrates relevant experience briefly (2-3 sentences max)
- Proposes a clear approach/solution
- Ends with a soft call-to-action
- Is ${toneDesc} in tone
- Keeps it SHORT — around 150-200 words max (Upwork clients prefer concise proposals)
- Does NOT use generic phrases like "I am writing to express my interest" or "Dear hiring manager"
- Does NOT include placeholder text in brackets
- Sounds natural and human, not AI-generated`;

    const userContent = `Job Title: ${jobTitle || 'Not specified'}
Job Description: ${jobDescription}
${budget ? `Budget: ${budget}` : ''}
${skills ? `Required Skills: ${skills}` : ''}
${highlights ? `My Key Skills/Highlights: ${highlights}` : ''}

Write a short, compelling Upwork proposal for this job.`;

    const data = await generateText(req.prisma, systemPrompt, userContent);
    const text = data.choices?.[0]?.message?.content || '';
    await logActivity(req.prisma, req.user.id, 'generate', 'proposal', jobTitle || 'upwork_proposal');
    res.json({ result: text });
  } catch (err) {
    console.error('Proposal generation error:', err);
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
