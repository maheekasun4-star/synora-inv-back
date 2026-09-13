require('dotenv').config();
const express = require('express');
const cors = require('cors');

const prisma = require('./prismaClient');
const authRouter           = require('./routes/auth');
const itemsRouter          = require('./routes/inv.items');
const suppliersRouter      = require('./routes/inv.suppliers');
const taxClassesRouter     = require('./routes/inv.taxclasses');
const approvalLevelsRouter = require('./routes/inv.approvallevels');
const departmentsRouter    = require('./routes/inv.departments');
const storesRouter         = require('./routes/inv.stores');
const purchaseRequestsRouter = require('./routes/inv.purchaserequests');
const quotationsRouter     = require('./routes/inv.quotations');
const purchaseOrdersRouter = require('./routes/inv.purchaseorders');
const grnRouter            = require('./routes/inv.grn');

const { authenticate } = require('./middlewares/auth');

const app = express();
const PORT = process.env.PORT || 5002;

// ─── Middleware ───────────────────────────────────────────────────────────────

app.use(cors());
app.use(express.json());

// ─── Health check ─────────────────────────────────────────────────────────────

app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'hotel-inventory' }));

// ─── Public routes ────────────────────────────────────────────────────────────

app.use('/api/auth', authRouter);

// ─── Protected routes (all require JWT) ──────────────────────────────────────

// Sprint 0 — master data
app.use('/api/inv/categories',       authenticate, itemsRouter);
app.use('/api/inv/items',            authenticate, itemsRouter);
app.use('/api/inv/suppliers',        authenticate, suppliersRouter);
app.use('/api/inv/tax-classes',      authenticate, taxClassesRouter);
app.use('/api/inv/approval-levels',  authenticate, approvalLevelsRouter);

// Supporting masters
app.use('/api/inv/departments',      authenticate, departmentsRouter);
app.use('/api/inv/stores',           authenticate, storesRouter);

// Sprint 1 — Purchase Requests
app.use('/api/inv/purchase-requests', authenticate, purchaseRequestsRouter);

// Sprint 2 — Quotations & Purchase Orders
app.use('/api/inv/quotations',        authenticate, quotationsRouter);
app.use('/api/inv/purchase-orders',   authenticate, purchaseOrdersRouter);

// Sprint 3 — GRN
app.use('/api/inv/grn',               authenticate, grnRouter);

// ─── Startup ──────────────────────────────────────────────────────────────────

async function start() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    console.log('✓ hotel_inventory database connected');
  } catch (err) {
    console.error('✗ Failed to connect to hotel_inventory database:', err.message);
    process.exit(1);
  }

  app.listen(PORT, () => {
    console.log(`Hotel Inventory API running on port ${PORT}`);
  });
}

start();

process.on('SIGINT',  async () => { await prisma.$disconnect(); process.exit(0); });
process.on('SIGTERM', async () => { await prisma.$disconnect(); process.exit(0); });
