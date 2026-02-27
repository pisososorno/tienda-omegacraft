/**
 * Compatibility constants and helpers for Minecraft product versioning/platforms.
 */

// ── Common Minecraft versions (presets for UI) ──────────────────
export const MC_VERSION_PRESETS = [
  "1.8", "1.8.9",
  "1.9", "1.10", "1.11", "1.12", "1.12.2",
  "1.13", "1.14", "1.15", "1.16", "1.16.5",
  "1.17", "1.17.1", "1.18", "1.18.2",
  "1.19", "1.19.4", "1.20", "1.20.1", "1.20.2", "1.20.4", "1.20.6",
  "1.21", "1.21.1", "1.21.4",
] as const;

// ── Allowed platforms ───────────────────────────────────────────
export const PLATFORMS = [
  "Paper", "Spigot", "Bukkit", "Fabric", "Forge", "Geyser",
] as const;

export type Platform = (typeof PLATFORMS)[number];

// ── Display helpers ─────────────────────────────────────────────

/**
 * Returns a human-readable version label for display.
 * - If supportedVersions has values, shows a compact list (e.g. "1.20.1–1.20.4")
 * - If min/max are set, shows range (e.g. "1.16 – 1.20.4")
 * - If only min, shows single version
 */
export function formatVersionLabel(
  supportedVersions: string[],
  minecraftVersionMin: string | null | undefined,
  minecraftVersionMax: string | null | undefined,
): string {
  if (supportedVersions.length > 0) {
    const sorted = [...supportedVersions].sort(compareMcVersion);
    if (sorted.length === 1) return sorted[0];
    // Show first and last
    return `${sorted[0]}–${sorted[sorted.length - 1]}`;
  }
  if (minecraftVersionMin && minecraftVersionMax) {
    if (minecraftVersionMin === minecraftVersionMax) return minecraftVersionMin;
    return `${minecraftVersionMin}–${minecraftVersionMax}`;
  }
  if (minecraftVersionMin) return minecraftVersionMin;
  return "";
}

/**
 * Compare two Minecraft version strings for sorting.
 */
export function compareMcVersion(a: string, b: string): number {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const va = pa[i] ?? 0;
    const vb = pb[i] ?? 0;
    if (va !== vb) return va - vb;
  }
  return 0;
}
