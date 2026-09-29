import { redirect } from "next/navigation";
import { getCurrentUser } from "@/server/auth/current-user";

// Login/register pages. Someone already signed in is sent to the app instead.
export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  if (await getCurrentUser()) redirect("/products");
  return <main className="mx-auto mt-24 w-full max-w-sm px-4">{children}</main>;
}
