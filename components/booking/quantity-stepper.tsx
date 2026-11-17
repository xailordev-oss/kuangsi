"use client";

import { Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

// ປຸ່ມ +/− ຂະໜາດ 44×44px (ui-brief 1.4)
export function QuantityStepper({
  value,
  min = 0,
  max,
  onChange,
  decreaseLabel,
  increaseLabel,
}: {
  value: number;
  min?: number;
  max: number;
  onChange: (next: number) => void;
  decreaseLabel: string;
  increaseLabel: string;
}) {
  return (
    <div className="flex items-center gap-1">
      <Button
        type="button"
        variant="outline"
        className="size-11 rounded-full p-0"
        aria-label={decreaseLabel}
        disabled={value <= min}
        onClick={() => onChange(value - 1)}
      >
        <Minus aria-hidden />
      </Button>
      <output aria-live="polite" className="w-8 text-center text-lg font-semibold tabular-nums">
        {value}
      </output>
      <Button
        type="button"
        variant="outline"
        className="size-11 rounded-full p-0"
        aria-label={increaseLabel}
        disabled={value >= max}
        onClick={() => onChange(value + 1)}
      >
        <Plus aria-hidden />
      </Button>
    </div>
  );
}
