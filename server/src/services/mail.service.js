import nodemailer from "nodemailer";

const provider = process.env.EMAIL_PROVIDER || "gmail";
const transporter =
  provider === "mailtrap"
    ? nodemailer.createTransport({
        host: process.env.MAILTRAP_HOST,
        port: Number(process.env.MAILTRAP_PORT || 587),
        secure: false,
        auth: { user: process.env.MAILTRAP_USER, pass: process.env.MAILTRAP_PASS },
      })
    : nodemailer.createTransport({
        host: "smtp.gmail.com",
        port: 465,
        secure: true,
        auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
      });

export async function sendMail(to, subject, text, html) {
  return transporter.sendMail({
    from: process.env.MAIL_FROM || process.env.SMTP_USER,
    to,
    subject,
    text,
    html: html ?? `<p>${text}</p>`,
  });
}
