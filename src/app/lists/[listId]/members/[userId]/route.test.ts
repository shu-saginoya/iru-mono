import { beforeEach, describe, expect, it, vi } from "vitest";
import { DELETE } from "./route";
import { getAuthContext, getListAccess } from "@/lib/api/auth";

vi.mock("@/lib/api/auth", () => ({
  getAuthContext: vi.fn(),
  getListAccess: vi.fn(),
  unauthorized: () =>
    Response.json(
      { error: "Authentication required", code: "UNAUTHENTICATED" },
      { status: 401 },
    ),
}));

const mockedGetAuthContext = vi.mocked(getAuthContext);
const mockedGetListAccess = vi.mocked(getListAccess);

describe("DELETE /lists/:listId/members/:userId", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("does not allow the list owner to be removed", async () => {
    const supabase = { from: vi.fn() };
    mockedGetAuthContext.mockResolvedValue({
      supabase: supabase as never,
      user: { id: "owner-1" } as never,
    });
    mockedGetListAccess.mockResolvedValue({
      supabase: supabase as never,
      list: { created_by: "owner-1" } as never,
      isOwner: true,
    });

    const response = await DELETE(
      new Request("http://localhost/lists/list-1/members/owner-1", {
        method: "DELETE",
      }),
      {
        params: Promise.resolve({ listId: "list-1", userId: "owner-1" }),
      },
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      code: "OWNER_CANNOT_BE_REMOVED",
    });
    expect(supabase.from).not.toHaveBeenCalled();
  });
});
