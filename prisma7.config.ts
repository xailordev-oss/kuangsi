import { defineConfig } from "prisma/config";

// ໃຊ້ຕົວອ່ານ .env ທີ່ມີໃນ Node ເອງ ແທນ package dotenv (ບໍ່ຢູ່ໃນ stack)
try {
  process.loadEnvFile();
} catch {
  // ບໍ່ມີ .env (ເຊັ່ນ CI ທີ່ຕັ້ງ env ໄວ້ແລ້ວ)
}

// ແຫຼ່ງຄວາມຈິງຂອງໂຄງສ້າງແມ່ນ db/kuangsi-schema.sql → ໃຊ້ `prisma db pull` ບໍ່ໃຊ້ `prisma migrate`
export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: process.env["DATABASE_URL"],
  },
});
