const nodemailer = require('nodemailer');
const env = require('../config/env');

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;

  const user = (env.SMTP_USER || '').trim();
  const pass = (env.SMTP_PASS || '').trim().replace(/\s+/g, '');

  if (user && pass) {
    const isGmail = (env.SMTP_HOST || '').includes('gmail') || user.endsWith('@gmail.com');
    
    const config = isGmail
      ? {
          service: 'gmail',
          auth: {
            user,
            pass,
          },
        }
      : {
          host: env.SMTP_HOST,
          port: env.SMTP_PORT,
          secure: env.SMTP_SECURE,
          auth: {
            user,
            pass,
          },
        };

    transporter = nodemailer.createTransport(config);
    return transporter;
  }

  return null;
}

/**
 * Sends a modern HTML OTP verification email to the user
 * @param {string} toEmail - Recipient email
 * @param {string} otp - 6-digit OTP
 * @param {string} role - 'student' or 'teacher'
 */
async function sendOtpEmail(toEmail, otp, role = 'student') {
  const mailTransporter = getTransporter();

  // If no SMTP credentials configured, fail explicitly so dev mode is completely OFF
  if (!mailTransporter) {
    console.error('[emailService] Real SMTP is required. SMTP_USER or SMTP_PASS not set in server/.env');
    throw new Error(
      'Email SMTP not configured in server/.env. Please configure SMTP_USER (your Gmail) and SMTP_PASS (Google App Password) to send real OTP emails.'
    );
  }

  const roleTitle = role === 'teacher' ? 'Faculty / Teacher' : 'Student';

  const htmlContent = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Email Verification - SMDL College</title>
      <style>
        body {
          margin: 0;
          padding: 0;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
          background-color: #0b0f19;
          color: #f1f5f9;
        }
        .container {
          max-width: 580px;
          margin: 40px auto;
          background: #111827;
          border-radius: 16px;
          border: 1px solid #1f2937;
          overflow: hidden;
          box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5);
        }
        .header {
          background: linear-gradient(135deg, #1e3a8a 0%, #0284c7 100%);
          padding: 32px 24px;
          text-align: center;
        }
        .header h1 {
          margin: 0;
          color: #ffffff;
          font-size: 22px;
          font-weight: 700;
          letter-spacing: -0.5px;
        }
        .header p {
          margin: 6px 0 0 0;
          color: #bae6fd;
          font-size: 13px;
        }
        .content {
          padding: 36px 32px;
        }
        .greeting {
          font-size: 16px;
          color: #e2e8f0;
          margin-bottom: 12px;
        }
        .message {
          font-size: 14px;
          line-height: 1.6;
          color: #94a3b8;
          margin-bottom: 28px;
        }
        .otp-box {
          background: #1e293b;
          border: 2px dashed #0284c7;
          border-radius: 12px;
          padding: 24px;
          text-align: center;
          margin: 24px 0;
        }
        .otp-label {
          font-size: 12px;
          text-transform: uppercase;
          letter-spacing: 1.5px;
          color: #38bdf8;
          font-weight: 600;
          margin-bottom: 8px;
        }
        .otp-code {
          font-size: 38px;
          font-family: 'Courier New', Courier, monospace;
          font-weight: 800;
          letter-spacing: 10px;
          color: #ffffff;
          text-shadow: 0 0 12px rgba(56, 189, 248, 0.5);
        }
        .expiry {
          font-size: 13px;
          color: #f59e0b;
          margin-top: 8px;
        }
        .security-notice {
          border-top: 1px solid #1f2937;
          padding-top: 20px;
          font-size: 12px;
          color: #64748b;
          line-height: 1.5;
        }
        .footer {
          background-color: #0a0f1d;
          padding: 20px;
          text-align: center;
          font-size: 11px;
          color: #475569;
          border-top: 1px solid #1e293b;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>SES's S. M. Dadasaheb Limaye College</h1>
          <p>Department of Computer Science & Academic Attendance Portal</p>
        </div>
        <div class="content">
          <div class="greeting">Hello, <strong>${roleTitle}</strong></div>
          <p class="message">
            Thank you for registering on the <strong>SMDL College Smart Attendance System</strong>. 
            To ensure your account's security and verify your email address, please use the One-Time Password (OTP) below:
          </p>
          
          <div class="otp-box">
            <div class="otp-label">Your Verification Code</div>
            <div class="otp-code">${otp}</div>
            <div class="expiry">&#9200; Valid for 10 minutes only</div>
          </div>

          <div class="security-notice">
            <p><strong>Security Tip:</strong> Never share this OTP with anyone, including college staff or administrators. Our system will never ask for your OTP outside the official registration portal.</p>
            <p>If you did not initiate this registration request, please disregard this email.</p>
          </div>
        </div>
        <div class="footer">
          &copy; ${new Date().getFullYear()} SES's S. M. Dadasaheb Limaye Arts, Commerce and Science College, Kalamboli.<br/>
          Smart Attendance System. All rights reserved.
        </div>
      </div>
    </body>
    </html>
  `;

  const mailOptions = {
    from: env.EMAIL_FROM,
    to: toEmail,
    subject: `[SMDL College] ${otp} is your Email Verification Code`,
    text: `Your SMDL College Attendance System verification code is: ${otp}. It expires in 10 minutes.`,
    html: htmlContent,
  };

  try {
    const info = await mailTransporter.sendMail(mailOptions);
    return {
      success: true,
      delivered: true,
      messageId: info.messageId,
    };
  } catch (error) {
    console.error('[emailService] Failed to send email via SMTP:', error);
    throw new Error(`Failed to deliver verification email: ${error.message || 'SMTP delivery failed'}`);
  }
}

/**
 * Sends a secure password reset link to user's registered email
 * @param {string} toEmail 
 * @param {string} resetUrl - Complete frontend URL with recovery token
 * @param {string} role - 'student' or 'teacher'
 */
async function sendPasswordResetEmail(toEmail, resetUrl, role = 'student') {
  const mailTransporter = getTransporter();

  if (!mailTransporter) {
    console.error('[emailService] SMTP_USER or SMTP_PASS not set in server/.env');
    throw new Error(
      'Email SMTP not configured in server/.env. Please configure SMTP_USER and SMTP_PASS.'
    );
  }

  const roleTitle = role === 'teacher' ? 'Faculty / Teacher' : 'Student';

  const htmlContent = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Password Reset - SMDL College</title>
      <style>
        body {
          margin: 0;
          padding: 0;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
          background-color: #0b0f19;
          color: #f1f5f9;
        }
        .container {
          max-width: 580px;
          margin: 40px auto;
          background: #111827;
          border-radius: 16px;
          border: 1px solid #1f2937;
          overflow: hidden;
          box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5);
        }
        .header {
          background: linear-gradient(135deg, #1e3a8a 0%, #0284c7 100%);
          padding: 32px 24px;
          text-align: center;
        }
        .header h1 {
          margin: 0;
          color: #ffffff;
          font-size: 22px;
          font-weight: 700;
          letter-spacing: -0.5px;
        }
        .header p {
          margin: 6px 0 0 0;
          color: #bae6fd;
          font-size: 13px;
        }
        .content {
          padding: 36px 32px;
        }
        .greeting {
          font-size: 16px;
          color: #e2e8f0;
          margin-bottom: 12px;
        }
        .message {
          font-size: 14px;
          line-height: 1.6;
          color: #94a3b8;
          margin-bottom: 28px;
        }
        .button-box {
          text-align: center;
          margin: 32px 0;
        }
        .reset-btn {
          display: inline-block;
          background: linear-gradient(135deg, #0284c7 0%, #0369a1 100%);
          color: #ffffff !important;
          text-decoration: none;
          font-weight: 700;
          font-size: 15px;
          padding: 14px 32px;
          border-radius: 12px;
          box-shadow: 0 4px 14px 0 rgba(2, 132, 199, 0.4);
          letter-spacing: 0.3px;
        }
        .link-fallback {
          font-size: 11px;
          color: #64748b;
          word-break: break-all;
          margin-top: 18px;
          line-height: 1.4;
        }
        .expiry {
          background: #1e293b;
          border-left: 4px solid #f59e0b;
          padding: 12px 16px;
          border-radius: 6px;
          font-size: 13px;
          color: #fcd34d;
          margin: 20px 0;
        }
        .security-notice {
          border-top: 1px solid #1f2937;
          padding-top: 20px;
          font-size: 12px;
          color: #64748b;
          line-height: 1.5;
        }
        .footer {
          background-color: #0a0f1d;
          padding: 20px;
          text-align: center;
          font-size: 11px;
          color: #475569;
          border-top: 1px solid #1e293b;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>SES's S. M. Dadasaheb Limaye College</h1>
          <p>Smart Attendance & Communication Portal</p>
        </div>
        <div class="content">
          <div class="greeting">Hello, <strong>${roleTitle}</strong></div>
          <p class="message">
            We received a request to reset your SMDL College account password.
            Please click the button below to choose a new password:
          </p>
          
          <div class="button-box">
            <a href="${resetUrl}" class="reset-btn" target="_blank">Reset Password</a>
            <div class="link-fallback">
              Or copy this link in your browser:<br/>
              <span style="color: #38bdf8;">${resetUrl}</span>
            </div>
          </div>

          <div class="expiry">
            &#9200; <strong>Note:</strong> This link is valid for <strong>15 minutes only</strong> and can be used once.
          </div>

          <div class="security-notice">
            <p><strong>Security Notice:</strong> If you did not request a password reset, you can safely ignore this email. Your current password will remain unchanged and your account remains secure.</p>
          </div>
        </div>
        <div class="footer">
          &copy; ${new Date().getFullYear()} SES's S. M. Dadasaheb Limaye Arts, Commerce and Science College, Kalamboli.<br/>
          Smart Attendance System. All rights reserved.
        </div>
      </div>
    </body>
    </html>
  `;

  const mailOptions = {
    from: env.EMAIL_FROM,
    to: toEmail,
    subject: `SMDL College - Password Reset Request`,
    text: `Hello, We received a request to reset your SMDL College account password. Please open this link to reset your password: ${resetUrl}. This link expires in 15 minutes. If you did not request this, please ignore this email.`,
    html: htmlContent,
  };

  try {
    const info = await mailTransporter.sendMail(mailOptions);
    return {
      success: true,
      delivered: true,
      messageId: info.messageId,
    };
  } catch (error) {
    console.error('[emailService] Failed to send password reset email:', error);
    throw new Error(`Failed to deliver password reset email: ${error.message || 'SMTP delivery failed'}`);
  }
}

/**
 * Sends a security notification email confirming password was changed
 */
async function sendPasswordChangedSecurityEmail(toEmail, role = 'student') {
  const mailTransporter = getTransporter();
  if (!mailTransporter) return;

  const roleTitle = role === 'teacher' ? 'Faculty Member' : 'Student';

  const htmlContent = `
    <div style="font-family: sans-serif; max-width: 520px; margin: 20px auto; background: #111827; color: #f1f5f9; padding: 24px; border-radius: 12px; border: 1px solid #1f2937;">
      <h2 style="color: #38bdf8; margin-top: 0;">SMDL College - Security Alert</h2>
      <p>Hello ${roleTitle},</p>
      <p>Your SMDL College account password was successfully changed on <strong>${new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' })} (IST)</strong>.</p>
      <div style="background: #1e293b; padding: 12px; border-radius: 8px; margin: 16px 0; font-size: 13px; color: #cbd5e1;">
        If you initiated this change, no further action is required.
      </div>
      <p style="font-size: 12px; color: #ef4444;">
        ⚠️ If you did NOT change your password, please contact the SMDL College administration immediately to secure your account.
      </p>
      <hr style="border: none; border-top: 1px solid #374151; margin: 20px 0;" />
      <p style="font-size: 11px; color: #6b7280; text-align: center;">SES's S. M. Dadasaheb Limaye College, Kalamboli</p>
    </div>
  `;

  try {
    await mailTransporter.sendMail({
      from: env.EMAIL_FROM,
      to: toEmail,
      subject: `SMDL College - Security Alert: Password Changed`,
      text: `Your SMDL College account password was successfully changed. If you did not make this change, contact college administration immediately.`,
      html: htmlContent,
    });
  } catch (err) {
    console.warn('[emailService] Security alert email warning:', err.message);
  }
}

module.exports = {
  sendOtpEmail,
  sendPasswordResetEmail,
  sendPasswordChangedSecurityEmail,
};
