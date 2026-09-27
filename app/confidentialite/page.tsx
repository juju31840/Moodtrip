import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Confidentialité · VibeTrip",
  description: "Ce que VibeTrip fait de tes données — et surtout ce qu'il n'en fait pas.",
};

/**
 * Politique de confidentialité, exigée par l'App Store (l'application demande la position) et
 * liée depuis la fiche de l'app.
 *
 * Écrite depuis le code et non depuis un modèle de politique : chaque phrase correspond à un
 * appel réseau ou à un magasin réel (`mobile/src/lib/`). Si un envoi change, cette page change
 * avec lui — une politique qui promet moins que ce que fait l'app est pire que pas de politique.
 */

const CONTACT = "jules.schuft@gmail.com";
const MISE_A_JOUR = "26 septembre 2026";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3 border-t-2 border-ink pt-5">
      <h2 className="font-display text-[26px] uppercase leading-[1.04]">{title}</h2>
      <div className="flex flex-col gap-3 text-[15px] leading-relaxed text-ink-soft">{children}</div>
    </section>
  );
}

export default function Confidentialite() {
  return (
    <main className="grain mx-auto flex min-h-[100dvh] max-w-2xl flex-col gap-8 px-5 pb-16 pt-[max(2.5rem,env(safe-area-inset-top))]">
      <header className="flex flex-col gap-3">
        <a href="/" className="text-[11px] font-extrabold uppercase tracking-[0.1em] text-ink-mute underline">
          VibeTrip
        </a>
        <h1 className="font-display text-[44px] uppercase leading-[1.04]">Confidentialité</h1>
        <p className="text-[17px] leading-snug text-ink">
          Pas de compte, pas de publicité, pas de pistage. Tes sorties, ta carte et ton profil restent sur ton téléphone.
        </p>
        <p className="text-[12px] font-bold uppercase tracking-[0.06em] text-ink-mute">Mise à jour le {MISE_A_JOUR}</p>
      </header>

      <Section title="Ce qui reste sur ton téléphone">
        <p>
          Tout ce que tu enregistres vit dans le stockage de l&apos;application, sur ton appareil : tes sorties validées, les
          étapes cochées, ta carte des lieux visités, tes tampons, tes notes, tes préférences, et le profil que tu remplis
          (prénom, âge, photo). Rien de tout cela n&apos;est envoyé à un serveur. Supprimer l&apos;application l&apos;efface.
        </p>
        <p>Il n&apos;y a pas de compte : on ne te demande ni adresse e-mail, ni numéro, ni mot de passe.</p>
      </Section>

      <Section title="Ta position">
        <p>
          Si tu l&apos;autorises, ta position sert uniquement à composer une sortie autour de l&apos;endroit où tu es, au moment
          où tu la demandes. Elle n&apos;est pas suivie en arrière-plan et n&apos;est pas conservée par nos serveurs. Tu peux
          toujours saisir une ville à la place.
        </p>
      </Section>

      <Section title="Ce qui part quand tu demandes une sortie">
        <p>
          Pour composer tes propositions, l&apos;application envoie à notre serveur : le point de départ (ta position ou la
          ville saisie), le mode, les trois réglages, tes envies et l&apos;heure de départ. Le serveur choisit des lieux réels
          dans notre base, puis fait écrire le programme par Claude, le modèle d&apos;Anthropic. Anthropic reçoit ces réglages
          et la liste des lieux candidats — jamais ton nom, ton profil ni ton historique.
        </p>
        <p>
          Pour éviter les abus, chaque appareil porte un identifiant tiré au hasard à l&apos;installation, sans lien avec ton
          identité. Avec ton adresse IP, il sert seulement à compter le nombre de demandes par heure, et les deux
          sont effacés automatiquement au bout d&apos;un jour.
        </p>
      </Section>

      <Section title="Ce qui est compté, anonymement">
        <p>
          Quand tu coches « j&apos;y suis allé » ou que tu notes un lieu, un compteur est incrémenté sur ce lieu dans notre
          base : cela fait remonter les bonnes adresses pour tout le monde. Seuls le nom du lieu, sa position et la note
          sont envoyés — ni identifiant, ni date, ni rien qui permette de savoir qui y est allé.
        </p>
      </Section>

      <Section title="Services utilisés">
        <ul className="flex list-none flex-col gap-2">
          <li>
            <strong className="text-ink">Vercel</strong> — héberge notre serveur.
          </li>
          <li>
            <strong className="text-ink">Supabase</strong> — notre base de lieux, les compteurs anonymes et le décompte des
            demandes.
          </li>
          <li>
            <strong className="text-ink">Anthropic</strong> — écrit le programme à partir de tes réglages.
          </li>
          <li>
            <strong className="text-ink">Mapbox</strong> — recherche de villes et aperçus de cartes.
          </li>
          <li>
            <strong className="text-ink">Apple Plans</strong> — la carte affichée dans l&apos;application et l&apos;itinéraire
            quand tu appuies sur « Y aller ».
          </li>
          <li>
            <strong className="text-ink">Open-Meteo</strong> — la météo du lieu de ta sortie, pour te proposer une variante
            à couvert s&apos;il pleut.
          </li>
          <li>
            <strong className="text-ink">Wikimedia Commons</strong> — les photos de villes, affichées avec leurs crédits.
          </li>
        </ul>
        <p>Ces services reçoivent ce qui leur est nécessaire pour répondre (par exemple une coordonnée), jamais ton profil.</p>
      </Section>

      <Section title="Ce que VibeTrip ne fait pas">
        <p>
          Aucune publicité, aucun traceur publicitaire, aucune revente ni partage de données à des fins commerciales, aucun
          suivi d&apos;une application à l&apos;autre.
        </p>
      </Section>

      <Section title="Tes droits">
        <p>
          Les données enregistrées sont sur ton téléphone : tu peux supprimer une sortie depuis l&apos;application, ou tout
          effacer en la désinstallant. Pour toute question, ou pour exercer tes droits d&apos;accès et d&apos;effacement
          prévus par le RGPD, écris à{" "}
          <a href={`mailto:${CONTACT}`} className="font-bold text-blue underline">
            {CONTACT}
          </a>
          .
        </p>
      </Section>
    </main>
  );
}
