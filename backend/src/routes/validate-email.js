const { Router } = require('express');
const { validateEmail } = require('../services/reoon');
const { logActivity } = require('../middleware/activityLog');

const router = Router();

router.post('/', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'Email required' });
    }

    const result = await validateEmail(req.prisma, email);
    await logActivity(req.prisma, req.user.id, 'validate', 'email_validation', email);
    await req.prisma.history.create({
      data: { userId: req.user.id, category: 'email_validation', title: email, input: email, output: JSON.stringify(result) },
    });
    res.json(result);
  } catch (err) {
    console.error('Email validation error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
