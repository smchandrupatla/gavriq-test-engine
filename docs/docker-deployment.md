# Docker deployment for gavriq-test-engine

Run these commands from this repository. Node.js 22+ and Docker Compose v2 are required on the host. No parent SandBench checkout or host npm installation is needed. Dependencies install inside the application images.

## Configure

Copy .env.example to .env and set the required values. Review compose.yaml for local development credentials, exposed localhost ports, and external integrations. Data Browser needs a target database; Deployment Control needs explicit workspace and Docker access for operational actions.

## Windows PowerShell

```powershell
./scripts/docker-deploy.ps1
./scripts/docker-health.ps1
./scripts/docker-test.ps1
./scripts/docker-stop.ps1
```

## Linux, macOS, or a POSIX shell

```sh
sh scripts/docker-deploy.sh
sh scripts/docker-health.sh
sh scripts/docker-test.sh
sh scripts/docker-stop.sh
```

Deploy validates Compose, builds images, and waits for readiness. Health checks every default-profile service and the application HTTP health endpoint. Test requires a running deployment, checks readiness, and runs the cases in scripts/docker-checks.json. Stop removes only this Compose project's containers and network; it does not remove volumes.

## Isolated validation

```sh
node scripts/docker.mjs validate --isolated --env-file .env.example
```

This builds and starts a separate gavriq-test-engine-validation project, runs health and test cases, and stops its containers even if a check fails. No host ports are published. Persistent volumes use the separate project name and are retained. Data Browser uses its isolated viewer database as a test target. External integrations remain configured endpoints and are not exercised by the supplied read-only cases. Do not run two validations of this same repository concurrently.

Use --no-build to reuse existing images, --timeout 300 to change startup wait time, and --env-file PATH to select configuration. Named profiles are not enabled by these scripts.

## Results and limitations

Exit code 0 means the requested operation passed. A failed assertion, missing service, unhealthy container, Docker error, or cleanup failure produces a nonzero exit code. Results are written to .docker-results/<action>.json and excluded from Git.

Container readiness, HTTP health, landing page where available, and a representative application read contract. These are repository deployment tests, not the full inherited acceptance suite. Broker round trips, external integrations, and persistence are not covered.

A successful run does not establish production readiness.

The deployment runner itself can be tested without Docker: `node --test scripts/tests/docker-runner.test.mjs`.
