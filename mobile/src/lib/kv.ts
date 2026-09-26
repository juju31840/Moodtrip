import Storage from "expo-sqlite/kv-store";
import { useSyncExternalStore } from "react";

/**
 * Un petit magasin clé-valeur observable : lecture synchrone, écriture qui prévient les écrans
 * abonnés. Les itinéraires, les lieux visités, le profil et les villes récentes passent tous
 * par lui — une seule façon d'écrire, et un échec d'écriture ne fait jamais perdre la copie en
 * mémoire de l'écran courant.
 */
export function createStore<T>(key: string, initial: T) {
  const listeners = new Set<() => void>();
  let cache: T | undefined;

  function get(): T {
    if (cache !== undefined) return cache;
    try {
      const raw = Storage.getItemSync(key);
      cache = raw ? (JSON.parse(raw) as T) : initial;
    } catch {
      cache = initial;
    }
    return cache;
  }

  function set(next: T): boolean {
    cache = next;
    let ok = true;
    try {
      Storage.setItemSync(key, JSON.stringify(next));
    } catch {
      ok = false;
    }
    listeners.forEach((listener) => listener());
    return ok;
  }

  function useValue(): T {
    return useSyncExternalStore(
      (listener) => {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
      get
    );
  }

  return { get, set, useValue };
}
