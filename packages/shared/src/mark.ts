// Pomi's mark on a 100-unit square: a bold p whose bowl is a coin, a ring
// around a dot, with the stem cut from the bowl by a gap that follows the
// ring. The app and the website draw it from these shapes, and
// apps/mobile/scripts/render-icons.py draws the same ones for the app icon.
export const POMI_MARK = {
  // Fill with the even-odd rule: the second circle is the ring's hole.
  ring: "M50 5a32 32 0 1 1 0 64a32 32 0 1 1 0-64zM50 22a15 15 0 1 0 0 30a15 15 0 1 0 0-30z",
  stem: "M18 55.57A37 37 0 0 0 35 70.82V95H18z",
  dot: { cx: 50, cy: 37, r: 7 },
} as const;

// The app icon's face is the white mark on the brand violet with its coin in
// this coral, wherever Pomi stands for itself: the app icon, the launch screen
// and the web sign-in.
export const POMI_ICON_COIN = "#FF8A5B";
