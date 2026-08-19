import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";
import { getAuthContext } from "@/lib/api/auth";

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

describe("GET /lists", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("rejects unauthenticated list reads", async () => {
    mockedGetAuthContext.mockResolvedValue(null);

    const response = await GET();

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({
      code: "UNAUTHENTICATED",
    });
  });

  it("returns only the current user's lists", async () => {
    const from = vi.fn((table: string) => {
      if (table === "list_members") {
        return {
          select: () => ({
            eq: () => ({
              data: [{ list_id: "list-2" }],
              error: null,
            }),
          }),
        };
      }

      if (table === "lists") {
        return {
          select: () => ({
            in: () => ({
              order: () =>
                Promise.resolve({
                  data: [{ id: "list-2", name: "買い物リスト" }],
                  error: null,
                }),
            }),
          }),
        };
      }

      throw new Error(`Unexpected table: ${table}`);
    });

    mockedGetAuthContext.mockResolvedValue({
      supabase: { from } as never,
      user: { id: "user-1" } as never,
    });

    const response = await GET();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      lists: [{ id: "list-2", name: "買い物リスト" }],
    });
  });
});
