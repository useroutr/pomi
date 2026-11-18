import { networkName, product } from "@pomi/shared";
import { UseroutrError } from "@useroutr/sdk";
import { Bricolage_Grotesque } from "next/font/google";
import Link from "next/link";
import { connection } from "next/server";
import { requestService } from "@/server/app-services";
import { serverConfig } from "@/server/config";
import { type AskOption, AskCard, type PayWithNetwork } from "./landing/ask-card";
import { FloatingLogos } from "./landing/floating-logos";
import styles from "./landing/landing.module.css";
import { networkLogo, tokenLogo, walletLogo } from "./landing/logos";
import { PomiLogo, PomiMark } from "./landing/pomi-logo";
import { QrCard } from "./landing/qr-card";
import { usdcFirst } from "./landing/usdc-first";

// Loaded here, not in the layout, so only the landing page downloads it.
const display = Bricolage_Grotesque({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

const GITHUB_URL = "https://github.com/useroutr/pomi";
const USEROUTR_URL = "https://www.useroutr.com";

// Stellar's USDC and XLM can always pay a receiver, so the card offers them
// when Useroutr's list cannot be read.
const STELLAR_ASSETS = [
  { symbol: "USDC", network: "stellar" },
  { symbol: "XLM", network: "stellar" },
];

interface Catalog {
  assets: { symbol: string; network: string }[];
  payWith: { network: string; symbols: string[] }[];
}

// Read from Useroutr on each visit (its list is cached for ten minutes), so
// the networks named here are the ones that work today.
async function catalog(): Promise<Catalog> {
  try {
    const requests = requestService();
    const [assets, payWith] = await Promise.all([
      requests.requestableAssets(),
      requests.paymentNetworks(),
    ]);
    return { assets, payWith };
  } catch (error) {
    // The page still says what Pomi does; it only leaves the networks out.
    if (error instanceof UseroutrError) {
      return { assets: STELLAR_ASSETS, payWith: [] };
    }
    throw error;
  }
}

export default async function HomePage() {
  await connection();
  const { assets, payWith } = await catalog();
  const appUrl = serverConfig().appUrl;
  const options: AskOption[] = usdcFirst(assets).map((asset) => ({
    symbol: asset.symbol,
    network: asset.network,
    tokenLogo: tokenLogo(asset.symbol),
    networkLogo: networkLogo(asset.network),
  }));
  const networks: PayWithNetwork[] = payWith.map((entry) => ({
    network: entry.network,
    logo: networkLogo(entry.network),
  }));

  return (
    <div className={[styles.page, display.variable].join(" ")}>
      <header className={styles.nav}>
        <Link href="/" className={styles.navLogo}>
          <PomiLogo className={styles.logo} />
        </Link>
        <nav className={styles.navLinks} aria-label="Sections">
          <a href="#how">How it works</a>
          <a href="#pay-with">Pay with anything</a>
          <a href="#your-page">Your page</a>
        </nav>
        <div className={styles.navActions}>
          <Link href="/sign-in" className={styles.navSignIn}>
            Sign in
          </Link>
          <Link href="/sign-in" className={styles.pill}>
            Get started
          </Link>
        </div>
      </header>

      <main>
        <section className={styles.hero} aria-labelledby="hero-title">
          <div className={styles.aurora} aria-hidden="true" />
          <FloatingLogos />
          <div className={styles.heroInner}>
            <p className={styles.eyebrow}>
              <span className={styles.liveDot} aria-hidden="true" />
              Live on mainnet. Payments by Useroutr.
            </p>
            <h1 id="hero-title" className={styles.heroTitle}>
              Get paid in what you want, <span className={styles.gradientText}>from anything.</span>
            </h1>
            <AskCard options={options} payWith={networks} />
          </div>
        </section>

        <section id="how" className={styles.section} aria-labelledby="how-title">
          <h2 id="how-title" className={styles.sectionTitle}>
            Ask, share, get paid.
          </h2>
          <div className={styles.steps}>
            <article className={[styles.step, styles.stepViolet].join(" ")}>
              <span className={styles.stepNumber}>1</span>
              <h3>Ask</h3>
              <p>Pick an amount and what you want it in. Add a note so they know what it is for.</p>
              <div className={styles.stepVisual}>
                <span className={styles.bigAmount}>
                  25 <small>USDC</small>
                </span>
                <span className={styles.notePill}>Logo design for Kemi</span>
              </div>
            </article>
            <article className={[styles.step, styles.stepPink].join(" ")}>
              <span className={styles.stepNumber}>2</span>
              <h3>Share</h3>
              <p>Send the link anywhere, or show its QR code. It opens in any browser.</p>
              <div className={styles.stepVisual}>
                <span className={styles.linkPill}>
                  <PomiMark />
                  {displayHost(appUrl)}/r/…
                </span>
              </div>
            </article>
            <article className={[styles.step, styles.stepOrange].join(" ")}>
              <span className={styles.stepNumber}>3</span>
              <h3>Get paid</h3>
              <p>They pay with whatever they hold. You get exactly what you asked for.</p>
              <div className={styles.stepVisual}>
                <span className={styles.toast}>
                  <span className={styles.toastCheck} aria-hidden="true" />
                  <span>
                    <strong>You were paid</strong>
                    <small>25 USDC, just now</small>
                  </span>
                </span>
              </div>
            </article>
          </div>
        </section>

        {payWith.length > 0 && (
          <section id="pay-with" className={styles.section} aria-labelledby="pay-with-title">
            <div className={styles.split}>
              <div>
                <h2 id="pay-with-title" className={styles.sectionTitle}>
                  Payers bring what they have.
                </h2>
                <p className={styles.lead}>
                  Every network and token here can pay your link today. Useroutr quotes it, routes
                  it and settles it, so you receive the asset you asked for and nothing else.
                </p>
              </div>
              <ul className={styles.networks}>
                {payWith.map((entry) => {
                  const logo = networkLogo(entry.network);
                  return (
                    <li key={entry.network} className={styles.network}>
                      {logo !== null && <img src={logo} alt="" />}
                      <span>
                        <strong>{networkName(entry.network)}</strong>
                        <small>{entry.symbols.join(", ")}</small>
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          </section>
        )}

        <section id="your-page" className={styles.section} aria-labelledby="your-page-title">
          <div className={[styles.split, styles.splitReverse].join(" ")}>
            {/* A sample card; its code opens Pomi itself, and its label says so. */}
            <QrCard link={appUrl} label={displayHost(appUrl)} name="Your name" initial="Y" />
            <div>
              <h2 id="your-page-title" className={styles.sectionTitle}>
                One link for everything.
              </h2>
              <p className={styles.lead}>
                Your page lists the requests you choose and a pay box for any amount. Print its QR
                code for a counter, a stall or a slide.
              </p>
              <ul className={styles.facts}>
                <li>Paid to your own wallet, on the network you choose</li>
                <li>Requests that close once paid, or stay open for many</li>
                <li>A note on every payment, so you know what it was for</li>
              </ul>
            </div>
          </div>
        </section>

        <section className={styles.section} aria-label="Why Pomi">
          <div className={styles.trust}>
            <article>
              <img src={walletLogo("lobstr") ?? ""} alt="" className={styles.trustIcon} />
              <h3>Your wallet, not ours</h3>
              <p>Payments land in a wallet you control. Pomi never holds your money.</p>
            </article>
            <article>
              <img src={tokenLogo("USDC") ?? ""} alt="" className={styles.trustIcon} />
              <h3>Exactly what you asked for</h3>
              <p>A payer can bring any token; the amount you see is the amount that arrives.</p>
            </article>
            <article>
              <span className={styles.trustMark}>
                <PomiMark />
              </span>
              <h3>Open source</h3>
              <p>
                Every line of Pomi is public on <a href={GITHUB_URL}>GitHub</a>, built on Useroutr's
                public API.
              </p>
            </article>
          </div>
        </section>

        <section className={styles.section} aria-labelledby="cta-title">
          <div className={styles.cta}>
            <h2 id="cta-title">Ask for your first payment.</h2>
            <p>It takes a minute: your email, a name for your page, and where money lands.</p>
            <div className={styles.ctaActions}>
              <Link href="/sign-in" className={styles.ctaPrimary}>
                Get started
              </Link>
              <a href={GITHUB_URL} className={styles.ctaGhost}>
                See the code
              </a>
            </div>
          </div>
        </section>
      </main>

      <footer className={styles.footer}>
        <PomiLogo className={styles.logo} />
        <p>{product.tagline}</p>
        <nav aria-label="More">
          <Link href="/sign-in">Sign in</Link>
          <a href={GITHUB_URL}>GitHub</a>
          <a href={USEROUTR_URL}>Useroutr</a>
        </nav>
      </footer>
    </div>
  );
}

function displayHost(url: string): string {
  return url.replace(/^https?:\/\//, "");
}
