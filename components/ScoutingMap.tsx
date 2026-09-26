"use client";

import { useEffect, useRef, useState } from "react";
import Map, { Marker, type MapRef } from "react-map-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import type { ScoutedPlace, GeoPoint } from "@/types/itinerary";

/**
 * Le repérage, pendant l'attente : la carte du quartier de départ et les adresses réellement
 * examinées par le modèle.
 *
 * Retour des testeurs (24/09/2026) : l'attente paraissait longue. Elle l'est — 5 à 9 s, presque
 * entièrement le temps d'écriture du modèle — mais le serveur connaît les candidats en ~0,3 s.
 * Les montrer rend l'attente à ce qu'elle est : un choix parmi de vrais lieux, pas un sablier.
 * L'utilisateur a écarté l'affichage des étapes au fil de l'eau (« un peu chiant ») et demandé
 * « un zoom sur le quartier avec un effet visuel » : c'est ce zoom, mais sur des faits.
 */
const RECOGNIZED = "#DD3B2E";
const OTHER = "#17161A";

export function ScoutingMap({ origin, places }: { origin: GeoPoint; places: ScoutedPlace[] }) {
  const mapRef = useRef<MapRef>(null);
  const [shown, setShown] = useState(0);
  const reduced = useRef(false);

  // Les lieux reconnus d'abord : ce sont eux qu'on veut voir apparaître en premier.
  const ordered = [...places].sort((a, b) => Number(b.recognized) - Number(a.recognized));

  useEffect(() => {
    reduced.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced.current) {
      setShown(ordered.length);
      return;
    }
    // Apparition échelonnée sur ~4 s, quel que soit le nombre de lieux.
    const step = Math.max(40, Math.floor(4000 / Math.max(1, ordered.length)));
    const timer = window.setInterval(() => {
      setShown((current) => {
        if (current >= ordered.length) {
          window.clearInterval(timer);
          return current;
        }
        return current + 1;
      });
    }, step);
    return () => window.clearInterval(timer);
  }, [ordered.length]);

  function onLoad() {
    if (reduced.current) return;
    // Un seul mouvement lent, sans rebond : on descend sur le quartier pendant que le modèle
    // écrit. Quinze secondes couvrent l'attente la plus longue mesurée (voyage, ~10 s).
    mapRef.current?.flyTo({
      center: [origin.lng, origin.lat],
      zoom: 14.6,
      bearing: 14,
      pitch: 38,
      duration: 15000,
      curve: 1,
      easing: (t) => t,
    });
  }

  return (
    <Map
      ref={mapRef}
      mapboxAccessToken={process.env.NEXT_PUBLIC_MAPBOX_TOKEN}
      initialViewState={{ latitude: origin.lat, longitude: origin.lng, zoom: 12.4, bearing: -8, pitch: 0 }}
      mapStyle="mapbox://styles/mapbox/light-v11"
      interactive={false}
      attributionControl={false}
      onLoad={onLoad}
      style={{ width: "100%", height: "100%" }}
    >
      {ordered.slice(0, shown).map((place, index) => (
        <Marker key={`${place.name}-${index}`} latitude={place.location.lat} longitude={place.location.lng} anchor="center">
          <span
            aria-hidden
            className="block motion-safe:animate-[scout-pop_280ms_ease-out]"
            style={{
              width: place.recognized ? 10 : 6,
              height: place.recognized ? 10 : 6,
              background: place.recognized ? RECOGNIZED : OTHER,
              opacity: place.recognized ? 1 : 0.45,
            }}
          />
        </Marker>
      ))}
      {/* Le point de départ, en encre pleine — le repère de tout le reste. */}
      <Marker latitude={origin.lat} longitude={origin.lng} anchor="center">
        <span aria-hidden className="block h-4 w-4 border-[3px] border-ink bg-paper" />
      </Marker>
    </Map>
  );
}
