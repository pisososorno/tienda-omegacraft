/**
 * Watermark injection for source code files.
 * Adds a unique order/buyer fingerprint + legal block to source files.
 */

const LEGAL_BLOCK = `================================================================================
LICENSED PRODUCT — DO NOT REDISTRIBUTE
Purchased by: {{BUYER_EMAIL}}
Order: {{ORDER_NUMBER}} | Date: {{DATE}}
License: {{LICENSE_KEY}}
Fingerprint: {{FINGERPRINT}}
Any unauthorized distribution is a violation of the license agreement
and may result in legal action. ${process.env.APP_URL || 'https://localhost:3000'}/terms
================================================================================`;

export interface WatermarkData {
  buyerEmail: string;
  orderNumber: string;
  licenseKey: string;
  fingerprint: string;
  date: string;
}

/**
 * Generate the legal watermark block with interpolated data.
 */
export function generateLegalBlock(data: WatermarkData): string {
  return LEGAL_BLOCK.replace("{{BUYER_EMAIL}}", data.buyerEmail)
    .replace("{{ORDER_NUMBER}}", data.orderNumber)
    .replace("{{DATE}}", data.date)
    .replace("{{LICENSE_KEY}}", data.licenseKey)
    .replace("{{FINGERPRINT}}", data.fingerprint);
}

/**
 * Wrap the legal block in a comment for Java/JS files.
 */
export function wrapAsJavaComment(block: string): string {
  const lines = block.split("\n");
  return ["/*", ...lines.map((l) => ` * ${l}`), " */"].join("\n");
}

/**
 * Wrap the legal block for YAML/properties files.
 */
export function wrapAsHashComment(block: string): string {
  return block
    .split("\n")
    .map((l) => `# ${l}`)
    .join("\n");
}

/**
 * Generate a LICENSE.txt content with the legal block.
 */
export function generateLicenseTxt(data: WatermarkData): string {
  return `${generateLegalBlock(data)}

This product is licensed under a single-use, non-transferable license.
You may modify the product for your own use but may not redistribute
the original or modified versions.

Full terms: ${process.env.APP_URL || 'https://localhost:3000'}/terms
`;
}

/**
 * Inject watermark into a Java source file (prepend comment).
 */
export function watermarkJavaFile(
  content: string,
  data: WatermarkData
): string {
  const comment = wrapAsJavaComment(generateLegalBlock(data));
  return `${comment}\n\n${content}`;
}

/**
 * Inject watermark into a YAML/properties file (prepend comment).
 */
export function watermarkConfigFile(
  content: string,
  data: WatermarkData
): string {
  const comment = wrapAsHashComment(generateLegalBlock(data));
  return `${comment}\n\n${content}`;
}

/**
 * Determine watermark type based on file extension.
 */
export function getWatermarkType(
  filename: string
): "java" | "config" | "none" {
  const ext = filename.split(".").pop()?.toLowerCase();
  if (!ext) return "none";

  const javaExts = ["java", "js", "ts", "kt", "groovy", "scala", "cs"];
  const configExts = ["yml", "yaml", "properties", "toml", "cfg", "conf"];

  if (javaExts.includes(ext)) return "java";
  if (configExts.includes(ext)) return "config";
  return "none";
}
