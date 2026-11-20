const nodemailer = require('nodemailer');
const env = require('../config/env');

let transporter = null;
let lastHttpErrorDetails = '';

/**
 * Sends email via HTTP REST API (Port 443 - HTTPS).
 * Bypasses cloud platform SMTP port restrictions (e.g., Render free tier blocking ports 25, 465, 587).
 */
async function sendViaHttpApi({ toEmail, subject, htmlContent, textContent }) {
  let resendError = null;
  let brevoError = null;
  lastHttpErrorDetails = '';

  // 1. Resend API (https://resend.com - Free 3,000 emails/mo via Port 443 HTTPS)
  if (env.RESEND_API_KEY) {
    try {
      const fromAddr = env.EMAIL_FROM && env.EMAIL_FROM.includes('@')
        ? env.EMAIL_FROM
        : 'SMDL Attendance <onboarding@resend.dev>';

      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${env.RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: fromAddr,
          to: [toEmail],
          subject,
          html: htmlContent,
          text: textContent,
        }),
        signal: AbortSignal.timeout(8000),
      });

      const resData = await res.json();
      if (!res.ok) {
        throw new Error(resData?.message || `Resend HTTP ${res.status}`);
      }

      return {
        success: true,
        delivered: true,
        provider: 'resend_https',
        messageId: resData.id,
      };
    } catch (err) {
      resendError = err;
      lastHttpErrorDetails = `Resend: ${err.message}`;
      console.warn('[emailService] Resend HTTPS delivery attempt failed:', err.message);
      // Fall through to Brevo or SMTP rather than aborting immediately
    }
  }

  // 2. Brevo API (https://brevo.com - Free 300 emails/day via Port 443 HTTPS)
  if (env.BREVO_API_KEY) {
    try {
      let senderEmail = 'collegesmdl@gmail.com';
      if (env.BREVO_SENDER_EMAIL && env.BREVO_SENDER_EMAIL.includes('@')) {
        senderEmail = env.BREVO_SENDER_EMAIL.trim();
      } else if (env.EMAIL_FROM && env.EMAIL_FROM.includes('@')) {
        const match = env.EMAIL_FROM.match(/<([^>]+)>/);
        senderEmail = match ? match[1].trim() : env.EMAIL_FROM.trim();
      } else if (env.SMTP_USER && env.SMTP_USER.includes('@')) {
        senderEmail = env.SMTP_USER.trim();
      }

      const res = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          'api-key': env.BREVO_API_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sender: { name: 'SMDL College Smart Attendance', email: senderEmail },
          to: [{ email: toEmail }],
          subject,
          htmlContent,
          textContent,
        }),
        signal: AbortSignal.timeout(8000),
      });

      const resData = await res.json();
      if (!res.ok) {
        throw new Error(resData?.message || `Brevo HTTP ${res.status}`);
      }

      return {
        success: true,
        delivered: true,
        provider: 'brevo_https',
        messageId: resData.messageId,
      };
    } catch (err) {
      brevoError = err;
      lastHttpErrorDetails = lastHttpErrorDetails ? `${lastHttpErrorDetails} | Brevo: ${err.message}` : `Brevo: ${err.message}`;
      console.warn('[emailService] Brevo HTTPS delivery attempt failed:', err.message);
      if (!env.SMTP_USER && resendError) {
        throw resendError;
      }
      if (!env.SMTP_USER) {
        throw err;
      }
    }
  }

  return null;
}

