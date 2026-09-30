import { AuthForm } from "@/components/AuthForm";

/** Route /register: sign-up form. The new account is signed in straight away and lands on /products. */
export default function RegisterPage() {
  return <AuthForm mode="register" next="/products" />;
}
