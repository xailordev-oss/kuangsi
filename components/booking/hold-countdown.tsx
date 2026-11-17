"use client";

import { Timer } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

function remaining(expiresAt: string): number {
  return Math.max(0, Math.floor((Date.parse(expiresAt) - Date.now()) / 1000));
}

// ໝົດເວລາ → refresh ໃຫ້ server ສະແດງສະຖານະ expired (server ເປັນຜູ້ຕັດສິນ ບໍ່ແມ່ນໂມງຂອງເຄື່ອງ)
export function HoldCountdown({ expiresAt, template }: { expiresAt: string; template: string }) {
  const router = useRouter();
  const [seconds, setSeconds] = useState<number | null>(null);

  useEffect(() => {
    const tick = () => {
      const s = remaining(expiresAt);
      setSeconds(s);
      if (s === 0) {
        clearInterval(id);
        router.refresh();
      }
    };
    const id = setInterval(tick, 1000);
    tick();
    return () => clearInterval(id);
  }, [expiresAt, router]);

  if (seconds === null) return null;
  const mm = String(Math.floor(seconds / 60)).padStart(2, "0");
  const ss = String(seconds % 60).padStart(2, "0");
  return (
    <p className={cn("flex items-center gap-2 text-lg font-semibold tabular-nums", seconds < 300 && "text-warning")}>
      <Timer aria-hidden className="size-5" />
      <span role="timer" aria-live="off">
        {template.replace("{time}", `${mm}:${ss}`)}
      </span>
    </p>
  );
}
