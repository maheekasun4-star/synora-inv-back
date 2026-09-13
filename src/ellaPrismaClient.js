const { PrismaClient } = require('@prisma/client');

/**
 * Separate Prisma client pointed at ella_pms.
 * Used ONLY for auth — reads the shared users table.
 * The main prismaClient.js points at hotel_inventory.
 *
 * In deployment, many environments only provide DATABASE_URL.
 * Fall back to it so the app does not crash when this custom name is absent.
 */
const ellaDatabaseUrl = process.env.ELLA_PMS_DATABASE_URL || process.env.DATABASE_URL;

if (!ellaDatabaseUrl) {
  throw new Error('Missing database URL. Set ELLA_PMS_DATABASE_URL or DATABASE_URL before starting the app.');
}

const ellaPrisma = new PrismaClient({
  datasources: { db: { url: ellaDatabaseUrl } },
  log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
});

module.exports = ellaPrisma;
