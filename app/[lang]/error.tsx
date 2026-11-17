"use client";

import { RotateCcw, TriangleAlert } from "lucide-react";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import en from "@/dictionaries/en.json";
import lo from "@/dictionaries/lo.json";

// ສະຖານະ "ຜິດພາດ" ຂອງທຸກໜ້າ: ຂໍ້ຄວາມ + ປຸ່ມລອງໃໝ່ (ui-brief 2.6)
export default function LocaleError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const { lang } = useParams<{ lang: string }>();
  const dict = lang === "lo" ? lo : en;
  return (
    <div role="alert" className="flex flex-col items-center gap-4 py-12 text-center">
      <TriangleAlert aria-hidden className="size-10 text-destructive" />
      <p className="text-lg">{dict.error.generic}</p>
      <Button onClick={reset} className="min-h-11 text-base">
        <RotateCcw aria-hidden />
        {dict.common.retry}
      </Button>
    </div>
  );
}
