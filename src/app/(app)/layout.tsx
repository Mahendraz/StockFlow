import { redirect } from "next/navigation";
import { AppNav } from "@/components/AppNav";
import { getCurrentUser } from "@/server/auth/current-user";

/**
 * Authenticated shell. The session is checked against the database on the server
 * before anything renders; visitors without a valid session go to /login.
 * (The API enforces auth on its own as well; this only keeps the UI honest.)
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return (
    <>
      <AppNav email={user.email} />
      <main className="mx-auto w-full max-w-5xl px-4 py-6">{children}</main>
    </>
  );
}
