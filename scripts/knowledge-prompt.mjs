/**
 * Consigne et schéma de la curation par connaissance du modèle, partagés entre l'essai sur une
 * ville (`curate-knowledge.mjs`) et le passage de toutes les villes par l'API Batch
 * (`curate-knowledge-batch.mjs`) — la même question, pour que la mesure faite sur l'une vaille
 * pour l'autre.
 */
export const PAQUET = 700;

export const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["connus"],
  properties: {
    connus: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["ref", "raison"],
        properties: { ref: { type: "string" }, raison: { type: "string" } },
      },
    },
  },
};

/** `lieux` : [{ nom, adresse, place_type }] ; `debut` : indice du premier, pour les références. */
export function consigne(ville, lieux, debut) {
  const lignes = lieux.map((l, i) => `R${debut + i} | ${l.nom}${l.adresse ? ` | ${l.adresse}` : ""} | ${l.place_type}`).join("\n");
  return [
    `Voici des bars, restaurants et lieux de sortie réels de la ville « ${ville} » (France), un par ligne : référence | nom | adresse | type.`,
    "Désigne uniquement ceux que tu connais PRÉCISÉMENT comme des adresses reconnues : tables réputées, institutions locales, bars cités par les guides ou la presse, lieux emblématiques.",
    "Règles strictes : si tu ne connais pas ce lieu précis à cette adresse, ne le retiens pas. Un nom qui te semble familier ne suffit pas. Un homonyme dans une autre ville ne compte pas. Mieux vaut en retenir trop peu que se tromper.",
    "Pour chaque lieu retenu : sa référence exacte, et une raison de moins de quinze mots qui dit un fait précis que tu sais sur lui (spécialité, chef, histoire) — jamais un adjectif creux.",
    "",
    lignes,
  ].join("\n");
}

/** Le filtre des lieux soumis — identique dans les deux scripts. */
export const FILTRE_SQL = `themes && array['eat','drink','night']
    and not est_chaine and not nom_douteux and not coord_douteuse
    and google_status is distinct from 'closed'`;
