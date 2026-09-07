import { beforeEach, describe, expect, it, vi } from "vitest";
import { redirect } from "next/navigation";
import { getAuthContext } from "@/lib/api/auth";
import { GET } from "./route";

vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
}));

vi.mock("@/lib/api/auth", () => ({
  getAuthContext: vi.fn(),
}));

const mockedGetAuthContext = vi.mocked(getAuthContext);
const mockedRedirect = vi.mocked(redirect);

describe("GET /invitations/:token", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("returns 410 for an invalid or expired invitation", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: null,
      error: { code: "P0002", message: "INVITATION_INVALID" },
    });
    mockedGetAuthContext.mockResolvedValue({
      supabase: { rpc } as never,
      user: { id: "user-1" } as never,
    });

    const response = await GET(new Request("http://localhost"), {
      params: Promise.resolve({ token: "token-1" }),
    });

    expect(response.status).toBe(410);
    await expect(response.json()).resolves.toMatchObject({
      code: "INVITATION_INVALID",
    });
  });

  it("redirects after accepting an invitation", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: {}, error: null });
    mockedGetAuthContext.mockResolvedValue({
      supabase: { rpc } as never,
      user: { id: "user-1" } as never,
    });

    await GET(new Request("http://localhost"), {
      params: Promise.resolve({ token: "token-1" }),
    });

    expect(mockedRedirect).toHaveBeenCalledWith("/");
  });
});
