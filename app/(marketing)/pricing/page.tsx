import Link from 'next/link';
import { CheckCircle2 } from 'lucide-react';
import { stripeConfigured } from '@/lib/stripe-api';
import { CheckoutButton } from './CheckoutButton';

export const metadata = {
  title: 'Tarife — Protocol',
  description: 'Free pentru lansare. Plătit când vrei limite mai mari + Claude prioritar. Anulezi oricând.',
};

const FREE_BULLETS = [
  '1 protocol AI / lună (Claude Sonnet 4.5 cu fallback Groq)',
  '10 mesaje chat / oră',
  '3 analize foto la mese / zi',
  '3 încărcări PDF analize / oră',
  'Tracking zilnic complet (HRV, somn, antrenament, pași)',
  'Toate integrările wearable (Oura, Fitbit, Withings, WHOOP, Google Fit)',
  'Export complet date (CSV / Markdown / .ics)',
  'Doctor-share pentru consultații cu medicul',
];

const PRO_BULLETS = [
  'Totul din planul gratuit',
  '6 regenerări manuale de protocol / zi',
  '60 mesaje chat / oră',
  '30 analize foto la mese / zi',
  '10 încărcări PDF analize / oră',
  '60 voice logs / oră',
  'Suport prioritar pe email',
  'BYOK Anthropic (folosește propria cheie, fără limită)',
];

export default function PricingPage() {
  const enabled = stripeConfigured();

  return (
    <div className="max-w-5xl mx-auto px-6 py-12 space-y-12">
      <header className="text-center space-y-3">
        <Link href="/" className="text-accent font-bold text-lg">Protocol</Link>
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">Tarife simple, fără surprize</h1>
        <p className="text-sm text-muted-foreground max-w-xl mx-auto leading-relaxed">
          Începi cu varianta gratuită cât durează cât timp ai nevoie. Treci la plătit doar dacă regenerările zilnice sau chat-ul devin limita ta. Anulezi oricând din portalul Stripe — fără întrebări.
        </p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Free tier */}
        <div className="rounded-3xl bg-surface-1 border border-card-border p-7 space-y-5">
          <div>
            <p className="text-xs uppercase tracking-widest text-muted">Gratuit</p>
            <p className="text-3xl font-bold mt-1">0 RON</p>
            <p className="text-xs text-muted-foreground mt-1">Pentru totdeauna. Fără card.</p>
          </div>
          <ul className="space-y-2.5">
            {FREE_BULLETS.map((b) => (
              <li key={b} className="flex items-start gap-2 text-sm leading-relaxed">
                <CheckCircle2 className="w-4 h-4 text-accent shrink-0 mt-0.5" />
                <span>{b}</span>
              </li>
            ))}
          </ul>
          <Link
            href="/login?mode=register"
            className="block w-full text-center px-4 py-3 rounded-xl bg-surface-2 border border-card-border text-sm font-semibold hover:bg-surface-3 transition-colors"
          >
            Începe acum
          </Link>
        </div>

        {/* Pro tier */}
        <div className="rounded-3xl bg-gradient-to-br from-accent/6 via-accent/2 to-transparent border border-accent/30 p-7 space-y-5 relative">
          <span className="absolute top-5 right-5 text-xs font-mono uppercase tracking-widest bg-accent/15 text-accent border border-accent/30 px-2 py-0.5 rounded-full">
            Recomandat
          </span>
          <div>
            <p className="text-xs uppercase tracking-widest text-accent">Pro</p>
            <p className="text-3xl font-bold mt-1">49 RON<span className="text-base font-normal text-muted-foreground"> / lună</span></p>
            <p className="text-xs text-muted-foreground mt-1">~€10 / lună · anulabil oricând</p>
          </div>
          <ul className="space-y-2.5">
            {PRO_BULLETS.map((b) => (
              <li key={b} className="flex items-start gap-2 text-sm leading-relaxed">
                <CheckCircle2 className="w-4 h-4 text-accent shrink-0 mt-0.5" />
                <span>{b}</span>
              </li>
            ))}
          </ul>
          {enabled ? (
            <CheckoutButton />
          ) : (
            <button
              type="button"
              disabled
              className="block w-full text-center px-4 py-3 rounded-xl bg-surface-2 border border-card-border text-sm font-semibold text-muted-foreground cursor-not-allowed"
              title="Stripe nu e încă configurat pe acest deploy"
            >
              În curând
            </button>
          )}
          <p className="text-xs text-muted-foreground leading-relaxed text-center">
            Plata se face prin Stripe. Nu păstrăm date de card.{' '}
            <Link href="/privacy" className="text-accent hover:underline">Politică de confidențialitate</Link>.
          </p>
        </div>
      </div>

      <section className="space-y-3 text-center">
        <h2 className="text-lg font-semibold">Întrebări frecvente</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-left max-w-4xl mx-auto">
          {[
            {
              q: 'Pot folosi varianta gratuită nelimitat?',
              a: 'Da. Nu există perioadă de probă obligatorie sau forțare către plătit. Limitele zilnice sunt suficient de generoase pentru un utilizator obișnuit.',
            },
            {
              q: 'Ce se întâmplă dacă anulez abonamentul?',
              a: 'Continui să ai acces la beneficiile Pro până la sfârșitul perioadei plătite. După, treci automat la gratuit — datele tale rămân intacte.',
            },
            {
              q: 'De ce există un plan plătit?',
              a: 'Pentru a acoperi costurile de Anthropic Claude la cei care folosesc intens chat-ul și regenerarea protocolului. La 100 de utilizatori activi pe gratuit, costurile pe AI depășesc bugetul personal.',
            },
            {
              q: 'BYOK ce înseamnă?',
              a: 'Bring Your Own Key — îți pui propria cheie Anthropic. Plătești direct la Anthropic, nu prin platformă. Util dacă ești dezvoltator sau folosești foarte intens.',
            },
          ].map((f) => (
            <div key={f.q} className="rounded-2xl bg-card border border-card-border p-4">
              <p className="text-sm font-semibold mb-1">{f.q}</p>
              <p className="text-xs text-muted-foreground leading-relaxed">{f.a}</p>
            </div>
          ))}
        </div>
      </section>

      <div className="text-center">
        <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">← Înapoi acasă</Link>
      </div>
    </div>
  );
}
