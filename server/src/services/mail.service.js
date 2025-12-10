import nodemailer from 'nodemailer';

const provider = (process.env.EMAIL_PROVIDER || 'gmail').toLowerCase();

const pickFrontendUrl = () => {
  const sources = [process.env.FRONTEND_URL, process.env.CLIENT_URL, process.env.CLIENT_ORIGIN];
  for (const raw of sources) {
    if (!raw) continue;
    const first = String(raw).split(',')[0].trim();
    if (first) return first.replace(/\/$/, '');
  }
  return 'http://localhost:5173';
};

const commonTimeouts = {
  connectionTimeout: 7000,
  greetingTimeout: 7000,
  socketTimeout: 7000,
};

const transporter =
  provider === 'mailtrap'
    ? nodemailer.createTransport({
        host: process.env.MAILTRAP_HOST,
        port: Number(process.env.MAILTRAP_PORT || 587),
        secure: false,
        auth: { user: process.env.MAILTRAP_USER, pass: process.env.MAILTRAP_PASS },
        ...commonTimeouts,
      })
    : provider === 'smtp'
    ? nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT || 587),
        secure: String(process.env.SMTP_SECURE ?? 'false').toLowerCase() === 'true',
        auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
        ...commonTimeouts,
      })
    : nodemailer.createTransport({
        service: 'gmail',

        auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
        ...commonTimeouts,
      });

export async function sendMail(to, subject, text, html) {
  return transporter.sendMail({
    from: process.env.SMTP_USER,
    to,
    subject,
    text,
    html: html ?? `<p>${text}</p>`,
  });
}

export async function sendWelcomeEmail(userEmail, userName, password = 'P@ssw0rd') {
  const subject = 'Tài khoản của bạn đã được tạo - TnQ Fashion';
  const loginUrl = `${pickFrontendUrl()}/login`;

  const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 8px;">
      <h2 style="color: #2c3e50; text-align: center;">Chào mừng đến với TnQ Fashion!</h2>
      
      <p style="font-size: 16px; color: #333;">Xin chào <strong>${userName}</strong>,</p>
      
      <p style="font-size: 14px; color: #555;">
        Tài khoản của bạn đã được tạo thành công trên hệ thống TnQ Fashion. 
        Dưới đây là thông tin đăng nhập của bạn:
      </p>
      
      <div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0;">
        <p style="margin: 0; font-size: 14px;"><strong>Email:</strong> ${userEmail}</p>
        <p style="margin: 10px 0 0 0; font-size: 14px;"><strong>Mật khẩu:</strong> ${password}</p>
      </div>
      <p style="text-align:center;">
        <a href="${loginUrl}" style="display:inline-block; background:#111827; color:#fff; padding:10px 16px; border-radius:6px; text-decoration:none;">Đăng nhập ngay</a>
      </p>
      
      <div style="background-color: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 5px; margin: 20px 0;">
        <p style="margin: 0; font-size: 13px; color: #856404;">
          <strong>⚠️ Lưu ý bảo mật:</strong> Vui lòng đổi mật khẩu ngay sau lần đăng nhập đầu tiên để đảm bảo tính bảo mật cho tài khoản của bạn.
        </p>
      </div>
      
      <p style="font-size: 14px; color: #555;">
        Bạn có thể đăng nhập vào hệ thống và bắt đầu sử dụng các dịch vụ của chúng tôi.
      </p>
      
      <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
      
      <p style="font-size: 12px; color: #777; text-align: center;">
        Email này được gửi tự động từ hệ thống TnQ Fashion.<br>
        Vui lòng không trả lời email này.
      </p>
    </div>
  `;

  const textContent = `
    Chào mừng đến với TnQ Fashion!
    
    Xin chào ${userName},
    
    Tài khoản của bạn đã được tạo thành công. Thông tin đăng nhập:
    
    Email: ${userEmail}
    Mật khẩu: ${password}
    
    Vui lòng đổi mật khẩu ngay sau lần đăng nhập đầu tiên để đảm bảo bảo mật.
    
    Đăng nhập: ${loginUrl}
    
    Trân trọng,
    TnQ Fashion Team
  `;

  try {
    await sendMail(userEmail, subject, textContent, htmlContent);
    console.log(` Welcome email sent to: ${userEmail}`);
    return { success: true };
  } catch (error) {
    console.error(` Failed to send welcome email to ${userEmail}:`, error.message);
    // Không throw error để không ảnh hưởng đến việc tạo user
    return { success: false, error: error.message };
  }
}
