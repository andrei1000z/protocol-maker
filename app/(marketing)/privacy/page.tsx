import Link from 'next/link';

export const metadata = { title: 'Politică de confidențialitate — Protocol' };

const LAST_UPDATED = '12 mai 2026';

// Sub-processors are listed here so future audits / new integrations are
// added in exactly one place. Privacy law (GDPR Art. 28) requires we
// disclose every party that processes user data on our behalf.
const SUBPROCESSORS = [
  {
    name: 'Supabase',
    role: 'Bază de date + autentificare',
    categories: 'Profil, biomarkeri, protocoale, tracking zilnic, mese, jurnal de chat',
    region: 'Verifică în Setări proiect — se migrează în UE pentru Q3 2026',
    dpa: 'https://supabase.com/legal/dpa',
  },
  {
    name: 'Vercel',
    role: 'Hosting + edge runtime',
    categories: 'Loguri request, headers, IP (trunchiat)',
    region: 'Edge global; date statice cache-uite în UE pentru utilizatori UE',
    dpa: 'https://vercel.com/legal/dpa',
  },
  {
    name: 'Anthropic',
    role: 'Model AI primar (Claude) — generare protocoale + chat',
    categories: 'Profil, biomarkeri, metrici recente, mesaje chat (NU email/identitate)',
    region: 'Statele Unite — SCCs aplicabile',
    dpa: 'https://www.anthropic.com/legal/dpa',
  },
  {
    name: 'Groq',
    role: 'Model AI fallback + parser PDF analize',
    categories: 'Text extras din PDF analize, profil pentru fallback',
    region: 'Statele Unite — SCCs aplicabile',
    dpa: 'https://groq.com/dpa',
  },
  {
    name: 'Upstash Redis',
    role: 'Rate limiting (3 protocoale/zi, 30 mesaje chat/oră etc.)',
    categories: 'User ID + counter (fără date de sănătate)',
    region: 'UE (eu-west-1) când e configurat',
    dpa: 'https://upstash.com/static/trust/upstash_dpa.pdf',
  },
  {
    name: 'Stripe (opțional, dacă activezi abonament)',
    role: 'Procesare plăți',
    categories: 'Email, ID Stripe customer, status abonament (NU detalii card — Stripe gestionează direct)',
    region: 'UE pentru clienți UE',
    dpa: 'https://stripe.com/legal/dpa',
  },
  {
    name: 'Oura / Fitbit / Withings / WHOOP / Google Fit (opțional, dacă conectezi)',
    role: 'Sincronizare wearable',
    categories: 'Doar metricile pe care le-ai autorizat (somn, HR, HRV, pași etc.)',
    region: 'Variază per furnizor — vezi politicile lor proprii',
    dpa: 'Vezi politica fiecărui furnizor — conexiunea e opt-in pe Setări',
  },
];

const RIGHTS = [
  { name: 'Acces', desc: 'Cere o copie a tuturor datelor pe care le avem despre tine.' },
  { name: 'Rectificare', desc: 'Corectează informații inexacte sau incomplete (direct din Setări sau pe email).' },
  { name: 'Ștergere („dreptul de a fi uitat")', desc: 'Șterge contul și toate datele. Funcție în Setări → Cont → Șterge cont. Ireversibilă.' },
  { name: 'Portabilitate', desc: 'Exportă datele tale în format JSON. Funcție în Setări → Export date.' },
  { name: 'Restricționare', desc: 'Ne ceri să nu mai prelucrăm anumite date până clarificăm o solicitare.' },
  { name: 'Opoziție', desc: 'Te opui prelucrării bazate pe interes legitim. Pentru consimțământ, îl poți retrage oricând.' },
  { name: 'Decizii automatizate', desc: 'Generarea de protocol e automatizată dar consultativă — nu produce efecte juridice. Poți cere oricând revizuire umană.' },
];

