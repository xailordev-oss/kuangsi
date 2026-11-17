import { notFound } from "next/navigation";
import { hasLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";

export default async function PrivacyPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const { privacy } = await getDictionary(lang);
  const sections = [
    [privacy.collectTitle, privacy.collectBody],
    [privacy.locationTitle, privacy.locationBody],
    [privacy.receiptTitle, privacy.receiptBody],
  ] as const;
  return (
    <article className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold">{privacy.title}</h1>
      <p>{privacy.intro}</p>
      {sections.map(([title, body]) => (
        <section key={title}>
          <h2 className="text-lg font-semibold">{title}</h2>
          <p>{body}</p>
        </section>
      ))}
    </article>
  );
}
