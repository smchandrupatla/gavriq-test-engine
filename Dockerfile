# Consolidated Test Engine (control-plane API + dashboard) and SIT console â€” one
# image/container, one external port. scripts/consolidated-entrypoint.mjs runs both as
# independent Node child processes behind a small reverse proxy (/sit/* -> console,
# everything else -> API), so a crash in one doesn't take the other down even though
# they now ship together â€” see that script's header comment for the reasoning.
#
# The SIT console's UI-phase cases need both Playwright and Selenium browsers.
# Debian provides real chromium + chromium-driver packages as a matching pair;
# Ubuntu Noble's Chromium packages are snap launchers and cannot run here.
# Install Playwright browsers through the project's CLI to match its exact version.
FROM node:22-bookworm-slim
WORKDIR /app
RUN apt-get update \
  && apt-get install -y --no-install-recommends chromium chromium-driver fonts-liberation ca-certificates \
  && rm -rf /var/lib/apt/lists/*
ENV SIT_CHROME_BINARY=/usr/bin/chromium
ENV SIT_CHROMEDRIVER_PATH=/usr/bin/chromedriver
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

COPY package.json package-lock.json* ./
# Install browsers explicitly after dependencies, using the resolved Playwright CLI.
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
RUN npm install
RUN env -u PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD \
    node node_modules/playwright/cli.js install --with-deps chromium firefox webkit \
    && rm -rf /var/lib/apt/lists/*

COPY apps ./apps
COPY sit ./sit
COPY dev ./dev
COPY docs ./docs
COPY data ./data
COPY tsconfig.json* ./
COPY scripts/consolidated-entrypoint.mjs ./scripts/consolidated-entrypoint.mjs

ENV NODE_ENV=production
ENV PORT=8787
ENV HOST=0.0.0.0
EXPOSE 8787

CMD ["node", "scripts/consolidated-entrypoint.mjs"]
