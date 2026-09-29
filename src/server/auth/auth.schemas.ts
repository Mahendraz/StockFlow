import { z } from "zod";

const email = z.string().trim().toLowerCase().pipe(z.email("Enter a valid email address").max(254));

export const registerSchema = z.object({
  email,
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    // bcrypt ignores everything after 72 bytes, so longer passwords would be silently truncated.
    .refine((p) => new TextEncoder().encode(p).length <= 72, "Password must be at most 72 bytes"),
});

// Login deliberately does not re-check the password policy: any wrong password,
// whatever its shape, gets the same generic 401.
export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().min(1, "Email is required"),
  password: z.string().min(1, "Password is required"),
});
