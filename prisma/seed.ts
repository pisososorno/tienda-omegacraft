import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";
import { createHash, randomBytes } from "crypto";

const prisma = new PrismaClient();

function sha256(data: string): string {
  return createHash("sha256").update(data).digest("hex");
}

async function main() {
  console.log("🌱 Seeding database...");

  // ── ADMIN USER ──────────────────────────────────────
  const adminPassword = await hash("admin123", 12);
  const admin = await prisma.adminUser.upsert({
    where: { email: "admin@tiendadigital.com" },
    update: {},
    create: {
      email: "admin@tiendadigital.com",
      passwordHash: adminPassword,
      name: "Admin",
    },
  });
  console.log(`  ✓ Admin user: ${admin.email}`);

  // ── TERMS VERSION ───────────────────────────────────
  const termsContent = `# TÉRMINOS Y CONDICIONES — {{STORE_NAME}} (ES)
**Versión:** v1.0
**Fecha de entrada en vigor:** 2026-02-16
**Resumen:** Estos Términos regulan la compra y uso de productos digitales para Minecraft (plugins, configuraciones, mapas, source code y contenidos descargables) ofrecidos por **{{STORE_NAME}}** ("nosotros", "la Tienda"). Al comprar, acceder o descargar, aceptas estos Términos.

---

## 1) Definiciones
- **Producto Digital:** archivos descargables o accesibles digitalmente (ZIP, JAR, schematics, mapas, configuraciones, código fuente, etc.).
- **Orden/Pedido:** compra registrada en la Tienda.
- **Entrega / Descarga:** acceso a archivos mediante enlace/token y/o área "Mis descargas".
- **Staged Delivery (Entrega por Etapas):** entrega parcial (por ejemplo, "preview" o "compilado") y/o entrega completa (por ejemplo, "full source") liberada según reglas de la Tienda o aprobación administrativa.
- **Evidencia/Logs:** registros técnicos de la transacción y acceso (por ejemplo: timestamps, IP cifrada, User-Agent, hashes de archivos, eventos del sistema).

---

## 2) Aceptación y elegibilidad
Al usar la Tienda confirmas que:
- Tienes capacidad legal para contratar, o actúas con autorización del titular del medio de pago.
- Entiendes que los Productos Digitales se entregan electrónicamente y pueden quedar disponibles de forma inmediata tras confirmación de pago.

---

## 3) Productos, compatibilidad y descripciones
- Las descripciones, compatibilidades y requisitos (versiones de Minecraft, Paper/Spigot, dependencias, etc.) se informan en la página del producto.
- Hacemos esfuerzos razonables por mantener la información actualizada, pero pueden existir diferencias según tu hosting, versiones, plugins de terceros o configuraciones del servidor.
- Recomendamos probar en un entorno de staging antes de producción.

---

## 4) Precios, impuestos y moneda
- Los precios se muestran en la moneda indicada en el sitio (por ejemplo, USD).
- Impuestos, tasas y cargos bancarios o del procesador de pagos pueden variar por país y son responsabilidad del comprador, salvo que se indique lo contrario.

---

## 5) Pagos y verificación
- Los pagos se procesan a través de proveedores como PayPal u otros integrados oficialmente.
- Una Orden se considera **pagada** cuando el pago está **confirmado** (por ejemplo, mediante webhook/evento verificado del procesador).
- No garantizamos disponibilidad de descarga si el pago está pendiente, en revisión o es revertido.

---

## 6) Entrega digital, enlaces y límites
Para proteger a compradores y a la Tienda:
- Los enlaces de descarga pueden expirar (por ejemplo, 15 minutos por token).
- Se aplican límites de descargas y ventanas de tiempo (por ejemplo, 3 descargas durante 7 días), según se indique en el producto o en la Orden.
- Los archivos se entregan mediante enlaces firmados/tokens; no se publican URLs directas públicas.
- Podemos bloquear o limitar descargas ante señales razonables de abuso, uso no autorizado o riesgo de fraude.

---

## 7) Staged Delivery (Entrega por Etapas)
Algunos productos pueden entregarse por etapas, por ejemplo:
- **Etapa "preview/compilado"**: acceso inicial a un build o parte del contenido.
- **Etapa "full/source"**: acceso a código fuente u otros archivos completos.

La liberación de etapas puede depender de:
- Confirmación de pago,
- Cumplimiento de límites de descarga,
- Verificación de identidad/propiedad del pago (cuando sea razonable),
- Decisiones administrativas por seguridad (por ejemplo, alta probabilidad de disputa).

---

## 8) Política de no reembolso (Productos Digitales)
**Debido a la naturaleza digital** del contenido (entrega inmediata y posibilidad de copia), en general:
- **Las compras no son reembolsables** una vez que el producto haya sido entregado o puesto a disposición para descarga, salvo que la ley aplicable exija lo contrario.
- Si existe un problema técnico verificable atribuible al producto (por ejemplo, archivo corrupto), podremos ofrecer, a nuestra discreción razonable: reemplazo del archivo, corrección, instrucciones de instalación o soporte básico.

Nada de lo anterior limita derechos irrenunciables del consumidor cuando sean aplicables en tu jurisdicción.

---

## 9) Licencia de uso y restricciones
Salvo que un producto indique una licencia distinta, se otorga una licencia **limitada, no exclusiva, no transferible y revocable** para:
- usar el Producto Digital en tus servidores/proyectos,
- para fines personales o comerciales relacionados con tu servidor Minecraft.

**Prohibido:**
- revender, redistribuir, sublicenciar, compartir o publicar el producto (o partes sustanciales) en repositorios, foros, marketplaces, Discords, etc.,
- permitir que terceros descarguen desde tus enlaces o área de descargas,
- eliminar marcas, avisos de licencia o identificadores insertados.

---

## 10) Watermarking, licencias y huellas digitales
Para proteger el contenido y mitigar fraude:
- Ciertos productos (especialmente source code) pueden incluir un **bloque de licencia**, **identificadores** o **huellas** asociadas a la Orden (por ejemplo: order_id, email, fecha, fingerprint).
- Estos elementos no afectan el funcionamiento, pero ayudan a verificar origen ante redistribución o disputas.

---

## 11) Evidencia técnica, registros y disputas
La Tienda puede registrar eventos y metadatos para:
- operar el sistema de entrega,
- prevención de fraude,
- soporte,
- y respuesta a disputas/contracargos.

Esto puede incluir (entre otros):
- fecha y hora (UTC),
- aceptación de términos (versión + hash),
- IP cifrada y enmascarada,
- User-Agent,
- logs de acceso/descarga,
- hashes SHA256 de archivos,
- eventos de pago (IDs y estados).

**Importante:** estos registros se usan como evidencia técnica y operativa. No prometemos resultados específicos en disputas, ya que la resolución depende del procesador de pagos y sus políticas.

---

## 12) Suspensión, revocación y "modo disputa"
Podemos, de forma razonable, **suspender o revocar** acceso/descargas si:
- detectamos actividad anómala,
- hay disputa/contracargo,
- el pago es revertido,
- hay incumplimiento de estos Términos.

En "modo disputa" podemos:
- congelar evidencia asociada a la Orden,
- revocar enlaces activos,
- conservar un paquete de evidencia (por ejemplo PDF) asociado a la Orden.

---

## 13) Soporte
- El soporte (si se ofrece) se limita a lo indicado en cada producto.
- No incluye administración del servidor, instalación de plugins de terceros, ni soluciones de hosting.
- El tiempo de respuesta puede variar según zona horaria y volumen.

---

## 14) Limitación de responsabilidad
En la medida permitida por la ley aplicable:
- No somos responsables por pérdidas indirectas (lucro cesante, pérdida de datos, caída de servidor, pérdida de reputación, etc.).
- Nuestra responsabilidad total por una Orden no excederá el monto pagado por ese producto, salvo que la ley exija otra cosa.
- No garantizamos que el producto sea "libre de errores" en todos los entornos, ya que depende de versiones, plugins y configuración del usuario.

---

## 15) Modificaciones del servicio y del contenido
- Podemos actualizar productos (parches, mejoras) o discontinuarlos.
- Podemos actualizar estos Términos. La versión aceptada en tu compra queda registrada como evidencia de esa Orden.

---

## 16) Ley aplicable y jurisdicción
- Estos Términos se interpretan conforme a la ley del **país donde opere legalmente el titular de {{STORE_NAME}}**, salvo que normas imperativas de protección al consumidor en tu país dispongan lo contrario.
- Las controversias se someterán a los tribunales competentes según corresponda por ley aplicable.

> **Nota:** Este texto es general. Si definimos país/empresa legal (p. ej., Chile, SPA, etc.) se debe completar con precisión.

---

## 17) Contacto
Para soporte y temas legales:
**Email:** {{CONTACT_EMAIL}}

---

# POLÍTICA DE PRIVACIDAD — {{STORE_NAME}} (ES)
**Versión:** v1.0
**Fecha de entrada en vigor:** 2026-02-16

## 1) Qué datos recopilamos
Podemos recopilar:
- **Datos de compra:** email, producto, precio, IDs de orden, estado del pago, IDs del procesador (p.ej., PayPal transaction/capture id).
- **Datos técnicos:** timestamps UTC, User-Agent, eventos del sistema, hashes de archivos (SHA256), logs de descarga y accesos.
- **IP:** se almacena **cifrada** (p. ej., AES-256-GCM) y se utiliza para seguridad/fraude. En vistas normales puede mostrarse enmascarada.

No solicitamos datos sensibles innecesarios. Los datos de tarjeta no los recibimos directamente si el pago lo procesa PayPal u otro proveedor.

---

## 2) Para qué usamos tus datos
- Procesar compras y entregar productos digitales.
- Prevenir fraude y abuso.
- Cumplir obligaciones legales y contables.
- Responder a reclamos, disputas o contracargos.
- Mejorar el servicio (métricas y estabilidad).

---

## 3) Base legal
Dependiendo de tu jurisdicción, tratamos datos bajo bases como:
- ejecución de contrato (entrega del producto),
- interés legítimo (seguridad y antifraude),
- cumplimiento legal (contabilidad/tributación),
- consentimiento (por ejemplo, comunicaciones no esenciales cuando aplique).

---

## 4) Retención de datos
- Conservamos evidencia de órdenes y logs antifraude por un período orientativo de **540 días** (aprox. 18 meses) para cubrir ventanas de disputa y auditoría.
- Luego, eliminamos o anonimizamos datos cuando sea razonablemente posible, salvo obligación legal distinta.

---

## 5) Compartición con terceros
Podemos compartir datos mínimos necesarios con:
- Procesadores de pago (p.ej., PayPal) para procesar transacciones.
- Proveedores de infraestructura (hosting, base de datos, almacenamiento tipo S3/R2, email SMTP) para operar el servicio.
- Autoridades cuando exista obligación legal.

No vendemos tus datos personales.

---

## 6) Seguridad
Aplicamos medidas razonables:
- cifrado de IP,
- tokens firmados para descargas,
- registros append-only de eventos,
- control de acceso administrativo,
- backups y monitoreo.

Sin embargo, ningún sistema es 100% infalible.

---

## 7) Derechos del usuario
Según tu país, puedes tener derecho a:
- acceso, rectificación, actualización,
- eliminación (cuando proceda),
- oposición o limitación,
- portabilidad,
- reclamo ante autoridad.

Para ejercerlos, contáctanos indicando tu email y, si aplica, el número de orden.

---

## 8) Cookies
Podemos usar cookies técnicas (sesión, seguridad, autenticación admin) y, opcionalmente, analíticas. En entornos locales/dev pueden variar.

---

## 9) Cambios a esta política
Podemos actualizar esta política. La versión aplicable a tu compra puede quedar registrada para fines de evidencia.

---

## 10) Contacto privacidad
**Email:** {{PRIVACY_EMAIL}}

---

# TERMS AND CONDITIONS — {{STORE_NAME}} (EN)
**Version:** v1.0
**Effective date:** 2026-02-16
**Summary:** These Terms govern the purchase and use of digital Minecraft products (plugins, configs, maps, source code and downloadable content) offered by **{{STORE_NAME}}** ("we", "the Store"). By purchasing, accessing, or downloading, you agree to these Terms.

---

## 1) Definitions
- **Digital Product:** downloadable or digitally accessible files (ZIP, JAR, schematics, maps, configurations, source code, etc.).
- **Order:** a purchase record created in the Store.
- **Delivery / Download:** access to files via link/token and/or the "My Downloads" area.
- **Staged Delivery:** partial delivery (e.g., "preview" or "compiled build") and/or full delivery (e.g., "full source") released under Store rules or admin approval.
- **Evidence/Logs:** technical records related to transactions and access (e.g., timestamps, encrypted IP, User-Agent, file hashes, system events).

---

## 2) Acceptance and eligibility
By using the Store, you confirm that:
- You have legal capacity to enter into this agreement, or you are authorized by the payment method owner.
- You understand Digital Products may be made available immediately after payment confirmation.

---

## 3) Products, compatibility and descriptions
- Product details, compatibility, and requirements (Minecraft versions, Paper/Spigot, dependencies, etc.) are shown on the product page.
- We make reasonable efforts to keep information accurate, but results may vary depending on hosting, versions, third-party plugins, and server configuration.
- We recommend testing in a staging environment before production use.

---

## 4) Pricing, taxes and currency
- Prices are shown in the currency displayed (e.g., USD).
- Taxes, fees, and bank/payment provider charges may vary by country and are the buyer's responsibility unless explicitly stated otherwise.

---

## 5) Payments and verification
- Payments are processed through official providers such as PayPal (or others integrated in the Store).
- An Order is considered **paid** only when payment is **confirmed** (e.g., via verified webhook/event from the payment provider).
- Download availability may be restricted if payment is pending, under review, or reversed.

---

## 6) Digital delivery, links and limits
To protect buyers and the Store:
- Download links may expire (e.g., 15 minutes per token).
- Download limits and time windows apply (e.g., 3 downloads within 7 days) as stated on the product page or Order.
- Files are delivered via signed URLs/tokens; public direct file URLs are not provided.
- We may block or limit downloads if there are reasonable indicators of abuse, unauthorized use, or fraud risk.

---

## 7) Staged Delivery
Some products may be delivered in stages, for example:
- **"preview/compiled" stage**: initial access to a build or partial content.
- **"full/source" stage**: full source code or complete deliverables.

Stage release may depend on:
- Payment confirmation,
- Download limit compliance,
- Reasonable identity/payment ownership verification (when warranted),
- Administrative decisions for security (e.g., high dispute risk).

---

## 8) No-refund policy (Digital Products)
**Due to the digital nature** of the content (immediate delivery and copyability), as a general rule:
- Purchases are **non-refundable** once the product has been delivered or made available for download, unless applicable law requires otherwise.
- If there is a verifiable technical issue attributable to the product (e.g., corrupted file), we may, at our reasonable discretion, provide: file replacement, correction, installation guidance, or basic support.

Nothing in this section limits any non-waivable consumer rights where applicable.

---

## 9) License and use restrictions
Unless a product states a different license, we grant a **limited, non-exclusive, non-transferable, revocable** license to:
- use the Digital Product in your servers/projects,
- for personal or commercial use related to your Minecraft server.

**Prohibited:**
- reselling, redistributing, sublicensing, sharing, or publishing the product (or substantial parts) on repositories, forums, marketplaces, Discord servers, etc.
- allowing third parties to download via your links or "My Downloads".
- removing license notices, watermarks, or embedded identifiers.

---

## 10) Watermarking, licenses and fingerprints
To protect content and mitigate fraud:
- Certain products (especially source code) may include a **license block**, **identifiers**, or **fingerprints** associated with the Order (e.g., order_id, email, date, fingerprint).
- These do not affect functionality but help verify origin in cases of redistribution or disputes.

---

## 11) Technical evidence, logs and disputes
The Store may record events and metadata to:
- operate digital delivery,
- prevent fraud and abuse,
- provide support,
- respond to disputes/chargebacks.

This may include (among others):
- UTC timestamps,
- acceptance of Terms (version + hash),
- encrypted and masked IP,
- User-Agent,
- download/access logs,
- file SHA256 hashes,
- payment events (IDs and statuses).

**Important:** logs are used as technical/operational evidence. We do not promise specific outcomes in disputes, as resolution depends on payment providers and their policies.

---

## 12) Suspension, revocation and "dispute mode"
We may reasonably **suspend or revoke** access/downloads if:
- anomalous activity is detected,
- a dispute/chargeback is filed,
- the payment is reversed,
- these Terms are breached.

In "dispute mode" we may:
- freeze evidence associated with the Order,
- revoke active download tokens,
- preserve an evidence package (e.g., PDF) linked to the Order.

---

## 13) Support
- Support (if offered) is limited to what is stated on each product page.
- It does not include server administration, third-party plugin installation, or hosting troubleshooting.
- Response times may vary by timezone and workload.

---

## 14) Limitation of liability
To the maximum extent permitted by law:
- We are not liable for indirect damages (lost profits, data loss, server downtime, reputation loss, etc.).
- Our total liability for an Order will not exceed the amount paid for that product, unless the law requires otherwise.
- We do not guarantee error-free operation in all environments, as results depend on versions, plugins, and user configuration.

---

## 15) Changes to service and content
- We may update products (patches, improvements) or discontinue them.
- We may update these Terms. The version accepted at purchase time may be recorded as evidence for that Order.

---

## 16) Governing law and jurisdiction
- These Terms are governed by the law of the **country where {{STORE_NAME}}'s legal owner operates**, unless mandatory consumer protection rules in your country apply.
- Disputes will be resolved by competent courts as determined by applicable law.

> **Note:** This is a general clause. Once the legal entity/country is defined, this should be completed precisely.

---

## 17) Contact
For support and legal matters:
**Email:** {{CONTACT_EMAIL}}

---

# PRIVACY POLICY — {{STORE_NAME}} (EN)
**Version:** v1.0
**Effective date:** 2026-02-16

## 1) Data we collect
We may collect:
- **Purchase data:** email, product, price, order IDs, payment status, payment provider IDs (e.g., PayPal transaction/capture id).
- **Technical data:** UTC timestamps, User-Agent, system events, file hashes (SHA256), download/access logs.
- **IP address:** stored **encrypted** (e.g., AES-256-GCM) and used for security/fraud prevention. In standard views it may be displayed masked.

We do not collect unnecessary sensitive data. We do not receive your card details directly if PayPal (or another provider) processes your payment.

---

## 2) How we use your data
- To process orders and deliver digital products.
- To prevent fraud and abuse.
- To comply with legal/accounting obligations.
- To respond to claims, disputes, or chargebacks.
- To improve the service (metrics and reliability).

---

## 3) Legal bases
Depending on your jurisdiction, we process data under bases such as:
- contract performance (delivering the product),
- legitimate interests (security and anti-fraud),
- legal compliance (accounting/tax),
- consent (for non-essential communications where applicable).

---

## 4) Data retention
- We retain order evidence and anti-fraud logs for an indicative period of **540 days** (~18 months) to cover dispute windows and audit needs.
- Thereafter, we delete or anonymize data when reasonably possible, unless a different legal obligation applies.

---

## 5) Sharing with third parties
We may share the minimum necessary data with:
- Payment processors (e.g., PayPal) to process transactions.
- Infrastructure providers (hosting, databases, S3/R2-style storage, SMTP email) to operate the service.
- Authorities when legally required.

We do not sell your personal data.

---

## 6) Security
We apply reasonable safeguards:
- IP encryption,
- signed download tokens,
- append-only event logs,
- admin access controls,
- backups and monitoring.

However, no system is 100% secure.

---

## 7) Your rights
Depending on your country, you may have rights to:
- access, correct, update,
- delete (where applicable),
- object or restrict processing,
- data portability,
- lodge a complaint with a regulator.

To exercise rights, contact us with your email and, if applicable, your order number.

---

## 8) Cookies
We may use technical cookies (session, security, admin authentication) and optionally analytics. Behavior may vary in local/dev environments.

---

## 9) Changes to this policy
We may update this Privacy Policy. The version applicable to your purchase may be recorded for evidence.

---

## 10) Privacy contact
**Email:** {{PRIVACY_EMAIL}}`;

  const termsHash = sha256(termsContent);
  const terms = await prisma.termsVersion.upsert({
    where: { id: "seed-terms-v1" },
    update: {
      content: termsContent,
      contentHash: termsHash,
      versionLabel: "v1.0",
      isActive: true,
    },
    create: {
      id: "seed-terms-v1",
      versionLabel: "v1.0",
      content: termsContent,
      contentHash: termsHash,
      isActive: true,
    },
  });
  console.log(`  ✓ Terms version: ${terms.versionLabel}`);

  // ── PRODUCTS ────────────────────────────────────────

  // Product 1: Plugin JAR
  const product1 = await prisma.product.upsert({
    where: { slug: "kitpvp-plugin" },
    update: {},
    create: {
      slug: "kitpvp-plugin",
      name: "KitPvP Pro Plugin",
      shortDescription: "Complete KitPvP system with kits, arenas, stats, and leaderboards.",
      description: `# KitPvP Pro Plugin

## Features
- **20+ Built-in Kits** with customizable abilities
- **Arena System** — multiple arenas with different configurations
- **Stats & Leaderboards** — kills, deaths, KDR, streaks
- **Economy Integration** — Vault support for kit purchases
- **GUI Menus** — beautiful inventory menus for kit selection
- **PlaceholderAPI** support for scoreboards

## Compatibility
- Minecraft 1.19 - 1.21
- Paper / Spigot / Purpur
- Java 17+

## Installation
1. Drop the JAR into your plugins folder
2. Restart the server
3. Configure in \`plugins/KitPvP/config.yml\``,
      category: "plugins",
      priceUsd: 15.00,
      isActive: true,
      metadata: {
        mc_versions: ["1.19", "1.20", "1.21"],
        platforms: ["Paper", "Spigot", "Purpur"],
        java_version: "17+",
        tags: ["pvp", "kits", "arena", "competitive"],
      },
    },
  });

  await prisma.productFile.upsert({
    where: { id: "seed-file-kitpvp-jar" },
    update: {},
    create: {
      id: "seed-file-kitpvp-jar",
      productId: product1.id,
      filename: "KitPvP-Pro-v3.2.1.jar",
      storageKey: "products/kitpvp-plugin/KitPvP-Pro-v3.2.1.jar",
      sha256Hash: sha256("kitpvp-plugin-jar-placeholder"),
      fileSize: BigInt(2_450_000),
      mimeType: "application/java-archive",
      sortOrder: 1,
    },
  });
  console.log(`  ✓ Product: ${product1.name} ($${product1.priceUsd})`);

  // Product 2: Source Code (expensive, staged delivery)
  const product2 = await prisma.product.upsert({
    where: { slug: "custom-economy-source" },
    update: {},
    create: {
      slug: "custom-economy-source",
      name: "Custom Economy System — Full Source Code",
      shortDescription: "Complete economy plugin with source code. Bank, shops, auctions, and more.",
      description: `# Custom Economy System — Source Code

## What You Get
- **Full Java source code** with Maven project structure
- **Compiled JAR** ready to deploy
- **Documentation** with setup guide and API reference

## Features
- Player banks with interest rates
- Admin-configurable shops (GUI based)
- Auction house with bidding system
- Transaction logging and admin tools
- MySQL / SQLite support
- Full PlaceholderAPI integration

## Source Code Includes
- Clean, documented Java 17 code
- Maven build with all dependencies
- Unit tests for core modules
- CI/CD pipeline configuration

## License
Single-server license. Source modifications allowed for personal use only.`,
      category: "source_code",
      priceUsd: 350.00,
      isActive: true,
      metadata: {
        mc_versions: ["1.20", "1.21"],
        platforms: ["Paper"],
        java_version: "17+",
        tags: ["economy", "source-code", "shops", "bank", "auction"],
        staged_delivery: true,
      },
    },
  });

  await prisma.productFile.upsert({
    where: { id: "seed-file-economy-jar" },
    update: {},
    create: {
      id: "seed-file-economy-jar",
      productId: product2.id,
      filename: "EconomySystem-v1.0-demo.jar",
      storageKey: "products/custom-economy-source/EconomySystem-v1.0-demo.jar",
      sha256Hash: sha256("economy-demo-jar-placeholder"),
      fileSize: BigInt(1_800_000),
      mimeType: "application/java-archive",
      sortOrder: 1,
    },
  });

  await prisma.productFile.upsert({
    where: { id: "seed-file-economy-source" },
    update: {},
    create: {
      id: "seed-file-economy-source",
      productId: product2.id,
      filename: "EconomySystem-v1.0-source.zip",
      storageKey: "products/custom-economy-source/EconomySystem-v1.0-source.zip",
      sha256Hash: sha256("economy-source-zip-placeholder"),
      fileSize: BigInt(8_500_000),
      mimeType: "application/zip",
      sortOrder: 2,
    },
  });
  console.log(`  ✓ Product: ${product2.name} ($${product2.priceUsd})`);

  // Product 3: Config pack
  const product3 = await prisma.product.upsert({
    where: { slug: "skyblock-config-pack" },
    update: {},
    create: {
      slug: "skyblock-config-pack",
      name: "Ultimate Skyblock Config Pack",
      shortDescription: "Pre-configured Skyblock setup with custom islands, challenges, and rewards.",
      description: `# Ultimate Skyblock Config Pack

## Includes
- **50+ Custom Islands** with unique themes
- **200+ Challenges** organized by difficulty
- **Reward System** configs for completions
- **Shop Configs** with balanced economy
- **Hologram Configs** for leaderboards
- **Permission Setups** for LuckPerms

## Compatible Plugins
- BentoBox / ASkyBlock
- ShopGUIPlus
- DecentHolograms
- LuckPerms

## Installation
1. Download and extract the ZIP
2. Copy configs to respective plugin folders
3. Follow the included setup guide`,
      category: "configurations",
      priceUsd: 8.50,
      isActive: true,
      metadata: {
        mc_versions: ["1.20", "1.21"],
        platforms: ["Paper", "Spigot"],
        tags: ["skyblock", "configs", "islands", "challenges"],
      },
    },
  });

  await prisma.productFile.upsert({
    where: { id: "seed-file-skyblock-configs" },
    update: {},
    create: {
      id: "seed-file-skyblock-configs",
      productId: product3.id,
      filename: "Skyblock-Config-Pack-v2.0.zip",
      storageKey: "products/skyblock-config-pack/Skyblock-Config-Pack-v2.0.zip",
      sha256Hash: sha256("skyblock-configs-placeholder"),
      fileSize: BigInt(450_000),
      mimeType: "application/zip",
      sortOrder: 1,
    },
  });
  console.log(`  ✓ Product: ${product3.name} ($${product3.priceUsd})`);

  // Product 4: Map
  const product4 = await prisma.product.upsert({
    where: { slug: "medieval-spawn-map" },
    update: {},
    create: {
      slug: "medieval-spawn-map",
      name: "Medieval Castle Spawn",
      shortDescription: "Stunning medieval castle spawn with NPCs areas, portals, and custom terrain.",
      description: `# Medieval Castle Spawn

## Details
- **Size:** 300x300 blocks
- **Style:** Medieval fantasy with custom terrain
- **Features:** NPC areas, portal room, market stalls, throne room
- **Format:** World download (.zip) — compatible with all server versions

## Screenshots
See gallery for detailed views of all areas.`,
      category: "maps",
      priceUsd: 12.00,
      isActive: true,
      metadata: {
        mc_versions: ["1.19", "1.20", "1.21"],
        platforms: ["Paper", "Spigot", "Purpur", "Vanilla"],
        tags: ["spawn", "medieval", "castle", "map", "build"],
        dimensions: "300x300",
      },
    },
  });

  await prisma.productFile.upsert({
    where: { id: "seed-file-medieval-map" },
    update: {},
    create: {
      id: "seed-file-medieval-map",
      productId: product4.id,
      filename: "Medieval-Castle-Spawn.zip",
      storageKey: "products/medieval-spawn-map/Medieval-Castle-Spawn.zip",
      sha256Hash: sha256("medieval-map-placeholder"),
      fileSize: BigInt(35_000_000),
      mimeType: "application/zip",
      sortOrder: 1,
    },
  });
  console.log(`  ✓ Product: ${product4.name} ($${product4.priceUsd})`);

  // ── PRODUCT IMAGES (placeholders) ───────────────────
  for (const product of [product1, product2, product3, product4]) {
    await prisma.productImage.upsert({
      where: { id: `seed-img-${product.slug}-1` },
      update: {},
      create: {
        id: `seed-img-${product.slug}-1`,
        productId: product.id,
        storageKey: `images/${product.slug}/cover.webp`,
        altText: `${product.name} cover image`,
        sortOrder: 1,
        isPrimary: true,
      },
    });
  }
  console.log(`  ✓ Product images created`);

  // ── SITE SETTINGS ──────────────────────────────────
  const settings = await prisma.siteSettings.upsert({
    where: { id: "default" },
    update: {},
    create: {
      id: "default",
      storeName: "TiendaDigital",
      storeSlogan: "Productos digitales premium para Minecraft",
      contactEmail: "support@tiendadigital.com",
      privacyEmail: "privacy@tiendadigital.com",
      heroTitle: "Plugins, Maps y Configs de calidad profesional",
      heroDescription: "Descubre nuestra colección de productos digitales para Minecraft. Spawns, dungeons, plugins y source code — todo con entrega instantánea y soporte incluido.",
      appearance: {
        primaryColor: "#6366f1",
        accentColor: "#818cf8",
        navbarBg: "#ffffff",
        navbarText: "#0f172a",
        heroBgType: "gradient",
        heroBgGradient: "from-slate-900 via-indigo-950 to-slate-900",
        heroBgSolid: "#0f172a",
        heroBgImage: "",
        bodyBg: "#ffffff",
        cardBg: "#ffffff",
        footerBg: "#0f172a",
        footerText: "#f8fafc",
        catalogBg: "#f8fafc",
      },
    },
  });
  console.log(`  ✓ Site settings: ${settings.storeName}`);

  console.log("\n✅ Seed completed successfully!");
  console.log(`   Products: 4`);
  console.log(`   Admin: admin@tiendadigital.com / admin123`);
  console.log(`   Terms: v1.0 (active)`);
  console.log(`   Settings: ${settings.storeName}`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error("❌ Seed error:", e);
    await prisma.$disconnect();
    process.exit(1);
  });
