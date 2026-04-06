const { Router } = require('express');
const { createInviteToken } = require('../utils/invite');
const { encrypt, decrypt } = require('../services/encryption');
const { sendInviteEmail } = require('../services/email');

const router = Router();

// GET /api/admin/dashboard — comprehensive stats
router.get('/dashboard', async (req, res) => {
  try {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Counts
    const [
      totalUsers,
      totalSnippets,
      totalFolders,
      totalPrompts,
      totalTags,
      pendingInvites,
    ] = await Promise.all([
      req.prisma.user.count(),
      req.prisma.snippet.count(),
      req.prisma.folder.count(),
      req.prisma.prompt.count(),
      req.prisma.tag.count(),
      req.prisma.inviteToken.count({ where: { usedAt: null } }),
    ]);

    // Activity counts by type
    const [
      aiGenerationsTotal,
      emailValidationsTotal,
      whatsappMessagesTotal,
      aiGenerationsToday,
      emailValidationsToday,
      whatsappMessagesToday,
      aiGenerationsWeek,
      emailValidationsWeek,
      whatsappMessagesWeek,
    ] = await Promise.all([
      req.prisma.activityLog.count({ where: { action: 'generate' } }),
      req.prisma.activityLog.count({ where: { action: 'validate' } }),
      req.prisma.activityLog.count({ where: { action: 'send', entityType: 'whatsapp_message' } }),
      req.prisma.activityLog.count({ where: { action: 'generate', createdAt: { gte: today } } }),
      req.prisma.activityLog.count({ where: { action: 'validate', createdAt: { gte: today } } }),
      req.prisma.activityLog.count({ where: { action: 'send', entityType: 'whatsapp_message', createdAt: { gte: today } } }),
      req.prisma.activityLog.count({ where: { action: 'generate', createdAt: { gte: weekAgo } } }),
      req.prisma.activityLog.count({ where: { action: 'validate', createdAt: { gte: weekAgo } } }),
      req.prisma.activityLog.count({ where: { action: 'send', entityType: 'whatsapp_message', createdAt: { gte: weekAgo } } }),
    ]);

    // Recent activity (last 20)
    const recentActivity = await req.prisma.activityLog.findMany({
      take: 20,
      orderBy: { createdAt: 'desc' },
      include: { user: { select: { name: true, email: true } } },
    });

    // Activity per user (top contributors)
    const userActivity = await req.prisma.activityLog.groupBy({
      by: ['userId'],
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: 10,
    });

    // Enrich with user names
    const userIds = userActivity.map((u) => u.userId);
    const users = await req.prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, name: true, email: true },
    });
    const userMap = Object.fromEntries(users.map((u) => [u.id, u]));
    const topContributors = userActivity.map((u) => ({
      user: userMap[u.userId] || { name: 'Unknown', email: '' },
      totalActions: u._count.id,
    }));

    // Snippets created this week
    const snippetsThisWeek = await req.prisma.snippet.count({
      where: { createdAt: { gte: weekAgo } },
    });

    // New users this month
    const newUsersThisMonth = await req.prisma.user.count({
      where: { createdAt: { gte: monthAgo } },
    });

    res.json({
      overview: {
        totalUsers,
        totalSnippets,
        totalFolders,
        totalPrompts,
        totalTags,
        pendingInvites,
        newUsersThisMonth,
        snippetsThisWeek,
      },
      usage: {
        aiGenerations: { total: aiGenerationsTotal, today: aiGenerationsToday, thisWeek: aiGenerationsWeek },
        emailValidations: { total: emailValidationsTotal, today: emailValidationsToday, thisWeek: emailValidationsWeek },
        whatsappMessages: { total: whatsappMessagesTotal, today: whatsappMessagesToday, thisWeek: whatsappMessagesWeek },
      },
      recentActivity,
      topContributors,
    });
  } catch (err) {
    console.error('Dashboard stats error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

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

    // Send invite email
    try {
      const inviterName = req.user?.name || req.user?.email || '';
      await sendInviteEmail(email, token, inviterName);
    } catch (emailErr) {
      console.error('Failed to send invite email:', emailErr.message);
      // Still return success — invite was created, email just failed
      return res.status(201).json({ inviteToken: token, email, expiresAt, emailSent: false, emailError: emailErr.message });
    }

    res.status(201).json({ inviteToken: token, email, expiresAt, emailSent: true });
  } catch (err) {
    console.error('Invite error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/admin/invites (pending invites)
router.get('/invites', async (req, res) => {
  try {
    const invites = await req.prisma.inviteToken.findMany({
      where: { usedAt: null },
      select: { id: true, email: true, expiresAt: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });
    res.json(invites);
  } catch (err) {
    console.error('List invites error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/admin/invites/:id
router.delete('/invites/:id', async (req, res) => {
  try {
    await req.prisma.inviteToken.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err) {
    console.error('Delete invite error:', err);
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
