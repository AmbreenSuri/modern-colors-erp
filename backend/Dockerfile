# Modern Colours API — deterministic container build (Railway / any Docker host).
# Pins Node 20 (Nest 11 + AWS SDK v3 require >=20) and sidesteps Nixpacks' cache-mount
# EBUSY. Build tools live in "dependencies" (see package.json), so --omit=dev still builds.
FROM node:20-slim

# Prisma needs OpenSSL for both `generate` (build) and the query engine (runtime).
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

WORKDIR /app
ENV NODE_ENV=production

# Install deps first for better layer caching. --omit=dev skips the Jest/Supertest stack.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Copy source, generate the Prisma client, then compile to dist/.
COPY . .
RUN npx prisma generate && npm run build

# Railway injects PORT at runtime; the app reads it and binds 0.0.0.0.
EXPOSE 3000

# Start the compiled server directly. NOTE: do NOT run `prisma migrate deploy` here —
# it hangs on Neon's POOLED endpoint (PgBouncer has no advisory locks). Run migrations
# separately against a DIRECT (non-pooled) Neon URL: `npx prisma migrate deploy`.
CMD ["node", "dist/main.js"]
