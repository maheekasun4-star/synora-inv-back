const express = require('express');
const router = express.Router();
const prisma = require('../prismaClient');
const { getLatestSnapshot, generateCode } = require('../services/approvalService');

const PO_INCLUDE = {
  supplier: true,
  purchaseRequest: { select: { id: true, prCode: true } },
  items: { include: { item: true } },
  grns: { select: { id: true, grnCode: true, status: true, receivedDate: true } },
};

// ─── LIST ─────────────────────────────────────────────────────────────────────

router.get('/', async (req, res) => {
  try {
    const { status, supplierId, fromDate, toDate } = req.query;
    const where = {};
    if (status) where.status = status;
    if (supplierId) where.supplierId = Number(supplierId);
    if (fromDate || toDate) {
      where.orderDate = {};
      if (fromDate) where.orderDate.gte = new Date(fromDate);
      if (toDate)   where.orderDate.lte = new Date(toDate);
    }
    const pos = await prisma.purchaseOrder.findMany({
      where,
      include: { supplier: true, purchaseRequest: { select: { id: true, prCode: true } } },
      orderBy: { createdAt: 'desc' },
    });
    res.json(pos);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── GET ONE ──────────────────────────────────────────────────────────────────

router.get('/:id', async (req, res) => {
  try {
    const po = await prisma.purchaseOrder.findUnique({ where: { id: Number(req.params.id) }, include: PO_INCLUDE });
    if (!po) return res.status(404).json({ error: 'Purchase order not found' });
    res.json(po);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── CREATE ───────────────────────────────────────────────────────────────────

/**
 * POST /api/inv/purchase-orders
 * Body: {
 *   purchaseRequestId,    -- must have status = 'approved'
 *   supplierId,
 *   quotationId?,          -- if provided, prices are filled from the quotation
 *   orderDate: 'YYYY-MM-DD',
 *   paymentType?,
 *   deliveryAddress?,
 *   items: [{ itemId, quantity, unitPrice, taxRate?, discountRate? }]
 * }
 */
router.post('/', async (req, res) => {
  try {
    const { purchaseRequestId, supplierId, orderDate, paymentType, deliveryAddress, items } = req.body;

    if (!purchaseRequestId || !supplierId || !orderDate || !items || items.length === 0) {
      return res.status(400).json({ error: 'purchaseRequestId, supplierId, orderDate and items are required' });
    }

    // Enforce: PR must be approved
    const pr = await prisma.purchaseRequest.findUnique({
      where: { id: Number(purchaseRequestId) },
      include: { approvalRequest: true },
    });
    if (!pr) return res.status(404).json({ error: 'Purchase request not found' });
    if (pr.approvalRequest.status !== 'approved') {
      return res.status(400).json({
        error: `Purchase request is not approved (status: '${pr.approvalRequest.status}'). A PO can only be created from an approved PR.`,
      });
    }

    // Compute totals
    let grossValue = 0;
    let taxValue = 0;
    const lineItems = items.map(i => {
      const qty       = Number(i.quantity);
      const price     = Number(i.unitPrice);
      const taxRate   = Number(i.taxRate   || 0);
      const discRate  = Number(i.discountRate || 0);
      const lineGross = qty * price;
      const lineDisc  = lineGross * (discRate / 100);
      const lineTax   = (lineGross - lineDisc) * (taxRate / 100);
      const lineTotal = lineGross - lineDisc + lineTax;
      grossValue += lineGross;
      taxValue   += lineTax;
      return {
        itemId:       Number(i.itemId),
        quantity:     qty,
        unitPrice:    price,
        taxRate:      taxRate,
        discountRate: discRate,
        lineTotal,
      };
    });
    const netValue = grossValue + taxValue;

    const count = await prisma.purchaseOrder.count();
    const poCode = generateCode('PO', count + 1);

    const po = await prisma.purchaseOrder.create({
      data: {
        poCode,
        supplierId:        Number(supplierId),
        purchaseRequestId: Number(purchaseRequestId),
        orderDate:         new Date(orderDate),
        paymentType:       paymentType || null,
        deliveryAddress:   deliveryAddress || null,
        grossValue,
        taxValue,
        netValue,
        status: 'open',
        items: { create: lineItems },
      },
      include: PO_INCLUDE,
    });

    res.status(201).json(po);
  } catch (err) {
    if (err.code === 'P2002') return res.status(409).json({ error: 'PO code already exists' });
    res.status(500).json({ error: err.message });
  }
});

// ─── CANCEL ───────────────────────────────────────────────────────────────────

router.put('/:id/cancel', async (req, res) => {
  try {
    const { cancelReason } = req.body;
    if (!cancelReason || !cancelReason.trim()) {
      return res.status(400).json({ error: 'cancelReason is required' });
    }

    const po = await prisma.purchaseOrder.findUnique({ where: { id: Number(req.params.id) } });
    if (!po) return res.status(404).json({ error: 'Purchase order not found' });
    if (!['open', 'partially_received'].includes(po.status)) {
      return res.status(409).json({ error: `Cannot cancel a PO with status '${po.status}'` });
    }

    const updated = await prisma.purchaseOrder.update({
      where: { id: Number(req.params.id) },
      data: { status: 'cancelled', cancelReason },
    });
    res.json(updated);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
