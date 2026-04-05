const { Router } = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { authMiddleware } = require('../middleware/auth');
const { verifyInviteToken } = require('../utils/invite');

const router = Router();
const JWT_EXPIRY = '7d';
const BCRYPT_ROUNDS = 12;

function signToken(user) {
  return jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET, {
    expiresIn: JWT_EXPIRY,
  });
}

function sanitizeUser(user) {
  const { passwordHash, ...rest } = user;
  return rest;
}

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    const user = await req.prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = signToken(user);
    res.json({ token, user: sanitizeUser(user) });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/auth/accept-invite
router.post('/accept-invite', async (req, res) => {
  try {
    const { token, name, password } = req.body;
    if (!token || !name || !password) {
      return res.status(400).json({ error: 'Token, name, and password required' });
    }

    let payload;
    try {
      payload = verifyInviteToken(token);
    } catch (err) {
      return res.status(400).json({ error: 'Invalid or expired invite token' });
    }

    const invite = await req.prisma.inviteToken.findUnique({ where: { token } });
    if (!invite) {
      return res.status(400).json({ error: 'Invite not found' });
    }
    if (invite.usedAt) {
      return res.status(400).json({ error: 'Invite already used' });
    }
    if (new Date() > invite.expiresAt) {
      return res.status(400).json({ error: 'Invite expired' });
    }

    const existing = await req.prisma.user.findUnique({ where: { email: invite.email } });
    if (existing) {
      return res.status(400).json({ error: 'Account already exists for this email' });
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

    const user = await req.prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: { email: invite.email, name, passwordHash, role: 'member' },
      });
      await tx.inviteToken.update({
        where: { id: invite.id },
        data: { usedAt: new Date() },
      });
      return newUser;
    });

    const jwtToken = signToken(user);
    res.status(201).json({ token: jwtToken, user: sanitizeUser(user) });
  } catch (err) {
    console.error('Accept invite error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/auth/me
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const user = await req.prisma.user.findUnique({ where: { id: req.user.id } });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(sanitizeUser(user));
  } catch (err) {
    console.error('Me error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
