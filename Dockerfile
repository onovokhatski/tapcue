# The public online demo (ADR 0018): the built web app and the server in demo mode, on the port the
# host gives in PORT. Railway builds this file by itself; any other Docker host can too.

# Build: every dependency, then the web app's production build.
FROM node:22-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY packages/server/package.json packages/server/
COPY packages/web/package.json packages/web/
RUN npm ci
COPY . .
RUN npm run build

# Run: only what the server needs, and the build from above.
FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production TAPCUE_DEMO=1
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY packages/server/package.json packages/server/
COPY packages/web/package.json packages/web/
RUN npm ci --omit=dev && npm cache clean --force
COPY packages/shared packages/shared
COPY packages/server packages/server
COPY examples/demo-stand examples/demo-stand
COPY --from=build /app/packages/web/dist packages/web/dist
EXPOSE 4000
# `exec` lets the server receive the host's stop signal itself.
CMD ["sh", "-c", "exec node --import tsx packages/server/src/main.ts --port ${PORT:-4000}"]
