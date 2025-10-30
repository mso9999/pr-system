"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendEmail = sendEmail;
exports.verifyConnection = verifyConnection;
const functions = __importStar(require("firebase-functions"));
const nodemailer = __importStar(require("nodemailer"));
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
async function sendEmail(mailOptions) {
    const transporter = createTransporter();
    // Set default FROM address if not provided
    const emailOptions = {
        from: mailOptions.from || '"1PWR System" <noreply@1pwrafrica.com>',
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
    }
    catch (error) {
        console.error('Failed to send email via SMTP:', error);
        throw error;
    }
}
/**
 * Verify SMTP connection
 */
async function verifyConnection() {
    try {
        const transporter = createTransporter();
        await transporter.verify();
        console.log('SMTP connection verified successfully');
        return true;
    }
    catch (error) {
        console.error('SMTP connection verification failed:', error);
        return false;
    }
}
//# sourceMappingURL=emailSender.js.map