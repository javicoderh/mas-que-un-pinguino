import tls from "node:tls";

const smtpHost = import.meta.env.SMTP_HOST ?? "";
const smtpPort = Number(import.meta.env.SMTP_PORT ?? "465");
const smtpUser = import.meta.env.SMTP_USER ?? "";
const smtpPass = import.meta.env.SMTP_PASS ?? "";
const smtpFrom = import.meta.env.SMTP_FROM ?? smtpUser;
const smtpReplyTo = import.meta.env.EMAIL_REPLY_TO ?? smtpUser;

export const isSmtpConfigured = Boolean(
  smtpHost && Number.isFinite(smtpPort) && smtpPort > 0 && smtpUser && smtpPass && smtpFrom
);

const base64 = (value: string) => Buffer.from(value, "utf8").toString("base64");

const normalizeSmtpLine = (value: string) => value.replace(/\r?\n/g, " ").trim();

const encodeHeaderWord = (value: string) => `=?UTF-8?B?${base64(value)}?=`;

const formatAddressHeader = (value: string) => {
  const normalized = normalizeSmtpLine(value);
  const match = normalized.match(/^(.*)<([^>]+)>$/);
  if (!match) return normalized;

  const displayName = match[1].trim().replace(/^"|"$/g, "");
  const email = match[2].trim();

  if (!displayName) return `<${email}>`;
  return `${encodeHeaderWord(displayName)} <${email}>`;
};

export interface SendEmailParams {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export async function sendEmail(params: SendEmailParams) {
  if (!isSmtpConfigured) {
    throw new Error("smtp-not-configured");
  }

  const subject = encodeHeaderWord(params.subject);

  const boundary = `boundary_${crypto.randomUUID().replace(/-/g, "")}`;

  const messageLines = params.html
    ? [
        `From: ${formatAddressHeader(smtpFrom)}`,
        `To: ${normalizeSmtpLine(params.to)}`,
        `Reply-To: ${formatAddressHeader(smtpReplyTo)}`,
        `Subject: ${subject}`,
        "MIME-Version: 1.0",
        `Date: ${new Date().toUTCString()}`,
        `Content-Type: multipart/alternative; boundary="${boundary}"`,
        "",
        `--${boundary}`,
        'Content-Type: text/plain; charset="utf-8"',
        "Content-Transfer-Encoding: 8bit",
        "",
        params.text,
        "",
        `--${boundary}`,
        'Content-Type: text/html; charset="utf-8"',
        "Content-Transfer-Encoding: 8bit",
        "",
        params.html,
        "",
        `--${boundary}--`,
        ""
      ]
    : [
        `From: ${formatAddressHeader(smtpFrom)}`,
        `To: ${normalizeSmtpLine(params.to)}`,
        `Reply-To: ${formatAddressHeader(smtpReplyTo)}`,
        `Subject: ${subject}`,
        "MIME-Version: 1.0",
        `Date: ${new Date().toUTCString()}`,
        'Content-Type: text/plain; charset="utf-8"',
        "Content-Transfer-Encoding: 8bit",
        "",
        params.text,
        ""
      ];

  const message = messageLines.join("\r\n");

  await new Promise<void>((resolve, reject) => {
    let stage = 0;
    let buffer = "";

    const socket = tls.connect({ host: smtpHost, port: smtpPort, servername: smtpHost });
    socket.setEncoding("utf8");
    socket.setTimeout(20_000);

    const finishWithError = (error: Error) => {
      socket.destroy();
      reject(error);
    };

    const sendLine = (line: string) => socket.write(`${line}\r\n`);

    socket.on("timeout", () => finishWithError(new Error("smtp-timeout")));
    socket.on("error", (error) => finishWithError(error));

    socket.on("data", (chunk: string) => {
      buffer += chunk;

      while (buffer.includes("\n")) {
        const index = buffer.indexOf("\n");
        const line = buffer.slice(0, index).replace(/\r$/, "");
        buffer = buffer.slice(index + 1);

        if (!line || /^\d{3}-/.test(line)) continue;

        const code = Number(line.slice(0, 3));
        if (!Number.isFinite(code)) continue;

        if (code >= 400) {
          finishWithError(new Error(`smtp-error:${line}`));
          return;
        }

        if (stage === 0 && code === 220) {
          sendLine("EHLO esmasqueunpinguino.local");
          stage = 1;
        } else if (stage === 1 && code === 250) {
          sendLine("AUTH LOGIN");
          stage = 2;
        } else if (stage === 2 && code === 334) {
          sendLine(base64(smtpUser));
          stage = 3;
        } else if (stage === 3 && code === 334) {
          sendLine(base64(smtpPass));
          stage = 4;
        } else if (stage === 4 && code === 235) {
          sendLine(`MAIL FROM:<${smtpUser}>`);
          stage = 5;
        } else if (stage === 5 && code === 250) {
          sendLine(`RCPT TO:<${params.to}>`);
          stage = 6;
        } else if (stage === 6 && (code === 250 || code === 251)) {
          sendLine("DATA");
          stage = 7;
        } else if (stage === 7 && code === 354) {
          const escapedMessage = message.replace(/(^|\r\n)\./g, "$1..");
          socket.write(`${escapedMessage}\r\n.\r\n`);
          stage = 8;
        } else if (stage === 8 && code === 250) {
          sendLine("QUIT");
          stage = 9;
        } else if (stage === 9 && code === 221) {
          socket.end();
          resolve();
        }
      }
    });
  });
}
