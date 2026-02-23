import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const email = process.env.ADMIN_EMAIL || "admin@tiendadigital.com";
  const password = process.env.ADMIN_PASSWORD || "admin123";
  const name = process.env.ADMIN_NAME || "Admin";

  console.log(`Resetting admin: ${email}`);

  const passwordHash = await hash(password, 12);

  const admin = await prisma.adminUser.upsert({
    where: { email },
    update: {
      passwordHash,
      name,
      disabledAt: null,
    },
    create: {
      email,
      passwordHash,
      name,
    },
  });

  console.log(`✓ Admin reset: ${admin.email} (${admin.id})`);
  console.log(`  Password: ${password}`);
  console.log(`  Status: active (disabledAt cleared)`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error("✗ Error:", e);
    await prisma.$disconnect();
    process.exit(1);
  });
