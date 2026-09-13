const express = require('express');
const router = express.Router();
const prisma = require('../prismaClient');

const QUOTATION_INCLUDE = {
  supplier: true,
  purchaseRequest: { select: { id: true, prCode: true } },
  items: { include: { item: true, taxClass: { include: { rates: true } } } },
};

// ─── LIST ─────────────────────────────────────────────────────────────────────

router.get('/', async (req, res) => {
  try {
    const { supplierId, isActive, purchaseRequestId } = req.query;
    const where = {};
    if (supplierId) where.supplierId = Number(supplierId);
    if (isActive !== undefined) where.isActive = isActive === 'true';
    if (purchaseRequestId) where.purchaseRequestId = Number(purchaseRequestId);
    const quotations = await prisma.quotation.findMany({
      where,
      include: { supplier: true, purchaseRequest: { select: { id: true, prCode: true } } },
      orderBy: { createdAt: 'desc' },
    });
    res.json(quotations);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── GET ONE ──────────────────────────────────────────────────────────────────

router.get('/:id', async (req, res) => {
  try {
    const q = await prisma.quotation.findUnique({ where: { id: Number(req.params.id) }, include: QUOTATION_INCLUDE });
    if (!q) return res.status(404).json({ error: 'Quotation not found' });
    res.json(q);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── CREATE ───────────────────────────────────────────────────────────────────

/**
 * POST /api/inv/quotations
 * Body: { supplierId, purchaseRequestId?, quotationCode?, fromDate?, toDate?,
 *         items: [{ itemId, price, minQty?, maxQty?, taxClassId? }] }
 */
router.post('/', async (req, res) => {
  try {
    const { supplierId, purchaseRequestId, quotationCode, fromDate, toDate, items } = req.body;
    if (!supplierId || !items || items.length === 0) {
      return res.status(400).json({ error: 'supplierId and at least one item are required' });
    }

    const count = await prisma.quotation.count();
    const code = quotationCode || `QT-${String(count + 1).padStart(6, '0')}`;

    const q = await prisma.quotation.create({
      data: {
        quotationCode: code,
        supplierId: Number(supplierId),
        purchaseRequestId: purchaseRequestId ? Number(purchaseRequestId) : null,
        fromDate: fromDate ? new Date(fromDate) : null,
        toDate:   toDate   ? new Date(toDate)   : null,
        items: {
          create: items.map(i => ({
            itemId:     Number(i.itemId),
            price:      Number(i.price),
            minQty:     i.minQty  != null ? Number(i.minQty)  : null,
            maxQty:     i.maxQty  != null ? Number(i.maxQty)  : null,
            taxClassId: i.taxClassId ? Number(i.taxClassId) : null,
          })),
        },
      },
      include: QUOTATION_INCLUDE,
    });
    res.status(201).json(q);
  } catch (err) {
    if (err.code === 'P2002') return res.status(409).json({ error: 'Quotation code already exists' });
    res.status(500).json({ error: err.message });
  }
});

// ─── UPDATE ───────────────────────────────────────────────────────────────────

router.put('/:id', async (req, res) => {
  try {
    const { supplierId, fromDate, toDate, isActive } = req.body;
    const q = await prisma.quotation.update({
      where: { id: Number(req.params.id) },
      data: {
        ...(supplierId !== undefined && { supplierId: Number(supplierId) }),
        ...(fromDate   !== undefined && { fromDate: fromDate ? new Date(fromDate) : null }),
        ...(toDate     !== undefined && { toDate:   toDate   ? new Date(toDate)   : null }),
        ...(isActive   !== undefined && { isActive }),
      },
      include: QUOTATION_INCLUDE,
    });
    res.json(q);
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Quotation not found' });
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
