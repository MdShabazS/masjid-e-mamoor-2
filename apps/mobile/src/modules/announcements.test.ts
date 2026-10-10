import { supabase } from "../lib/supabase";
import { listMyAnnouncements, publishAnnouncement } from "./announcements";

jest.mock("expo-crypto", () => ({ randomUUID: () => "operation-1" }));
jest.mock("../lib/supabase", () => ({ supabase: { rpc: jest.fn() } }));

const rpc = supabase.rpc as jest.Mock;

describe("announcement trusted operations", () => {
  beforeEach(() => rpc.mockReset());

  it("publishes through the trusted RPC with a stable operation id", async () => {
    rpc.mockResolvedValue({ data: { id: "announcement-1" }, error: null });
    await publishAnnouncement({ title: "  Committee update ", body: "  Meeting moved. " });
    expect(rpc).toHaveBeenCalledWith("publish_announcement", {
      p_title: "Committee update",
      p_body: "Meeting moved.",
      p_target_path: "/announcements",
      p_operation_id: "operation-1",
    });
  });

  it("reads only through the personal announcement RPC", async () => {
    rpc.mockResolvedValue({ data: [], error: null });
    await expect(listMyAnnouncements()).resolves.toEqual([]);
    expect(rpc).toHaveBeenCalledWith("list_my_announcements", { p_limit: 50, p_offset: 0 });
  });
});
