import Link from 'next/link';

export const metadata = { title: 'Privacy Policy — Protocol' };

export default function PrivacyPage() {
  return (
    <div className="max-w-2xl mx-auto px-6 py-12 space-y-6">
      <Link href="/" className="text-accent font-bold text-lg">Protocol</Link>
      <h1 className="text-3xl font-bold">Privacy Policy</h1>
      <p className="text-sm text-muted-foreground">Last updated: April 2026</p>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-accent">Data We Collect</h2>
        <p className="text-sm text-muted-foreground">We collect health and lifestyle data you provide: age, sex, weight, height, diet, exercise, medications, supplements, blood biomarker values, and goals. We also store generated protocols and compliance tracking data.</p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-accent">How We Use It</h2>
        <p className="text-sm text-muted-foreground">Your data is used exclusively to:</p>
        <ul className="text-sm text-muted-foreground list-disc pl-6 space-y-1">
          <li>Generate personalized protocols via AI (Groq, Anthropic)</li>
          <li>Track your daily compliance</li>
          <li>Compare blood tests over time</li>
          <li>Provide app functionality</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-accent">Third Parties</h2>
        <p className="text-sm text-muted-foreground">We send anonymized prompts to Groq and Anthropic to generate protocols. They do not persist your data per their policies. We use Supabase for database + auth, Vercel for hosting, and Vercel Analytics for usage metrics (anonymous).</p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-accent">Your Rights</h2>
        <p className="text-sm text-muted-foreground">Export your data anytime in Settings. Delete your account to remove all data permanently. You control your data.</p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-accent">Security</h2>
        <p className="text-sm text-muted-foreground">All data encrypted at rest (Supabase). Row Level Security ensures users can only access their own data. No plaintext passwords — Supabase Auth handles hashing.</p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-accent">Contact</h2>
        <p className="text-sm text-muted-foreground">Questions? Open an issue on <a href="https://github.com/andrei1000z/protocol-maker" className="text-accent hover:underline">GitHub</a>.</p>
      </section>

      <div className="pt-6 border-t border-card-border">
        <Link href="/" className="text-sm text-accent hover:underline">← Back to home</Link>
      </div>
    </div>
  );
}
