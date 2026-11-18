"use client";

import { Trash2 } from "lucide-react";
import { useState } from "react";
import { BookingLinks, fmtDate, formatAmount, SaveFeedback, useSettingsSave, type SD } from "@/components/admin/settings/save-kit";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { t } from "@/lib/i18n/format";

type Day = { dayOfWeek: number; open: string; close: string; closed: boolean };

// ເວລາເປີດ-ປິດ 7 ວັນ — ປິດ / ຫຍໍ້ວັນທີ່ມີການຈອງ → server ຕອບ confirm_required ພ້ອມຈຳນວນ
export function HoursForm({ initial, d }: { initial: Day[]; d: SD }) {
  const [days, setDays] = useState(initial);
  const s = useSettingsSave(d);
  const h = d.hours;
  const update = (dow: number, patch: Partial<Day>) => setDays((x) => x.map((r) => (r.dayOfWeek === dow ? { ...r, ...patch } : r)));
  const bad = days.some((r) => !r.closed && r.close <= r.open);

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        void s.send("/api/admin/settings/hours", "PUT", { days });
      }}
    >
      <p className="text-muted-foreground">{h.intro}</p>
      <ul className="flex flex-col gap-2">
        {days.map((r) => {
          const wrong = !r.closed && r.close <= r.open;
          return (
            <li key={r.dayOfWeek} data-testid={`dow-${r.dayOfWeek}`} className="flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-center">
              <span className="w-20 font-semibold">{d.weekdays[r.dayOfWeek]}</span>
              <label className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">{h.open}</span>
                <Input type="time" className="min-h-11 w-32 text-base" value={r.open} disabled={r.closed} required onChange={(e) => update(r.dayOfWeek, { open: e.target.value })} />
              </label>
              <label className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">{h.close}</span>
                <Input
                  type="time"
                  className="min-h-11 w-32 text-base"
                  value={r.close}
                  disabled={r.closed}
                  required
                  aria-invalid={wrong || undefined}
                  onChange={(e) => update(r.dayOfWeek, { close: e.target.value })}
                />
              </label>
              <label className="flex min-h-11 items-center gap-2">
                <input type="checkbox" className="size-5 accent-primary" checked={r.closed} onChange={(e) => update(r.dayOfWeek, { closed: e.target.checked })} />
                <span>{h.closedDay}</span>
              </label>
              {wrong && <span className="text-sm text-destructive">{h.closeBeforeOpen}</span>}
            </li>
          );
        })}
      </ul>
      <SaveFeedback s={s} d={d} />
      <Button type="submit" className="min-h-11 w-fit" disabled={s.busy || bad}>
        {s.busy ? d.saving : d.save}
      </Button>
    </form>
  );
}

type Holiday = { id: string; date: string; nameLo: string; nameEn: string | null; isClosed: boolean; past: boolean; bookings: { code: string; status: string; people: number }[] };

