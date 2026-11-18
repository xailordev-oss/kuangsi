"use client";

import { useCallback, useState } from "react";

export type LocateError = "denied" | "unavailable" | "timeout" | "unsupported";
export type MyLocation = { lat: number; lng: number; accuracy: number };

// requirements 4.5 / 4.11: ຂໍຕຳແໜ່ງສະເພາະຕອນຜູ້ໃຊ້ກົດ (ເອີ້ນ locate()) — ບໍ່ຂໍທັນທີທີ່ເປີດໜ້າ
// Geolocation ໃຊ້ໄດ້ສະເພາະ secure context: HTTPS ຫຼື http://localhost
export function useMyLocation() {
  const [location, setLocation] = useState<MyLocation | null>(null);
  const [error, setError] = useState<LocateError | null>(null);
  const [loading, setLoading] = useState(false);

  const locate = useCallback(() => {
    setError(null);
    if (!("geolocation" in navigator) || !window.isSecureContext) {
      setError("unsupported");
      return;
    }
    setLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy });
        setLoading(false);
      },
      (err) => {
        setError(err.code === err.PERMISSION_DENIED ? "denied" : err.code === err.TIMEOUT ? "timeout" : "unavailable");
        setLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 300_000 },
    );
  }, []);

  return { location, error, loading, locate };
}
