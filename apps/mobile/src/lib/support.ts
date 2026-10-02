export const SUPPORT_EMAIL = "md.shabaz.2005@gmail.com";

export function buildSupportEmailUrl({
  appVersion,
  buildVersion,
  platform,
  osVersion,
  role,
}: {
  appVersion: string;
  buildVersion: string;
  platform: string;
  osVersion: string;
  role: string;
}) {
  const subject = "Masjid E Mamoor 2 - Support Request";

  const body = [
    "Hello,",
    "",
    "I am facing a problem in Masjid E Mamoor 2.",
    "",
    "Please describe what you were doing and what happened:",
    "",
    "",
    "App diagnostics:",
    `App version: ${appVersion}`,
    `Build: ${buildVersion}`,
    `Platform: ${platform}`,
    `OS version: ${osVersion}`,
    `Role: ${role}`,
    "",
    "Please do not include passwords, OTPs, payment credentials, or other sensitive information.",
  ].join("\n");

  return `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
