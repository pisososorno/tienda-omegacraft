import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { sha256 } from "./hashing";
import { encryptIp, maskIp } from "./privacy";

/**
 * Canonical JSON serialization — sorts object keys recursively
 * so the output is deterministic regardless of insertion order.
 * This is critical because PostgreSQL JSONB reorders keys.
 */
export function canonicalJson(value: unknown): string {
  if (value === null || value === undefined) return "null";
  if (typeof value === "boolean" || typeof value === "number") return JSON.stringify(value);
  if (typeof value === "string") return JSON.stringify(value);
  if (Array.isArray(value)) {
    return "[" + value.map(canonicalJson).join(",") + "]";
  }
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj).sort();
    const pairs = keys.map((k) => JSON.stringify(k) + ":" + canonicalJson(obj[k]));
    return "{" + pairs.join(",") + "}";
  }
  return JSON.stringify(value);
}

export interface AppendEventInput {
  orderId: string;
  eventType: string;
  eventData?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  externalRef?: string;
}

/**
 * Append a tamper-evident event to the order event chain.
 *
 * 1. Get the last event for this order (max sequence_number).
 * 2. Compute sequence_number = last.sequence_number + 1 (or 1 if first).
 * 3. Compute event_hash = SHA256(order_id|seq|type|data|prev_hash|created_at).
 * 4. Insert with unique constraint on (order_id, sequence_number).
 */
export async function appendEvent(input: AppendEventInput) {
  const {
    orderId,
    eventType,
    eventData = {},
    ipAddress,
    userAgent,
    externalRef,
  } = input;

  // Get last event in chain
  const lastEvent = await prisma.orderEvent.findFirst({
    where: { orderId },
    orderBy: { sequenceNumber: "desc" },
    select: { sequenceNumber: true, eventHash: true },
  });

  const sequenceNumber = lastEvent ? lastEvent.sequenceNumber + 1 : 1;
  const prevHash = lastEvent ? lastEvent.eventHash : null;
  const createdAt = new Date();

  // Compute event hash (canonical JSON for deterministic serialization)
  const hashInput = [
    orderId,
    String(sequenceNumber),
    eventType,
    canonicalJson(eventData),
    prevHash || "GENESIS",
    createdAt.toISOString(),
  ].join("|");

  const eventHash = sha256(hashInput);

  // Encrypt IP if present
  const maskedIp = ipAddress ? maskIp(ipAddress) : null;
  let ipEncrypted: Buffer | null = null;
  try {
    if (ipAddress) {
      ipEncrypted = encryptIp(ipAddress);
    }
  } catch {
    // If encryption fails (key not set), continue without encrypted IP
  }

  const event = await prisma.orderEvent.create({
    data: {
      orderId,
      sequenceNumber,
      eventType,
      eventData: eventData as Prisma.InputJsonValue,
      ipAddress: maskedIp,
      ipEncrypted,
      userAgent: userAgent || null,
      externalRef: externalRef || null,
      prevHash,
      eventHash,
      createdAt,
    },
  });

  return event;
}

/**
 * Verify the integrity of the entire event chain for an order.
 * Recalculates each event_hash and checks against stored value.
 */
export async function verifyChain(orderId: string): Promise<{
  valid: boolean;
  totalEvents: number;
  firstEventAt: Date | null;
  lastEventAt: Date | null;
  brokenAtSequence: number | null;
  expectedHash?: string;
  actualHash?: string;
  detail?: string;
}> {
  const events = await prisma.orderEvent.findMany({
    where: { orderId },
    orderBy: { sequenceNumber: "asc" },
  });

  if (events.length === 0) {
    return {
      valid: true,
      totalEvents: 0,
      firstEventAt: null,
      lastEventAt: null,
      brokenAtSequence: null,
    };
  }

  let prevHash: string | null = null;

  for (const event of events) {
    // 1. Verify prevHash linkage
    if (event.prevHash !== prevHash) {
      return {
        valid: false,
        totalEvents: events.length,
        firstEventAt: events[0].createdAt,
        lastEventAt: events[events.length - 1].createdAt,
        brokenAtSequence: event.sequenceNumber,
        expectedHash: prevHash || "null (genesis)",
        actualHash: event.prevHash || "null",
        detail: `prevHash mismatch at seq #${event.sequenceNumber}: expected ${prevHash || "null"}, stored ${event.prevHash || "null"}`,
      };
    }

    // 2. Recompute event hash with canonical JSON
    const hashInput = [
      event.orderId,
      String(event.sequenceNumber),
      event.eventType,
      canonicalJson(event.eventData),
      prevHash || "GENESIS",
      event.createdAt.toISOString(),
    ].join("|");

    const expectedHash = sha256(hashInput);

    if (expectedHash !== event.eventHash) {
      return {
        valid: false,
        totalEvents: events.length,
        firstEventAt: events[0].createdAt,
        lastEventAt: events[events.length - 1].createdAt,
        brokenAtSequence: event.sequenceNumber,
        expectedHash,
        actualHash: event.eventHash,
        detail: `eventHash mismatch at seq #${event.sequenceNumber} (${event.eventType})`,
      };
    }

    prevHash = event.eventHash;
  }

  return {
    valid: true,
    totalEvents: events.length,
    firstEventAt: events[0].createdAt,
    lastEventAt: events[events.length - 1].createdAt,
    brokenAtSequence: null,
  };
}

/**
 * Re-seal the event chain for an order.
 * Recomputes all hashes using canonical JSON serialization.
 * Use this to fix chains that were broken by non-deterministic JSON.stringify.
 */
export async function resealChain(orderId: string): Promise<{
  resealed: number;
  totalEvents: number;
}> {
  const events = await prisma.orderEvent.findMany({
    where: { orderId },
    orderBy: { sequenceNumber: "asc" },
  });

  let prevHash: string | null = null;
  let updated = 0;

  for (const event of events) {
    const hashInput = [
      event.orderId,
      String(event.sequenceNumber),
      event.eventType,
      canonicalJson(event.eventData),
      prevHash || "GENESIS",
      event.createdAt.toISOString(),
    ].join("|");

    const newHash = sha256(hashInput);
    const needsUpdate = event.prevHash !== prevHash || event.eventHash !== newHash;

    if (needsUpdate) {
      await prisma.orderEvent.update({
        where: { id: event.id },
        data: {
          prevHash,
          eventHash: newHash,
        },
      });
      updated++;
    }

    prevHash = newHash;
  }

  return { resealed: updated, totalEvents: events.length };
}
