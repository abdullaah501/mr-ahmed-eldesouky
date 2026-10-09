import { NextResponse } from "next/server";
import nodemailer from "nodemailer";

export async function POST(req) {
  const origin = req.headers.get("origin");
  const allowedOrigin = process.env.NEXT_PUBLIC_URL;

  const headers = {
    "Access-Control-Allow-Origin":
      origin === allowedOrigin ? origin : allowedOrigin,
    "Access-Control-Allow-Credentials": "true",
    "Content-Type": "application/json",
  };

  if (origin !== allowedOrigin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403, headers });
  }

  const body = await req.json();
  const {
    to,
    subject,
    message,
    html,
    name = "",
    email = "",
    phone = "",
  } = body;

  console.log("test ☺️", body);

  if (!to || !subject || !message) {
    return NextResponse.json(
      { success: false, message: "All fields are required" },
      { status: 400, headers },
    );
  }

  let finalHtml = html;

  if (!finalHtml && (name || email || phone || message)) {
    finalHtml = `
      <div style="direction: rtl; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
        <!-- Header -->
        <div style="background-color: #00b9ae; padding: 24px; text-align: center;">
          <h2 style="color: #ffffff; margin: 0; font-size: 20px; font-weight: bold;">رسالة تواصل جديدة - منصة أ. أحمد الدسوقي</h2>
        </div>
        
        <!-- Content -->
        <div style="padding: 24px; background-color: #ffffff;">
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
            <tr>
              <td style="padding: 10px; border-bottom: 1px solid #edf2f7; font-weight: bold; color: #4a5568; width: 120px;">الاسم:</td>
              <td style="padding: 10px; border-bottom: 1px solid #edf2f7; color: #2d3748;">${name || "غير متوفر"}</td>
            </tr>
            <tr>
              <td style="padding: 10px; border-bottom: 1px solid #edf2f7; font-weight: bold; color: #4a5568;">البريد الإلكتروني:</td>
              <td style="padding: 10px; border-bottom: 1px solid #edf2f7; color: #2d3748;"><a href="mailto:${email}" style="color: #00b9ae; text-decoration: none;">${email || "غير متوفر"}</a></td>
            </tr>
            <tr>
              <td style="padding: 10px; border-bottom: 1px solid #edf2f7; font-weight: bold; color: #4a5568;">رقم الموبايل:</td>
              <td style="padding: 10px; border-bottom: 1px solid #edf2f7; color: #2d3748;">${phone || "غير متوفر"}</td>
            </tr>
            <tr>
              <td style="padding: 10px; border-bottom: 1px solid #edf2f7; font-weight: bold; color: #4a5568;">الموضوع:</td>
              <td style="padding: 10px; border-bottom: 1px solid #edf2f7; color: #2d3748; font-weight: bold;">${subject || "بدون موضوع"}</td>
            </tr>
          </table>
          
          <div style="background-color: #f7fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin-top: 20px; text-align: right;">
            <h4 style="margin-top: 0; margin-bottom: 8px; color: #4a5568;">محتوى الرسالة:</h4>
            <p style="margin: 0; color: #2d3748; line-height: 1.6; white-space: pre-wrap;">${message || "لا يوجد محتوى للرسالة"}</p>
          </div>
        </div>
        
        <!-- Footer -->
        <div style="background-color: #edf2f7; padding: 16px; text-align: center; font-size: 12px; color: #718096; border-top: 1px solid #e2e8f0;">
          تم إرسال هذه الرسالة تلقائياً من نموذج التواصل في موقع <a href="https://mr-ahmed-eldesouky.pixelpulse.online" style="color: #00b9ae; text-decoration: none; font-weight: bold;">منصة أ. أحمد الدسوقي</a>
        </div>
      </div>
    `;
  }

  // Nodemailer Transporter Setup
  const transporter = nodemailer.createTransport({
    service: "Gmail",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
    tls: {
      rejectUnauthorized: false, // ⛔️ Disable certificate validation
    },
    pool: true, // ⏳ Keeps the connection open for reuse
    maxConnections: 5,
    maxMessages: 10,
  });

  try {
    const info = await transporter.sendMail({
      from: `"${name ? `${name} (عبر منصة أ. أحمد الدسوقي)` : "منصة أ. أحمد الدسوقي"}" <${process.env.EMAIL_USER}>`,
      replyTo: email || undefined,
      to,
      subject: subject || "رسالة جديدة",
      text: message,
      html: finalHtml,
    });

    console.log("Email sent:", info.messageId);

    return NextResponse.json(
      {
        success: true,
        message: "Email sent successfully",
        messageId: info.messageId,
      },
      { status: 200, headers },
    );
  } catch (error) {
    console.error("Error sending email:", error);

    return NextResponse.json(
      { success: false, message: error.message || "Error sending email" },
      { status: 500, headers },
    );
  }
}
