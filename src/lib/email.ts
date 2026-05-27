import nodemailer from "nodemailer";

export type EmailDelivery = {
  enabled: boolean;
  sent: boolean;
  message: string;
};

type AlertEmail = {
  to: string;
  subject: string;
  title: string;
  message: string;
  processNumber?: string;
};

export function isEmailConfigured() {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

export async function sendAlertEmail(email: AlertEmail): Promise<EmailDelivery> {
  if (!isEmailConfigured()) {
    return {
      enabled: false,
      sent: false,
      message: "SMTP não configurado. O alerta ficou disponível dentro do site.",
    };
  }

  try {
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT ?? 587),
      secure: process.env.SMTP_SECURE === "true",
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    await transporter.sendMail({
      from: process.env.SMTP_FROM ?? process.env.SMTP_USER,
      to: email.to,
      subject: email.subject,
      text: buildTextEmail(email),
      html: buildHtmlEmail(email),
    });

    return {
      enabled: true,
      sent: true,
      message: "E-mail enviado.",
    };
  } catch (error) {
    return {
      enabled: true,
      sent: false,
      message: error instanceof Error ? error.message : "Falha ao enviar e-mail.",
    };
  }
}

function buildTextEmail(email: AlertEmail) {
  return [
    email.title,
    "",
    email.message,
    email.processNumber ? `Processo: ${email.processNumber}` : "",
    "",
    "Este alerta é informativo e não substitui a consulta oficial no tribunal.",
  ]
    .filter(Boolean)
    .join("\n");
}

function buildHtmlEmail(email: AlertEmail) {
  return `
    <div style="font-family:Arial,sans-serif;line-height:1.5;color:#0f172a">
      <h2 style="margin:0 0 12px">${escapeHtml(email.title)}</h2>
      <p style="margin:0 0 12px">${escapeHtml(email.message)}</p>
      ${
        email.processNumber
          ? `<p style="margin:0 0 12px"><strong>Processo:</strong> ${escapeHtml(email.processNumber)}</p>`
          : ""
      }
      <p style="font-size:12px;color:#475569">Este alerta é informativo e não substitui a consulta oficial no tribunal.</p>
    </div>
  `;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

