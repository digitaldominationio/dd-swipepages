const jwt = require('jsonwebtoken');

const INVITE_EXPIRY = '48h';

function createInviteToken(email) {
  return jwt.sign({ email, purpose: 'invite' }, process.env.JWT_SECRET, {
    expiresIn: INVITE_EXPIRY,
  });
}

function verifyInviteToken(token) {
  const payload = jwt.verify(token, process.env.JWT_SECRET);
  if (payload.purpose !== 'invite') {
    throw new Error('Invalid token purpose');
  }
  return payload;
}

module.exports = { createInviteToken, verifyInviteToken };
