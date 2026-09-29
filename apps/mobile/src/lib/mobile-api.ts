import type { Session } from "@supabase/supabase-js";
import { getMobileConfig } from "./config";
import type { MobileReferral } from "../modules/types";

export interface MobileLoginResponse {
  accessToken: string;
  refreshToken: string;
  expiresAt: number | null;
  expiresIn: number;
  mustChangePassword: boolean;
}

export function parseProvisionResponse(
  value: unknown,
): { temporaryPassword: string | null } | null {
  if (!value || typeof value !== "object") return null;
  const password = (value as { temporaryPassword?: unknown }).temporaryPassword;
  return typeof password === "string" || password === null
    ? { temporaryPassword: password }
    : null;
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

async function managementRequest<T>(
  session: Session,
  path: string,
  method: "GET" | "POST",
  body?: unknown,
): Promise<T> {
  const { apiUrl } = getMobileConfig();
  const response = await fetch(`${apiUrl}/api/mobile/referrals/${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  if (!response.ok) throw new Error("request_failed");
  return (await response.json()) as T;
}

export async function listManagedReferrals(session: Session) {
  const result = await managementRequest<{ referrals: MobileReferral[] }>(
    session,
    "manage",
    "GET",
  );
  return result.referrals;
}

export async function approveManagedReferral(
  session: Session,
  referralId: string,
  operationId: string,
) {
  await managementRequest(session, "approve", "POST", { referralId, operationId });
}

export async function rejectManagedReferral(
  session: Session,
  referralId: string,
  operationId: string,
  reason: string | null,
) {
  await managementRequest(session, "reject", "POST", {
    referralId,
    operationId,
    reason,
  });
}

export async function provisionManagedReferral(
  session: Session,
  input: {
    referralId: string;
    username: string;
    password?: string;
    operationId: string;
  },
) {
  const result = await managementRequest<unknown>(
    session,
    "provision",
    "POST",
    input,
  );
  const parsed = parseProvisionResponse(result);
  if (!parsed) throw new Error("request_failed");
  return parsed;
}