export function HolidaysManager({ holidays, today, d }: { holidays: Holiday[]; today: string; d: SD }) {
  const s = useSettingsSave(d);
  const h = d.holidays;
  const [form, setForm] = useState({ date: today, nameLo: "", nameEn: "", isClosed: true });
  const [deleting, setDeleting] = useState<Holiday | null>(null);

  return (
    <div className="flex flex-col gap-4">
      <p className="text-muted-foreground">{h.intro}</p>
      <form
        className="grid gap-3 rounded-lg border p-3 sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          void s.send("/api/admin/settings/holidays", "POST", form, () => setForm((f) => ({ ...f, nameLo: "", nameEn: "" })));
        }}
      >
        <label className="flex flex-col gap-1">
          <span className="font-semibold">{h.date}</span>
          <Input type="date" min={today} required className="min-h-11 text-base" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-semibold">{h.nameLo}</span>
          <Input required maxLength={100} className="min-h-11 text-base" value={form.nameLo} onChange={(e) => setForm({ ...form, nameLo: e.target.value })} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-semibold">{h.nameEn}</span>
          <Input maxLength={100} className="min-h-11 text-base" value={form.nameEn} onChange={(e) => setForm({ ...form, nameEn: e.target.value })} />
        </label>
        <label className="flex min-h-11 items-center gap-2 self-end">
          <input type="checkbox" className="size-5 accent-primary" checked={form.isClosed} onChange={(e) => setForm({ ...form, isClosed: e.target.checked })} />
          <span>{h.isClosed}</span>
        </label>
        <div className="sm:col-span-2">
          <Button type="submit" className="min-h-11" disabled={s.busy}>
            {d.add}
          </Button>
        </div>
      </form>
      <SaveFeedback s={s} d={d} />
      {holidays.length === 0 ? (
        <p className="rounded-lg border border-dashed p-6">{h.empty}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {holidays.map((x) => (
            <li key={x.id} data-testid={`holiday-${x.date}`} className={`flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 ${x.past ? "bg-muted text-muted-foreground" : "bg-card"}`}>
              <span className="flex flex-col">
                <span className="font-semibold">{fmtDate(x.date, d)}</span>
                <span>
                  {x.nameLo}
                  {x.nameEn && <span className="text-muted-foreground"> · {x.nameEn}</span>}
                </span>
              </span>
              <span className="flex items-center gap-2">
                <span className={`rounded-full px-2.5 py-0.5 text-sm font-semibold ${x.isClosed ? "bg-destructive-subtle text-destructive" : "bg-primary-subtle text-primary"}`}>
                  {x.isClosed ? h.closed : h.openSpecial}
                </span>
                {x.past ? (
                  <span className="text-sm">{h.past}</span>
                ) : (
                  <Button type="button" variant="outline" className="min-h-11" disabled={s.busy} onClick={() => setDeleting(x)}>
                    <Trash2 aria-hidden />
                    {d.delete}
                  </Button>
                )}
              </span>
              {x.bookings.length > 0 && (
                <div className="w-full">
                  <BookingLinks bookings={x.bookings} d={d} />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      <Dialog open={deleting !== null} onOpenChange={(o) => !o && setDeleting(null)}>
        <DialogContent>
          <DialogTitle>{d.delete}</DialogTitle>
          <DialogDescription className="text-base">{deleting && t(h.confirmDelete, { name: deleting.nameLo, date: fmtDate(deleting.date, d) })}</DialogDescription>
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
                void s.send(`/api/admin/settings/holidays/${id}`, "DELETE");
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

type Override = { date: string; maxVisitors: number; people: number };

// ຈຳນວນຮັບສະເພາະວັນ — ຕັ້ງຕ່ຳກວ່າທີ່ຈອງແລ້ວ → ເຕືອນ + ຢືນຢັນ (ບໍ່ຫ້າມ)
export function CapacityOverrides({ overrides, today, d }: { overrides: Override[]; today: string; d: SD }) {
  const s = useSettingsSave(d);
  const c = d.capacity;
  const [form, setForm] = useState({ date: today, max: "" });

  return (
    <div className="flex flex-col gap-3">
      <div>
        <h2 className="text-lg font-semibold">{c.overrides}</h2>
        <p className="text-sm text-muted-foreground">{c.overridesHint}</p>
      </div>
      <form
        className="grid grid-cols-2 gap-3 rounded-lg border p-3 sm:grid-cols-3"
        onSubmit={(e) => {
          e.preventDefault();
          void s.send("/api/admin/settings/capacity", "PUT", { date: form.date, maxVisitors: Number(form.max) }, () => setForm({ ...form, max: "" }));
        }}
      >
        <label className="flex flex-col gap-1">
          <span className="font-semibold">{c.date}</span>
          <Input type="date" min={today} required className="min-h-11 text-base" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-semibold">{c.max}</span>
          <Input type="number" inputMode="numeric" min={1} step={1} required className="min-h-11 text-base" value={form.max} onChange={(e) => setForm({ ...form, max: e.target.value })} />
        </label>
        <div className="col-span-2 flex items-end sm:col-span-1">
          <Button type="submit" className="min-h-11 w-full" disabled={s.busy}>
            {d.save}
          </Button>
        </div>
      </form>
      <SaveFeedback s={s} d={d} />
      {overrides.length === 0 ? (
        <p className="rounded-lg border border-dashed p-6">{c.empty}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {overrides.map((o) => (
            <li key={o.date} data-testid={`override-${o.date}`} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-card p-3">
              <span className="flex flex-col">
                <span className="font-semibold">{fmtDate(o.date, d)}</span>
                <span>
                  {formatAmount(o.maxVisitors)} · <span className={o.people > o.maxVisitors ? "font-semibold text-warning" : "text-muted-foreground"}>{t(c.booked, { n: formatAmount(o.people) })}</span>
                </span>
              </span>
              <span className="flex gap-2">
                <Button type="button" variant="outline" className="min-h-11" onClick={() => setForm({ date: o.date, max: String(o.maxVisitors) })}>
                  {d.edit}
                </Button>
                <Button type="button" variant="outline" className="min-h-11" disabled={s.busy} onClick={() => void s.send("/api/admin/settings/capacity", "PUT", { date: o.date, maxVisitors: null })}>
                  {c.reset}
                </Button>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
