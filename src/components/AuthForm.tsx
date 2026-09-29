"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api, errorMessage, fieldErrors, type FieldErrors } from "@/lib/api-client";
import { ErrorBanner, Field } from "./ui";

type Mode = "login" | "register";

const copy = {
  login: { title: "Sign in to StockFlow", submit: "Sign in", busy: "Signing in…", endpoint: "/api/auth/login" },
  register: { title: "Create your account", submit: "Create account", busy: "Creating…", endpoint: "/api/auth/register" },
} as const;

export function AuthForm({ mode, next }: { mode: Mode; next: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<FieldErrors>({});
  const text = copy[mode];

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    setFields({});
    try {
      await api(text.endpoint, { method: "POST", body: { email, password } });
      router.replace(next);
      router.refresh();
    } catch (err) {
      // Messages come straight from the server (password policy, duplicate email, bad credentials).
      setError(errorMessage(err));
      setFields(fieldErrors(err));
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="card space-y-4" noValidate>
      <h1 className="text-xl font-semibold">{text.title}</h1>
      {error && <ErrorBanner message={error} />}
      <Field label="Email" htmlFor="email" errors={fields.email}>
        <input
          id="email"
          type="email"
          autoComplete="email"
          className="input"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          aria-invalid={!!fields.email}
          required
        />
      </Field>
      <Field
        label="Password"
        htmlFor="password"
        errors={fields.password}
        hint={mode === "register" ? "At least 8 characters" : undefined}
      >
        <input
          id="password"
          type="password"
          autoComplete={mode === "login" ? "current-password" : "new-password"}
          className="input"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          aria-invalid={!!fields.password}
          required
        />
      </Field>
      <button type="submit" className="btn btn-primary w-full" disabled={pending}>
        {pending ? text.busy : text.submit}
      </button>
      <p className="text-center text-sm text-slate-600">
        {mode === "login" ? (
          <>
            No account?{" "}
            <Link href="/register" className="text-blue-700 hover:underline">
              Register
            </Link>
          </>
        ) : (
          <>
            Already registered?{" "}
            <Link href="/login" className="text-blue-700 hover:underline">
              Sign in
            </Link>
          </>
        )}
      </p>
    </form>
  );
}
