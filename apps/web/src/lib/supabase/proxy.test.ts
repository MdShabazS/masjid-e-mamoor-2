import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { createServerClient } = vi.hoisted(() => ({ createServerClient: vi.fn() }));
vi.mock("@supabase/ssr", () => ({ createServerClient }));

import { updateSession } from "./proxy";

describe("public receipt session access", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it("lets a visitor with a stale cookie reach the public receipt page", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "public-key");
    const response = await updateSession(new NextRequest("https://masjid.example/receipt-lookup", {
      headers: { cookie: "session=stale" },
    }));
    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
    expect(createServerClient).not.toHaveBeenCalled();
  });
});
