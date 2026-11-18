import { type CSSProperties } from "react";
import ui from "./ui.module.css";

// A person's initial on the brand mesh, the app's avatar orb.
export function Avatar({ name, size = 48 }: { name: string; size?: number }) {
  const sized: CSSProperties & Record<"--avatar", string> = { "--avatar": `${String(size)}px` };
  return (
    <span className={[ui.avatar, ui.vibrant].join(" ")} style={sized} aria-hidden="true">
      {Array.from(name.trim())[0] ?? "?"}
    </span>
  );
}
