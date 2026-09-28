import { CreateForm } from "@/components/create/CreateForm";

export default function HomePage() {
  return (
    <main className="pt-6">
      <header className="mb-8 text-center">
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.3em] text-muted">One idea. One story. One cinematic Reel.</p>
        <h1 className="gold-text font-display text-4xl font-bold leading-tight tracking-wide sm:text-5xl">AI LOVE REEL STUDIO</h1>
        <p className="mt-3 text-[15px] text-muted">Turn one idea into a cinematic love story.</p>
      </header>
      <CreateForm showTestButton={process.env.NODE_ENV !== "production"} />
    </main>
  );
}
