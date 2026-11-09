import { product } from "@pomi/shared";

export default function HomePage() {
  return (
    <main className="hero">
      <h1>{product.name}</h1>
      <p>{product.tagline}</p>
    </main>
  );
}
