// Route "/": has no page of its own; it just redirects to /products.

import { redirect } from "next/navigation";

// The (app) layout sends visitors without a valid session on to /login.
export default function Home() {
  redirect("/products");
}
