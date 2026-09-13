const { PrismaClient } = require('@prisma/client');

/**
 * Separate Prisma client pointed at ella_pms.
 * Used ONLY for auth — reads the shared users table.
 * The main prismaClient.js points at hotel_inventory.
 */
const ellaPrisma = new PrismaClient({
  datasources: { db: { url: process.env.ELLA_PMS_DATABASE_URL } },
  log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
});

module.exports = ellaPrisma;
