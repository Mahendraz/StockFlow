import { AuthForm } from "@/components/AuthForm";
import { safeNextPath } from "@/lib/safe-next";

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { next } = await searchParams;
  return <AuthForm mode="login" next={safeNextPath(next)} />;
}
