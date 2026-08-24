import { useCallback, useState } from "react";

export function useGeolocation() {
  const [coords, setCoords] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const request = useCallback(() => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        const e = new Error("Geolocation is not supported on this device/browser.");
        setError(e.message);
        reject(e);
        return;
      }
      setLoading(true);
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const c = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          setCoords(c);
          setLoading(false);
          setError(null);
          resolve(c);
        },
        (err) => {
          setError(err.message || "Could not get your location.");
          setLoading(false);
          reject(err);
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    });
  }, []);

  return { coords, error, loading, request, setCoords };
}
