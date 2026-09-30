// Accounts and sessions: register, log in, log out, and turn a session cookie into a user.

import { createHash, randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import type { Types } from "mongoose";
import { env } from "../env";
import { AppError, conflict, unauthorized } from "../errors";
import { Session } from "../models/session";
import { User } from "../models/user";

/** The signed-in user as route handlers see it: just the id, which every query is scoped by. */
export interface AuthUser {
  id: Types.ObjectId;
}

/** User fields that are safe to send to the browser (never the password hash). */
export interface PublicUser {
  id: string;
  email: string;
}

/** A new session. The raw token goes into the cookie; only its hash is stored in the DB. */
export interface IssuedSession {
  token: string;
  expiresAt: Date;
}

/** One 401 for both "no such email" and "wrong password", so nobody can find out which emails have accounts. */
const INVALID_CREDENTIALS = () => new AppError(401, "INVALID_CREDENTIALS", "Invalid email or password");

let dummyHash: string | undefined;

/**
 * A real bcrypt hash compared against when the email does not exist, so a login for an
 * unknown email costs the same time as one with a wrong password (no timing leak, A9).
 */
function getDummyHash(): string {
  dummyHash ??= bcrypt.hashSync("stockflow-dummy-password", env().BCRYPT_COST);
  return dummyHash;
}

/** SHA-256 of a session token. Only this hash is stored, so a leaked DB cannot be used to log in. */
function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Stores a new session (token hash, expires after SESSION_TTL_HOURS) and returns the raw token for the cookie. */
async function createSession(userId: Types.ObjectId): Promise<IssuedSession> {
  // 256 bits of randomness: unguessable, and meaningless without the server-side session row.
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + env().SESSION_TTL_HOURS * 60 * 60 * 1000);
  await Session.create({ tokenHash: hashToken(token), userId, expiresAt });
  return { token, expiresAt };
}

/** Creates an account with a bcrypt-hashed password and signs the user in. A taken email is 409 EMAIL_TAKEN. */
export async function register(email: string, password: string): Promise<{ user: PublicUser; session: IssuedSession }> {
  // bcrypt generates a fresh random salt per call and embeds it in the hash.
  const passwordHash = await bcrypt.hash(password, env().BCRYPT_COST);
  try {
    const user = await User.create({ email, passwordHash });
    return { user: { id: user.id, email: user.email }, session: await createSession(user._id) };
  } catch (err) {
    // 11000 = duplicate key: the unique index on email found an existing account.
    if ((err as { code?: number }).code === 11000) {
      throw conflict("EMAIL_TAKEN", "An account with this email already exists", {
        email: ["An account with this email already exists"],
      });
    }
    throw err;
  }
}

/** Checks email + password with bcrypt and starts a session. Any failure is the same 401 INVALID_CREDENTIALS. */
export async function login(email: string, password: string): Promise<{ user: PublicUser; session: IssuedSession }> {
  const user = await User.findOne({ email });
  // Always run bcrypt, even when the user does not exist, and answer both failures identically.
  const ok = await bcrypt.compare(password, user?.passwordHash ?? getDummyHash());
  if (!user || !ok) throw INVALID_CREDENTIALS();
  return { user: { id: user.id, email: user.email }, session: await createSession(user._id) };
}

/** Deletes the session server-side, so the token is dead even if someone kept a copy of the cookie. */
export async function logout(token: string | undefined): Promise<void> {
  if (token) await Session.deleteOne({ tokenHash: hashToken(token) });
}

/** Returns the user for a session token, or null when the token is missing, unknown or expired. */
export async function findUserByToken(token: string | undefined): Promise<AuthUser | null> {
  if (!token) return null;
  const session = await Session.findOne({ tokenHash: hashToken(token), expiresAt: { $gt: new Date() } }).lean();
  return session ? { id: session.userId } : null;
}

/** Like findUserByToken, but throws 401 UNAUTHORIZED when there is no valid session. */
export async function requireUser(token: string | undefined): Promise<AuthUser> {
  const user = await findUserByToken(token);
  if (!user) throw unauthorized();
  return user;
}

/** Loads the user's id and email. Throws 401 if the account no longer exists. */
export async function getPublicUser(auth: AuthUser): Promise<PublicUser> {
  const user = await User.findById(auth.id).lean();
  if (!user) throw unauthorized();
  return { id: user._id.toString(), email: user.email };
}
