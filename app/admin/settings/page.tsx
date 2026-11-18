import Link from "next/link";
import { Suspense } from "react";
import { AdminFrame } from "@/components/admin/admin-frame";
import { CapacityOverrides, HolidaysManager, HoursForm } from "@/components/admin/settings/calendar-forms";
import { SettingsGroupForm, type FieldSpec } from "@/components/admin/settings/group-form";
import { PlacesManager, RatesManager, TabSelect } from "@/components/admin/settings/reference-forms";
import { Skeleton } from "@/components/ui/skeleton";
import { lastEdit, listAdminAudit } from "@/lib/admin/audit";
import { staffPage } from "@/lib/admin/page";
import { listPlaces, listRates } from "@/lib/admin/reference-data";
import {
  groupKeys,
  listCapacityOverrides,
  listHolidays,
  listOperatingHours,
  missingBankKeys,
  readSettings,
  type SettingGroup,
} from "@/lib/admin/settings";
import { DISPLAY_CURRENCIES } from "@/lib/exchange";
import { formatDateTime, t } from "@/lib/i18n/format";
import type { StaffDictionary, StaffLocale } from "@/lib/i18n/staff";
import { INT_SETTINGS, type IntSettingKey } from "@/lib/settings";
import { todayInVientiane } from "@/lib/time";

const TABS = ["hours", "holidays", "capacity", "online", "bank", "pos", "rates", "places", "system", "history"] as const;
type Tab = (typeof TABS)[number];

const TAB_ACTIONS: Record<Exclude<Tab, "history">, string[]> = {
  hours: ["operating_hours.update"],
  holidays: ["holiday.create", "holiday.delete"],
  capacity: ["settings.capacity", "capacity.set", "capacity.delete"],
  online: ["settings.online"],
  bank: ["settings.bank"],
  pos: ["settings.pos"],
  rates: ["exchange_rate.create"],
  places: ["place.create", "place.update", "place.deactivate", "place.activate"],
  system: ["settings.system"],
};

function specs(group: SettingGroup): FieldSpec[] {
  return groupKeys(group).map((key) => {
    if (key in INT_SETTINGS) return { key, kind: "int", ...INT_SETTINGS[key as IntSettingKey] };
    if (key === "gates") return { key, kind: "gates", maxLength: 300 };
    if (key === "pos_auto_checkin" || key.startsWith("translations_reviewed_")) return { key, kind: "bool" };
    if (key.startsWith("verify_time_note_")) return { key, kind: "textarea", maxLength: 300 };
    return { key, kind: "text", maxLength: key === "bank_account_number" ? 50 : 150 };
  });
}

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default function AdminSettingsPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <Suspense fallback={<Skeleton className="m-4 h-96" />}>
      <SettingsView searchParams={searchParams} />
    </Suspense>
  );
}

async function SettingsView({ searchParams }: { searchParams: SearchParams }) {
  const { user, locale, dict } = await staffPage("settings.manage", "/admin/settings");
  const d = dict.admin.settings;
  const raw = (await searchParams).tab;
  const tab: Tab = TABS.includes(raw as Tab) ? (raw as Tab) : "hours";
  const tabs = TABS.map((key) => ({ key, label: d.tabs[key] }));
  const edited = tab === "history" ? null : await lastEdit(TAB_ACTIONS[tab]);

  return (
    <AdminFrame user={user} locale={locale} dict={dict} current="/admin/settings" title={d.title}>
      <TabSelect tabs={tabs} current={tab} label={d.tabLabel} />
      <nav aria-label={d.tabLabel} className="hidden flex-wrap gap-1 md:flex">
        {tabs.map((x) => (
          <Link
            key={x.key}
            href={`/admin/settings?tab=${x.key}`}
            aria-current={x.key === tab ? "page" : undefined}
            className={`rounded-full px-3 py-1.5 text-sm font-semibold ${x.key === tab ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-primary-subtle"}`}
          >
            {x.label}
          </Link>
        ))}
      </nav>
      <section className="flex flex-col gap-4 rounded-lg border bg-card p-4" aria-labelledby="tab-title">
        <div className="flex flex-col">
          <h2 id="tab-title" className="text-lg font-semibold">
            {d.tabs[tab]}
          </h2>
          {tab !== "history" && (
            <p className="text-sm text-muted-foreground">{edited ? t(d.lastEdit, { by: edited.by, time: formatDateTime(edited.at, locale) }) : d.neverEdited}</p>
          )}
        </div>
        <TabBody tab={tab} d={d} locale={locale} />
      </section>
    </AdminFrame>
  );
}

