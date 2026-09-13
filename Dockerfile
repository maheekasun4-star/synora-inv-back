FROM node:24-bookworm-slim

WORKDIR /app

# Prisma requires OpenSSL libraries at runtime.
RUN apt-get update && apt-get install -y --no-install-recommends openssl libssl1.1 ca-certificates && rm -rf /var/lib/apt/lists/*

# Copy package files first for layer caching
COPY package*.json ./
COPY .npmrc* ./

# Install production deps only
RUN npm install --omit=dev

# Copy Prisma schema and generate client
COPY prisma ./prisma/
RUN npx prisma generate

# Copy source
COPY src ./src/

EXPOSE 5002

CMD ["node", "src/index.js"]
