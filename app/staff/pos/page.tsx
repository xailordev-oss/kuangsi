import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { PosApp, type PosTicket } from "@/components/staff/pos-app";
import { StaffHeader } from "@/components/staff/staff-header";
import { StaffNav } from "@/components/staff/staff-nav";
import { Skeleton } from "@/components/ui/skeleton";
import { getCurrentUser } from "@/lib/auth/dal";
import { can, homePathForRole, STAFF_LOGIN_PATH } from "@/lib/auth/roles";
import { getPosWindow } from "@/lib/booking/availability";
import { getCatalog } from "@/lib/booking/catalog";
import { ageLabel, localizedName } from "@/lib/booking/ui";
import { countryNamesFor } from "@/lib/country-names";
import { prisma } from "@/lib/db";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getStaffDictionary, getStaffLocale } from "@/lib/i18n/staff";

export default function PosPage() {
  return (
    <Suspense fallback={<Skeleton className="m-4 h-96" />}>
      <PosView />
    </Suspense>
  );
}

async function PosView() {
  await connection();
  const user = await getCurrentUser();
  if (!user) redirect(`${STAFF_LOGIN_PATH}?callbackUrl=/staff/pos`);
  if (!can(user.role, "pos.sell")) redirect(homePathForRole(user.role));

  const locale = await getStaffLocale();
  const dict = getStaffDictionary(locale);
  const [catalog, window, customerDict] = await Promise.all([getCatalog(), getPosWindow(prisma), getDictionary(locale)]);
  // ຊື່ປີ້ ແລະ ຊ່ວງອາຍຸ ກຽມຢູ່ server ດ້ວຍຂໍ້ຄວາມຊຸດດຽວກັບໜ້າລູກຄ້າ
  // TODO: ຢືນຢັນກັບຜູ້ຈັດການຕາດວ່າບໍລິການເສີມອັນໃດຂາຍຢູ່ປະຕູແທ້ (ຕູ້ຝາກຂອງ? ສູນໝີ?) — ຖ້າມີ ເພີ່ມປຸ່ມ "ເພີ່ມບໍລິການ" ແຍກ ບໍ່ໃສ່ໃນ flow ຫຼັກ (API ຮອງຮັບ addOns ແລ້ວ)
  const tickets: PosTicket[] = catalog.ticketTypes.map((tt) => ({
    id: tt.id,
    name: localizedName(tt.name, locale),
    ages: ageLabel(tt, customerDict),
    visitorGroup: tt.visitorGroup,
    ageGroup: tt.ageGroup,
    price: Number(tt.price),
  }));

  return (
    <div lang={locale} className="flex min-h-dvh flex-col">
      <StaffHeader title={dict.pos.title} staffName={user.fullName} locale={locale} dict={dict} />
      <StaffNav role={user.role} current="/staff/pos" dict={dict} />
      <PosApp tickets={tickets} initialWindow={window} countryNames={countryNamesFor(locale)} dict={dict} />
    </div>
  );
}
