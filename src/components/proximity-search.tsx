"use client";
import { useEffect, useState } from "react";

export function ProximitySearch({ latitude, longitude }: { latitude?: string; longitude?: string }) {
  const [coords, setCoords] = useState({ latitude: latitude ?? "", longitude: longitude ?? "" });
  const [status, setStatus] = useState(latitude && longitude ? "Location ready" : "Waiting for location permission");

  useEffect(() => {
    if (coords.latitude && coords.longitude) return;
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      ({ coords: value }) => {
        setCoords({ latitude: String(value.latitude), longitude: String(value.longitude) });
        setStatus("Location ready");
      },
      () => setStatus("Location permission not granted"),
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 300_000 },
    );
  }, [coords.latitude, coords.longitude]);

  return <><input type="hidden" name="latitude" value={coords.latitude}/><input type="hidden" name="longitude" value={coords.longitude}/><input type="hidden" name="pickupOnly" value={coords.latitude && coords.longitude ? "true" : ""}/><span className="sr-only" aria-live="polite">{status}</span></>;
}
