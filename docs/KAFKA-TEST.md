# Kafka test

Two on-demand tests, under **Kafka test** in the Test Engine menu (`#/kafka-test`), prove that what
Sand Bench sends to Kafka arrives in Kafka:

| Test | File | What it does |
| --- | --- | --- |
| Schedule → Kafka | `sit/cases/25-kafka-schedule.sit.ts` | Creates a dataset, test case and **schedule** in Sand Bench (target: the *Sand Bench Kafka Desk* connection). The Sand Bench worker fires it; the run's generated messages go to topic `sandbench.out`. |
| Data feeder → Kafka | `sit/cases/26-kafka-data-feeder.sit.ts` | Creates a dataset of messages with known IDs and a **data feeder** that trickles them over ~12 s, starts it and watches messages arrive. |

Each test writes **checkpoints** for both systems (`SB` = Sand Bench, `KD` = Kafka Desk) and stops at the first
one that does not hold, so the evidence shows where a message stopped:

- Sand Bench: Kafka channel really delivers (not "simulated"); schedule/feeder created and run by the worker;
  every delivery **acknowledged** by the broker with topic/partition/offset.
- Kafka Desk: consuming the topic; **consumed every message ID from the broker** (`POST /app/checkpoints/verify`),
  at the same topic/partition/offset Sand Bench was given; visible in its Receive list; (feeder) messages were
  appearing while the feeder was still sending, in send order.

Evidence: `EVIDENCE_DIR/kafka-test/<run>.json` and `latest-<case>.json`, shown in the menu (per-message table:
message ID, what Sand Bench recorded, what Kafka Desk consumed).

## Run it in Docker

```sh
sh scripts/kafka-stack.sh up      # Kafka Desk+Redpanda, Sand Bench (compose.kafkadesk.yml), Test Engine
# open http://localhost:8788/#/kafka-test  ->  "Run both tests"
sh scripts/kafka-stack.sh test    # or start them from the shell
```

The three compose projects share the network `gavriq-kafka-net` (Kafka Desk = `kafka-desk`, Redpanda =
`kafka-desk-redpanda`, Sand Bench API = `sandbench-api`). The engine runs on 8788 because Sand Bench owns 8787.
Sand Bench's built-in `kafkaportal` is disabled in this mode (same port and name as Kafka Desk).

## Settings (Test Engine container)

`SIT_API_BASE` (Sand Bench), `SIT_KAFKA_DESK_BASE`, `SIT_KAFKA_DESK_USER/PASS`, `SIT_KAFKA_CONNECTION_ID`
(default `ext_kafka_desk`), `SIT_KAFKA_FEEDER_MESSAGES` / `_SECONDS`, `SIT_KAFKA_SCHEDULE_WAIT_MS`,
`SIT_KAFKA_DESK_CONFIRM_MS`. Login uses `SIT_USERNAME` / `SIT_PASSWORD` (default `operator.acme`).

## Without Docker

`npx tsx --test tests/kafka-test-flow.test.ts` runs both cases against the real Kafka Desk (sibling checkout), a
fake Kafka REST proxy and a mock Sand Bench API, and checks they fail at the right checkpoint when delivery is
only simulated, a message never reaches the broker, or the worker never runs the schedule.
