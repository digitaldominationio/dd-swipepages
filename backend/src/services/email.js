const nodemailer = require('nodemailer');

function createTransport() {
  return nodemailer.createTransport({
    host: process.env.EMAIL_SMTP || 'smtp.mailersend.net',
    port: parseInt(process.env.EMAIL_SMTP_PORT || '587', 10),
    secure: false,
    auth: {
      user: process.env.EMAIL_SMTP_USER,
      pass: process.env.EMAIL_SMTP_PASSWORD,
    },
  });
}

async function sendInviteEmail(email, inviteToken, inviterName) {
  const transport = createTransport();
  const fromEmail = process.env.EMAIL_SMTP_FROM_EMAIL || 'noreply@swipetoolkit.com';
  const fromName = process.env.EMAIL_SMTP_FROM_NAME || 'Swipe Toolkit';
  const appUrl = process.env.APP_URL || 'https://chrex.ddmn.in';
  const inviteLink = `${appUrl}/admin/accept-invite?token=${encodeURIComponent(inviteToken)}`;

  await transport.sendMail({
    from: `"${fromName}" <${fromEmail}>`,
    to: email,
    subject: `You're invited to join Swipe Toolkit`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 520px; margin: 0 auto; padding: 32px;">
        <div style="background: linear-gradient(135deg, #1e293b 0%, #334155 100%); border-radius: 12px; padding: 32px; text-align: center; margin-bottom: 24px;">
          <h1 style="color: #fff; font-size: 24px; margin: 0;">Swipe Toolkit</h1>
          <p style="color: #94a3b8; font-size: 14px; margin: 8px 0 0;">Team Productivity Suite</p>
        </div>
        <h2 style="color: #1e293b; font-size: 20px; margin-bottom: 8px;">You've been invited!</h2>
        <p style="color: #475569; font-size: 14px; line-height: 1.6;">
          ${inviterName ? `<strong>${inviterName}</strong> has invited you` : 'You have been invited'} to join the team on Swipe Toolkit.
        </p>
        <p style="color: #475569; font-size: 14px; line-height: 1.6;">
          Click the button below to set up your account. This invite expires in <strong>48 hours</strong>.
        </p>
        <div style="text-align: center; margin: 28px 0;">
          <a href="${inviteLink}" style="display: inline-block; background: #3b82f6; color: #fff; text-decoration: none; padding: 12px 32px; border-radius: 8px; font-size: 14px; font-weight: 600;">
            Accept Invite
          </a>
        </div>
        <p style="color: #94a3b8; font-size: 12px; text-align: center;">
          Or copy this link: <br>
          <span style="color: #64748b; word-break: break-all;">${inviteLink}</span>
        </p>
        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;">
        <p style="color: #94a3b8; font-size: 11px; text-align: center;">
          Sent by Swipe Toolkit &middot; This is an automated message
        </p>
      </div>
    `,
    text: `You've been invited to join Swipe Toolkit!\n\nAccept your invite: ${inviteLink}\n\nThis invite expires in 48 hours.`,
  });
}

module.exports = { sendInviteEmail };
