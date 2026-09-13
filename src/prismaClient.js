const { PrismaClient } = require('@prisma/client');

/**
 * Prisma client for the hotel_inventory database.
 * All inventory-specific tables live here.
 */
const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
});

module.exports = prisma;
