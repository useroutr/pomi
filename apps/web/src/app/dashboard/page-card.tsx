import { CopyButton } from "./copy-button";
import styles from "./dashboard.module.css";
import { PageQrButton } from "./page-qr-button";
import { ClaimHandleForm } from "./profile-form";
import ui from "@/app/components/ui.module.css";

// The receiver's page on the app's vibrant card: its link and what to do with
// it, or the form to claim one.
export function PageCard({
  handle,
  displayName,
  email,
  appUrl,
}: {
  handle: string | null;
  displayName: string | null;
  email: string;
  appUrl: string;
}) {
  const host = appUrl.replace(/^https?:\/\//, "");
  const name = displayName ?? handle ?? email;
  const title = handle === null ? "Claim your page" : (displayName ?? handle);
  return (
    <section className={[ui.vibrant, styles.pageCard].join(" ")} aria-labelledby="page-title">
      <div className={styles.pageWho}>
        <span className={styles.pageAvatar} aria-hidden="true">
          {Array.from(name.trim())[0] ?? "?"}
        </span>
        <div className={styles.pageText}>
          <span className={styles.soft}>Your page</span>
          <h1 id="page-title" className={styles.pageName}>
            {title}
          </h1>
          {handle !== null && (
            <span className={styles.pageUrl}>
              {host}/{handle}
            </span>
          )}
        </div>
      </div>
      {handle === null ? (
        <ClaimHandleForm host={host} />
      ) : (
        <div className={styles.pageActions}>
          <CopyButton text={`${appUrl}/${handle}`} label="Copy link" className={ui.glassButton} />
          <a
            className={ui.glassButton}
            href={`${appUrl}/${handle}`}
            target="_blank"
            rel="noreferrer"
          >
            Open
          </a>
          <PageQrButton link={`${appUrl}/${handle}`} label={`${host}/${handle}`} name={name} />
        </div>
      )}
    </section>
  );
}
