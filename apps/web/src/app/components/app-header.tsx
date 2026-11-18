import Link from "next/link";
import { type ReactNode } from "react";
import { PomiLogo } from "./pomi-logo";
import ui from "./ui.module.css";

// The bar across the top of every screen but the landing page.
export function AppHeader({ children }: { children?: ReactNode }) {
  return (
    <header className={ui.header}>
      <div className={ui.headerInner}>
        <Link href="/" className={ui.brand}>
          <PomiLogo />
        </Link>
        <div className={ui.headerEnd}>{children}</div>
      </div>
    </header>
  );
}
