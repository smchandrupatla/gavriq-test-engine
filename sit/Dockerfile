# Dedicated SIT image with Playwright and Selenium for the UI-phase cases.
# Debian supplies runnable chromium + chromium-driver packages as a matching pair;
# Ubuntu Noble's Chromium packages are snap launchers and cannot run here.
# The project's Playwright CLI installs browsers matching its exact version.
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
COPY sit ./sit
COPY dev ./dev
COPY docs/use-cases ./docs/use-cases
COPY tsconfig.json ./
ENV NODE_ENV=production
ENV PORT=8098
EXPOSE 8098
CMD ["node", "sit/console.mjs"]
