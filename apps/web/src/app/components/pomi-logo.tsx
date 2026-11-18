import { POMI_MARK } from "@pomi/shared";

// The mark beside the name, as the app's welcome screen sets it.
export function PomiLogo({ className }: { className?: string }) {
  return (
    <span className={className} aria-label="Pomi" role="img">
      <PomiMark />
      <span aria-hidden="true">pomi</span>
    </span>
  );
}

export function PomiMark({ dot = "currentColor" }: { dot?: string }) {
  return (
    <svg viewBox="0 0 100 100" aria-hidden="true" focusable="false">
      <path d={POMI_MARK.ring} fill="currentColor" fillRule="evenodd" />
      <path d={POMI_MARK.stem} fill="currentColor" />
      <circle cx={POMI_MARK.dot.cx} cy={POMI_MARK.dot.cy} r={POMI_MARK.dot.r} fill={dot} />
    </svg>
  );
}
