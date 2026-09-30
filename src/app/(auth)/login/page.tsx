import { AuthForm } from "@/components/AuthForm";
import { safeNextPath } from "@/lib/safe-next";

/** Route /login: sign-in form. `?next=` is where to go afterwards; safeNextPath only allows paths on this site. */
export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { next } = await searchParams;
  return <AuthForm mode="login" next={safeNextPath(next)} />;
}
