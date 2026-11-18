"use client";

import { Pencil, Plus } from "lucide-react";
import { useState } from "react";
import { formatAmount, SaveFeedback, useSettingsSave, type SD } from "@/components/admin/settings/save-kit";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { t } from "@/lib/i18n/format";
import type { StaffDictionary } from "@/lib/i18n/staff";

type CD = StaffDictionary["admin"]["catalog"];
type Group = "lao" | "foreigner";
type AgeGroup = "adult" | "child" | "senior" | "free";
type Unit = "per_person" | "per_booking" | "per_item";

export type TicketRow = {
  id: string;
  code: string;
  visitorGroup: Group;
  ageGroup: AgeGroup;
  nameLo: string;
  nameEn: string;
  nameZh: string | null;
  nameTh: string | null;
  ageMin: number | null;
  ageMax: number | null;
  price: number;
  sortOrder: number;
  isActive: boolean;
};
export type AddOnRow = { id: string; code: string; unit: Unit; nameLo: string; nameEn: string; nameZh: string | null; nameTh: string | null; price: number; isActive: boolean };

type Form = {
  id: string | null;
  code: string;
  ageGroup: AgeGroup;
  unit: Unit;
  nameLo: string;
  nameEn: string;
  nameZh: string;
  nameTh: string;
  price: string;
  ageMin: string;
  ageMax: string;
  sortOrder: string;
  isActive: boolean;
  lockedLabel: string | null;
};

const selectClass = "min-h-11 w-full rounded-md border border-input bg-background px-2 text-base";
const num = (v: string) => (v.trim() === "" ? null : Number(v.replace(/,/g, "")));

function ageText(r: { ageMin: number | null; ageMax: number | null }, d: CD): string {
  if (r.ageMin !== null && r.ageMax !== null) return t(d.ageRange, { min: r.ageMin, max: r.ageMax });
  if (r.ageMin !== null) return t(d.ageFrom, { min: r.ageMin });
  if (r.ageMax !== null) return t(d.ageTo, { max: r.ageMax });
  return d.anyAge;
}

