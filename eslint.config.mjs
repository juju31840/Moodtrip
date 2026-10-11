import nextVitals from "eslint-config-next/core-web-vitals";

// Next 16 a retiré `next lint` : ESLint 9 et sa configuration « flat » prennent le relais, avec
// les mêmes règles qu'avant (next/core-web-vitals). L'app mobile a son propre lint (`mobile/`).
const config = [
  ...nextVitals,
  { ignores: [".next/**", "node_modules/**", "mobile/**", "next-env.d.ts"] },
  {
    // Règles nouvelles de eslint-plugin-react-hooks 7, pensées pour le React Compiler (non activé
    // ici). Elles signalent des usages qui fonctionnent (lecture du stockage local dans un effet,
    // mémoïsation manuelle) : avertissement plutôt qu'erreur, à reprendre si le compilateur
    // est activé un jour. Montée de version Next 16, 11/10/2026.
    rules: {
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/preserve-manual-memoization": "warn",
      "react-hooks/immutability": "warn",
    },
  },
];

export default config;