async function TabBody({ tab, d, locale }: { tab: Tab; d: StaffDictionary["admin"]["settings"]; locale: StaffLocale }) {
  const today = todayInVientiane();
  switch (tab) {
    case "hours":
      return <HoursForm initial={await listOperatingHours()} d={d} />;
    case "holidays":
      return <HolidaysManager holidays={await listHolidays()} today={today} d={d} />;
    case "capacity": {
      const [values, overrides] = await Promise.all([readSettings(groupKeys("capacity")), listCapacityOverrides()]);
      return (
        <>
          <SettingsGroupForm group="capacity" fields={specs("capacity")} initial={values} d={d} />
          <hr />
          <CapacityOverrides overrides={overrides} today={today} d={d} />
        </>
      );
    }
    case "bank": {
      const values = await readSettings(groupKeys("bank"));
      const missing = missingBankKeys(values);
      return (
        <>
          {/* ຂໍ້ຕົກລົງ 28: ສະຖານະການຈອງ online ຕາມຂໍ້ມູນທີ່ບັນທຶກແລ້ວ */}
          <p
            data-testid="online-status"
            className={`rounded-lg border p-3 font-semibold ${missing.length ? "border-warning/50 bg-warning-subtle text-warning" : "border-success/40 bg-success-subtle text-success"}`}
          >
            {missing.length ? t(d.bank.statusClosed, { missing: missing.map((k) => (d.fields as Record<string, string>)[k]).join(", ") }) : d.bank.statusOpen}
          </p>
          <SettingsGroupForm group="bank" fields={specs("bank")} initial={values} d={d} />
        </>
      );
    }
    case "online":
    case "pos":
    case "system":
      return <SettingsGroupForm group={tab} fields={specs(tab)} initial={await readSettings(groupKeys(tab))} d={d} />;
    case "rates": {
      const seen = new Set<string>();
      // ອັນໃໝ່ສຸດທີ່ມີຜົນແລ້ວ = ໃຊ້ຢູ່ · ມື້ນີ້ / ອະນາຄົດ ແກ້ໄດ້ · ອະນາຄົດເທົ່ານັ້ນ ລຶບໄດ້ (ຂໍ້ຕົກລົງ 49)
      const rates = (await listRates()).map((r) => {
        let status: "current" | "future" | "old" = "old";
        if (r.effectiveDate > today) status = "future";
        else if (!seen.has(r.currency)) {
          seen.add(r.currency);
          status = "current";
        }
        return { ...r, status, editable: r.effectiveDate >= today, deletable: r.effectiveDate > today };
      });
      return <RatesManager rates={rates} currencies={DISPLAY_CURRENCIES} today={today} d={d} />;
    }
    case "places":
      return <PlacesManager places={await listPlaces()} d={d} />;
    case "history":
      return <History d={d} locale={locale} />;
  }
}

async function History({ d, locale }: { d: StaffDictionary["admin"]["settings"]; locale: StaffLocale }) {
  const rows = await listAdminAudit();
  const h = d.history;
  const fieldLabel = (k: string) => (d.fields as Record<string, string>)[k] ?? (k.startsWith("dow") ? d.weekdays[Number(k.slice(3))] : k);
  const show = (v: unknown) => (v === null || v === undefined || v === "" ? d.confirm.empty : typeof v === "object" ? JSON.stringify(v) : String(v));
  if (rows.length === 0) return <p className="rounded-lg border border-dashed p-6">{h.empty}</p>;
  return (
    <>
      <p className="text-sm text-muted-foreground">{h.intro}</p>
      <ul className="flex flex-col gap-2" data-testid="history">
        {rows.map((r) => {
          const keys = [...new Set([...Object.keys(r.oldValue ?? {}), ...Object.keys(r.newValue ?? {})])];
          return (
            <li key={r.id} className="flex flex-col gap-1 rounded-lg border p-3">
              <span className="font-semibold">{(d.actions as Record<string, string>)[r.action] ?? r.action}</span>
              <span className="text-sm text-muted-foreground">{t(h.by, { name: r.by ?? h.system, time: formatDateTime(r.at, locale) })}</span>
              <ul className="flex flex-col text-sm">
                {keys.map((k) => (
                  <li key={k} className="break-words">
                    {k.startsWith("_") ? (
                      <span className="text-warning">⚠ {show(r.newValue?.[k])}</span>
                    ) : (
                      <>
                        <span className="text-muted-foreground">{fieldLabel(k)}: </span>
                        {r.oldValue && k in r.oldValue && <span className="line-through decoration-destructive/60">{show(r.oldValue[k])}</span>}
                        {r.oldValue && k in r.oldValue && r.newValue && k in r.newValue && " → "}
                        {r.newValue && k in r.newValue && <span className="font-semibold">{show(r.newValue[k])}</span>}
                      </>
                    )}
                  </li>
                ))}
              </ul>
            </li>
          );
        })}
      </ul>
    </>
  );
}