// 10c: ລາຄາ / ເພີ່ມ / ປິດຂາຍ → server ຕອບ confirm_required ພ້ອມລາຄາເກົ່າ-ໃໝ່ ແລະ ການຈອງທີ່ຖືລາຄາເກົ່າ (ຂໍ້ຕົກລົງ 51)
// code · ກຸ່ມ · ກຸ່ມອາຍຸ · ໜ່ວຍ ສະແດງເປັນຂໍ້ຄວາມອ່ານຢ່າງດຽວຫຼັງສ້າງ (ຂໍ້ຕົກລົງ 52)
export function CatalogManager({
  mode,
  group,
  tickets,
  addOns,
  lakPerUnit,
  d,
  sd,
}: {
  mode: "tickets" | "addons";
  group: Group;
  tickets: TicketRow[];
  addOns: AddOnRow[];
  lakPerUnit: Partial<Record<"USD" | "THB", number>>;
  d: CD;
  sd: SD;
}) {
  const s = useSettingsSave(sd);
  const [form, setForm] = useState<Form | null>(null);
  const kip = (v: number) => `${formatAmount(v)} ${sd.kipUnit}`;
  const set = (patch: Partial<Form>) => setForm((f) => f && { ...f, ...patch });

  const blank: Form = { id: null, code: "", ageGroup: "adult", unit: "per_person", nameLo: "", nameEn: "", nameZh: "", nameTh: "", price: "", ageMin: "", ageMax: "", sortOrder: "0", isActive: true, lockedLabel: null };

  function editTicket(r: TicketRow) {
    setForm({
      ...blank,
      id: r.id,
      code: r.code,
      ageGroup: r.ageGroup,
      nameLo: r.nameLo,
      nameEn: r.nameEn,
      nameZh: r.nameZh ?? "",
      nameTh: r.nameTh ?? "",
      price: String(r.price),
      ageMin: r.ageMin === null ? "" : String(r.ageMin),
      ageMax: r.ageMax === null ? "" : String(r.ageMax),
      sortOrder: String(r.sortOrder),
      isActive: r.isActive,
      lockedLabel: t(d.locked, { code: r.code, group: d.groups[r.visitorGroup], age: d.ageGroups[r.ageGroup] }),
    });
  }

  function editAddOn(a: AddOnRow) {
    setForm({
      ...blank,
      id: a.id,
      code: a.code,
      unit: a.unit,
      nameLo: a.nameLo,
      nameEn: a.nameEn,
      nameZh: a.nameZh ?? "",
      nameTh: a.nameTh ?? "",
      price: String(a.price),
      isActive: a.isActive,
      lockedLabel: t(d.lockedAddOn, { code: a.code, unit: d.units[a.unit] }),
    });
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    const names = { nameLo: form.nameLo, nameEn: form.nameEn, nameZh: form.nameZh, nameTh: form.nameTh };
    const price = num(form.price) ?? NaN;
    const done = () => setForm(null);
    if (mode === "tickets") {
      const editable = { ...names, price, ageMin: num(form.ageMin), ageMax: num(form.ageMax), sortOrder: num(form.sortOrder) ?? 0, isActive: form.isActive };
      if (form.id) void s.send(`/api/admin/ticket-types/${form.id}`, "PATCH", editable, done);
      else void s.send("/api/admin/ticket-types", "POST", { code: form.code, visitorGroup: group, ageGroup: form.ageGroup, ...editable }, done);
    } else {
      const editable = { ...names, price, isActive: form.isActive };
      if (form.id) void s.send(`/api/admin/add-ons/${form.id}`, "PATCH", editable, done);
      else void s.send("/api/admin/add-ons", "POST", { code: form.code, unit: form.unit, ...editable }, done);
    }
  }

  const price = form ? num(form.price) : null;
  const approx =
    price && price > 0
      ? (Object.entries(lakPerUnit) as [string, number][]).map(([cur, rate]) => `${new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(price / rate)} ${cur}`).join(" · ")
      : "";
  const bad = (k: string) => s.badFields.has(k) || undefined;
  const text = (k: "nameLo" | "nameEn" | "nameZh" | "nameTh", required: boolean) => (
    <label className="flex flex-col gap-1">
      <span className="font-semibold">{d[k]}</span>
      <Input className="min-h-11 text-base" required={required} maxLength={100} value={form?.[k] ?? ""} aria-invalid={bad(k)} onChange={(e) => set({ [k]: e.target.value })} />
    </label>
  );

  const rows = mode === "tickets" ? tickets.filter((r) => r.visitorGroup === group) : [];

  return (
    <div className="flex flex-col gap-4">
      <p className="text-muted-foreground">{mode === "tickets" ? d.intro : d.addonsIntro}</p>
      <Button type="button" className="min-h-11 w-fit" onClick={() => setForm(blank)}>
        <Plus aria-hidden />
        {mode === "tickets" ? d.addTicket : d.addAddOn}
      </Button>
      {!form && <SaveFeedback s={s} d={sd} />}

      {mode === "tickets" &&
        (rows.length === 0 ? (
          <p className="rounded-lg border border-dashed p-6">{d.empty}</p>
        ) : (
          <ul className="grid gap-2 md:grid-cols-2">
            {rows.map((r) => (
              <li key={r.id} data-testid={`tt-${r.code}`} className={`flex flex-col gap-1 rounded-lg border p-3 ${r.isActive ? "bg-card" : "bg-muted text-muted-foreground"}`}>
                <span className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-semibold">
                    {d.ageGroups[r.ageGroup].replace(/ \(.*\)$/, "")} · {ageText(r, d)}
                  </span>
                  <span className={`rounded-full px-2.5 py-0.5 text-sm font-semibold ${r.isActive ? "bg-success-subtle text-success" : "bg-muted text-neutral"}`}>
                    {r.isActive ? d.onSale : d.offSale}
                  </span>
                </span>
                <span className="text-xl font-bold tabular-nums">{r.price === 0 ? d.free : kip(r.price)}</span>
                <span className="text-sm">{r.nameLo}</span>
                <span className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm text-muted-foreground">
                    {r.code} · {t(d.order, { n: r.sortOrder })}
                  </span>
                  <Button type="button" variant="outline" className="min-h-11" onClick={() => editTicket(r)}>
                    <Pencil aria-hidden />
                    {sd.edit}
                  </Button>
                </span>
              </li>
            ))}
          </ul>
        ))}

      {mode === "addons" &&
        (addOns.length === 0 ? (
          <p className="rounded-lg border border-dashed p-6">{d.emptyAddOns}</p>
        ) : (
          <ul className="grid gap-2 md:grid-cols-2">
            {addOns.map((a) => (
              <li key={a.id} data-testid={`addon-${a.code}`} className={`flex flex-col gap-1 rounded-lg border p-3 ${a.isActive ? "bg-card" : "bg-muted text-muted-foreground"}`}>
                <span className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-semibold">{a.nameLo}</span>
                  <span className={`rounded-full px-2.5 py-0.5 text-sm font-semibold ${a.isActive ? "bg-success-subtle text-success" : "bg-muted text-neutral"}`}>
                    {a.isActive ? d.onSale : d.offSale}
                  </span>
                </span>
                <span className="text-xl font-bold tabular-nums">
                  {kip(a.price)} <span className="text-sm font-normal">{d.units[a.unit]}</span>
                </span>
                <span className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm text-muted-foreground">{a.code}</span>
                  <Button type="button" variant="outline" className="min-h-11" onClick={() => editAddOn(a)}>
                    <Pencil aria-hidden />
                    {sd.edit}
                  </Button>
                </span>
              </li>
            ))}
          </ul>
        ))}

      <Dialog open={form !== null} onOpenChange={(o) => !o && setForm(null)}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto">
          <DialogTitle>{form?.id ? t(d.editTitle, { name: form.nameLo }) : mode === "tickets" ? d.addTicket : d.addAddOn}</DialogTitle>
          <DialogDescription className={form?.lockedLabel ? "text-sm" : "sr-only"}>{form?.lockedLabel ?? d.intro}</DialogDescription>
          {form && (
            <form className="flex flex-col gap-3" onSubmit={submit}>
              {!form.id && (
                <div className="grid grid-cols-2 gap-3">
                  <label className="flex flex-col gap-1">
                    <span className="font-semibold">{d.code}</span>
                    <Input
                      className="min-h-11 text-base uppercase"
                      required
                      maxLength={30}
                      pattern="[A-Za-z][A-Za-z0-9_]{1,29}"
                      autoCapitalize="characters"
                      autoComplete="off"
                      value={form.code}
                      aria-invalid={bad("code")}
                      onChange={(e) => set({ code: e.target.value })}
                    />
                  </label>
                  {mode === "tickets" ? (
                    <label className="flex flex-col gap-1">
                      <span className="font-semibold">{d.ageGroup}</span>
                      <select className={selectClass} value={form.ageGroup} onChange={(e) => set({ ageGroup: e.target.value as AgeGroup, ...(e.target.value === "free" && { price: "0" }) })}>
                        {(Object.keys(d.ageGroups) as AgeGroup[]).map((k) => (
                          <option key={k} value={k}>
                            {d.ageGroups[k]}
                          </option>
                        ))}
                      </select>
                    </label>
                  ) : (
                    <label className="flex flex-col gap-1">
                      <span className="font-semibold">{d.unit}</span>
                      <select className={selectClass} value={form.unit} onChange={(e) => set({ unit: e.target.value as Unit })}>
                        {(Object.keys(d.units) as Unit[]).map((k) => (
                          <option key={k} value={k}>
                            {d.units[k]}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                  {mode === "tickets" && <p className="col-span-2 text-sm text-muted-foreground">{t(d.locked, { code: form.code || "…", group: d.groups[group], age: d.ageGroups[form.ageGroup] })}</p>}
                </div>
              )}
              <label className="flex flex-col gap-1">
                <span className="font-semibold">{d.price}</span>
                <Input
                  className="min-h-11 text-base tabular-nums"
                  inputMode="numeric"
                  required
                  value={form.price}
                  aria-invalid={bad("price")}
                  aria-describedby="price-hint"
                  onChange={(e) => set({ price: e.target.value.replace(/[^\d]/g, "").slice(0, 8) })}
                />
                <span id="price-hint" className="text-sm text-muted-foreground">
                  {[approx && t(d.approx, { amount: approx }), mode === "tickets" ? d.freeHint : null].filter(Boolean).join(" · ")}
                </span>
              </label>
              {mode === "tickets" && (
                <div className="grid grid-cols-2 gap-3">
                  <label className="flex flex-col gap-1">
                    <span className="font-semibold">{d.ageMin}</span>
                    <Input className="min-h-11 text-base" type="number" inputMode="numeric" min={0} max={120} value={form.ageMin} aria-invalid={bad("ageMin")} onChange={(e) => set({ ageMin: e.target.value })} />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="font-semibold">{d.ageMax}</span>
                    <Input className="min-h-11 text-base" type="number" inputMode="numeric" min={0} max={120} value={form.ageMax} aria-invalid={bad("ageMax")} onChange={(e) => set({ ageMax: e.target.value })} />
                  </label>
                  <p className="col-span-2 text-sm text-muted-foreground">{d.ageHint}</p>
                </div>
              )}
              {text("nameLo", true)}
              {text("nameEn", true)}
              {text("nameZh", false)}
              {text("nameTh", false)}
              <div className="grid grid-cols-2 items-end gap-3">
                {mode === "tickets" && (
                  <label className="flex flex-col gap-1">
                    <span className="font-semibold">{d.sortOrder}</span>
                    <Input className="min-h-11 text-base" type="number" inputMode="numeric" min={0} max={999} value={form.sortOrder} onChange={(e) => set({ sortOrder: e.target.value })} />
                  </label>
                )}
                <label className="flex min-h-11 items-center gap-2">
                  <input type="checkbox" className="size-5 accent-primary" checked={form.isActive} onChange={(e) => set({ isActive: e.target.checked })} />
                  <span>{d.isActive}</span>
                </label>
              </div>
              <SaveFeedback s={s} d={sd} />
              <DialogFooter className="gap-2">
                <Button type="button" variant="outline" className="min-h-11" onClick={() => setForm(null)}>
                  {sd.cancel}
                </Button>
                <Button type="submit" className="min-h-11" disabled={s.busy}>
                  {sd.save}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
