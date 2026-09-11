# IBM MQ Developer (optional)

Sand Bench does not start this broker with `docker compose up`. Testhub on `:8091` remains the default `mq` stand-in.

```bash
docker compose --profile mq up -d mqmgr
```

| Object | Value |
| --- | --- |
| Image | `icr.io/ibm-messaging/mq` (IBM MQ Advanced for Developers) |
| Queue manager | `QM1` |
| Listener | `1414` |
| Console | http://127.0.0.1:9443 |
| Channel | `DEV.APP.SVRCONN` |
| Queue | `DEV.QUEUE.1` |
| App user | `app` / `passw0rd` (developer image default) |
| CCDT | `dev/mq/ccdt.json` (placeholder; client later) |

License is free for a **single developer or tester**. Not production. Not a shared team pipeline without IBM non-production entitlement.

The API and worker read `SBE_MQ_*` from Compose. They do **not** `depends_on: mqmgr`. If `mqmgr` is down, Testhub still captures channel `mq`.
