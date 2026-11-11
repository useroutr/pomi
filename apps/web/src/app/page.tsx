import { product } from "@pomi/shared";
import Link from "next/link";

export default function HomePage() {
  return (
    <main className="hero">
      <h1>{product.name}</h1>
      <p>{product.tagline}</p>
      <Link className="hero-link" href="/sign-in">
        Sign in to request a payment
      </Link>
    </main>
  );
}
