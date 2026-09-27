import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Aide · Moodtrip",
  description: "Comment marche Moodtrip, et comment nous écrire.",
};

/**
 * Page d'assistance, exigée par l'App Store (« Support URL ») et liée depuis le Profil.
 *
 * Mêmes principes que la page de confidentialité : chaque réponse décrit ce que fait réellement
 * l'application, jamais ce qu'on aimerait qu'elle fasse.
 */

const CONTACT = "jules.schuft@gmail.com";

function Question({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3 border-t-2 border-ink pt-5">
      <h2 className="font-display text-[26px] uppercase leading-[1.04]">{title}</h2>
      <div className="flex flex-col gap-3 text-[15px] leading-relaxed text-ink-soft">{children}</div>
    </section>
  );
}

export default function Support() {
  return (
    <main className="grain mx-auto flex min-h-[100dvh] max-w-2xl flex-col gap-8 px-5 pb-16 pt-[max(2.5rem,env(safe-area-inset-top))]">
      <header className="flex flex-col gap-3">
        <a href="/" className="text-[11px] font-extrabold uppercase tracking-[0.1em] text-ink-mute underline">
          Moodtrip
        </a>
        <h1 className="font-display text-[44px] uppercase leading-[1.04]">Aide</h1>
        <p className="text-[17px] leading-snug text-ink">
          Un souci, une adresse fermée, une idée ? Écris à{" "}
          <a href={`mailto:${CONTACT}`} className="font-bold text-blue underline">
            {CONTACT}
          </a>
          . On répond à chaque message.
        </p>
      </header>

      <Question title="Comment ça marche">
        <p>
          Tu choisis quand (ce soir, un week-end, un voyage), d&apos;où tu pars, puis ton budget, l&apos;ambiance et la
          distance. Moodtrip compose deux ou trois programmes différents parmi des lieux réels autour de toi. Tu ouvres
          celui qui te tente, tu changes une étape si elle ne te plaît pas, et tu le gardes dans tes sorties.
        </p>
      </Question>

      <Question title="Où ça marche">
        <p>
          En France. Les lieux viennent d&apos;une base d&apos;environ 575 000 adresses françaises : hors de France,
          Moodtrip n&apos;a presque rien à proposer.
        </p>
      </Question>

      <Question title="« Adresse reconnue », ça veut dire quoi">
        <p>
          Que le lieu est une adresse connue de sa ville : citée par la presse, un guide ou Wikipédia, ou repérée
          comme une institution locale. Les autres lieux existent aussi, ils sont simplement moins connus. Avant de partir loin, un coup
          d&apos;œil aux horaires ne coûte rien.
        </p>
      </Question>

      <Question title="Je suis tombé sur une porte close">
        <p>
          Nous vérifions régulièrement que les lieux sont toujours ouverts, et un lieu fermé est signalé dans tes sorties
          déjà enregistrées. Il en échappe forcément : écris-nous son nom et sa ville, nous le retirons.
        </p>
      </Question>

      <Question title="Le chargement prend quelques secondes">
        <p>
          C&apos;est le temps d&apos;écrire trois programmes : cinq secondes environ pour une soirée, un peu plus pour un
          voyage. Sans connexion, rien ne peut être composé, mais tes sorties enregistrées restent consultables et tu
          peux cocher tes étapes.
        </p>
      </Question>

      <Question title="Mes données">
        <p>
          Pas de compte : tes sorties, ta carte et ton profil restent sur ton téléphone. Supprimer l&apos;application les
          efface. Le détail est sur la page{" "}
          <a href="/confidentialite" className="font-bold text-blue underline">
            confidentialité
          </a>
          .
        </p>
      </Question>
    </main>
  );
}
