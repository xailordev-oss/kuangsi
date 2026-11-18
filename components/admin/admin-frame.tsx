import Link from "next/link";
import { StaffHeader } from "@/components/staff/staff-header";
import { StaffNav } from "@/components/staff/staff-nav";
import type { StaffUser } from "@/lib/auth/dal";
import type { StaffDictionary, StaffLocale } from "@/lib/i18n/staff";

export function AdminFrame({
  user,
  locale,
  dict,
  current,
  title,
  children,
}: {
  user: StaffUser;
  locale: StaffLocale;
  dict: StaffDictionary;
  current: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div lang={locale} className="flex flex-1 flex-col">
      <StaffHeader title={dict.common.siteName} staffName={user.fullName} locale={locale} dict={dict} />
      <StaffNav role={user.role} current={current} dict={dict} />
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-4 px-4 py-4">
        <h1 className="text-xl font-bold">{title}</h1>
        {children}
      </main>
    </div>
  );
}

export function StatTile({ label, value, hint, tone = "default", href }: { label: string; value: string; hint?: string; tone?: "default" | "warn"; href?: string }) {
  const body = (
    <>
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="text-2xl font-bold tabular-nums">{value}</p>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </>
  );
  const className = `flex flex-col gap-0.5 rounded-lg border p-3 ${tone === "warn" ? "border-warning/50 bg-warning-subtle" : "bg-card"}`;
  return href ? (
    <Link href={href} className={`${className} hover:border-primary`}>
      {body}
    </Link>
  ) : (
    <div className={className}>{body}</div>
  );
}

// ກຣາຟແທ່ງ CSS (ບໍ່ໃຊ້ chart library — ນອກ stack) · ຕົວເລກສະແດງເປັນຂໍ້ຄວາມສະເໝີ (ບໍ່ອີງແຕ່ຄວາມຍາວແທ່ງ)
export function BarList({ rows, label }: { rows: { label: string; value: number; display: string }[]; label: string }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <ul aria-label={label} className="flex flex-col gap-1.5">
      {rows.map((r) => (
        <li key={r.label} className="grid grid-cols-[minmax(5rem,9rem)_1fr_auto] items-center gap-2">
          <span className="truncate text-sm">{r.label}</span>
          <span aria-hidden className="h-3 rounded-sm bg-muted">
            <span className="block h-3 rounded-sm bg-primary" style={{ width: `${(r.value / max) * 100}%` }} />
          </span>
          <span className="text-sm font-semibold tabular-nums">{r.display}</span>
        </li>
      ))}
    </ul>
  );
}

export function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2 rounded-lg border bg-card p-4">
      <div>
        <h2 className="text-lg font-semibold">{title}</h2>
        {hint && <p className="text-sm text-muted-foreground">{hint}</p>}
      </div>
      {children}
    </section>
  );
}

const STATUS_TONE: Record<string, string> = {
  pending: "bg-warning-subtle text-warning",
  verifying: "bg-warning-subtle text-warning",
  paid: "bg-success-subtle text-success",
  success: "bg-success-subtle text-success",
  ok: "bg-success-subtle text-success",
  failed: "bg-destructive-subtle text-destructive",
};

// ຂໍ້ຄວາມສະເໝີ (ບໍ່ອີງແຕ່ສີ)
export function StatusPill({ status, label }: { status: string; label: string }) {
  return (
    <span className={`inline-flex w-fit items-center rounded-full px-2.5 py-0.5 text-sm font-semibold ${STATUS_TONE[status] ?? "bg-muted text-neutral"}`}>
      {label}
    </span>
  );
}

type Flow = { label: string; received: number; refunded: number; net: number };

// ຂໍ້ຕົກລົງ 44: ສະແດງ ຮັບ · ຄືນ · ສຸດທິ ແຍກກັນສະເໝີ (ບໍ່ສະແດງແຕ່ສຸດທິ) — ຫົວຖັນບອກໜ່ວຍ ຕົວເລກບໍ່ມີໜ່ວຍ (ພໍດີຈໍ 375px)
export function FlowTable({
  rows,
  total,
  heads,
  caption,
}: {
  rows: Flow[];
  total?: Flow;
  heads: { received: string; refunded: string; net: string; unit: string };
  caption: string;
}) {
  const n = (v: number) => new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(v);
  const line = (r: Flow, strong = false) => (
    <div key={r.label} role="row" className={`flex flex-col gap-0.5 border-b py-1.5 last:border-b-0 ${strong ? "font-semibold" : ""}`}>
      <span role="rowheader" className="text-sm">
        {r.label}
      </span>
      <span className="grid grid-cols-3 gap-2 text-right tabular-nums">
        <span role="cell">{n(r.received)}</span>
        <span role="cell" className={r.refunded > 0 ? "text-destructive" : "text-muted-foreground"}>
          {r.refunded > 0 ? `−${n(r.refunded)}` : "0"}
        </span>
        <span role="cell">{n(r.net)}</span>
      </span>
    </div>
  );
  return (
    <div role="table" aria-label={caption} className="flex flex-col">
      <div role="row" className="grid grid-cols-3 gap-2 border-b pb-1 text-right text-xs text-muted-foreground">
        <span role="columnheader">
          {heads.received} ({heads.unit})
        </span>
        <span role="columnheader">
          {heads.refunded} ({heads.unit})
        </span>
        <span role="columnheader">
          {heads.net} ({heads.unit})
        </span>
      </div>
      {rows.map((r) => line(r))}
      {total && line(total, true)}
    </div>
  );
}
