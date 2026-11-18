import Link from "next/link";
import { Suspense } from "react";
import { AdminFrame } from "@/components/admin/admin-frame";
import { CatalogManager } from "@/components/admin/catalog-manager";
import { TabSelect } from "@/components/admin/settings/reference-forms";
import { Skeleton } from "@/components/ui/skeleton";
import { lastEdit } from "@/lib/admin/audit";
import { listAddOns, listTicketTypes } from "@/lib/admin/catalog";
import { staffPage } from "@/lib/admin/page";
import { getLakPerUnit } from "@/lib/exchange";
import { formatDateTime, t } from "@/lib/i18n/format";

const TABS = ["lao", "foreigner", "addons"] as const;
type Tab = (typeof TABS)[number];
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default function TicketTypesPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <Suspense fallback={<Skeleton className="m-4 h-96" />}>
      <TicketTypesView searchParams={searchParams} />
    </Suspense>
  );
}

// 10c — ກະທົບລາຄາ (ຂໍ້ຕົກລົງ 37) · admin ເທົ່ານັ້ນ (catalog.manage)
async function TicketTypesView({ searchParams }: { searchParams: SearchParams }) {
  const { user, locale, dict } = await staffPage("catalog.manage", "/admin/ticket-types");
  const d = dict.admin.catalog;
  const raw = (await searchParams).tab;
  const tab: Tab = TABS.includes(raw as Tab) ? (raw as Tab) : "lao";
  const tabs = TABS.map((key) => ({ key, label: d.tabs[key] }));
  const isAddOns = tab === "addons";
  const [tickets, addOns, rates, edited] = await Promise.all([
    isAddOns ? [] : listTicketTypes(),
    isAddOns ? listAddOns() : [],
    getLakPerUnit(),
    lastEdit(isAddOns ? ["add_on.create", "add_on.update", "add_on.price"] : ["ticket_type.create", "ticket_type.update", "ticket_type.price"]),
  ]);

  return (
    <AdminFrame user={user} locale={locale} dict={dict} current="/admin/ticket-types" title={d.title}>
      <TabSelect tabs={tabs} current={tab} label={d.tabLabel} />
      <nav aria-label={d.tabLabel} className="hidden flex-wrap gap-1 md:flex">
        {tabs.map((x) => (
          <Link
            key={x.key}
            href={`/admin/ticket-types?tab=${x.key}`}
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
          <p className="text-sm text-muted-foreground">
            {edited ? t(dict.admin.settings.lastEdit, { by: edited.by, time: formatDateTime(edited.at, locale) }) : dict.admin.settings.neverEdited}
          </p>
        </div>
        <CatalogManager
          mode={isAddOns ? "addons" : "tickets"}
          group={tab === "foreigner" ? "foreigner" : "lao"}
          tickets={tickets}
          addOns={addOns}
          lakPerUnit={rates}
          d={d}
          sd={dict.admin.settings}
        />
      </section>
    </AdminFrame>
  );
}
