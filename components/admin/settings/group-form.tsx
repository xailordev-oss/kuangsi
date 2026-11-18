"use client";

import { useState } from "react";
import { SaveFeedback, useSettingsSave, type SD } from "@/components/admin/settings/save-kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { t } from "@/lib/i18n/format";

export type FieldSpec = { key: string; kind: "int" | "text" | "textarea" | "bool" | "gates"; min?: number; max?: number; maxLength?: number };

// ກຸ່ມຄ່າໃນ settings — ບັນທຶກທັງກຸ່ມ · server ປຽບທຽບກັບຄ່າໃນ DB ແລະ ບັນທຶກສະເພາະທີ່ປ່ຽນ (audit ເກົ່າ/ໃໝ່)
export function SettingsGroupForm({ group, fields, initial, d }: { group: string; fields: FieldSpec[]; initial: Record<string, string>; d: SD }) {
  const [values, setValues] = useState(initial);
  const s = useSettingsSave(d);
  const set = (key: string, v: string) => setValues((x) => ({ ...x, [key]: v }));

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const payload = Object.fromEntries(
      fields.map((f) => [f.key, f.kind === "int" ? Number(values[f.key]) : f.kind === "bool" ? values[f.key] === "true" : (values[f.key] ?? "")]),
    );
    void s.send(`/api/admin/settings/groups/${group}`, "PUT", { values: payload });
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4" data-testid={`group-${group}`}>
      {fields.map((f) => {
        const id = `f-${f.key}`;
        const label = (d.fields as Record<string, string>)[f.key] ?? f.key;
        const hint = [(d.hints as Record<string, string>)[f.key], f.kind === "int" ? t(d.range, { min: f.min ?? "", max: f.max ?? "" }) : null]
          .filter(Boolean)
          .join(" · ");
        const invalid = s.badFields.has(f.key);
        const described = [hint && `${id}-hint`, invalid && `${id}-err`].filter(Boolean).join(" ") || undefined;
        if (f.kind === "bool") {
          return (
            <div key={f.key} className="flex flex-col gap-1">
              <label className="flex min-h-11 items-center gap-3">
                <input
                  id={id}
                  type="checkbox"
                  className="size-5 accent-primary"
                  checked={values[f.key] === "true"}
                  onChange={(e) => set(f.key, String(e.target.checked))}
                  aria-describedby={described}
                />
                <span>{label}</span>
              </label>
              {hint && (
                <p id={`${id}-hint`} className="text-sm text-muted-foreground">
                  {hint}
                </p>
              )}
            </div>
          );
        }
        return (
          <div key={f.key} className="flex flex-col gap-1">
            <label htmlFor={id} className="font-semibold">
              {label}
            </label>
            {f.kind === "textarea" ? (
              <textarea
                id={id}
                rows={2}
                maxLength={f.maxLength}
                required
                className="min-h-11 rounded-md border border-input bg-background px-3 py-2 text-base"
                value={values[f.key] ?? ""}
                onChange={(e) => set(f.key, e.target.value)}
                aria-invalid={invalid || undefined}
                aria-describedby={described}
              />
            ) : (
              <Input
                id={id}
                className="min-h-11 text-base"
                type={f.kind === "int" ? "number" : "text"}
                inputMode={f.kind === "int" ? "numeric" : undefined}
                min={f.min}
                max={f.max}
                step={f.kind === "int" ? 1 : undefined}
                maxLength={f.maxLength}
                required
                autoComplete="off"
                spellCheck={f.kind === "gates" ? false : undefined}
                value={values[f.key] ?? ""}
                onChange={(e) => set(f.key, e.target.value)}
                aria-invalid={invalid || undefined}
                aria-describedby={described}
              />
            )}
            {hint && (
              <p id={`${id}-hint`} className="text-sm text-muted-foreground">
                {hint}
              </p>
            )}
            {invalid && (
              <p id={`${id}-err`} className="text-sm text-destructive">
                {d.invalidField}
              </p>
            )}
          </div>
        );
      })}
      <SaveFeedback s={s} d={d} />
      <Button type="submit" className="min-h-11 w-fit" disabled={s.busy}>
        {s.busy ? d.saving : d.save}
      </Button>
    </form>
  );
}
