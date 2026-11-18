import { SymbolView, type SymbolWeight } from "expo-symbols";
import { usePalette } from "@/theme/theme";

// SF Symbols on iOS, Material Symbols on Android, named once here so every
// screen uses the same glyph for the same meaning.
const ICONS = {
  back: { ios: "chevron.left", android: "arrow_back" },
  close: { ios: "xmark", android: "close" },
  plus: { ios: "plus", android: "add" },
  qr: { ios: "qrcode", android: "qr_code_2" },
  scan: { ios: "qrcode.viewfinder", android: "qr_code_scanner" },
  share: { ios: "square.and.arrow.up", android: "share" },
  copy: { ios: "doc.on.doc", android: "content_copy" },
  paste: { ios: "doc.on.clipboard", android: "content_paste" },
  check: { ios: "checkmark", android: "check" },
  checkCircle: { ios: "checkmark.circle.fill", android: "check_circle" },
  warning: { ios: "exclamationmark.circle.fill", android: "error" },
  bell: { ios: "bell.badge.fill", android: "notifications_active" },
  wallet: { ios: "wallet.bifold.fill", android: "account_balance_wallet" },
  chevronRight: { ios: "chevron.right", android: "chevron_right" },
  backspace: { ios: "delete.left", android: "backspace" },
  more: { ios: "ellipsis", android: "more_horiz" },
  link: { ios: "link", android: "link" },
  calendar: { ios: "calendar", android: "calendar_today" },
  external: { ios: "arrow.up.right", android: "open_in_new" },
  mail: { ios: "envelope.fill", android: "mail" },
  sparkle: { ios: "sparkles", android: "auto_awesome" },
  lock: { ios: "lock.fill", android: "lock" },
  person: { ios: "person.fill", android: "person" },
  globe: { ios: "globe", android: "public" },
  signOut: { ios: "rectangle.portrait.and.arrow.right", android: "logout" },
  home: { ios: "house.fill", android: "home" },
  activity: { ios: "list.bullet.rectangle.portrait.fill", android: "receipt_long" },
  you: { ios: "person.crop.circle.fill", android: "account_circle" },
} as const;

export type IconName = keyof typeof ICONS;

export function Icon({
  name,
  size = 20,
  color,
  weight = "semibold",
}: {
  name: IconName;
  size?: number;
  color?: string;
  weight?: SymbolWeight;
}) {
  const palette = usePalette();
  return (
    <SymbolView
      name={ICONS[name]}
      size={size}
      weight={weight}
      tintColor={color ?? palette.text}
      resizeMode="scaleAspectFit"
      style={{ width: size, height: size }}
    />
  );
}
