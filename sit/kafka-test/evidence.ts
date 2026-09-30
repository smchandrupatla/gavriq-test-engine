import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { KAFKA_TEST } from "./env.ts";

/**
 * Checkpoints and evidence for a Kafka test.
 *
 * A checkpoint is one thing that must be true, recorded against the system that has to
 * prove it: "sand-bench" (what Sand Bench says it did), "kafka-desk" (what Kafka Desk
 * independently saw) or "test-engine" (the test's own set-up and comparisons). A checkpoint
 * that does not hold is recorded as failed and the test stops there, so the evidence file
 * always shows exactly how far the message got and where it stopped.
 *
 * The file written at the end (EVIDENCE_DIR/kafka-test/<run>.json, plus latest-<case>.json)
 * is what the Test Engine's "Kafka test" menu shows: the checkpoints, and for every message
 * its id, what Sand Bench recorded and what Kafka Desk consumed.
 */

export type System = "sand-bench" | "kafka-desk" | "test-engine";

export type Checkpoint = {
  id: string;
  system: System;
  title: string;
  status: "passed" | "failed";
  at: string;
  detail?: string;
  data?: unknown;
};

export type Coordinates = { topic: string; partition: number; offset: number };

export type MessageEvidence = {
  ordinal: number;
  messageId: string | null;
  /** What Sand Bench recorded for this delivery. */
  sandBench: { runId: string; seq: number; status: string; detail?: string | null; coordinates: Coordinates | null };
  /** What Kafka Desk consumed from the broker. */
  kafkaDesk: { found: boolean; source?: string; coordinates?: Coordinates | null; seenAt?: string; matchedBy?: string | null };
  /** Topic, partition and offset agree between the two. */
  coordinatesMatch: boolean;
};

export type EvidenceFile = {
  case: string;
  title: string;
  runId: string;
  result: "passed" | "failed" | "running";
  startedAt: string;
  finishedAt: string | null;
  error: string | null;
  environment: Record<string, unknown>;
  sandBench: Record<string, unknown>;
  checkpoints: Checkpoint[];
  messages: MessageEvidence[];
};

export class CheckpointFailed extends Error {
  constructor(public checkpoint: Checkpoint) {
    super(`Checkpoint ${checkpoint.id} failed [${checkpoint.system}]: ${checkpoint.title}${checkpoint.detail ? ` — ${checkpoint.detail}` : ""}`);
    this.name = "CheckpointFailed";
  }
}

export class Evidence {
  readonly runId: string;
  readonly startedAt = new Date().toISOString();
  readonly checkpoints: Checkpoint[] = [];
  readonly messages: MessageEvidence[] = [];
  readonly sandBench: Record<string, unknown> = {};
  private error: string | null = null;

  constructor(readonly caseKey: string, readonly title: string, private environment: Record<string, unknown> = {}) {
    this.runId = `${caseKey}-${this.startedAt.replace(/[-:.TZ]/g, "").slice(0, 14)}-${Math.random().toString(16).slice(2, 6)}`;
  }

  private write(cp: Checkpoint) {
    this.checkpoints.push(cp);
    process.stdout.write(`[kafka-test] ${cp.status === "passed" ? "PASS" : "FAIL"} ${cp.id} [${cp.system}] ${cp.title}${cp.detail ? ` — ${cp.detail}` : ""}\n`);
  }

  /** Record a checkpoint that holds. */
  pass(id: string, system: System, title: string, detail?: string, data?: unknown) {
    this.write({ id, system, title, status: "passed", at: new Date().toISOString(), detail, data });
  }

  /** Record a checkpoint that does not hold and stop the test. */
  fail(id: string, system: System, title: string, detail?: string, data?: unknown): never {
    const cp: Checkpoint = { id, system, title, status: "failed", at: new Date().toISOString(), detail, data };
    this.write(cp);
    throw new CheckpointFailed(cp);
  }

  /** `condition` true records a pass; false records a failure and throws. */
  check(condition: unknown, id: string, system: System, title: string, detail?: string | (() => string), data?: unknown) {
    const text = typeof detail === "function" ? detail() : detail;
    if (condition) this.pass(id, system, title, text, data);
    else this.fail(id, system, title, text, data);
  }

  set(environment: Record<string, unknown>) {
    Object.assign(this.environment, environment);
  }

  finish(error?: unknown) {
    this.error = error ? (error instanceof Error ? error.message : String(error)) : null;
  }

  toJSON(): EvidenceFile {
    const failed = this.checkpoints.some((cp) => cp.status === "failed") || Boolean(this.error);
    return {
      case: this.caseKey,
      title: this.title,
      runId: this.runId,
      result: this.error === null && !failed ? "passed" : "failed",
      startedAt: this.startedAt,
      finishedAt: new Date().toISOString(),
      error: this.error,
      environment: this.environment,
      sandBench: this.sandBench,
      checkpoints: this.checkpoints,
      messages: this.messages,
    };
  }

  /** Written even when the test failed: a failed run's evidence is the most useful kind. */
  async save(): Promise<string | null> {
    try {
      await mkdir(KAFKA_TEST.evidenceDir, { recursive: true });
      const body = JSON.stringify(this.toJSON(), null, 2);
      const file = path.join(KAFKA_TEST.evidenceDir, `${this.runId}.json`);
      await writeFile(file, body);
      await writeFile(path.join(KAFKA_TEST.evidenceDir, `latest-${this.caseKey}.json`), body);
      process.stdout.write(`[kafka-test] evidence saved: ${file}\n`);
      return file;
    } catch (error) {
      process.stdout.write(`[kafka-test] could not save evidence: ${error instanceof Error ? error.message : String(error)}\n`);
      return null;
    }
  }
}
