// Le code partagé avec le site (types, libellés des curseurs, envies) vit à la racine du dépôt,
// hors du projet Expo : Metro doit le surveiller pour pouvoir l'empaqueter. Seuls des modules
// **purs** y sont importés — rien qui touche `window`, `localStorage` ou `server-only`.
// `getSentryExpoConfig` étend la config Expo pour produire les source maps envoyées à Sentry.
const { getSentryExpoConfig } = require("@sentry/react-native/metro");
const path = require("path");

const config = getSentryExpoConfig(__dirname);
config.watchFolders = [path.resolve(__dirname, "../lib"), path.resolve(__dirname, "../types")];

module.exports = config;
