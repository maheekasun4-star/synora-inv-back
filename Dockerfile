FROM node:24-alpine

WORKDIR /app

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
