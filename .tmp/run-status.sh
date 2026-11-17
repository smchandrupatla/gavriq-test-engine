#!/usr/bin/env bash
# Scratch helper: progress and results of one verification run.
#   .tmp/run-status.sh verify-run-1            summary
#   .tmp/run-status.sh verify-run-1 failures   + every non-passing case
SRC="$1"; MODE="$2"
PSQL="docker exec gavriq-test-engine-sit-console-db-1 psql -U sitconsole -d sitconsole -P pager=off -A -F |"

$PSQL -t -c "SELECT 'executions: ' || string_agg(status || '=' || n, '  ' ORDER BY status)
             FROM (SELECT status::text, count(*) n FROM test_engine.executions WHERE trigger_source='$SRC' GROUP BY 1) s"
$PSQL -t -c "SELECT 'cases planned: ' || COALESCE(sum(cardinality(test_case_ids)),0) FROM test_engine.executions WHERE trigger_source='$SRC'"
$PSQL -t -c "SELECT 'results: ' || COALESCE(string_agg(status || '=' || n, '  ' ORDER BY status), '(none yet)')
             FROM (SELECT r.status::text, count(*) n FROM test_engine.execution_results r
                   JOIN test_engine.executions e ON e.id=r.execution_id WHERE e.trigger_source='$SRC' GROUP BY 1) s"
$PSQL -t -c "SELECT 'running now: ' || COALESCE(string_agg(COALESCE(metadata->>'suite_key', key), ', '), '-')
             FROM test_engine.executions WHERE trigger_source='$SRC' AND status='running'"
$PSQL -t -c "SELECT 'window: ' || min(started_at)::timestamp(0) || ' -> ' || COALESCE(max(finished_at)::timestamp(0)::text,'') || '   now ' || now()::timestamp(0)
             FROM test_engine.executions WHERE trigger_source='$SRC'"

if [ "$MODE" = "failures" ]; then
  $PSQL -c "SELECT COALESCE(e.metadata->>'suite_key','-') suite, tc.key, tc.execution_method m, r.status, r.classification cls, r.duration_ms ms,
                   left(regexp_replace(r.message, E'[\\n\\r]+', ' ', 'g'), 210) msg
            FROM test_engine.execution_results r
            JOIN test_engine.executions e ON e.id=r.execution_id
            JOIN test_engine.test_cases tc ON tc.id=r.test_case_id
            WHERE e.trigger_source='$SRC' AND r.status <> 'passed'
            ORDER BY 1, 2"
fi
