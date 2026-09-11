# gavriq-test-engine

Post-deployment integration and browser test runner with execution history and use-case traceability.

## Extraction status

Application files and local container configuration have been copied into this repository. This is an extraction candidate with passing image builds and limited smoke checks, not a finalized standalone release. See [verification status](docs/verification.md).

## Local evaluation

Copy .env.example to .env and configure integration endpoints and any required credentials. Run:

```sh
docker compose config
docker compose up --build
```

Application ports bind to localhost. Owned databases and volumes are defined in compose.yaml. External systems are configured through .env rather than requiring another source checkout.

## Included services

- sit-console
- sit-console-db
- sit

## Known limitations

- Image builds and packaging-path checks passed. Full functional acceptance is still pending.
- External integrations must be configured. A portal starting does not establish end-to-end functionality.
- Copied shared code is vendored here; there are no filesystem links back to SandBench.
- Existing development database credentials remain in inherited local container definitions; production hardening is pending.

## Provenance

See [extraction provenance](docs/extraction-provenance.md).

## License

Copyright (c) 2026 Gavriq Labs Global. All rights reserved. Proprietary software; see [LICENSE](LICENSE). Third-party components retain their respective licenses.

## Validation snapshot

Passed: application startup, health endpoint, and one application read endpoint. See [verification](docs/verification.md) and [smoke evidence](docs/smoke-result.json).
