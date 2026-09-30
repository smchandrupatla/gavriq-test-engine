// What each Kafka test checks, in order, before it has run. The ids are exactly the checkpoint
// ids the cases write into their evidence (tests/kafka-test-flow.test.ts fails if they drift), so
// the "Kafka test" menu can show the plan first and the result of each checkpoint after a run.
//   SB = Sand Bench's checkpoint, KD = Kafka Desk's.

const sb = (id, title) => ({ id, system: "sand-bench", title });
const kd = (id, title) => ({ id, system: "kafka-desk", title });

export const KAFKA_TEST_CASES = [
  {
    key: "kafka-schedule",
    file: "25-kafka-schedule.sit.ts",
    title: "Schedule → Kafka",
    summary: "Create a schedule in Sand Bench. When the worker runs it, its generated test messages go to Kafka; Kafka Desk must have consumed every one.",
    checkpoints: [
      sb("SCH-SB-01", "Sand Bench is ready and its Kafka channel delivers to a real broker"),
      kd("SCH-KD-01", "Kafka Desk is up and consuming the topic from the broker"),
      sb("SCH-SB-02", "Sand Bench has the Kafka Desk connection, enabled, with a topic"),
      sb("SCH-SB-03", "Dataset created for the scheduled test case"),
      sb("SCH-SB-03b", "Test case created and linked to the dataset"),
      sb("SCH-SB-04", "Schedule created in Sand Bench for the Kafka Desk connection"),
      sb("SCH-SB-05", "The Sand Bench worker ran the schedule when it came due"),
      sb("SCH-SB-06", "The scheduled run has deliveries"),
      sb("SCH-SB-07a", "Sand Bench recorded every delivery for the run"),
      sb("SCH-SB-07b", "Every delivery was acknowledged by the Kafka broker (none simulated, failed or blocked)"),
      sb("SCH-SB-07c", "Every acknowledgement carries the broker's topic, partition and offset"),
      sb("SCH-SB-07d", "All deliveries went over the kafka channel"),
      kd("SCH-KD-02a", "Kafka Desk answered the checkpoint request"),
      kd("SCH-KD-02b", "Kafka Desk consumed every message ID from Kafka"),
      kd("SCH-KD-02c", "Each message sits at the same topic, partition and offset in Sand Bench and in Kafka Desk"),
      kd("SCH-KD-03", "The message is listed in Kafka Desk's Receive list and can be found by its ID"),
    ],
  },
  {
    key: "kafka-data-feeder",
    file: "26-kafka-data-feeder.sit.ts",
    title: "Data feeder → Kafka",
    summary: "Create a dataset of messages with known IDs and a data feeder in Sand Bench that trickles them to Kafka. Kafka Desk must show them arriving while the feeder runs and have consumed every one.",
    checkpoints: [
      sb("FDR-SB-01", "Sand Bench is ready and its Kafka channel delivers to a real broker"),
      kd("FDR-KD-01", "Kafka Desk is up and consuming the topic from the broker"),
      sb("FDR-SB-02", "Sand Bench has the Kafka Desk connection, enabled, with a topic"),
      sb("FDR-SB-03", "Dataset created for the feeder"),
      sb("FDR-SB-03b", "Messages with known IDs stored in the dataset"),
      sb("FDR-SB-04", "Data feeder created in Sand Bench for the Kafka Desk connection"),
      sb("FDR-SB-05", "The feeder's send plan lists every message with its send time"),
      sb("FDR-SB-06", "Feeder started; it sends over the kafka channel"),
      sb("FDR-SB-07", "The feeder ran to completion"),
      sb("FDR-SB-07b", "All messages were sent, none failed or blocked"),
      kd("FDR-KD-01b", "Messages were appearing in Kafka Desk while the feeder was still sending"),
      sb("FDR-SB-08a", "Sand Bench recorded every delivery for the run"),
      sb("FDR-SB-08b", "Every delivery was acknowledged by the Kafka broker (none simulated, failed or blocked)"),
      sb("FDR-SB-08c", "Every acknowledgement carries the broker's topic, partition and offset"),
      sb("FDR-SB-08d", "The messages went out in dataset order with the IDs this test stored"),
      kd("FDR-KD-02a", "Kafka Desk answered the checkpoint request"),
      kd("FDR-KD-02b", "Kafka Desk consumed every message ID from Kafka"),
      kd("FDR-KD-02c", "Each message sits at the same topic, partition and offset in Sand Bench and in Kafka Desk"),
      kd("FDR-KD-04", "On the topic the messages are in the order the feeder sent them"),
      kd("FDR-KD-03", "The message is listed in Kafka Desk's Receive list and can be found by its ID"),
    ],
  },
];
