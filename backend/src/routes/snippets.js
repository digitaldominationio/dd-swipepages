const { Router } = require('express');
const { logActivity } = require('../middleware/activityLog');

const router = Router();

const snippetInclude = {
  tags: { include: { tag: true } },
  folder: true,
};

// GET /api/snippets?folder=X&tag=Y&search=Z
router.get('/', async (req, res) => {
  try {
    const { folder, tag, search } = req.query;
    const where = {};

    if (folder) {
      where.folderId = folder;
    }

    if (tag) {
      where.tags = { some: { tagId: tag } };
    }

    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { content: { contains: search, mode: 'insensitive' } },
      ];
    }

    const snippets = await req.prisma.snippet.findMany({
      where,
      include: snippetInclude,
      orderBy: { updatedAt: 'desc' },
    });

    res.json(snippets);
  } catch (err) {
    console.error('List snippets error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/snippets
router.post('/', async (req, res) => {
  try {
    const { title, content, type, folderId, tagIds } = req.body;
    if (!title || !content || !folderId) {
      return res.status(400).json({ error: 'Title, content, and folderId required' });
    }

    const snippet = await req.prisma.snippet.create({
      data: {
        title,
        content,
        type: type || 'snippet',
        folderId,
        createdBy: req.user.id,
        tags: tagIds && tagIds.length > 0
          ? { create: tagIds.map((tagId) => ({ tagId })) }
          : undefined,
      },
      include: snippetInclude,
    });

    await logActivity(req.prisma, req.user.id, 'create', 'snippet', snippet.id);
    res.status(201).json(snippet);
  } catch (err) {
    console.error('Create snippet error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/snippets/:id
router.put('/:id', async (req, res) => {
  try {
    const { title, content, type, folderId, tagIds } = req.body;
    const data = {};
    if (title !== undefined) data.title = title;
    if (content !== undefined) data.content = content;
    if (type !== undefined) data.type = type;
    if (folderId !== undefined) data.folderId = folderId;

    // If tagIds provided, replace all tags
    if (tagIds !== undefined) {
      await req.prisma.snippetTag.deleteMany({ where: { snippetId: req.params.id } });
      if (tagIds.length > 0) {
        data.tags = { create: tagIds.map((tagId) => ({ tagId })) };
      }
    }

    const snippet = await req.prisma.snippet.update({
      where: { id: req.params.id },
      data,
      include: snippetInclude,
    });

    res.json(snippet);
  } catch (err) {
    console.error('Update snippet error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/snippets/:id
router.delete('/:id', async (req, res) => {
  try {
    await req.prisma.snippet.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err) {
    console.error('Delete snippet error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
