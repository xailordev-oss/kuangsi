"use client";

import { Input } from "@/components/ui/input";
import { OTHER_COUNTRY, PHONE_COUNTRIES } from "@/lib/booking/ui";
import type { CountryNames } from "@/lib/country-names";
import { normalizePhone } from "@/lib/phone";

export type PhoneValue = { country: string; national: string };

// ແປງເປັນ E.164 ດ້ວຍ lib/phone.ts ດຽວກັບ server (ຂໍ້ຕົກລົງ 24)
// "ອື່ນໆ" ຕ້ອງພິມ +ລະຫັດປະເທດ ເອງ — ບໍ່ດັ່ງນັ້ນຈະຖືກຕີຄວາມເປັນເບີລາວ
export function toE164({ country, national }: PhoneValue): string | null {
  if (country === OTHER_COUNTRY) {
    const raw = national.trim();
    return raw.startsWith("+") || raw.startsWith("00") ? normalizePhone(raw) : null;
  }
  const entry = PHONE_COUNTRIES.find((c) => c.code === country);
  return entry ? normalizePhone(national, entry.callingCode) : null;
}

export function PhoneInput({
  id,
  value,
  onChange,
  names,
  countryLabel,
  otherLabel,
  invalid,
  describedBy,
}: {
  id: string;
  value: PhoneValue;
  onChange: (v: PhoneValue) => void;
  names: CountryNames;
  countryLabel: string;
  otherLabel: string;
  invalid?: boolean;
  describedBy?: string;
}) {
  return (
    <div className="flex gap-2">
      <select
        aria-label={countryLabel}
        value={value.country}
        onChange={(e) => onChange({ ...value, country: e.target.value })}
        className="min-h-11 w-28 shrink-0 rounded-md border border-input bg-background px-2 text-base"
      >
        {PHONE_COUNTRIES.map((c) => (
          <option key={c.code} value={c.code}>
            +{c.callingCode} {names[c.code] ?? c.code}
          </option>
        ))}
        <option value={OTHER_COUNTRY}>{otherLabel}</option>
      </select>
      <Input
        id={id}
        type="tel"
        inputMode="tel"
        autoComplete="tel-national"
        value={value.national}
        onChange={(e) => onChange({ ...value, national: e.target.value })}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        placeholder={value.country === "LA" ? "020 5555 5555" : value.country === OTHER_COUNTRY ? "+66 81 234 5678" : ""}
        className="min-h-11 text-base"
      />
    </div>
  );
}
