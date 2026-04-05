const { Router } = require('express');

const router = Router();

// GET /api/folders
router.get('/', async (req, res) => {
  try {
    const folders = await req.prisma.folder.findMany({
      orderBy: { sortOrder: 'asc' },
      include: { children: true },
    });
    res.json(folders);
  } catch (err) {
    console.error('List folders error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/folders
router.post('/', async (req, res) => {
  try {
    const { name, parentId, sortOrder } = req.body;
    if (!name) {
      return res.status(400).json({ error: 'Name required' });
    }

    const folder = await req.prisma.folder.create({
      data: {
        name,
        parentId: parentId || null,
        sortOrder: sortOrder || 0,
        createdBy: req.user.id,
      },
    });

    res.status(201).json(folder);
  } catch (err) {
    console.error('Create folder error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/folders/:id
router.put('/:id', async (req, res) => {
  try {
    const { name, parentId, sortOrder } = req.body;
    const data = {};
    if (name !== undefined) data.name = name;
    if (parentId !== undefined) data.parentId = parentId;
    if (sortOrder !== undefined) data.sortOrder = sortOrder;

    const folder = await req.prisma.folder.update({
      where: { id: req.params.id },
      data,
    });

    res.json(folder);
  } catch (err) {
    console.error('Update folder error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/folders/:id
router.delete('/:id', async (req, res) => {
  try {
    await req.prisma.folder.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err) {
    console.error('Delete folder error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
