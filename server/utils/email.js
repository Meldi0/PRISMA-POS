import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

// Inisialisasi transporter Nodemailer
let transporter = null;

const smtpHost = process.env.SMTP_HOST || 'smtp.gmail.com';
const smtpPort = Number(process.env.SMTP_PORT || 465);
const smtpUser = process.env.SMTP_USER || '';
const smtpPass = process.env.SMTP_PASS || '';
const emailFrom = process.env.EMAIL_FROM || (smtpUser ? `"PRISMA POS Helpdesk" <${smtpUser}>` : '"PRISMA POS Helpdesk" <no-reply@poso.local>');

export function isSmtpReady() {
  const user = (process.env.SMTP_USER || '').trim();
  const pass = (process.env.SMTP_PASS || '').trim();
  return Boolean(
    user &&
    pass &&
    !user.includes('emailkamu@') &&
    !user.includes('your-account@') &&
    !pass.includes('xxxx') &&
    !pass.includes('YOUR_')
  );
}

export const isSmtpConfigured = isSmtpReady();

if (isSmtpReady()) {
  transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpPort === 465, // true for 465, false for 587 / other ports
    auth: {
      user: smtpUser,
      pass: smtpPass
    }
  });
}

/**
 * Kirim email kode OTP ke alamat email / Gmail pengguna
 */
export async function sendOtpEmail({ toEmail, recipientName, otpCode }) {
  const subject = `Kode OTP Masuk Sistem Helpdesk POSO: ${otpCode}`;

  const htmlContent = `
    <!DOCTYPE html>
    <html lang="id">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${subject}</title>
      <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #F8FAFC; margin: 0; padding: 0; }
        .container { max-width: 540px; margin: 30px auto; background: #ffffff; border-radius: 16px; border: 1px solid #E2E8F0; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.06); }
        .header { background: linear-gradient(135deg, #002B49 0%, #0D5C75 100%); padding: 32px 24px; text-align: center; color: #ffffff; }
        .header h1 { margin: 0; font-size: 22px; font-weight: 800; letter-spacing: 0.5px; }
        .header p { margin: 6px 0 0 0; font-size: 13px; opacity: 0.85; }
        .content { padding: 32px 28px; color: #1E293B; }
        .greeting { font-size: 15px; font-weight: 600; margin-bottom: 12px; }
        .message { font-size: 13px; line-height: 1.6; color: #475569; margin-bottom: 24px; }
        .otp-box { background: #F1F5F9; border: 2px dashed #0D5C75; border-radius: 12px; padding: 20px; text-align: center; margin-bottom: 24px; }
        .otp-code { font-family: 'Courier New', Courier, monospace; font-size: 36px; font-weight: 900; letter-spacing: 8px; color: #002B49; margin: 0; }
        .otp-expiry { font-size: 12px; color: #DC2626; font-weight: 600; margin-top: 8px; }
        .warning { font-size: 12px; color: #64748B; background: #FFFBEB; border-left: 4px solid #F59E0B; padding: 12px 14px; border-radius: 6px; margin-bottom: 24px; line-height: 1.5; }
        .footer { background: #F8FAFC; border-top: 1px solid #E2E8F0; padding: 20px 24px; text-align: center; font-size: 11px; color: #94A3B8; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>PT POS INDONESIA (PERSERO)</h1>
          <p>PRISMA POS — Sistem Helpdesk & Tiket Terpadu</p>
        </div>
        <div class="content">
          <div class="greeting">Halo, ${recipientName || 'Petugas Kedinasan'}</div>
          <div class="message">
            Kami menerima permintaan masuk (*sign-in*) ke akun PRISMA POS Anda. Gunakan 6-digit kode OTP (One-Time Password) berikut untuk menyelesaikan proses verifikasi:
          </div>
          
          <div class="otp-box">
            <div class="otp-code">${otpCode}</div>
            <div class="otp-expiry">⏱ Kode ini berlaku selama 5 menit</div>
          </div>

          <div class="warning">
            <strong>Keamanan:</strong> Jangan berikan kode OTP ini kepada siapapun, termasuk pihak yang mengatasnamakan Administrator POSO atau PT Pos Indonesia.
          </div>

          <div class="message" style="margin-bottom: 0; font-size: 12px;">
            Jika Anda tidak merasa melakukan percobaan login ini, segera hubungi Administrator Pusat untuk mengamankan akun Anda.
          </div>
        </div>
        <div class="footer">
          &copy; ${new Date().getFullYear()} PT Pos Indonesia (Persero) &bull; Direktorat Operasional & Teknologi Informasi<br/>
          Pesan otomatis, mohon tidak membalas email ini.
        </div>
      </div>
    </body>
    </html>
  `;

  // Log ke console terminal agar terlihat jelas di log server
  console.log('=================================================================');
  console.log(`[EMAIL OTP SENDER] Mengirim kode OTP ke: ${toEmail}`);
  console.log(`[EMAIL OTP SENDER] Subjek: ${subject}`);
  console.log(`[EMAIL OTP SENDER] KODE OTP: ${otpCode}`);
  console.log('=================================================================');

  if (isSmtpConfigured && transporter) {
    try {
      const info = await transporter.sendMail({
        from: emailFrom,
        to: toEmail,
        subject,
        html: htmlContent
      });
      console.log(`[EMAIL OTP SENDER] ✓ Email berhasil terkirim via SMTP (${info.messageId})`);
      return { success: true, messageId: info.messageId, mode: 'SMTP' };
    } catch (err) {
      console.error('[EMAIL OTP SENDER] Gagal mengirim via SMTP:', err.message);
      return { success: false, error: err.message, mode: 'SMTP_FAILED_LOGGED' };
    }
  } else {
    console.log('[EMAIL OTP SENDER] Mode Simulasi Aktif (SMTP_USER / SMTP_PASS belum diset di .env).');
    console.log('[EMAIL OTP SENDER] Kode OTP berhasil dicatat di console untuk pengujian dinas.');
    return { success: true, mode: 'CONSOLE_SIMULATION' };
  }
}
