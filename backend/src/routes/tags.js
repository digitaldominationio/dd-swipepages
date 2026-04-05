const { Router } = require('express');

const router = Router();

router.get('/', async (req, res) => {
  try {
    const tags = await req.prisma.tag.findMany({ orderBy: { name: 'asc' } });
    res.json(tags);
  } catch (err) {
    console.error('List tags error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/', async (req, res) => {
  try {
    const { name, color } = req.body;
    if (!name || !color) {
      return res.status(400).json({ error: 'Name and color required' });
    }

    const existing = await req.prisma.tag.findUnique({ where: { name } });
    if (existing) {
      return res.status(409).json({ error: 'Tag name already exists' });
    }

    const tag = await req.prisma.tag.create({ data: { name, color } });
    res.status(201).json(tag);
  } catch (err) {
    console.error('Create tag error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { name, color } = req.body;
    const data = {};
    if (name !== undefined) data.name = name;
    if (color !== undefined) data.color = color;

    const tag = await req.prisma.tag.update({
      where: { id: req.params.id },
      data,
    });
    res.json(tag);
  } catch (err) {
    console.error('Update tag error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    await req.prisma.tag.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err) {
    console.error('Delete tag error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
