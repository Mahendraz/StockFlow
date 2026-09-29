import { describe, expect, it } from "vitest";
import { POST as login } from "@/app/api/auth/login/route";
import { POST as logout } from "@/app/api/auth/logout/route";
import { GET as me } from "@/app/api/auth/me/route";
import { POST as register } from "@/app/api/auth/register/route";
import { User } from "@/server/models/user";
import { makeRequest, sessionFrom, signUp } from "./helpers";

describe("auth", () => {
  it("registers a user and stores only a bcrypt hash of the password", async () => {
    const res = await register(
      makeRequest("POST", "/api/auth/register", { body: { email: "New@Example.com", password: "s3cure-pass" } }),
      undefined,
    );
    expect(res.status).toBe(201);
    expect(await res.json()).toMatchObject({ user: { email: "new@example.com" } });
    expect(res.headers.getSetCookie()[0]).toMatch(/HttpOnly/i);

    const stored = await User.findOne({ email: "new@example.com" }).lean();
    expect(stored!.passwordHash).not.toContain("s3cure-pass");
    expect(stored!.passwordHash).toMatch(/^\$2[aby]\$/); // bcrypt format, salt embedded
  });

  it("rejects a duplicate email with 409 and a weak password with 422 (server-side policy)", async () => {
    await signUp("taken@example.com");
    const dup = await register(
      makeRequest("POST", "/api/auth/register", { body: { email: "taken@example.com", password: "another-pass" } }),
      undefined,
    );
    expect(dup.status).toBe(409);

    const weak = await register(
      makeRequest("POST", "/api/auth/register", { body: { email: "weak@example.com", password: "short" } }),
      undefined,
    );
    expect(weak.status).toBe(422);
    expect((await weak.json()).error.fields.password[0]).toMatch(/at least 8/);
  });

  it("(a) rejects a wrong password with a generic 401 that does not reveal which part was wrong", async () => {
    const { email } = await signUp();
    const wrongPassword = await login(
      makeRequest("POST", "/api/auth/login", { body: { email, password: "not-the-password" } }),
      undefined,
    );
    const unknownEmail = await login(
      makeRequest("POST", "/api/auth/login", { body: { email: "nobody@example.com", password: "whatever-123" } }),
      undefined,
    );

    expect(wrongPassword.status).toBe(401);
    expect(unknownEmail.status).toBe(401);
    // Identical bodies: an attacker cannot tell "no such user" from "wrong password".
    expect(await wrongPassword.json()).toEqual(await unknownEmail.json());
    expect(sessionFrom(wrongPassword)).toBeUndefined();
  });

  it("logs in with correct credentials", async () => {
    const { email, password } = await signUp();
    const res = await login(makeRequest("POST", "/api/auth/login", { body: { email, password } }), undefined);
    expect(res.status).toBe(200);
    expect(sessionFrom(res)).toBeTruthy();
  });

  it("(b) returns 401 for a protected route without a session", async () => {
    const res = await me(makeRequest("GET", "/api/auth/me"), undefined);
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: { code: "UNAUTHORIZED", message: "Authentication required" } });
  });

  it("logout invalidates the session server-side, not just the cookie", async () => {
    const { cookie } = await signUp();
    expect((await me(makeRequest("GET", "/api/auth/me", { cookie }), undefined)).status).toBe(200);

    const res = await logout(makeRequest("POST", "/api/auth/logout", { cookie }), undefined);
    expect(res.status).toBe(204);
    expect(sessionFrom(res)).toBe("");

    // Replaying the old token (e.g. a copied cookie) no longer works.
    expect((await me(makeRequest("GET", "/api/auth/me", { cookie }), undefined)).status).toBe(401);
  });
});
