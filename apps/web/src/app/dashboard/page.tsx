import { product } from "@pomi/shared";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { currentUser } from "@/server/auth/current-user";
import { SignOutButton } from "./sign-out-button";

export const metadata: Metadata = {
  title: `Dashboard | ${product.name}`,
};

export default async function DashboardPage() {
  const user = await currentUser();
  if (user === null) {
    redirect("/sign-in");
  }
  return (
    <main className="panel">
      <h1>{product.name}</h1>
      <p className="muted">Signed in as {user.email}</p>
      <SignOutButton />
    </main>
  );
}
