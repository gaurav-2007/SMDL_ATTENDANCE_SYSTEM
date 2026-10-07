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
    console.error('[emailService] Failed to send email via SMTP:', error.message);
    if (process.env.NODE_ENV !== 'production') {
      console.warn(`[emailService] Non-production fallback: returning dev mock delivery due to SMTP limit (${error.message})`);
      return {
        success: true,
        delivered: false,
        messageId: `mock-dev-${Date.now()}`,
        devFallback: true,
      };
    const sanitizedMsg = process.env.NODE_ENV === 'production'
      ? 'Failed to deliver verification email. Please try again later or contact college admin.'
      : `Failed to deliver verification email: ${error.message || 'SMTP delivery failed'}`;
    throw new Error(sanitizedMsg);
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
    console.error('[emailService] Failed to send password reset email:', error.message);
    if (process.env.NODE_ENV !== 'production') {
      console.warn(`[emailService] Non-production fallback: returning dev mock delivery due to SMTP limit (${error.message})`);
      return {
        success: true,
        delivered: false,
        messageId: `mock-dev-${Date.now()}`,
        devFallback: true,
      };
    const sanitizedMsg = process.env.NODE_ENV === 'production'
      ? 'Failed to deliver password reset email. Please try again later.'
      : `Failed to deliver password reset email: ${error.message || 'SMTP delivery failed'}`;
    throw new Error(sanitizedMsg);
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
