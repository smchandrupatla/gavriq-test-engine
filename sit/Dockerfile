# Dedicated image for the SIT engine (sit + sit-console) — separate from the main
# app/worker image (root Dockerfile). It carries two independent browser-automation
# frameworks for the UI-phase cases (sit/cases/60-*.sit.ts and 70/80-*.sit.ts), which
# the lightweight node:22 image the rest of the platform runs on doesn't have;
# api/worker/web/dbviewer/testhub have no reason to carry that weight:
#   - Playwright, via the browser this base image bundles at /ms-playwright. Version
#     must match package.json's "playwright" version exactly.
#   - Selenium WebDriver, via chromium + chromium-driver installed from the base
#     image's own Debian package repository. Installing both from the same apt
#     transaction is what keeps them a matching pair — Selenium's ChromeDriver
#     refuses to drive a Chrome build from a different major version, and a
#     manually-paired download is not reproducible across rebuilds the way an apt
#     package pin is.
FROM mcr.microsoft.com/playwright:v1.55.1-noble
WORKDIR /app
RUN apt-get update \
  && apt-get install -y --no-install-recommends chromium chromium-driver \
  && rm -rf /var/lib/apt/lists/*
ENV SIT_CHROME_BINARY=/usr/bin/chromium
ENV SIT_CHROMEDRIVER_PATH=/usr/bin/chromedriver
COPY package.json package-lock.json* ./
# The base image already bundles the matching browser at /ms-playwright; skip
# playwright's own download so `npm install` doesn't also try to fetch one.
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
RUN npm install
COPY sit ./sit
COPY dev ./dev
COPY docs/use-cases ./docs/use-cases
COPY tsconfig.json ./
ENV NODE_ENV=production
ENV PORT=8098
EXPOSE 8098
CMD ["node", "sit/console.mjs"]
