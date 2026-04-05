const { Router } = require('express');
const { createInviteToken } = require('../utils/invite');
const { encrypt, decrypt } = require('../services/encryption');

const router = Router();

// POST /api/admin/invite
router.post('/invite', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'Email required' });
    }

    const token = createInviteToken(email);
    const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000);

    await req.prisma.inviteToken.create({
      data: { token, email, expiresAt },
    });

    res.status(201).json({ inviteToken: token, email, expiresAt });
  } catch (err) {
    console.error('Invite error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/admin/users
router.get('/users', async (req, res) => {
  try {
    const users = await req.prisma.user.findMany({
      select: { id: true, email: true, name: true, role: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    });
    res.json(users);
  } catch (err) {
    console.error('List users error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/admin/users/:id
router.delete('/users/:id', async (req, res) => {
  try {
    if (req.params.id === req.user.id) {
      return res.status(400).json({ error: 'Cannot delete yourself' });
    }
    await req.prisma.user.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err) {
    console.error('Delete user error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/admin/settings
router.get('/settings', async (req, res) => {
  try {
    const settings = await req.prisma.setting.findMany();
    const masked = {};
    for (const s of settings) {
      const decrypted = decrypt(s.valueEncrypted);
      masked[s.key] = decrypted.length > 4
        ? '*'.repeat(decrypted.length - 4) + decrypted.slice(-4)
        : '****';
    }
    res.json(masked);
  } catch (err) {
    console.error('Get settings error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/admin/settings
router.put('/settings', async (req, res) => {
  try {
    const { settings } = req.body;
    if (!settings || typeof settings !== 'object') {
      return res.status(400).json({ error: 'Settings object required' });
    }

    for (const [key, value] of Object.entries(settings)) {
      const encrypted = encrypt(value);
      await req.prisma.setting.upsert({
        where: { key },
        update: { valueEncrypted: encrypted },
        create: { key, valueEncrypted: encrypted },
      });
    }

    res.json({ success: true });
  } catch (err) {
    console.error('Update settings error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/admin/prompts
router.post('/prompts', async (req, res) => {
  try {
    const { name, promptText, category, sortOrder } = req.body;
    if (!name || !promptText || !category) {
      return res.status(400).json({ error: 'Name, promptText, and category required' });
    }

    const prompt = await req.prisma.prompt.create({
      data: { name, promptText, category, sortOrder: sortOrder || 0, createdBy: req.user.id },
    });

    res.status(201).json(prompt);
  } catch (err) {
    console.error('Create prompt error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/admin/prompts
router.get('/prompts', async (req, res) => {
  try {
    const prompts = await req.prisma.prompt.findMany({ orderBy: { sortOrder: 'asc' } });
    res.json(prompts);
  } catch (err) {
    console.error('List prompts error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/admin/prompts/:id
router.put('/prompts/:id', async (req, res) => {
  try {
    const { name, promptText, category, sortOrder } = req.body;
    const data = {};
    if (name !== undefined) data.name = name;
    if (promptText !== undefined) data.promptText = promptText;
    if (category !== undefined) data.category = category;
    if (sortOrder !== undefined) data.sortOrder = sortOrder;

    const prompt = await req.prisma.prompt.update({
      where: { id: req.params.id },
      data,
    });

    res.json(prompt);
  } catch (err) {
    console.error('Update prompt error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/admin/prompts/:id
router.delete('/prompts/:id', async (req, res) => {
  try {
    await req.prisma.prompt.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err) {
    console.error('Delete prompt error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
