const { PrismaClient } = require('@prisma/client');

/**
 * Prisma client for the hotel_inventory database.
 * All inventory-specific tables live here.
 */
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error('Missing DATABASE_URL. Set the direct MySQL connection string before starting the backend.');
}

if (databaseUrl.startsWith('prisma://')) {
  throw new Error('Invalid Prisma data-proxy URL detected for DATABASE_URL. Use a direct database URL such as mysql://... instead of prisma://...');
}

const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
});

module.exports = prisma;
