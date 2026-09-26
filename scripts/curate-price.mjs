/**
 * Gamme de prix des restaurants reconnus — pour tenir le budget.
 *
 * Défaut connu depuis le premier banc d'essai (25/08/2026) : « Le Petit Nice Passédat », trois
 * étoiles, proposé à budget 70. Le socle Foursquare ne porte aucun prix. Les tables chères sont
 * presque toutes des adresses **reconnues** (étoilées, institutions) : on demande leur gamme au
 * modèle pour celles-là seulement, ~3 000 lieux, quelques centimes.
 *
 * La gamme n'est **jamais affichée** : elle sert à écarter les tables chères d'un budget serré.
 * C'est un fait produit par le modèle, ce que le projet s'interdit d'afficher — mais employé
 * comme filtre prudent, une erreur ne fait que retirer une table d'un vivier, jamais annoncer un
 * prix faux à quelqu'un.
 *
 *   node --env-file=.env.local scripts/curate-price.mjs
 */
import Anthropic from "@anthropic-ai/sdk";
import { lit, sql } from "./lib-socle.mjs";

const MODELE = "claude-haiku-4-5";
const PAQUET = 400;

await sql(`alter table places add column if not exists gamme text`);
const lieux = await sql(`
  select fsq_id, name as nom, address as adresse, locality_norm as ville
  from places where notoriete > 0 and place_type = 'restaurant' and gamme is null
  order by locality_norm, fsq_id`);
console.log(`${lieux.length} restaurants reconnus à classer`);

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["gammes"],
  properties: {
    gammes: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["ref", "gamme"],
        properties: { ref: { type: "string" }, gamme: { type: "string", enum: ["€", "€€", "€€€", "?"] } },
      },
    },
  },
};

const client = new Anthropic({ apiKey: process.env.VIBETRIP_CURATION_API_KEY ?? process.env.ANTHROPIC_API_KEY });
let entree = 0;
let sortie = 0;
const resultats = [];

for (let debut = 0; debut < lieux.length; debut += PAQUET) {
  const paquet = lieux.slice(debut, debut + PAQUET);
  const lignes = paquet.map((l, i) => `R${i} | ${l.nom} | ${l.adresse ?? "?"} | ${l.ville}`).join("\n");
  const reponse = await client.messages.create({
    model: MODELE,
    max_tokens: 8000,
    output_config: { format: { type: "json_schema", schema: SCHEMA } },
    messages: [
      {
        role: "user",
        content: [
          "Pour chacun de ces restaurants français (référence | nom | adresse | ville), donne sa gamme de prix pour un dîner :",
          "€ = moins de 25 € par personne ; €€ = 25 à 60 € ; €€€ = plus de 60 € (tables gastronomiques, étoilées, grandes brasseries de luxe).",
          "Si tu ne connais pas précisément ce restaurant, réponds « ? ». Ne devine pas d'après le nom.",
          "",
          lignes,
        ].join("\n"),
      },
    ],
  });
  entree += reponse.usage.input_tokens;
  sortie += reponse.usage.output_tokens;
  const texte = reponse.content.filter((b) => b.type === "text").map((b) => b.text).join("");
  try {
    for (const g of JSON.parse(texte).gammes ?? []) {
      const lieu = paquet[Number(String(g.ref).replace(/^R/, ""))];
      if (lieu) resultats.push({ fsq: lieu.fsq_id, gamme: g.gamme });
    }
  } catch {
    console.log(`  ⚠ paquet ${debut} illisible (${reponse.stop_reason})`);
  }
}

for (let i = 0; i < resultats.length; i += 500) {
  const valeurs = resultats.slice(i, i + 500).map((r) => `(${lit(r.fsq)}, ${lit(r.gamme)})`).join(",");
  await sql(`update places p set gamme = v.g from (values ${valeurs}) as v(f, g) where p.fsq_id = v.f`);
}
const bilan = await sql(`select gamme, count(*)::int as n from places where gamme is not null group by 1 order by 1`);
console.log(bilan.map((b) => `${b.gamme} ${b.n}`).join(" · "));
console.log(`≈ ${((entree * 1 + sortie * 5) / 1e6).toFixed(3)} $`);
