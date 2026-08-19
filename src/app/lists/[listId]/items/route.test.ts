import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET, POST } from "./route";
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
const context = { params: Promise.resolve({ listId: "list-1" }) };

describe("/lists/:listId/items", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("rejects unauthenticated item reads", async () => {
    mockedGetAuthContext.mockResolvedValue(null);

    const response = await GET(
      new Request("http://localhost/lists/list-1/items"),
      context,
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({
      code: "UNAUTHENTICATED",
    });
  });

  it("rejects invalid item input before writing", async () => {
    mockedGetAuthContext.mockResolvedValue({
      supabase: {} as never,
      user: { id: "user-1" } as never,
    });
    mockedGetListAccess.mockResolvedValue({
      supabase: {} as never,
      list: {} as never,
      isOwner: true,
    });

    const response = await POST(
      new Request("http://localhost/lists/list-1/items", {
        method: "POST",
        body: JSON.stringify({ title: "", quantity: 0 }),
      }),
      context,
    );

    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toMatchObject({
      code: "VALIDATION_ERROR",
    });
  });

  it("creates a validated item for a list member", async () => {
    const item = {
      id: "item-1",
      list_id: "list-1",
      title: "牛乳",
      quantity: 2,
    };
    const single = vi.fn().mockResolvedValue({ data: item, error: null });
    const select = vi.fn().mockReturnValue({ single });
    const insert = vi.fn().mockReturnValue({ select });
    const supabase = { from: vi.fn().mockReturnValue({ insert }) };
    mockedGetAuthContext.mockResolvedValue({
      supabase: supabase as never,
      user: { id: "user-1" } as never,
    });
    mockedGetListAccess.mockResolvedValue({
      supabase: supabase as never,
      list: {} as never,
      isOwner: false,
    });

    const response = await POST(
      new Request("http://localhost/lists/list-1/items", {
        method: "POST",
        body: JSON.stringify({ title: "牛乳", quantity: 2 }),
      }),
      context,
    );

    expect(response.status).toBe(201);
    expect(insert).toHaveBeenCalledWith({
      list_id: "list-1",
      title: "牛乳",
      quantity: 2,
    });
    await expect(response.json()).resolves.toMatchObject({ item });
  });
});
