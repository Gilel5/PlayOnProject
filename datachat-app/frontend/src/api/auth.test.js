import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the api instance module
vi.mock("./http", () => ({
  api: {
    post: vi.fn(),
    get: vi.fn(),
  },
}));

import { api } from "./http";
import { login, refresh, me } from "./auth";

describe("auth.js (axios)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("login calls /auth/login with email/password", async () => {
    api.post.mockResolvedValue({ data: { access_token: "abc" } });

    const data = await login("t@e.com", "pw");
    expect(api.post).toHaveBeenCalledWith("/auth/login", { email: "t@e.com", password: "pw" });
    expect(data.access_token).toBe("abc");
  });

  it("refresh calls /auth/refresh with no body", async () => {
    api.post.mockResolvedValue({ data: { access_token: "new" } });

    const data = await refresh();
    expect(api.post).toHaveBeenCalledWith("/auth/refresh");
    expect(data.access_token).toBe("new");
  });

  it("me calls /auth/me with Authorization header", async () => {
    api.get.mockResolvedValue({ data: { email: "x@y.com" } });

    const data = await me("TOKEN123");
    expect(api.get).toHaveBeenCalledWith("/auth/me", {
      headers: { Authorization: "Bearer TOKEN123" },
    });
    expect(data.email).toBe("x@y.com");
  });
});
