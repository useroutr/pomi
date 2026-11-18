import { drawQrCode, POMI_MARK, roundedSquare } from "@pomi/shared";
import styles from "./qr-card.module.css";

// A page's QR card as the app shows it (Linktree's layout): one light color,
// the person on top, the code drawn straight onto the card in one ink, and
// the link under it. The code is real and scans.
export function QrCard({
  link,
  label,
  name,
  initial,
  className,
}: {
  link: string;
  label: string;
  name: string;
  initial: string;
  className?: string;
}) {
  const code = drawQrCode(link);
  const quiet = 1;
  const extent = code.count + quiet * 2;
  const markModules = code.clear - 2;
  const markAt = (code.count - markModules) / 2;
  return (
    <figure
      className={className === undefined ? styles.qrCard : [styles.qrCard, className].join(" ")}
    >
      <span className={styles.qrAvatar} aria-hidden="true">
        {initial}
      </span>
      <svg
        className={styles.qrCode}
        viewBox={`${String(-quiet)} ${String(-quiet)} ${String(extent)} ${String(extent)}`}
        role="img"
        aria-label={`QR code for ${label}`}
      >
        <path d={roundedSquare(-quiet, -quiet, extent, quiet * 1.6)} fill="transparent" />
        <path d={code.modules} fill="currentColor" />
        <path d={code.finders} fill="currentColor" fillRule="evenodd" />
        <g
          transform={`translate(${String(markAt)} ${String(markAt)}) scale(${String(markModules / 100)})`}
        >
          <path d={POMI_MARK.ring} fill="currentColor" fillRule="evenodd" />
          <path d={POMI_MARK.stem} fill="currentColor" />
          <circle
            cx={POMI_MARK.dot.cx}
            cy={POMI_MARK.dot.cy}
            r={POMI_MARK.dot.r}
            fill="currentColor"
          />
        </g>
      </svg>
      <figcaption>
        <strong>{name}</strong>
        <span className={styles.qrLink}>{label}</span>
      </figcaption>
    </figure>
  );
}
