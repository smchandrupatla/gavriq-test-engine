FROM node:26-bookworm-slim
WORKDIR /app

COPY package.json package-lock.json* ./
# Playwright browsers are large; workers that need them should use a dedicated image.
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
RUN npm install

COPY apps ./apps
COPY sit ./sit
COPY dev ./dev
COPY docs ./docs
COPY tsconfig.json* ./

ENV NODE_ENV=production
ENV PORT=8787
ENV HOST=0.0.0.0
EXPOSE 8787

# Default: control plane API (+ dashboard at /)
CMD ["npx", "tsx", "apps/api/src/server.ts"]
