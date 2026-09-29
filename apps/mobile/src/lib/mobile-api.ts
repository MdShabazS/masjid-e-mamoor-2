import type { Session } from "@supabase/supabase-js";
import { getMobileConfig } from "./config";

export interface MobileLoginResponse {
  accessToken: string;
  refreshToken: string;
  expiresAt: number | null;
  expiresIn: number;
  mustChangePassword: boolean;
}

export function parseLoginResponse(value: unknown): MobileLoginResponse | null {
  if (!value || typeof value !== "object") return null;
  const body = value as Record<string, unknown>;
  if (
    typeof body.accessToken === "string" &&
    typeof body.refreshToken === "string" &&
    (typeof body.expiresAt === "number" || body.expiresAt === null) &&
    typeof body.expiresIn === "number" &&
    typeof body.mustChangePassword === "boolean"
  ) {
    return body as unknown as MobileLoginResponse;
  }
  return null;
}

async function readJson(response: Response) {
  try {
    return (await response.json()) as unknown;
  } catch {
    return null;
  }
}

export async function loginWithUsername(username: string, password: string) {
  const { apiUrl } = getMobileConfig();
  const response = await fetch(`${apiUrl}/api/mobile/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  const body = await readJson(response);

  if (!response.ok || !parseLoginResponse(body)) {
    throw new Error("invalid_credentials");
  }

  return parseLoginResponse(body) as MobileLoginResponse;
}

export async function changePassword(
  session: Session,
  password: string,
  confirmPassword: string,
) {
  const { apiUrl } = getMobileConfig();
  const response = await fetch(`${apiUrl}/api/mobile/auth/change-password`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ password, confirmPassword }),
  });

  if (!response.ok) throw new Error("password_change_failed");
}
