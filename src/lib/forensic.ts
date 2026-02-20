import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { sha256 } from "./hashing";
import { encryptIp, maskIp } from "./privacy";

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

  // Compute event hash
  const hashInput = [
    orderId,
    String(sequenceNumber),
    eventType,
    JSON.stringify(eventData),
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
    const hashInput = [
      event.orderId,
      String(event.sequenceNumber),
      event.eventType,
      JSON.stringify(event.eventData),
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
      };
    }

    // Also verify prevHash linkage
    if (event.prevHash !== prevHash) {
      return {
        valid: false,
        totalEvents: events.length,
        firstEventAt: events[0].createdAt,
        lastEventAt: events[events.length - 1].createdAt,
        brokenAtSequence: event.sequenceNumber,
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
