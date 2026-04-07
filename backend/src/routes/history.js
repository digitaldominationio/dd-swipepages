const { Router } = require('express');

const router = Router();

// GET /api/history?category=proposal&limit=10&offset=0
router.get('/', async (req, res) => {
  try {
    const { category, limit = '10', offset = '0' } = req.query;
    const where = { userId: req.user.id };
    if (category) where.category = category;

    const items = await req.prisma.history.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: parseInt(limit),
      skip: parseInt(offset),
      select: { id: true, category: true, title: true, input: true, output: true, createdAt: true },
    });

    res.json(items);
  } catch (err) {
    console.error('History fetch error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/history — clear all history for user (optionally by category)
router.delete('/', async (req, res) => {
  try {
    const { category } = req.query;
    const where = { userId: req.user.id };
    if (category) where.category = category;

    await req.prisma.history.deleteMany({ where });
    res.json({ success: true });
  } catch (err) {
    console.error('History clear error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/history/:id — delete single entry
router.delete('/:id', async (req, res) => {
  try {
    const item = await req.prisma.history.findUnique({ where: { id: req.params.id } });
    if (!item || item.userId !== req.user.id) {
      return res.status(404).json({ error: 'Not found' });
    }
    await req.prisma.history.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err) {
    console.error('History delete error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
