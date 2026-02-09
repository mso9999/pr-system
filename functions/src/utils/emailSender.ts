import * as functions from 'firebase-functions';
import * as nodemailer from 'nodemailer';

/**
 * Initialize nodemailer transporter with SMTP credentials from Firebase config
 */
function createTransporter() {
  const smtpConfig = functions.config().smtp;
  
  if (!smtpConfig || !smtpConfig.host || !smtpConfig.user || !smtpConfig.password) {
    throw new Error('SMTP configuration is missing. Please set smtp.host, smtp.user, and smtp.password in Firebase config.');
  }

  console.log('Creating SMTP transporter with config:', {
    host: smtpConfig.host,
    port: smtpConfig.port || 465,
    secure: smtpConfig.secure !== 'false', // Default to true
    user: smtpConfig.user
  });

  return nodemailer.createTransport({
    host: smtpConfig.host,
    port: parseInt(smtpConfig.port) || 465,
    secure: smtpConfig.secure !== 'false', // true for 465, false for other ports
    auth: {
      user: smtpConfig.user,
      pass: smtpConfig.password
    },
    tls: {
      // Don't fail on invalid certs (some shared hosting)
      rejectUnauthorized: false
    }
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


