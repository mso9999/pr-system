import * as nodemailer from 'nodemailer';

function createTransporter() {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const password = process.env.SMTP_PASSWORD;

  if (!host || !user || !password) {
    throw new Error('SMTP configuration is missing. Set SMTP_HOST, SMTP_USER, and SMTP_PASSWORD in functions/.env');
  }

  const port = parseInt(process.env.SMTP_PORT || '465');
  const secure = process.env.SMTP_SECURE !== 'false';

  console.log('Creating SMTP transporter with config:', { host, port, secure, user });

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass: password },
    tls: { rejectUnauthorized: false }
  });
}

/**
 * Send an email using SMTP
 * @param mailOptions Email options (to, cc, subject, text, html)
 */
export async function sendEmail(mailOptions: {
  to: string | string[];
  cc?: string | string[];
  subject: string;
  text: string;
  html: string;
  from?: string;
}) {
  const transporter = createTransporter();
  
  // Set default FROM address if not provided
  const emailOptions = {
    from: mailOptions.from || '"1PWR System" <notifications@1pwrafrica.com>',
    to: mailOptions.to,
    cc: mailOptions.cc,
    subject: mailOptions.subject,
    text: mailOptions.text,
    html: mailOptions.html
  };

  console.log('Sending email via SMTP:', {
    to: emailOptions.to,
    cc: emailOptions.cc,
    subject: emailOptions.subject,
    from: emailOptions.from
  });

  try {
    const info = await transporter.sendMail(emailOptions);
    console.log('Email sent successfully:', {
      messageId: info.messageId,
      accepted: info.accepted,
      rejected: info.rejected,
      response: info.response
    });
    return { success: true, messageId: info.messageId, info };
  } catch (error) {
    console.error('Failed to send email via SMTP:', error);
    throw error;
  }
}

/**
 * Verify SMTP connection
 */
export async function verifyConnection(): Promise<boolean> {
  try {
    const transporter = createTransporter();
    await transporter.verify();
    console.log('SMTP connection verified successfully');
    return true;
  } catch (error) {
    console.error('SMTP connection verification failed:', error);
    return false;
  }
}


