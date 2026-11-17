"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { PhoneInput, toE164 } from "@/components/booking/phone-input";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { CountryNames } from "@/lib/country-names";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/dictionaries";

const CODE_RE = /^KS-[23456789A-HJ-NP-Z]{5}$/;

export function LookupForm({ lang, dict, countryNames }: { lang: Locale; dict: Dictionary; countryNames: CountryNames }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);

  const schema = z.object({
    code: z.string().trim().toUpperCase().regex(CODE_RE, dict.lookup.errCode),
    phone: z.object({ country: z.string(), national: z.string() }).refine((p) => toE164(p) !== null, dict.details.errPhone),
  });
  type Values = z.input<typeof schema>;

  const { register, control, handleSubmit, formState } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { code: (searchParams.get("code") ?? "").toUpperCase(), phone: { country: "LA", national: "" } },
  });
  const errors = formState.errors;

  const onSubmit = handleSubmit(async (v) => {
    setError(null);
    const bookingCode = v.code.trim().toUpperCase();
    try {
      const res = await fetch("/api/public/bookings/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookingCode, phone: toE164(v.phone) }),
      });
      if (res.ok) {
        router.push(`/${lang}/booking/${bookingCode}`);
        return;
      }
      setError(res.status === 404 ? dict.lookup.notFound : dict.error.generic);
    } catch {
      setError(dict.error.network);
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <Label htmlFor="code" className="text-base">
          {dict.lookup.code}
        </Label>
        <Input
          id="code"
          autoCapitalize="characters"
          autoComplete="off"
          placeholder={dict.lookup.codeHint}
          className="min-h-11 text-base uppercase tracking-wider"
          aria-invalid={!!errors.code || undefined}
          {...register("code")}
        />
        {errors.code && (
          <p role="alert" className="text-sm text-destructive">
            {errors.code.message}
          </p>
        )}
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
            />
          )}
        />
        {errors.phone && (
          <p role="alert" className="text-sm text-destructive">
            {errors.phone.message ?? errors.phone.root?.message}
          </p>
        )}
      </div>
      {error && (
        <p role="alert" className="rounded-md bg-destructive-subtle p-3 text-destructive">
          {error}
        </p>
      )}
      <Button type="submit" size="lg" className="min-h-12 text-base" disabled={formState.isSubmitting}>
        {formState.isSubmitting && <Loader2 aria-hidden className="animate-spin" />}
        {dict.lookup.submit}
      </Button>
    </form>
  );
}
