// ສ້າງ ຫຼື ອັບເດດບັນຊີພະນັກງານ (ລະຫັດຜ່ານ + ບົດບາດ) — ບໍ່ລຶບ ແລະ ບໍ່ປ່ຽນ is_active ຂອງບັນຊີເກົ່າ
// ການຕັ້ງລະຫັດໃໝ່ ປົດລັອກບັນຊີນຳ (failed_login_count = 0, locked_until = NULL)
//
// ລະຫັດຜ່ານອ່ານຈາກ stdin (ບໍ່ຮັບເປັນ argument ເພື່ອບໍ່ໃຫ້ຄ້າງໃນ shell history):
//   npm run user:upsert -- --username admin --role admin
//   npm run user:upsert -- --username somchai --role cashier --email somchai@example.com --name "ສົມໃຈ"
import { parseArgs } from "node:util";
import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";
import { userUpsertSchema } from "@/lib/auth/schemas";

async function readPassword(): Promise<string> {
  if (process.stdin.isTTY) process.stdout.write("Password: ");
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString("utf8").replace(/\r?\n$/, "");
}

async function main() {
  const { values } = parseArgs({
    options: {
      username: { type: "string" },
      role: { type: "string" },
      email: { type: "string" },
      name: { type: "string" },
    },
  });

  const parsed = userUpsertSchema.safeParse({
    username: values.username,
    role: values.role,
    email: values.email,
    fullName: values.name,
    password: await readPassword(),
  });
  if (!parsed.success) {
    console.error(parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("\n"));
    process.exitCode = 1;
    return;
  }
  const { username, role, email, fullName, password } = parsed.data;
  const password_hash = await hashPassword(password);

  const existing = await prisma.users.findUnique({ where: { username }, select: { id: true } });
  if (existing) {
    await prisma.users.update({
      where: { id: existing.id },
      data: {
        password_hash,
        role,
        failed_login_count: 0,
        locked_until: null,
        ...(email && { email }),
        ...(fullName && { full_name: fullName }),
      },
    });
    console.log(`updated ${username} (${role})`);
    return;
  }

  if (!email || !fullName) {
    console.error("new user needs --email and --name");
    process.exitCode = 1;
    return;
  }
  await prisma.users.create({ data: { username, email, full_name: fullName, role, password_hash } });
  console.log(`created ${username} (${role})`);
}

main().finally(() => prisma.$disconnect());
