"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { CountryPicker } from "@/components/booking/country-picker";
import { PhoneInput, toE164 } from "@/components/booking/phone-input";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useDraft } from "@/lib/booking/draft";
import type { CountryNames } from "@/lib/country-names";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/dictionaries";

const ID_TYPES = ["national_id", "passport", "other"] as const;

function makeSchema(dict: Dictionary) {
  return z
    .object({
      fullName: z.string().trim().min(1, dict.details.errName).max(150, dict.details.errName),
      phone: z.object({ country: z.string(), national: z.string() }).refine((p) => toE164(p) !== null, dict.details.errPhone),
      email: z.union([z.literal(""), z.email(dict.details.errEmail).max(255)]),
      nationality: z.string(),
      idType: z.union([z.literal(""), z.enum(ID_TYPES)]),
      idNumber: z.string().trim().max(50),
    })
    .refine((v) => !v.idNumber || v.idType, { message: dict.details.errIdType, path: ["idType"] });
}

type FormValues = z.input<ReturnType<typeof makeSchema>>;

export function DetailsForm({
  lang,
  dict,
  countryNames,
  englishCountryNames,
}: {
  lang: Locale;
  dict: Dictionary;
  countryNames: CountryNames;
  englishCountryNames: CountryNames;
}) {
  const router = useRouter();
  const { draft, update, ready } = useDraft({ group: "lao", tickets: {}, addOns: {} });
  const [showId, setShowId] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(makeSchema(dict)),
    defaultValues: {
      fullName: "",
      phone: { country: "LA", national: "" },
      email: "",
      nationality: "LA",
      idType: "",
      idNumber: "",
    },
  });
  const { register, handleSubmit, control, reset, formState } = form;
  const errors = formState.errors;

  useEffect(() => {
    if (!ready || !draft.customer) return;
    const c = draft.customer;
    reset({
      fullName: c.fullName,
      phone: { country: c.phoneCountry, national: c.phoneNational },
      email: c.email ?? "",
      nationality: c.nationality ?? "",
      idType: c.idType ?? "",
      idNumber: c.idNumber ?? "",
    });
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (c.idNumber) setShowId(true);
  }, [ready, draft.customer, reset]);

  if (!ready) return <Skeleton className="h-96 w-full" />;

  if (!draft.visitDate || Object.values(draft.tickets).every((q) => !q)) {
    return (
      <div className="flex flex-col gap-3">
        <p>{dict.review.missingDraft}</p>
        <Button asChild className="min-h-11 text-base">
          <Link href={`/${lang}/book`}>{dict.booking.startOver}</Link>
        </Button>
      </div>
    );
  }

  const onSubmit = handleSubmit((v) => {
    update({
      customer: {
        fullName: v.fullName.trim(),
        phone: toE164(v.phone) ?? "",
        phoneCountry: v.phone.country,
        phoneNational: v.phone.national,
        email: v.email || undefined,
        nationality: v.nationality || undefined,
        idType: v.idNumber ? (v.idType as (typeof ID_TYPES)[number]) : undefined,
        idNumber: v.idNumber?.trim() || undefined,
      },
    });
    router.push(`/${lang}/book/review`);
  });

  const fieldError = (msg?: string, id?: string) =>
    msg ? (
      <p id={id} role="alert" className="text-sm text-destructive">
        {msg}
      </p>
    ) : null;

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <Label htmlFor="fullName" className="text-base">
          {dict.details.fullName}
        </Label>
        <Input
          id="fullName"
          autoComplete="name"
          className="min-h-11 text-base"
          aria-invalid={!!errors.fullName || undefined}
          aria-describedby={errors.fullName ? "fullName-error" : undefined}
          {...register("fullName")}
        />
        {fieldError(errors.fullName?.message, "fullName-error")}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="phone" className="text-base">
          {dict.details.phone}
        </Label>
        <Controller
          control={control}
          name="phone"
          render={({ field }) => (
            <PhoneInput
              id="phone"
              value={field.value}
              onChange={field.onChange}
              names={countryNames}
              countryLabel={dict.details.phoneCountry}
              otherLabel={dict.details.phoneOther}
              invalid={!!errors.phone}
              describedBy="phone-hint"
            />
          )}
        />
        <p id="phone-hint" className="text-sm text-muted-foreground">
          {dict.details.phoneHint}. {dict.details.phoneLaoHint}
        </p>
        {fieldError(errors.phone?.message ?? errors.phone?.root?.message)}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="email" className="text-base">
          {dict.details.email} <span className="text-sm font-normal text-muted-foreground">({dict.common.optional})</span>
        </Label>
        <Input id="email" type="email" autoComplete="email" className="min-h-11 text-base" aria-describedby="email-hint" {...register("email")} />
        <p id="email-hint" className="text-sm text-muted-foreground">
          {dict.details.emailHint}
        </p>
        {fieldError(errors.email?.message)}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="nationality" className="text-base">
          {dict.details.nationality} <span className="text-sm font-normal text-muted-foreground">({dict.common.optional})</span>
        </Label>
        <Controller
          control={control}
          name="nationality"
          render={({ field }) => (
            <CountryPicker
              id="nationality"
              value={field.value}
              onChange={field.onChange}
              lang={lang}
              names={countryNames}
              englishNames={englishCountryNames}
              labels={{
                none: dict.details.nationalityNone,
                search: dict.details.nationalitySearch,
                common: dict.details.nationalityCommon,
                all: dict.details.nationalityAll,
                noMatch: dict.details.nationalityNoMatch,
                change: dict.details.nationalityChange,
              }}
            />
          )}
        />
      </div>

      {/* ເລກບັດບໍ່ບັງຄັບ (ຂໍ້ຕົກລົງ 5) — ພັບໄວ້ ບໍ່ໃຫ້ເບິ່ງຄືຕ້ອງໃສ່ */}
      <details open={showId} onToggle={(e) => setShowId((e.target as HTMLDetailsElement).open)} className="rounded-xl border px-3">
        <summary className="flex min-h-11 cursor-pointer items-center text-base">{dict.details.idSection}</summary>
        <div className="flex flex-col gap-3 pb-3">
          <div className="flex flex-col gap-2">
            <Label htmlFor="idType" className="text-base">
              {dict.details.idType}
            </Label>
            <select id="idType" className="min-h-11 rounded-md border border-input bg-background px-2 text-base" {...register("idType")}>
              <option value="">—</option>
              {ID_TYPES.map((k) => (
                <option key={k} value={k}>
                  {dict.details.idTypes[k]}
                </option>
              ))}
            </select>
            {fieldError(errors.idType?.message)}
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="idNumber" className="text-base">
              {dict.details.idNumber}
            </Label>
            <Input id="idNumber" autoComplete="off" className="min-h-11 text-base" {...register("idNumber")} />
          </div>
        </div>
      </details>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t bg-background/95 p-4 shadow-lg backdrop-blur">
        <div className="mx-auto flex max-w-xl gap-2 md:max-w-2xl">
          <Button asChild variant="outline" size="lg" className="min-h-12 text-base">
            <Link href={`/${lang}/book`}>{dict.common.back}</Link>
          </Button>
          <Button type="submit" size="lg" className="min-h-12 flex-1 text-base">
            {dict.common.next}
          </Button>
        </div>
      </div>
    </form>
  );
}
