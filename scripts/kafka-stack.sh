#!/bin/sh
# Bring up / down the three stacks the "Kafka test" menu needs, joined by the Docker network
# gavriq-kafka-net:  Kafka Desk + Redpanda, Sand Bench (with compose.kafkadesk.yml), this engine.
#   sh scripts/kafka-stack.sh up | down | status | test
# Sibling checkouts are assumed next to this repo; override with KAFKA_DESK_DIR / SANDBENCH_DIR.
set -eu
HERE=$(cd "$(dirname "$0")/.." && pwd)
DESK=${KAFKA_DESK_DIR:-$HERE/../gavriq-kafka-desk}
SB=${SANDBENCH_DIR:-$HERE/../sand-bench-enterprise}
export TEST_ENGINE_HOST_PORT=${TEST_ENGINE_HOST_PORT:-8788}   # Sand Bench owns 8787

need() { [ -d "$1" ] || { echo "missing checkout: $1 (set $2)"; exit 1; }; }
need "$DESK" KAFKA_DESK_DIR; need "$SB" SANDBENCH_DIR

case "${1:-status}" in
  up)
    echo "== Kafka Desk + Redpanda"; (cd "$DESK" && KAFKA_DESK_TESTHUB_PORT=${KAFKA_DESK_TESTHUB_PORT:-18091} docker compose --profile kafka up -d --build)
    echo "== Sand Bench";            (cd "$SB" && docker compose -f docker-compose.yml -f compose.kafkadesk.yml up -d --build)
    echo "== Test Engine";           (cd "$HERE" && docker compose up -d --build test-engine)
    echo
    echo "Test Engine  http://localhost:$TEST_ENGINE_HOST_PORT/#/kafka-test   (menu: Kafka test)"
    echo "Kafka Desk   http://localhost:8095      Sand Bench  http://localhost:8080"
    ;;
  down)
    (cd "$HERE" && docker compose down); (cd "$SB" && docker compose -f docker-compose.yml -f compose.kafkadesk.yml down)
    (cd "$DESK" && docker compose --profile kafka down) ;;
  status)
    curl -fsS "http://localhost:$TEST_ENGINE_HOST_PORT/api/v1/kafka-test/status" || echo "Test Engine not reachable on $TEST_ENGINE_HOST_PORT" ;;
  test)
    curl -fsS -X POST -H 'content-type: application/json' -d '{"files":["25-kafka-schedule.sit.ts","26-kafka-data-feeder.sit.ts"]}' \
      "http://localhost:$TEST_ENGINE_HOST_PORT/api/v1/sit-runs" && echo && echo "Started. Watch: http://localhost:$TEST_ENGINE_HOST_PORT/#/kafka-test" ;;
  *) echo "usage: $0 up|down|status|test"; exit 2 ;;
esac
