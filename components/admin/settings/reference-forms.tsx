"use client";

import { MapPin, Pencil, Plus, Trash2 } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { fmtDate, formatAmount, SaveFeedback, useSettingsSave, type SD } from "@/components/admin/settings/save-kit";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { t } from "@/lib/i18n/format";

const selectClass = "min-h-11 w-full rounded-md border border-input bg-background px-2 text-base";

type Rate = { id: string; currency: string; lakPerUnit: string; effectiveDate: string; status: "current" | "future" | "old"; editable: boolean; deletable: boolean };

// ອັດຕາແລກປ່ຽນ (ຂໍ້ຕົກລົງ 49): ມື້ນີ້ / ອະນາຄົດ ແກ້ໄດ້ (ວັນທີ + ສະກຸນເດີມ = ແທນທີ່) · ຜ່ານມາແລ້ວ ອ່ານຢ່າງດຽວ · server ຂໍຢືນຢັນທຸກຄັ້ງ
export function RatesManager({ rates, currencies, today, d }: { rates: Rate[]; currencies: readonly string[]; today: string; d: SD }) {
  const s = useSettingsSave(d);
  const r = d.rates;
  const [form, setForm] = useState({ currency: currencies[0], lakPerUnit: "", effectiveDate: today });
  const [deleting, setDeleting] = useState<Rate | null>(null);

  return (
    <div className="flex flex-col gap-4">
      <p className="text-muted-foreground">{r.intro}</p>
      <form
        className="grid grid-cols-2 gap-3 rounded-lg border p-3 sm:grid-cols-4"
        onSubmit={(e) => {
          e.preventDefault();
          void s.send("/api/admin/settings/rates", "POST", { ...form, lakPerUnit: form.lakPerUnit.replace(/,/g, "") }, () => setForm({ ...form, lakPerUnit: "" }));
        }}
      >
        <label className="flex flex-col gap-1">
          <span className="font-semibold">{r.currency}</span>
          <select className={selectClass} value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })}>
            {currencies.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-semibold">{r.lakPerUnit}</span>
          <Input
            inputMode="decimal"
            required
            pattern="[0-9,]+(\.[0-9]{1,6})?"
            className="min-h-11 text-base"
            value={form.lakPerUnit}
            aria-invalid={s.badFields.has("lakPerUnit") || undefined}
            onChange={(e) => setForm({ ...form, lakPerUnit: e.target.value })}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-semibold">{r.effectiveDate}</span>
          <Input type="date" min={today} required className="min-h-11 text-base" value={form.effectiveDate} onChange={(e) => setForm({ ...form, effectiveDate: e.target.value })} />
        </label>
        <div className="flex items-end">
          <Button type="submit" className="min-h-11 w-full" disabled={s.busy}>
            {d.save}
          </Button>
        </div>
        <p className="col-span-2 text-sm text-muted-foreground sm:col-span-4">{r.formHint}</p>
      </form>
      <SaveFeedback s={s} d={d} />
      {rates.length === 0 ? (
        <p className="rounded-lg border border-dashed p-6">{r.empty}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {rates.map((x) => (
            <li key={x.id} data-testid={`rate-${x.currency}-${x.effectiveDate}`} className={`flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 ${x.status === "old" ? "text-muted-foreground" : "bg-card"}`}>
              <span className="flex flex-col">
                <span className="font-semibold">{t(r.line, { currency: x.currency, rate: formatAmount(x.lakPerUnit) })}</span>
                <span className="text-sm">{fmtDate(x.effectiveDate, d)}</span>
              </span>
              <span className="flex items-center gap-2">
                {x.status !== "old" && (
                  <span className={`rounded-full px-2.5 py-0.5 text-sm font-semibold ${x.status === "current" ? "bg-success-subtle text-success" : "bg-warning-subtle text-warning"}`}>
                    {x.status === "current" ? r.current : r.future}
                  </span>
                )}
                {x.editable ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="min-h-11"
                    onClick={() => setForm({ currency: x.currency, lakPerUnit: x.lakPerUnit, effectiveDate: x.effectiveDate })}
                  >
                    <Pencil aria-hidden />
                    {d.edit}
                  </Button>
                ) : null}
                {x.deletable && (
                  <Button type="button" variant="outline" className="min-h-11" disabled={s.busy} onClick={() => setDeleting(x)}>
                    <Trash2 aria-hidden />
                    {d.delete}
                  </Button>
                )}
                {!x.editable && (
                  <span className="text-sm">{r.locked}</span>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
      <Dialog open={deleting !== null} onOpenChange={(o) => !o && setDeleting(null)}>
        <DialogContent>
          <DialogTitle>{d.delete}</DialogTitle>
          <DialogDescription className="text-base">
            {deleting && t(r.confirmDelete, { line: t(r.line, { currency: deleting.currency, rate: formatAmount(deleting.lakPerUnit) }), date: fmtDate(deleting.effectiveDate, d) })}
          </DialogDescription>
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" className="min-h-11" onClick={() => setDeleting(null)}>
              {d.cancel}
            </Button>
            <Button
              type="button"
              variant="destructive"
              className="min-h-11"
              onClick={() => {
                const id = deleting!.id;
                setDeleting(null);
                void s.send(`/api/admin/settings/rates/${id}`, "DELETE");
              }}
            >
              {d.delete}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

type Place = {
  id: string;
  nameLo: string;
  nameEn: string;
  nameZh: string | null;
  nameTh: string | null;
  type: "hotel" | "landmark" | "airport";
  lat: number;
  lng: number;
  distanceKm: number | null;
  isActive: boolean;
};
type PlaceForm = { nameLo: string; nameEn: string; nameZh: string; nameTh: string; type: Place["type"]; lat: string; lng: string };
const EMPTY: PlaceForm = { nameLo: "", nameEn: "", nameZh: "", nameTh: "", type: "hotel", lat: "", lng: "" };

// ສະຖານທີ່ — ປິດດ້ວຍ is_active ບໍ່ລຶບ (ຄຳຖາມ B4) · ປ່ຽນພິກັດ → server ລ້າງໄລຍະທາງ
export function PlacesManager({ places, d }: { places: Place[]; d: SD }) {
  const s = useSettingsSave(d);
  const p = d.places;
  const [editing, setEditing] = useState<{ id: string | null; form: PlaceForm } | null>(null);

  function save(e: React.FormEvent) {
    e.preventDefault();
    if (!editing) return;
    const { form, id } = editing;
    const body = { ...form, lat: Number(form.lat), lng: Number(form.lng) };
    const done = () => setEditing(null);
    if (id) void s.send(`/api/admin/settings/places/${id}`, "PATCH", { action: "edit", ...body }, done);
    else void s.send("/api/admin/settings/places", "POST", body, done);
  }

  const field = (key: keyof PlaceForm, label: string, extra: React.ComponentProps<typeof Input> = {}) => (
    <label className="flex flex-col gap-1">
      <span className="font-semibold">{label}</span>
      <Input
        className="min-h-11 text-base"
        value={editing?.form[key] ?? ""}
        aria-invalid={s.badFields.has(key) || undefined}
        onChange={(e) => setEditing((x) => x && { ...x, form: { ...x.form, [key]: e.target.value } })}
        {...extra}
      />
    </label>
  );

  return (
    <div className="flex flex-col gap-4">
      <p className="text-muted-foreground">{p.intro}</p>
      <Button type="button" className="min-h-11 w-fit" onClick={() => setEditing({ id: null, form: EMPTY })}>
        <Plus aria-hidden />
        {p.addTitle}
      </Button>
      {!editing && <SaveFeedback s={s} d={d} />}
      {places.length === 0 ? (
        <p className="rounded-lg border border-dashed p-6">{p.empty}</p>
      ) : (
        <ul className="grid gap-2 md:grid-cols-2">
          {places.map((x) => (
            <li key={x.id} className={`flex flex-col gap-1 rounded-lg border p-3 ${x.isActive ? "bg-card" : "bg-muted text-muted-foreground"}`}>
              <span className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-semibold">{x.nameLo}</span>
                <span className="flex gap-1">
                  <span className="rounded-full bg-primary-subtle px-2.5 py-0.5 text-sm font-semibold text-primary">{p.types[x.type]}</span>
                  {!x.isActive && <span className="rounded-full bg-muted px-2.5 py-0.5 text-sm font-semibold text-neutral">{p.inactive}</span>}
                </span>
              </span>
              <span className="text-sm">{x.nameEn}</span>
              <span className="flex items-center gap-1 text-sm text-muted-foreground">
                <MapPin aria-hidden className="size-4" />
                {x.lat}, {x.lng}
              </span>
              <span className="text-sm">{x.distanceKm === null ? p.noDistance : t(p.distance, { km: formatAmount(x.distanceKm) })}</span>
              <span className="flex flex-wrap gap-2 pt-1">
                <Button
                  type="button"
                  variant="outline"
                  className="min-h-11"
                  onClick={() =>
                    setEditing({
                      id: x.id,
                      form: { nameLo: x.nameLo, nameEn: x.nameEn, nameZh: x.nameZh ?? "", nameTh: x.nameTh ?? "", type: x.type, lat: String(x.lat), lng: String(x.lng) },
                    })
                  }
                >
                  <Pencil aria-hidden />
                  {d.edit}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="min-h-11"
                  disabled={s.busy}
                  onClick={() => void s.send(`/api/admin/settings/places/${x.id}`, "PATCH", { action: x.isActive ? "deactivate" : "activate" })}
                >
                  {x.isActive ? p.deactivate : p.activate}
                </Button>
              </span>
            </li>
          ))}
        </ul>
      )}
      <Dialog open={editing !== null} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto">
          <DialogTitle>{editing?.id ? p.editTitle : p.addTitle}</DialogTitle>
          <form className="flex flex-col gap-3" onSubmit={save}>
            {field("nameLo", p.nameLo, { required: true, maxLength: 150 })}
            {field("nameEn", p.nameEn, { required: true, maxLength: 150 })}
            {field("nameZh", p.nameZh, { maxLength: 150 })}
            {field("nameTh", p.nameTh, { maxLength: 150 })}
            <label className="flex flex-col gap-1">
              <span className="font-semibold">{p.type}</span>
              <select
                className={selectClass}
                value={editing?.form.type}
                onChange={(e) => setEditing((x) => x && { ...x, form: { ...x.form, type: e.target.value as Place["type"] } })}
              >
                {(["hotel", "landmark", "airport"] as const).map((k) => (
                  <option key={k} value={k}>
                    {p.types[k]}
                  </option>
                ))}
              </select>
            </label>
            <div className="grid grid-cols-2 gap-3">
              {field("lat", p.lat, { required: true, inputMode: "decimal" })}
              {field("lng", p.lng, { required: true, inputMode: "decimal" })}
            </div>
            <p className="text-sm text-muted-foreground">{p.coordHint}</p>
            {editing?.id && <p className="text-sm text-muted-foreground">{p.coordReset}</p>}
            <SaveFeedback s={s} d={d} />
            <DialogFooter className="gap-2">
              <Button type="button" variant="outline" className="min-h-11" onClick={() => setEditing(null)}>
                {d.cancel}
              </Button>
              <Button type="submit" className="min-h-11" disabled={s.busy}>
                {d.save}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ຢູ່ຈໍນ້ອຍ: ລາຍການ tab ເປັນ select (wireframe 10b)
export function TabSelect({ tabs, current, label }: { tabs: { key: string; label: string }[]; current: string; label: string }) {
  const router = useRouter();
  const pathname = usePathname();
  return (
    <label className="flex flex-col gap-1 md:hidden">
      <span className="text-sm text-muted-foreground">{label}</span>
      <select className={selectClass} value={current} onChange={(e) => router.push(`${pathname}?tab=${e.target.value}`)}>
        {tabs.map((x) => (
          <option key={x.key} value={x.key}>
            {x.label}
          </option>
        ))}
      </select>
    </label>
  );
}