function getTransporter() {
  if (transporter) return transporter;

  const user = (env.SMTP_USER || '').trim();
  const pass = (env.SMTP_PASS || '').trim().replace(/\s+/g, '');

  if (user && pass) {
    const isGmail = (env.SMTP_HOST || '').includes('gmail') || user.endsWith('@gmail.com');
    
    // Strict connection timeouts to prevent cloud TCP SYN hanging when ports 465/587 are blocked
    const timeoutConfig = {
      connectionTimeout: 7000, // 7 seconds timeout (never hang 90s)
      greetingTimeout: 7000,
      socketTimeout: 8000,
      dns: { family: 4 }, // Force IPv4 to avoid IPv6 blackholing on Linux/Render
    };

    const config = isGmail
      ? {
          service: 'gmail',
          auth: {
            user,
            pass,
          },
          ...timeoutConfig,
        }
      : {
          host: env.SMTP_HOST,
          port: env.SMTP_PORT,
          secure: env.SMTP_SECURE,
          auth: {
            user,
            pass,
          },
          ...timeoutConfig,
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
  const roleTitle = role === 'teacher' ? 'Faculty / Teacher' : 'Student';
  const subject = `[SMDL College] ${otp} is your Email Verification Code`;
  const textContent = `Your SMDL College Attendance System verification code is: ${otp}. It expires in 10 minutes.`;

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

  // 1. Try HTTPS API first if configured (Port 443 - works everywhere including Render free tier)
  if (env.RESEND_API_KEY || env.BREVO_API_KEY) {
    try {
      const httpResult = await sendViaHttpApi({
        toEmail,
        subject,
        htmlContent,
        textContent,
      });
      if (httpResult?.success) {
        return httpResult;
      }
    } catch (httpErr) {
      console.warn('[emailService] HTTPS API delivery failed, attempting SMTP fallback:', httpErr.message);
    }
  }

  // 2. Fallback to standard SMTP (Localhost / standard server with open SMTP ports)
  const mailTransporter = getTransporter();
  if (!mailTransporter) {
    console.error('[emailService] No email service configured. Please set RESEND_API_KEY (for cloud) or SMTP_USER/PASS (for localhost).');
    throw new Error(
      'Email service not configured. Please configure RESEND_API_KEY (for cloud) or SMTP_USER and SMTP_PASS (for localhost).'
    );
  }

  const mailOptions = {
    from: env.EMAIL_FROM,
    to: toEmail,
    subject,
    text: textContent,
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
    console.error('[emailService] Failed to send email via SMTP:', error.message);
    if (process.env.NODE_ENV !== 'production') {
      console.warn(`[emailService] Non-production fallback: returning dev mock delivery due to SMTP limit (${error.message})`);
      return {
        success: true,
        delivered: false,
        messageId: `mock-dev-${Date.now()}`,
        devFallback: true,
      };
    }
    const isTimeout = error.code === 'ETIMEDOUT' || error.message?.includes('timeout') || error.message?.includes('greeting');
    let sanitizedMsg = isTimeout
      ? 'Email delivery timed out on cloud network (Render blocks SMTP ports 465/587).'
      : (error.message || 'Failed to deliver verification email.');
    if (lastHttpErrorDetails) {
      sanitizedMsg += ` (${lastHttpErrorDetails})`;
    } else if (isTimeout) {
      sanitizedMsg += ' Please ensure BREVO_API_KEY is configured in Render environment variables (and IP blocking is deactivated in Brevo settings).';
    }
    const err = new Error(sanitizedMsg);
    err.statusCode = 503;
    throw err;
  }
}

/**
 * Sends a secure password reset link and 6-digit recovery code to user's registered email
 * @param {string} toEmail 
 * @param {string} resetUrl - Complete frontend URL with recovery token
 * @param {string} role - 'student' or 'teacher'
 * @param {string} resetCode - Optional 6-digit numeric OTP code for mobile APK in-app recovery
 */
async function sendPasswordResetEmail(toEmail, resetUrl, role = 'student', resetCode = '') {
  const roleTitle = role === 'teacher' ? 'Faculty / Teacher' : 'Student';

  const isRealPublicWebUrl = resetUrl && !resetUrl.includes('localhost') && !resetUrl.includes('127.0.0.1');

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
          margin-bottom: 24px;
        }
        .code-box {
          background: #1e293b;
          border: 2px dashed #0284c7;
          border-radius: 12px;
          padding: 24px 20px;
          text-align: center;
          margin: 20px 0;
        }
        .code-label {
          font-size: 12px;
          text-transform: uppercase;
          letter-spacing: 1.5px;
          color: #38bdf8;
          font-weight: 600;
          margin-bottom: 8px;
        }
        .code-val {
          font-size: 38px;
          font-family: 'Courier New', Courier, monospace;
          font-weight: 800;
          letter-spacing: 8px;
          color: #ffffff;
          text-shadow: 0 0 10px rgba(56, 189, 248, 0.5);
        }
        .button-box {
          text-align: center;
          margin: 28px 0;
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
            Please use the 6-digit recovery code below directly in the <strong>SMDL College Attendance App</strong> to set your new password:
          </p>
          
          ${resetCode ? `
          <div class="code-box">
            <div class="code-label">6-Digit Password Reset Code</div>
            <div class="code-val">${resetCode}</div>
            <div style="font-size: 12px; color: #f59e0b; margin-top: 8px;">&#9200; Valid for 15 minutes only</div>
          </div>
          ` : ''}

          ${isRealPublicWebUrl ? `
          <div class="button-box">
            <a href="${resetUrl}" class="reset-btn" target="_blank">Reset Password via Web Browser</a>
            <div class="link-fallback">
              Or copy this link in your browser:<br/>
              <span style="color: #38bdf8;">${resetUrl}</span>
            </div>
          </div>
          ` : `
          <div style="background: rgba(2, 132, 199, 0.1); border: 1px solid rgba(2, 132, 199, 0.25); border-radius: 8px; padding: 14px; text-align: center; margin: 20px 0; font-size: 13px; color: #bae6fd;">
            📱 <strong>Mobile App Instruction:</strong> Enter this 6-digit code in the SMDL Attendance App on your phone to update your password.
          </div>
          `}

          <div class="expiry">
            &#9200; <strong>Note:</strong> This verification code is valid for <strong>15 minutes only</strong> and can be used once.
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

  const subject = `[SMDL College] ${resetCode ? resetCode + ' is your ' : ''}Password Reset Request`;
  const textContent = `Hello, We received a request to reset your SMDL College account password. ${resetCode ? `Your 6-digit reset code is: ${resetCode}. Enter this code in the SMDL Attendance mobile app to reset your password.` : ''} ${isRealPublicWebUrl ? `Web reset link: ${resetUrl}.` : ''} This expires in 15 minutes.`;

  // 1. Try HTTPS API first if configured (Port 443 - works everywhere including Render free tier)
  if (env.RESEND_API_KEY || env.BREVO_API_KEY) {
    try {
      const httpResult = await sendViaHttpApi({
        toEmail,
        subject,
        htmlContent,
        textContent,
      });
      if (httpResult?.success) {
        return httpResult;
      }
    } catch (httpErr) {
      console.warn('[emailService] HTTPS API reset delivery failed, attempting SMTP fallback:', httpErr.message);
    }
  }

  // 2. Fallback to standard SMTP
  const mailTransporter = getTransporter();
  if (!mailTransporter) {
    console.error('[emailService] No email service configured. Please set RESEND_API_KEY (for cloud) or SMTP_USER/PASS (for localhost).');
    throw new Error(
      'Email service not configured. Please configure RESEND_API_KEY (for cloud) or SMTP_USER and SMTP_PASS (for localhost).'
    );
  }

  const mailOptions = {
    from: env.EMAIL_FROM,
    to: toEmail,
    subject,
    text: textContent,
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
    console.error('[emailService] Failed to send password reset email via SMTP:', error.message);
    if (process.env.NODE_ENV !== 'production') {
      console.warn(`[emailService] Non-production fallback: returning dev mock delivery due to SMTP limit (${error.message})`);
      return {
        success: true,
        delivered: false,
        messageId: `mock-dev-${Date.now()}`,
        devFallback: true,
      };
    }
    const isTimeout = error.code === 'ETIMEDOUT' || error.message?.includes('timeout') || error.message?.includes('greeting');
    let sanitizedMsg = isTimeout
      ? 'Password reset delivery timed out on cloud network (Render blocks SMTP ports 465/587).'
      : (error.message || 'Failed to deliver password reset email.');
    if (lastHttpErrorDetails) {
      sanitizedMsg += ` (${lastHttpErrorDetails})`;
    } else if (isTimeout) {
      sanitizedMsg += ' Please ensure BREVO_API_KEY is configured in Render environment variables (and IP blocking is deactivated in Brevo settings).';
    }
    const err = new Error(sanitizedMsg);
    err.statusCode = 503;
    throw err;
  }
}

/**
 * Sends a security notification email confirming password was changed
 */
async function sendPasswordChangedSecurityEmail(toEmail, role = 'student') {
  const roleTitle = role === 'teacher' ? 'Faculty Member' : 'Student';
  const subject = `SMDL College - Account Password Changed`;
  const textContent = `Hello ${roleTitle}, Your SMDL College account password was successfully changed. If this was not you, please contact the college administrator immediately.`;

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

  if (env.RESEND_API_KEY || env.BREVO_API_KEY) {
    try {
      await sendViaHttpApi({
        toEmail,
        subject,
        htmlContent,
        textContent,
      });
      return;
    } catch (_e) {}
  }

  const mailTransporter = getTransporter();
  if (!mailTransporter) return;

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

/**
 * Sends a notification email to a teacher when their account is APPROVED by an admin
 * @param {string} toEmail 
 * @param {string} teacherName 
 */
async function sendTeacherApprovalEmail(toEmail, teacherName = 'Faculty Member') {
  const mailTransporter = getTransporter();
  if (!mailTransporter) {
    console.warn('[emailService] SMTP not configured; skipping teacher approval email.');
    return { success: false, reason: 'SMTP not configured' };
  }

  const clientUrl = (env.CLIENT_URL || 'http://localhost:3000').replace(/\/+$/, '');
  const loginUrl = `${clientUrl}/login`;

  const htmlContent = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Faculty Account Approved - SMDL College</title>
      <style>
        body { margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0b0f19; color: #f1f5f9; }
        .container { max-width: 580px; margin: 40px auto; background: #111827; border-radius: 16px; border: 1px solid #1f2937; overflow: hidden; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5); }
        .header { background: linear-gradient(135deg, #065f46 0%, #059669 100%); padding: 32px 24px; text-align: center; }
        .header h1 { margin: 0; color: #ffffff; font-size: 22px; font-weight: 700; }
        .header p { margin: 6px 0 0 0; color: #a7f3d0; font-size: 13px; }
        .content { padding: 36px 32px; }
        .greeting { font-size: 16px; color: #e2e8f0; margin-bottom: 12px; }
        .message { font-size: 14px; line-height: 1.6; color: #cbd5e1; }
        .status-card { background: #064e3b; border: 1px solid #059669; border-radius: 12px; padding: 20px; margin: 24px 0; text-align: center; }
        .status-badge { display: inline-block; background: #10b981; color: #ffffff; font-weight: 700; font-size: 12px; padding: 4px 12px; border-radius: 9999px; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px; }
        .status-title { font-size: 16px; font-weight: 700; color: #ffffff; margin: 0; }
        .btn-wrapper { text-align: center; margin: 28px 0; }
        .btn { display: inline-block; background: #059669; color: #ffffff; text-decoration: none; font-weight: 600; font-size: 15px; padding: 14px 32px; border-radius: 10px; box-shadow: 0 4px 12px rgba(5, 150, 105, 0.35); }
        .features-box { background: #1f2937; border-radius: 10px; padding: 16px; margin: 20px 0; font-size: 13px; color: #94a3b8; }
        .features-box ul { margin: 8px 0 0 0; padding-left: 20px; }
        .features-box li { margin-bottom: 6px; }
        .footer { background-color: #0a0f1d; padding: 20px; text-align: center; font-size: 11px; color: #475569; border-top: 1px solid #1e293b; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>SES's S. M. Dadasaheb Limaye College</h1>
          <p>Smart Attendance & Communication Portal &bull; Faculty Notice</p>
        </div>
        <div class="content">
          <div class="greeting">Dear <strong>${teacherName}</strong>,</div>
          <p class="message">
            We are pleased to inform you that your teacher registration application has been <strong>reviewed and approved</strong> by the college administration.
          </p>
          
          <div class="status-card">
            <span class="status-badge">&check; Active &amp; Approved</span>
            <p class="status-title">Faculty Portal Access Granted</p>
          </div>

          <p class="message">
            You can now log in to the faculty portal using your registered email address (or Employee ID) and password to manage your academic assignments.
          </p>

          <div class="features-box">
            <strong style="color: #f1f5f9;">What you can do now:</strong>
            <ul>
              <li>Access your daily lecture schedule and weekly timetable</li>
              <li>Conduct lecture sessions and review live student attendance rosters</li>
              <li>Inspect student verification proofs (live selfies &amp; GPS coordinates)</li>
              <li>Mark attendance overrides for students without smartphones</li>
              <li>Post announcements and share class study materials</li>
            </ul>
          </div>

          <div class="btn-wrapper">
            <a href="${loginUrl}" class="btn" target="_blank" rel="noopener noreferrer">Sign In to Faculty Portal &rarr;</a>
          </div>

          <p style="font-size: 12px; color: #64748b; line-height: 1.5;">
            If you did not apply for an account with SMDL College or believe you received this message by mistake, please contact college administration immediately.
          </p>
        </div>
        <div class="footer">
          <p style="margin: 0 0 4px 0;">SES's Shikshan Maharshi Dadasaheb Limaye Arts, Commerce &amp; Science College</p>
          <p style="margin: 0;">Sector 3E, CIDCO Colony, Kalamboli, Navi Mumbai, Maharashtra 410218</p>
        </div>
      </div>
    </body>
    </html>
  `;

  try {
    const info = await mailTransporter.sendMail({
      from: env.EMAIL_FROM,
      to: toEmail,
      subject: 'SMDL College - Faculty Account Approved',
      text: `Hello ${teacherName},\n\nYour SMDL College faculty account has been approved by the administration. You can now log in at ${loginUrl} to access your classes and attendance dashboard.\n\nSES's S. M. Dadasaheb Limaye College, Kalamboli`,
      html: htmlContent,
    });
    return { success: true, messageId: info.messageId };
  } catch (err) {
    console.error('[emailService] Failed to send teacher approval email:', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Sends a notification email to a teacher when their application is REJECTED by an admin
 * @param {string} toEmail 
 * @param {string} teacherName 
 * @param {string} rejectionReason 
 */
async function sendTeacherRejectionEmail(toEmail, teacherName = 'Faculty Member', rejectionReason = 'Application details could not be verified') {
  const mailTransporter = getTransporter();
  if (!mailTransporter) {
    console.warn('[emailService] SMTP not configured; skipping teacher rejection email.');
    return { success: false, reason: 'SMTP not configured' };
  }

  const htmlContent = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Faculty Application Update - SMDL College</title>
      <style>
        body { margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0b0f19; color: #f1f5f9; }
        .container { max-width: 580px; margin: 40px auto; background: #111827; border-radius: 16px; border: 1px solid #1f2937; overflow: hidden; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5); }
        .header { background: linear-gradient(135deg, #7f1d1d 0%, #b91c1c 100%); padding: 32px 24px; text-align: center; }
        .header h1 { margin: 0; color: #ffffff; font-size: 22px; font-weight: 700; }
        .header p { margin: 6px 0 0 0; color: #fecaca; font-size: 13px; }
        .content { padding: 36px 32px; }
        .greeting { font-size: 16px; color: #e2e8f0; margin-bottom: 12px; }
        .message { font-size: 14px; line-height: 1.6; color: #cbd5e1; }
        .reason-card { background: #18181b; border-left: 4px solid #ef4444; border-radius: 0 8px 8px 0; padding: 16px; margin: 20px 0; font-size: 14px; color: #fca5a5; }
        .contact-box { background: #1f2937; border-radius: 10px; padding: 16px; margin: 20px 0; font-size: 13px; color: #94a3b8; line-height: 1.6; }
        .footer { background-color: #0a0f1d; padding: 20px; text-align: center; font-size: 11px; color: #475569; border-top: 1px solid #1e293b; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>SES's S. M. Dadasaheb Limaye College</h1>
          <p>Smart Attendance & Communication Portal &bull; Application Status</p>
        </div>
        <div class="content">
          <div class="greeting">Dear <strong>${teacherName}</strong>,</div>
          <p class="message">
            Thank you for your application to register as faculty on the SMDL Smart Attendance System.
          </p>
          <p class="message">
            Following an administrative review, we regret to inform you that your registration could not be approved at this time.
          </p>
          
          <div class="reason-card">
            <strong style="color: #ffffff; display: block; margin-bottom: 4px;">Reason for Decision:</strong>
            ${rejectionReason || 'Application credentials or employee record could not be verified by college administration.'}
          </div>

          <div class="contact-box">
            <strong style="color: #f1f5f9;">What should you do?</strong><br />
            If you are a faculty member at SMDL College and believe this decision was made in error, or if your registration contained incorrect details (e.g. Employee ID or Department), please visit the College Administration Office or contact the Principal's Office to verify your credentials.
          </div>

          <p style="font-size: 12px; color: #64748b; margin-top: 24px;">
            Please do not submit duplicate registrations with alternate email addresses without contacting administration first.
          </p>
        </div>
        <div class="footer">
          <p style="margin: 0 0 4px 0;">SES's Shikshan Maharshi Dadasaheb Limaye Arts, Commerce &amp; Science College</p>
          <p style="margin: 0;">Sector 3E, CIDCO Colony, Kalamboli, Navi Mumbai, Maharashtra 410218</p>
        </div>
      </div>
    </body>
    </html>
  `;

  try {
    const info = await mailTransporter.sendMail({
      from: env.EMAIL_FROM,
      to: toEmail,
      subject: 'SMDL College - Faculty Registration Application Update',
      text: `Hello ${teacherName},\n\nYour faculty registration on the SMDL Smart Attendance System was reviewed and could not be approved at this time.\n\nReason: ${rejectionReason}\n\nIf you believe this was in error, please contact the SMDL College Administration Office.\n\nSES's S. M. Dadasaheb Limaye College, Kalamboli`,
      html: htmlContent,
    });
    return { success: true, messageId: info.messageId };
  } catch (err) {
    console.error('[emailService] Failed to send teacher rejection email:', err.message);
    return { success: false, error: err.message };
  }
}

module.exports = {
  sendOtpEmail,
  sendPasswordResetEmail,
  sendPasswordChangedSecurityEmail,
  sendTeacherApprovalEmail,
  sendTeacherRejectionEmail,
};
