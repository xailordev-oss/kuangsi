import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { t } from "@/lib/i18n/format";

const STEP_KEYS = ["date", "details", "review", "done"] as const;

export function BookingStepper({ step, dict }: { step: 1 | 2 | 3 | 4; dict: Dictionary }) {
  return (
    <nav aria-label={t(dict.booking.stepOf, { n: step })} className="mb-4">
      <p className="text-sm text-muted-foreground">{t(dict.booking.stepOf, { n: step })}</p>
      <ol className="mt-1 flex gap-1.5">
        {STEP_KEYS.map((key, i) => {
          const n = i + 1;
          const state = n < step ? "done" : n === step ? "current" : "todo";
          return (
            <li
              key={key}
              aria-current={state === "current" ? "step" : undefined}
              className={cn(
                "flex h-2 flex-1 rounded-full",
                state === "todo" ? "bg-muted" : "bg-primary",
              )}
            >
              <span className="sr-only">
                {dict.booking.steps[key]}
                {state === "done" && <Check aria-hidden />}
              </span>
            </li>
          );
        })}
      </ol>
      <p className="mt-1 text-lg font-semibold">{dict.booking.steps[STEP_KEYS[step - 1]]}</p>
    </nav>
  );
}
