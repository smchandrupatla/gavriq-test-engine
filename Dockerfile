FROM node:26-bookworm-slim
WORKDIR /app
COPY package.json package-lock.json* ./
# playwright is a shared dependency (see sit/Dockerfile, which actually uses it); api and
# worker never import it, so skip its browser download here too.
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
RUN npm install
COPY apps ./apps
COPY db ./db
COPY dev ./dev
COPY tsconfig.json ./
ENV NODE_ENV=production
ENV PORT=8787
EXPOSE 8787
CMD ["npx", "tsx", "apps/api/src/server.ts"]
