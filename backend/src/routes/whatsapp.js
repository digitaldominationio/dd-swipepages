const { Router } = require('express');
const { sendWhatsApp } = require('../services/walytic');
const { logActivity } = require('../middleware/activityLog');

const router = Router();

router.post('/send', async (req, res) => {
  try {
    const { phone, message } = req.body;
    if (!phone || !message) {
      return res.status(400).json({ error: 'Phone and message required' });
    }

    const result = await sendWhatsApp(req.prisma, phone, message);
    await logActivity(req.prisma, req.user.id, 'send', 'whatsapp_message', phone);
    res.json(result);
  } catch (err) {
    console.error('WhatsApp send error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
