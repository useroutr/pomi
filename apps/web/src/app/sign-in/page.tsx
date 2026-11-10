import { product } from "@pomi/shared";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { currentUser } from "@/server/auth/current-user";
import { SignInForm } from "./sign-in-form";

export const metadata: Metadata = {
  title: `Sign in to ${product.name}`,
};

export default async function SignInPage() {
  if ((await currentUser()) !== null) {
    redirect("/dashboard");
  }
  return (
    <main className="panel">
      <h1>Sign in to {product.name}</h1>
      <SignInForm />
    </main>
  );
}
