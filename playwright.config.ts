import { defineConfig, devices } from "@playwright/test";

try {
  process.loadEnvFile();
} catch {
  // ບໍ່ມີ .env (CI ຕັ້ງ env ໄວ້ແລ້ວ)
}

const PORT = 3107;

// E2E ແລ່ນກັບ DB ເຄື່ອງພັດທະນາ: global-setup ເປີດຈອງ online ຊົ່ວຄາວ ແລ້ວ teardown ຄືນຄ່າເດີມ + ລຶບຂໍ້ມູນທົດສອບ
// ຕ້ອງ build ກ່ອນ: npm run build && npm run test:e2e
export default defineConfig({
  testDir: "e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"], ["html", { open: "never" }]],
  globalSetup: "./e2e/global-setup.ts",
  globalTeardown: "./e2e/global-teardown.ts",
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      // ui-brief 1.1: ອອກແບບຈໍ 375px ກ່ອນ
      name: "mobile-375",
      use: {
        ...devices["Desktop Chrome"],
        // ໃຊ້ Google Chrome ທີ່ຕິດຕັ້ງໃນເຄື່ອງ (ດາວໂຫຼດ Chromium ຂອງ Playwright ບໍ່ໄດ້ໃນເຄືອຂ່າຍນີ້)
        // ຖ້າຢາກໃຊ້ Chromium ຂອງ Playwright: npx playwright install chromium ແລ້ວຕັ້ງ PW_CHANNEL=chromium
        channel: process.env.PW_CHANNEL ?? "chrome",
        viewport: { width: 375, height: 812 },
        isMobile: true,
        hasTouch: true,
        deviceScaleFactor: 2,
        locale: "lo-LA",
      },
    },
  ],
  webServer: {
    command: `npx next start -p ${PORT}`,
    url: `http://localhost:${PORT}/api/public/catalog`,
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
