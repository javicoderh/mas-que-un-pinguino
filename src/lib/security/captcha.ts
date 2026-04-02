import { securityConfig } from "./config";

export async function verifyCaptchaToken(token: string, ip: string) {
  if (!securityConfig.captcha.enabled) {
    return { verified: false, attempted: false };
  }

  if (!securityConfig.captcha.secret || !token) {
    return { verified: false, attempted: true };
  }

  if (securityConfig.captcha.provider === "turnstile") {
    const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        secret: securityConfig.captcha.secret,
        response: token,
        remoteip: ip
      })
    });

    if (!response.ok) {
      return { verified: false, attempted: true };
    }

    const payload = await response.json();
    return { verified: Boolean(payload.success), attempted: true };
  }

  const response = await fetch("https://www.google.com/recaptcha/api/siteverify", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      secret: securityConfig.captcha.secret,
      response: token,
      remoteip: ip
    })
  });

  if (!response.ok) {
    return { verified: false, attempted: true };
  }

  const payload = await response.json();
  return { verified: Boolean(payload.success), attempted: true };
}
