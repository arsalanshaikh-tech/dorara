'use strict'

/**
 * Plain, dependency-free HTML email templates. Each returns `{ subject, html,
 * text }`. Inline styles are used because email clients strip <style> blocks.
 * The palette matches Dorara's brand (deep teal + warm sand accents).
 */

const BRAND = {
  name: 'Dorara',
  primary: '#0f766e',
  ink: '#0f172a',
  muted: '#64748b',
  bg: '#f8fafc',
}

function layout(title, bodyHtml) {
  return `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:${BRAND.bg};font-family:Arial,Helvetica,sans-serif;color:${BRAND.ink};">
    <div style="max-width:560px;margin:0 auto;padding:32px 16px;">
      <div style="font-size:22px;font-weight:700;color:${BRAND.primary};margin-bottom:24px;">${BRAND.name}</div>
      <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;padding:32px;">
        <h1 style="font-size:20px;margin:0 0 16px;">${title}</h1>
        ${bodyHtml}
      </div>
      <p style="color:${BRAND.muted};font-size:12px;margin-top:24px;text-align:center;">
        You are receiving this email because an action was requested on your ${BRAND.name} account.
        If this wasn't you, you can safely ignore it.
      </p>
    </div>
  </body>
</html>`
}

function button(url, label) {
  return `<a href="${url}" style="display:inline-block;background:${BRAND.primary};color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:600;margin:8px 0;">${label}</a>`
}

function verifyEmail({ name, url }) {
  const subject = 'Verify your Dorara email address'
  const html = layout(
    'Confirm your email',
    `<p>Hi ${name || 'there'},</p>
     <p>Thanks for signing up for Dorara. Please confirm your email address to activate your account.</p>
     <p>${button(url, 'Verify email')}</p>
     <p style="color:${BRAND.muted};font-size:13px;">Or paste this link into your browser:<br/>${url}</p>`,
  )
  const text = `Hi ${name || 'there'},\n\nConfirm your email address to activate your Dorara account:\n${url}\n`
  return { subject, html, text }
}

function welcome({ name }) {
  const subject = 'Welcome to Dorara'
  const html = layout(
    'Welcome aboard',
    `<p>Hi ${name || 'there'},</p>
     <p>Your email is verified and your account is ready. Start by telling us about your next trip and we'll craft tailored destination recommendations, cost estimates and a step-by-step plan.</p>`,
  )
  const text = `Hi ${name || 'there'},\n\nYour Dorara account is ready. Start planning your next trip!\n`
  return { subject, html, text }
}

function resetPassword({ name, url }) {
  const subject = 'Reset your Dorara password'
  const html = layout(
    'Reset your password',
    `<p>Hi ${name || 'there'},</p>
     <p>We received a request to reset your password. This link expires shortly for your security.</p>
     <p>${button(url, 'Reset password')}</p>
     <p style="color:${BRAND.muted};font-size:13px;">Or paste this link into your browser:<br/>${url}</p>
     <p style="color:${BRAND.muted};font-size:13px;">If you didn't request this, no changes were made.</p>`,
  )
  const text = `Hi ${name || 'there'},\n\nReset your Dorara password:\n${url}\n\nIf you didn't request this, ignore this email.`
  return { subject, html, text }
}

function otp({ name, code, minutes }) {
  const subject = `${code} is your Dorara verification code`
  const html = layout(
    'Your verification code',
    `<p>Hi ${name || 'there'},</p>
     <p>Use the following one-time code. It expires in ${minutes} minutes.</p>
     <p style="font-size:32px;font-weight:700;letter-spacing:6px;color:${BRAND.primary};margin:16px 0;">${code}</p>
     <p style="color:${BRAND.muted};font-size:13px;">Never share this code with anyone.</p>`,
  )
  const text = `Hi ${name || 'there'},\n\nYour Dorara verification code is ${code}. It expires in ${minutes} minutes.`
  return { subject, html, text }
}

function loginAlert({ name, device, ip, when }) {
  const subject = 'New sign-in to your Dorara account'
  const html = layout(
    'New sign-in detected',
    `<p>Hi ${name || 'there'},</p>
     <p>We noticed a new sign-in to your account:</p>
     <ul style="color:${BRAND.muted};font-size:14px;">
       <li>Device: ${device || 'Unknown'}</li>
       <li>IP address: ${ip || 'Unknown'}</li>
       <li>Time: ${when}</li>
     </ul>
     <p>If this was you, no action is needed. Otherwise, reset your password immediately.</p>`,
  )
  const text = `Hi ${name || 'there'},\n\nNew sign-in detected.\nDevice: ${device}\nIP: ${ip}\nTime: ${when}\n`
  return { subject, html, text }
}

module.exports = { verifyEmail, welcome, resetPassword, otp, loginAlert }
