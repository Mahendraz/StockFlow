import { cookies } from "next/headers";
import { connectDb } from "../db";
import { findUserByToken, getPublicUser, type PublicUser } from "./auth.service";
import { SESSION_COOKIE } from "./cookie";

/**
 * For server components/layouts: the signed-in user, or null.
 * Validates the session against the database; merely having a cookie is not enough.
 */
export async function getCurrentUser(): Promise<PublicUser | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  await connectDb();
  const auth = await findUserByToken(token);
  if (!auth) return null;
  try {
    return await getPublicUser(auth);
  } catch {
    return null;
  }
}
