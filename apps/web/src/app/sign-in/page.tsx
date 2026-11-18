import { POMI_ICON_COIN, product } from "@pomi/shared";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AppHeader } from "@/app/components/app-header";
import { PomiMark } from "@/app/components/pomi-logo";
import ui from "@/app/components/ui.module.css";
import { currentUser } from "@/server/auth/current-user";
import { SignInForm } from "./sign-in-form";
import styles from "./sign-in.module.css";

export const metadata: Metadata = {
  title: `Sign in to ${product.name}`,
};

export default async function SignInPage() {
  if ((await currentUser()) !== null) {
    redirect("/dashboard");
  }
  return (
    <>
      <div className={ui.backdrop} aria-hidden="true" />
      <AppHeader />
      <main className={styles.main}>
        <section className={styles.card}>
          <span className={[styles.tile, ui.vibrant].join(" ")} aria-hidden="true">
            <PomiMark dot={POMI_ICON_COIN} />
          </span>
          <SignInForm />
        </section>
      </main>
    </>
  );
}
