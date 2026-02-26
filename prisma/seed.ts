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
**Versión:** v1.1  
**Fecha de entrada en vigor:** 2026-02-16  
**Resumen:** Estos Términos regulan la compra y uso de productos digitales para Minecraft (plugins, configuraciones, mapas, source code y contenidos descargables) ofrecidos por **{{STORE_NAME}}** ("nosotros", "la Tienda"). Al comprar, acceder o descargar, aceptas estos Términos.

---

## 1) Definiciones
- **Producto Digital:** archivos descargables o accesibles digitalmente (ZIP, JAR, schematics, mapas, configuraciones, código fuente, etc.).
- **Orden/Pedido:** compra registrada en la Tienda.
- **Entrega / Descarga:** acceso a archivos mediante enlace/token y/o área "Mis descargas".
- **Staged Delivery (Entrega por Etapas):** entrega parcial (por ejemplo, "preview" o "compilado") y/o entrega completa (por ejemplo, "full source") liberada según reglas de la Tienda o aprobación administrativa.
- **Evidencia/Logs:** registros técnicos de la transacción y acceso (por ejemplo: timestamps, IP cifrada, User-Agent, hashes de archivos, eventos del sistema, eventos de descarga, etc.).
- **Entrega efectiva:** se considera que un Producto Digital fue entregado cuando queda **puesto a disposición** del comprador (por ejemplo, token/enlace de descarga generado y habilitado) y/o cuando existe evidencia de **acceso/descarga exitosa** (por ejemplo, evento \`download.completed\`).

---

## 2) Aceptación, elegibilidad y edad mínima
Al usar la Tienda confirmas que:
- Tienes capacidad legal para contratar, o actúas con autorización del titular del medio de pago.
- Entiendes que los Productos Digitales se entregan electrónicamente y pueden quedar disponibles de forma inmediata tras confirmación de pago.
- **Edad mínima / menores:** debes tener **al menos 16 años** para comprar, o comprar con autorización y supervisión de un adulto/titular del medio de pago (según la ley aplicable en tu país). Si eres menor, no debes completar la compra sin esa autorización.

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
- Una Orden se considera **pagada** cuando el pago está **confirmado** por el procesador, por ejemplo:
  - mediante **webhook/evento** recibido y validado, y/o
  - mediante **verificación API** (p. ej. confirmación del estado "COMPLETED/CAPTURED" vía API del proveedor).
- No garantizamos disponibilidad de descarga si el pago está pendiente, en revisión, en disputa o es revertido.
- Podemos retener o limitar entregas cuando existan señales razonables de riesgo (fraude, abuso, uso no autorizado, inconsistencias de identidad).

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
- **Etapa "preview/compilado":** acceso inicial a build o contenido parcial.
- **Etapa "full/source":** entrega completa del código fuente o entregables.

La liberación por etapas puede depender de:
- Confirmación de pago,
- Cumplimiento de límites de descarga,
- Verificación razonable de propiedad del medio de pago (cuando corresponda),
- Decisiones administrativas por seguridad (p. ej., alto riesgo de disputa).

> Nota: Si un producto es "por etapas", esa condición debe estar indicada en la página del producto o en la descripción.

---

## 8) Política de no reembolso (Productos Digitales)
**Debido a la naturaleza digital** (entrega inmediata y posibilidad de copia), como regla general:
- Las compras son **no reembolsables** una vez que el producto ha sido **entregado o puesto a disposición** para descarga (**token/enlace habilitado**) y, especialmente, cuando exista evidencia de **descarga/acceso exitoso** (por ejemplo \`download.completed\`).
- Puede existir reembolso solo si la ley aplicable lo exige (por ejemplo, normas obligatorias de protección al consumidor).

En caso de problemas técnicos reales:
- Podemos ofrecer, a nuestro criterio, soporte razonable o reemplazo del archivo, siempre que el problema sea reproducible y no dependa del entorno del comprador.

---

## 9) Licencia de uso (uso permitido)
Salvo que el producto indique otra cosa, se concede una licencia:
- **No exclusiva, no transferible**, para uso personal o interno del servidor/organización del comprador.
- La licencia se asocia a la Orden y puede incluir huellas digitales o identificadores (ver sección 10).

---

## 10) Prohibiciones
**Prohibido:**
- revender, redistribuir, sublicenciar, compartir o publicar el producto (o partes sustanciales) en repositorios, foros, marketplaces, Discords, etc.,
- permitir que terceros descarguen desde tus enlaces o área de descargas,
- eliminar marcas, avisos de licencia o identificadores insertados.

---

## 11) Watermarking, licencias y huellas digitales
Para proteger el contenido y mitigar fraude:
- Ciertos productos (especialmente source code) pueden incluir un **bloque de licencia**, **identificadores** o **huellas** asociadas a la Orden (por ejemplo: order_id, email, fecha, fingerprint).
- Estos elementos no afectan el funcionamiento, pero ayudan a verificar origen ante redistribución o disputas.

---

## 12) Evidencia técnica, registros y disputas
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
- logs de acceso/descarga (incluyendo \`download.button_clicked\` y \`download.completed\` cuando aplique),
- hashes SHA256 de archivos,
- eventos de pago (IDs y estados).

**Importante:** estos registros se usan como evidencia técnica y operativa. No prometemos resultados específicos en disputas, ya que la resolución depende del procesador de pagos y sus políticas.

---

## 13) Suspensión, revocación y "modo disputa"
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

## 14) Soporte
- El soporte (si se ofrece) se limita a lo indicado en cada producto.
- No incluye administración del servidor, instalación de plugins de terceros, ni soluciones de hosting.
- El tiempo de respuesta puede variar según zona horaria y volumen.

---

## 15) Limitación de responsabilidad
En la medida permitida por la ley aplicable:
- No somos responsables por pérdidas indirectas (lucro cesante, pérdida de datos, caída de servidor, pérdida de reputación, etc.).
- Nuestra responsabilidad total por una Orden no excederá el monto pagado por ese producto, salvo que la ley exija otra cosa.
- No garantizamos que el producto sea "libre de errores" en todos los entornos, ya que depende de versiones, plugins y configuración del usuario.

---

## 16) Modificaciones del servicio y del contenido
- Podemos actualizar productos (parches, mejoras) o discontinuarlos.
- Podemos actualizar estos Términos. La versión aceptada en tu compra queda registrada como evidencia de esa Orden.

---

## 17) Ley aplicable y jurisdicción
- Estos Términos se interpretan conforme a la ley del **país donde opere legalmente el titular de {{STORE_NAME}}** (**{{LEGAL_COUNTRY}}**, cuando aplique), salvo que normas imperativas de protección al consumidor en tu país dispongan lo contrario.
- Las controversias se someterán a los tribunales competentes según corresponda por ley aplicable.

> Nota: Si defines una entidad legal (p. ej., empresa en Chile) completa \`{{LEGAL_COUNTRY}}\` y, si corresponde, la ciudad/tribunal aplicable.

---

## 18) Contacto
Para soporte y temas legales:  
**Email:** {{CONTACT_EMAIL}}

---

# POLÍTICA DE PRIVACIDAD — {{STORE_NAME}} (ES)
**Versión:** v1.1  
**Fecha de entrada en vigor:** 2026-02-16

---

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
- Proveedores de infraestructura (hosting, base de datos, almacenamiento tipo S3/R2, email SMTP/proveedor transaccional) para operar el servicio.
- Autoridades cuando exista obligación legal.

No vendemos tus datos personales.

---

## 6) Transferencias internacionales
Nuestros proveedores (hosting/CDN/email/almacenamiento) pueden operar en distintos países. Cuando existan transferencias internacionales de datos:
- aplicamos medidas razonables de seguridad,
- y elegimos proveedores reconocidos que ofrezcan garantías adecuadas según sea requerido por ley aplicable.

---

## 7) Seguridad
Aplicamos medidas razonables:
- cifrado de IP,
- tokens firmados para descargas,
- registros append-only de eventos,
- control de acceso administrativo,
- backups y monitoreo.

Sin embargo, ningún sistema es 100% infalible.

---

## 8) Derechos del usuario
Según tu país, puedes tener derecho a:
- acceso, rectificación, actualización,
- eliminación (cuando proceda),
- oposición o limitación,
- portabilidad,
- reclamo ante autoridad.

Para ejercerlos, contáctanos indicando tu email y, si aplica, el número de orden.

---

## 9) Responsable y contacto de privacidad
**Responsable:** {{LEGAL_ENTITY_NAME}} (si aplica) / Titular de {{STORE_NAME}}  
**Email privacidad:** {{PRIVACY_EMAIL}}

---

# TERMS OF SERVICE — {{STORE_NAME}} (EN)
**Version:** v1.1  
**Effective date:** 2026-02-16  
**Summary:** These Terms govern the purchase and use of digital products for Minecraft (plugins, configurations, maps, source code and downloadable content) offered by **{{STORE_NAME}}** ("we", "us", "the Store"). By purchasing, accessing or downloading, you agree to these Terms.

---

## 1) Definitions
- **Digital Product:** downloadable or digitally accessible files (ZIP, JAR, schematics, maps, configs, source code, etc.).
- **Order:** a purchase recorded in the Store.
- **Delivery / Download:** access to files via link/token and/or the "My Downloads" area.
- **Staged Delivery:** partial delivery (e.g., preview or compiled build) and/or full delivery (e.g., full source) released according to Store rules or administrative approval.
- **Evidence/Logs:** technical records of the transaction and access (timestamps, encrypted IP, User-Agent, file hashes, system events, download events, etc.).
- **Effective delivery:** a Digital Product is considered delivered when it is **made available** to the buyer (e.g., a download token/link is generated and enabled) and/or when there is evidence of **successful access/download** (e.g., \`download.completed\`).

---

## 2) Acceptance, eligibility and minimum age
By using the Store, you confirm that:
- You have legal capacity to contract, or you act with authorization from the payment method holder.
- You understand that Digital Products are delivered electronically and may be made available immediately after payment confirmation.
- **Minimum age / minors:** you must be **at least 16 years old** to purchase, or purchase under the authorization and supervision of an adult/payment method holder (as required by applicable law). If you are a minor, do not complete a purchase without such authorization.

---

## 3) Products, compatibility and descriptions
- Product descriptions, compatibility and requirements (Minecraft versions, Paper/Spigot, dependencies, etc.) are provided on the product page.
- We make reasonable efforts to keep information up to date, but results may vary depending on your hosting, third-party plugins, versions, or server configuration.
- We recommend testing in a staging environment before production use.

---

## 4) Pricing, taxes and currency
- Prices are displayed in the currency shown on the website (e.g., USD).
- Taxes, fees and bank/payment processor charges may vary by country and are the buyer's responsibility unless stated otherwise.

---

## 5) Payments and verification
- Payments are processed through providers such as PayPal or other officially integrated gateways.
- An Order is considered **paid** when the payment is **confirmed** by the processor, for example:
  - via a validated **webhook/event**, and/or
  - via **API verification** (e.g., confirming "COMPLETED/CAPTURED" status via the provider's API).
- We do not guarantee download availability if the payment is pending, under review, disputed or reversed.
- We may hold or limit delivery when there are reasonable risk signals (fraud, abuse, unauthorized use, identity inconsistencies).

---

## 6) Digital delivery, links and limits
To protect buyers and the Store:
- Download links may expire (e.g., 15 minutes per token).
- Download count/time limits apply (e.g., 3 downloads within 7 days), as indicated in the product or Order.
- Files are delivered via signed links/tokens; we do not publish public direct URLs.
- We may block or limit downloads upon reasonable signs of abuse, unauthorized use or fraud risk.

---

## 7) Staged Delivery
Some products may be delivered in stages, for example:
- **Preview/compiled stage:** initial access to a build or partial content.
- **Full/source stage:** full delivery of source code or complete deliverables.

Staged release may depend on:
- Payment confirmation,
- Download limit compliance,
- Reasonable verification of payment method ownership (when applicable),
- Administrative security decisions (e.g., high dispute risk).

> Note: If a product is delivered "in stages", this must be indicated on the product page or description.

---

## 8) No-refund policy (Digital Products)
**Due to the digital nature** (instant delivery and copyability), as a general rule:
- Purchases are **non-refundable** once the product has been **delivered or made available** for download (token/link enabled) and, especially, when there is evidence of **successful download/access** (e.g., \`download.completed\`).
- Refunds may be available only if required by applicable law (e.g., mandatory consumer protection rules).

In case of genuine technical issues:
- We may offer reasonable support or replacement at our discretion, provided the issue is reproducible and not caused by the buyer's environment.

---

## 9) License (permitted use)
Unless a product states otherwise, we grant a license that is:
- **Non-exclusive, non-transferable**, for personal use or internal use within the buyer's server/organization.
- Associated with the Order and may include fingerprints/identifiers (see Section 10).

---

## 10) Prohibited uses
**You may not:**
- resell, redistribute, sublicense, share or publish the product (or substantial parts) in repositories, forums, marketplaces, Discord servers, etc.
- allow third parties to download using your links or "My Downloads" access
- remove license notices, marks, or embedded identifiers.

---

## 11) Watermarking, licenses and fingerprints
To protect content and mitigate fraud:
- Certain products (especially source code) may include a **license block**, **identifiers** or **fingerprints** tied to the Order (e.g., order_id, email, date, fingerprint).
- These elements do not affect functionality but help verify origin in case of redistribution or disputes.

---

## 12) Technical evidence, logs and disputes
The Store may record events and metadata for:
- operating the delivery system,
- fraud prevention,
- support,
- and dispute/chargeback responses.

This may include (among others):
- UTC timestamps,
- Terms acceptance (version + hash),
- encrypted and masked IP,
- User-Agent,
- access/download logs (including \`download.button_clicked\` and \`download.completed\` when applicable),
- file SHA256 hashes,
- payment events (IDs and statuses).

**Important:** these records are used as technical/operational evidence. We do not guarantee outcomes in disputes, as final decisions are made by the payment processor and/or card issuer.

---

## 13) Suspension, revocation and "dispute mode"
We may reasonably **suspend or revoke** access/downloads if:
- anomalous activity is detected,
- a dispute/chargeback is opened,
- payment is reversed,
- these Terms are breached.

In "dispute mode" we may:
- freeze evidence tied to the Order,
- revoke active links,
- preserve an evidence bundle (e.g., PDF) for the Order.

---

## 14) Support
- Support (if offered) is limited to what is stated on each product.
- It does not include server administration, installation of third-party plugins, or hosting issues.
- Response times may vary by timezone and volume.

---

## 15) Limitation of liability
To the maximum extent permitted by applicable law:
- We are not liable for indirect losses (lost profits, data loss, server downtime, reputation loss, etc.).
- Our total liability for an Order shall not exceed the amount paid for that product, unless required otherwise by law.
- We do not guarantee error-free operation in all environments, as behavior depends on versions, plugins and user configuration.

---

## 16) Service and content changes
- We may update products (patches, improvements) or discontinue them.
- We may update these Terms. The version accepted at purchase is recorded as evidence for that Order.

---

## 17) Governing law and jurisdiction
- These Terms are interpreted under the law of the **country where the legal owner/operator of {{STORE_NAME}} operates** (**{{LEGAL_COUNTRY}}**, when applicable), unless mandatory consumer protection laws in your country provide otherwise.
- Disputes shall be submitted to competent courts as applicable.

> Note: Once you define a legal entity (e.g., a company in Chile), fill \`{{LEGAL_COUNTRY}}\` and, if appropriate, the city/court.

---

## 18) Contact
For support and legal matters:  
**Email:** {{CONTACT_EMAIL}}

---

# PRIVACY POLICY — {{STORE_NAME}} (EN)
**Version:** v1.1  
**Effective date:** 2026-02-16

---

## 1) Data we collect
We may collect:
- **Purchase data:** email, product, price, order IDs, payment status, processor IDs (e.g., PayPal transaction/capture id).
- **Technical data:** UTC timestamps, User-Agent, system events, file hashes (SHA256), download/access logs.
- **IP address:** stored **encrypted** (e.g., AES-256-GCM) and used for security/fraud prevention. In normal views it may appear masked.

We do not directly receive card details when payment is processed by PayPal or another provider.

---

## 2) How we use your data
- Process purchases and deliver Digital Products.
- Prevent fraud and abuse.
- Comply with legal/accounting obligations.
- Respond to claims, disputes or chargebacks.
- Improve service reliability and analytics.

---

## 3) Legal basis
Depending on your jurisdiction, we process data under bases such as:
- contract performance (delivery),
- legitimate interests (security/fraud prevention),
- legal obligations (accounting/tax),
- consent (for non-essential communications where applicable).

---

## 4) Data retention
- We retain order evidence and anti-fraud logs for an indicative period of **540 days** (approx. 18 months) to cover dispute windows and audits.
- After that, we delete or anonymize where reasonably possible, unless a longer legal obligation applies.

---

## 5) Sharing with third parties
We may share minimal necessary data with:
- Payment processors (e.g., PayPal) to process transactions.
- Infrastructure providers (hosting, databases, storage like S3/R2, email SMTP/transactional providers) to operate the service.
- Authorities when legally required.

We do not sell your personal data.

---

## 6) International transfers
Our providers (hosting/CDN/email/storage) may operate in different countries. Where international transfers occur:
- we apply reasonable security measures,
- and select reputable providers that offer appropriate safeguards as required by applicable law.

---

## 7) Security
We apply reasonable measures such as:
- IP encryption,
- signed download tokens,
- append-only event logs,
- administrative access control,
- backups and monitoring.

No system is 100% secure.

---

## 8) Your rights
Depending on your country, you may have rights to:
- access, correction, updating,
- deletion (where applicable),
- objection or restriction,
- portability,
- complaints to a supervisory authority.

To exercise rights, contact us with your email and (if applicable) your order number.

---

## 9) Data controller and privacy contact
**Controller:** {{LEGAL_ENTITY_NAME}} (if applicable) / Operator of {{STORE_NAME}}  
**Privacy email:** {{PRIVACY_EMAIL}}`;

  const termsHash = sha256(termsContent);
  const terms = await prisma.termsVersion.upsert({
    where: { id: "seed-terms-v1" },
    update: {
      content: termsContent,
      contentHash: termsHash,
      versionLabel: "v1.1",
      isActive: true,
    },
    create: {
      id: "seed-terms-v1",
      versionLabel: "v1.1",
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
  console.log(`   Terms: v1.1 (active)`);
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
