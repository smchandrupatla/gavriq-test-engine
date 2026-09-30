import { KAFKA_TEST, deskAuthHeaders } from "./env.ts";
import type { Coordinates } from "./evidence.ts";

// Kafka Desk (gavriq-kafka-desk) as the test sees it: an independent application that
// consumes the topic from the broker by itself. Everything here is a read, except verify,
// which only asks the desk what it has already consumed.

const TIMEOUT_MS = 8000;

export async function deskJson<T = unknown>(path: string, init: RequestInit = {}, timeoutMs = TIMEOUT_MS): Promise<{ status: number; body: T }> {
  const res = await fetch(`${KAFKA_TEST.deskBase}${path}`, {
    ...init,
    headers: { "content-type": "application/json", ...deskAuthHeaders(), ...(init.headers || {}) },
    signal: init.signal ?? AbortSignal.timeout(timeoutMs),
  });
  const body = (await res.json().catch(() => ({}))) as T;
  return { status: res.status, body };
}

export type DeskStatus = {
  tap?: { enabled: boolean; connected: boolean; topics: string[]; received: number; lastError: string | null; proxy: string };
  checkpoints?: { total: number; broker: number };
};

export type DeskEvidence = {
  source: string;
  topic: string;
  partition: number | null;
  offset: number | null;
  seenAt: string;
  ids: string[];
  format?: string;
  encoding?: string;
  layout?: string;
  preview?: string;
};

export type VerifyResult = {
  total: number;
  found: number;
  complete: boolean;
  missing: Array<string | null>;
  results: Array<{ index: number; id: string | null; found: boolean; matchedBy: string | null; count?: number; evidence: DeskEvidence | null }>;
};

/** Ask the desk to confirm messages were consumed from the broker, waiting up to waitMs for late ones. */
export async function verifyOnDesk(items: Array<{ id?: string; payload?: unknown }>, waitMs: number) {
  return deskJson<VerifyResult>(
    "/app/checkpoints/verify",
    { method: "POST", body: JSON.stringify({ items, sources: ["broker"], waitMs }) },
    waitMs + 10_000
  );
}

export function coordinatesOf(evidence: DeskEvidence | null | undefined): Coordinates | null {
  if (!evidence || evidence.partition == null || evidence.offset == null) return null;
  return { topic: evidence.topic, partition: evidence.partition, offset: evidence.offset };
}
