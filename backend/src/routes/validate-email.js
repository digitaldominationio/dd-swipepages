const { Router } = require('express');
const { validateEmail } = require('../services/reoon');

const router = Router();

router.post('/', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'Email required' });
    }

    const result = await validateEmail(req.prisma, email);
    res.json(result);
  } catch (err) {
    console.error('Email validation error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
