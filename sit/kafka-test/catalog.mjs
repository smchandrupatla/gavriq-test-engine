// The "Kafka test" category for the SIT console's own case catalog. sit/lib/catalog.mjs is
// synced from Sand Bench, so the engine's own cases are described here instead.

export const KAFKA_TEST_FILES = {
  "25-kafka-schedule.sit.ts": { group: "schedule", key: "kafka-schedule" },
  "26-kafka-data-feeder.sit.ts": { group: "data-feeder", key: "kafka-data-feeder" },
  "27-kafka-formats.sit.ts": { group: "formats", key: "kafka-formats" },
  "28-kafka-exceptions.sit.ts": { group: "exceptions", key: "kafka-exceptions" },
  "29-kafka-load.sit.ts": { group: "load", key: "kafka-load" },
};

export const KAFKA_TEST_TYPE = {
  id: "kafka-test",
  title: "Kafka test",
  summary: "Sand Bench schedules and data feeders delivering to Kafka, confirmed by Kafka Desk.",
};

export const KAFKA_TEST_GROUPS = {
  "kafka-test": [
    { id: "schedule", title: "Schedule → Kafka" },
    { id: "data-feeder", title: "Data feeder → Kafka" },
    { id: "formats", title: "Formats: JSON · XML · flat file" },
    { id: "exceptions", title: "Exceptions: Kafka down, recovery, interruption" },
    { id: "load", title: "Load" },
  ],
};

export function kafkaTestSuiteOf(fileName) {
  return KAFKA_TEST_FILES[fileName] ? "kafka-test" : null;
}

export function kafkaTestGroupOf(fileName) {
  return KAFKA_TEST_FILES[fileName]?.group ?? null;
}