export default function PrivacyPage() {
  return (
    <div className="max-w-3xl mx-auto px-6 py-12 space-y-8">
      <div className="flex items-center justify-between">
        <Link href="/" className="text-accent font-bold text-lg">Protocol</Link>
        <Link href="/terms" className="text-xs text-muted-foreground hover:text-foreground">Termeni →</Link>
      </div>

      <header className="space-y-2">
        <h1 className="text-3xl font-bold">Politică de confidențialitate</h1>
        <p className="text-sm text-muted-foreground">
          Versiunea din {LAST_UPDATED}. Adăugăm modificările materiale în <Link href="/changelog" className="text-accent hover:underline">changelog</Link>.
        </p>
      </header>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-accent">Pe scurt</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Protocol e o aplicație care îți construiește un protocol personalizat de longevitate din analizele tale și datele de stil de viață.
          Tratăm informațiile despre sănătate ca date de categorie specială (GDPR art. 9): le folosim doar pentru a-ți genera protocolul,
          le criptăm la repaus, nu le vindem niciodată și nu le folosim pentru advertising. Le poți exporta sau șterge oricând.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-accent">Operator de date</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Protocol Maker — proiect personal operat de Andrei Mușat. Contact:{' '}
          <a href="mailto:privacy@protocol.app" className="text-accent hover:underline">privacy@protocol.app</a>.
          Pentru cereri formale GDPR poți folosi același email — răspundem în maximum 30 de zile, conform art. 12.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-accent">Ce date colectăm</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">Trei categorii:</p>
        <ul className="text-sm text-muted-foreground list-disc pl-6 space-y-1.5 leading-relaxed">
          <li><strong className="text-foreground">Cont</strong>: email, parolă (hash-uită de Supabase, nu o vedem niciodată în clar), data creării.</li>
          <li><strong className="text-foreground">Sănătate (categorie specială)</strong>: vârstă, sex, înălțime, greutate, condiții medicale, medicație, suplimente, alergii, valori biomarkeri din analize, metrici zilnice (somn, HRV, pași, antrenamente, mese), feedback la suplimente.</li>
          <li><strong className="text-foreground">Operațional</strong>: jurnal de chat cu modelul AI, protocoalele generate, statistici de aderență, conexiuni wearable (token-uri criptate).</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-accent">Temei legal</h2>
        <ul className="text-sm text-muted-foreground list-disc pl-6 space-y-1.5 leading-relaxed">
          <li><strong className="text-foreground">Executarea contractului</strong> (art. 6(1)(b)) — pentru a furniza serviciul pe care l-ai cerut: cont, generare protocol, tracking.</li>
          <li><strong className="text-foreground">Consimțământ explicit</strong> (art. 9(2)(a)) — pentru prelucrarea datelor de sănătate, dat la onboarding cu un click distinct. Îl poți retrage oricând din Setări → Șterge cont.</li>
          <li><strong className="text-foreground">Consimțământ</strong> (art. 6(1)(a)) — pentru analytics opt-in (Vercel Analytics). Bannerul de cookie-uri îți cere acordul; ai opțiunea „Doar esențiale".</li>
          <li><strong className="text-foreground">Interes legitim</strong> (art. 6(1)(f)) — pentru securitate (rate limiting, audit log). Echilibrat împotriva drepturilor tale; nu prelucrăm date de sănătate sub acest temei.</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-accent">Sub-procesatori</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Folosim următoarele servicii care prelucrează date în numele nostru.
          Fiecare are un DPA (Data Processing Agreement) semnat — link-urile de mai jos.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-xs border border-card-border rounded-xl">
            <thead className="bg-card text-foreground">
              <tr>
                <th className="text-left px-3 py-2 font-semibold">Furnizor</th>
                <th className="text-left px-3 py-2 font-semibold">Rol</th>
                <th className="text-left px-3 py-2 font-semibold">Categorii de date</th>
                <th className="text-left px-3 py-2 font-semibold">Regiune</th>
                <th className="text-left px-3 py-2 font-semibold">DPA</th>
              </tr>
            </thead>
            <tbody className="text-muted-foreground">
              {SUBPROCESSORS.map((sp) => (
                <tr key={sp.name} className="border-t border-card-border">
                  <td className="px-3 py-2 font-medium text-foreground">{sp.name}</td>
                  <td className="px-3 py-2">{sp.role}</td>
                  <td className="px-3 py-2">{sp.categories}</td>
                  <td className="px-3 py-2">{sp.region}</td>
                  <td className="px-3 py-2">
                    {sp.dpa.startsWith('http')
                      ? <a href={sp.dpa} target="_blank" rel="noreferrer" className="text-accent hover:underline">Link</a>
                      : <span>{sp.dpa}</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-muted-foreground italic">
          Pentru transferurile către SUA (Anthropic, Groq) folosim Standard Contractual Clauses (SCCs)
          conform deciziei Comisiei UE 2021/914. Nu trimitem identificatori personali (email, nume)
          împreună cu prompturile de generare — doar profilul de sănătate sub un ID pseudonimizat.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-accent">Cât timp păstrăm datele</h2>
        <ul className="text-sm text-muted-foreground list-disc pl-6 space-y-1.5 leading-relaxed">
          <li><strong className="text-foreground">Profil + analize + protocoale</strong>: cât timp contul e activ. Soft delete cu „deleted_at" pentru recuperare în 30 de zile; după → ștergere definitivă.</li>
          <li><strong className="text-foreground">Jurnal chat</strong>: 90 de zile (auto-purge prin cron zilnic).</li>
          <li><strong className="text-foreground">Loguri operaționale (cost AI, rate limiting)</strong>: 90 de zile pentru auditare costuri și prevenire abuz.</li>
          <li><strong className="text-foreground">După ștergerea contului</strong>: maximum 30 de zile pentru curățarea sub-procesatorilor (caching CDN, replicate DB).</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-accent">Drepturile tale</h2>
        <ul className="text-sm text-muted-foreground list-disc pl-6 space-y-2 leading-relaxed">
          {RIGHTS.map((r) => (
            <li key={r.name}>
              <strong className="text-foreground">{r.name}.</strong> {r.desc}
            </li>
          ))}
        </ul>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Dacă consideri că prelucrăm datele tale necorespunzător, ai dreptul să te adresezi
          autorității de supraveghere — pentru România, <a href="https://www.dataprotection.ro/" target="_blank" rel="noreferrer" className="text-accent hover:underline">ANSPDCP</a>.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-accent">Securitate</h2>
        <ul className="text-sm text-muted-foreground list-disc pl-6 space-y-1.5 leading-relaxed">
          <li>Criptare la repaus pe toate tabelele (Supabase standard).</li>
          <li>HTTPS obligatoriu (HSTS), HTTP nu funcționează.</li>
          <li>Row Level Security cu FORCE pe profil, analize, protocoale — nimeni nu vede datele altui utilizator, nici măcar admin.</li>
          <li>Cookie-uri de sesiune HttpOnly, SameSite=Lax, Secure în producție.</li>
          <li>Rate limiting pe toate rutele AI sensibile.</li>
          <li>Audit log pentru toate operațiile de service-role (cron, ștergere cont, webhooks Stripe).</li>
          <li>Nu păstrăm parole în clar — autentificarea e gestionată de Supabase Auth (Argon2).</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-accent">Cookie-uri</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Folosim două categorii: <strong className="text-foreground">esențiale</strong> (sesiune Supabase, preferință temă/limbă, consimțământ cookie-uri) — nu pot fi dezactivate;
          și <strong className="text-foreground">analytics</strong> (Vercel Analytics, opt-in) — colectează pageviews anonime, fără cross-site tracking, fără advertising.
          Poți schimba decizia oricând ștergând cookie-ul „protocol:consent" din browser sau retrăgând acordul printr-un reset din Setări.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-accent">Notificare în caz de breach</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Dacă suntem informați de o încălcare a securității care îți afectează datele, te anunțăm pe email
          în maximum 72 de ore de la confirmare, conform art. 33-34 GDPR — chiar dacă nu există o obligație
          legală formală în acel caz specific.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-accent">Modificări ale acestei politici</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Când schimbăm ceva material îți trimitem o notificare pe email înainte ca modificarea să intre în vigoare.
          Versiunea actuală e datată {LAST_UPDATED}. Versiunile vechi rămân publice în repo-ul GitHub.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-accent">Contact</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Întrebări sau cereri GDPR: <a href="mailto:privacy@protocol.app" className="text-accent hover:underline">privacy@protocol.app</a>.
          Răspundem în maximum 30 de zile.
        </p>
      </section>

      <div className="pt-6 border-t border-card-border flex items-center justify-between">
        <Link href="/" className="text-sm text-accent hover:underline">← Înapoi acasă</Link>
        <Link href="/terms" className="text-sm text-muted-foreground hover:text-foreground">Termeni de utilizare →</Link>
      </div>
    </div>
  );
}
