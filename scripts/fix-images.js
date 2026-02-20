const { PrismaClient } = require("@prisma/client");
const p = new PrismaClient();

async function main() {
  // Update medieval castle spawn image
  const r1 = await p.productImage.updateMany({
    where: { id: "seed-img-medieval-spawn-map-1" },
    data: { storageKey: "/images/products/medieval-castle-spawn.svg" },
  });
  console.log("Medieval:", r1.count);

  // Skyblock
  const skyblock = await p.product.findUnique({ where: { slug: "skyblock-config-pack" } });
  if (skyblock) {
    const r2 = await p.productImage.updateMany({
      where: { productId: skyblock.id, storageKey: { startsWith: "images/skyblock" } },
      data: { storageKey: "/images/products/skyblock-config-pack.svg" },
    });
    console.log("Skyblock:", r2.count);
  }

  // Economy
  const economy = await p.product.findUnique({ where: { slug: "custom-economy-source" } });
  if (economy) {
    const r3 = await p.productImage.updateMany({
      where: { productId: economy.id, storageKey: { startsWith: "images/custom" } },
      data: { storageKey: "/images/products/custom-economy-source.svg" },
    });
    console.log("Economy:", r3.count);
  }

  // KitPvP
  const kitpvp = await p.product.findUnique({ where: { slug: "kitpvp-plugin" } });
  if (kitpvp) {
    const r4 = await p.productImage.updateMany({
      where: { productId: kitpvp.id, storageKey: { startsWith: "images/kitpvp" } },
      data: { storageKey: "/images/products/kitpvp-plugin.svg" },
    });
    console.log("KitPvP:", r4.count);
  }

  console.log("Done!");
  await p.$disconnect();
}

main().catch(console.error);
