# Consolidated Test Engine (control-plane API + dashboard) and SIT console — one
# image/container, one external port. scripts/consolidated-entrypoint.mjs runs both as
# independent Node child processes behind a small reverse proxy (/sit/* -> console,
# everything else -> API), so a crash in one doesn't take the other down even though
# they now ship together — see that script's header comment for the reasoning.
#
# Based on the Playwright image (not the plain node:22 base the worker uses) because the
# SIT console's UI-phase cases (sit/cases/60/70/80-*.sit.ts) need a real, version-matched
# browser:
#   - Playwright, via the browser this base image bundles at /ms-playwright. Version
#     must match package.json's "playwright" version exactly.
#   - Selenium WebDriver, via chromium + chromium-driver installed from the base
#     image's own Debian package repository, in the same apt transaction so the two
#     stay a matching pair (Selenium's ChromeDriver refuses to drive a Chrome build
#     from a different major version).
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

COPY apps ./apps
COPY sit ./sit
COPY dev ./dev
COPY docs ./docs
COPY tsconfig.json* ./
COPY scripts/consolidated-entrypoint.mjs ./scripts/consolidated-entrypoint.mjs

ENV NODE_ENV=production
ENV PORT=8787
ENV HOST=0.0.0.0
EXPOSE 8787

CMD ["node", "scripts/consolidated-entrypoint.mjs"]
