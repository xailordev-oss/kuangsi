import type { Metadata, Viewport } from "next";
import { fontVariables } from "@/lib/fonts";
import "../globals.css";

export const metadata: Metadata = { title: "Kuang Si Falls — Staff", robots: { index: false, follow: false } };
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#0f766e" };

// root layout ຂອງພະນັກງານ — ພາສາມາຈາກ cookie ຈຶ່ງຕັ້ງ lang ຢູ່ wrapper ພາຍໃນແຕ່ລະໜ້າ (ອ່ານ cookie ໄດ້ສະເພາະໃນ Suspense)
export default function StaffLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="lo" className={`${fontVariables} h-full antialiased`}>
      <body className="flex min-h-dvh flex-col bg-background text-foreground">{children}</body>
    </html>
  );
}
