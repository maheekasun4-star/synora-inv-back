const express = require('express');
const router = express.Router();
const prisma = require('../prismaClient');
const {
  getOrderedLevels,
  getCurrentLevelRecord,
  validateApproverRole,
  assertNotAlreadyActioned,
  getAllSnapshots,
  advance,
  reject,
  generateCode,
} = require('../services/approvalService');

const GRN_INCLUDE = {
  purchaseOrder: { include: { items: { include: { item: true } } } },
  supplier: true,
  store: true,
  items: { include: { item: true } },
  approvalRequest: {
    include: { actions: { include: { level: true }, orderBy: { actedAt: 'asc' } } },
  },
};

// ─── LIST ─────────────────────────────────────────────────────────────────────

router.get('/', async (req, res) => {
  try {
    const { status, purchaseOrderId, storeId } = req.query;
    const where = {};
    if (status) where.status = status;
    if (purchaseOrderId) where.purchaseOrderId = Number(purchaseOrderId);
    if (storeId) where.storeId = Number(storeId);
    const grns = await prisma.goodsReceivedNote.findMany({
      where,
      include: {
        supplier: true,
        store: true,
        purchaseOrder: { select: { id: true, poCode: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(grns);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── GET ONE ──────────────────────────────────────────────────────────────────

router.get('/:id', async (req, res) => {
  try {
    const grn = await prisma.goodsReceivedNote.findUnique({
      where: { id: Number(req.params.id) },
      include: GRN_INCLUDE,
    });
    if (!grn) return res.status(404).json({ error: 'GRN not found' });
    const levels = await getOrderedLevels('grn_receiving');
    const currentLevel = getCurrentLevelRecord(grn.currentLevel, levels);
    res.json({ ...grn, levels, currentLevel });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── CREATE GRN ───────────────────────────────────────────────────────────────

/**
 * POST /api/inv/grn
 * Body: {
 *   purchaseOrderId,
 *   storeId,
 *   supplierId,
 *   supplierInvoiceNo?,
 *   receivedDate: 'YYYY-MM-DD',
 *   items: [{ itemId, poItemId, quantity, unitPrice, discount?, taxValue?, expiryDate?, serialNo? }]
 * }
 */
router.post('/', async (req, res) => {
  try {
    const { purchaseOrderId, storeId, supplierId, supplierInvoiceNo, receivedDate, items } = req.body;

    if (!purchaseOrderId || !storeId || !supplierId || !receivedDate || !items || items.length === 0) {
      return res.status(400).json({ error: 'purchaseOrderId, storeId, supplierId, receivedDate and items are required' });
    }

    // Load PO with items to validate quantities
    const po = await prisma.purchaseOrder.findUnique({
      where: { id: Number(purchaseOrderId) },
      include: { items: true },
    });
    if (!po) return res.status(404).json({ error: 'Purchase order not found' });
    if (!['open', 'partially_received'].includes(po.status)) {
      return res.status(409).json({ error: `Cannot receive against a PO with status '${po.status}'` });
    }

    // Validate quantities per line
    for (const grnItem of items) {
      const poItem = po.items.find(p => p.itemId === Number(grnItem.itemId));
      if (!poItem) {
        return res.status(400).json({ error: `Item ${grnItem.itemId} is not on this purchase order` });
      }
      const remaining = Number(poItem.quantity) - Number(poItem.receivedQty);
      if (Number(grnItem.quantity) > remaining) {
        return res.status(400).json({
          error: `Item ${grnItem.itemId}: GRN quantity (${grnItem.quantity}) exceeds remaining PO balance (${remaining.toFixed(4)})`,
        });
      }
    }

    // Compute totals
    let grossValue = 0;
    let netValue = 0;
    const grnItemData = items.map(i => {
      const qty      = Number(i.quantity);
      const price    = Number(i.unitPrice);
      const discount = Number(i.discount   || 0);
      const taxValue = Number(i.taxValue   || 0);
      const netPrice = qty * price - discount + taxValue;
      grossValue += qty * price;
      netValue   += netPrice;
      return {
        itemId:     Number(i.itemId),
        quantity:   qty,
        unitPrice:  price,
        discount,
        taxValue,
        netPrice,
        expiryDate: i.expiryDate ? new Date(i.expiryDate) : null,
        serialNo:   i.serialNo   || null,
      };
    });

    const result = await prisma.$transaction(async (tx) => {
      const count = await tx.goodsReceivedNote.count();
      const grnCode = generateCode('GRN', count + 1);

      // Create ApprovalRequest for GRN workflow
      const approvalRequest = await tx.approvalRequest.create({
        data: {
          requestType: 'grn_receiving',
          requestedBy: req.user.id,
          status: 'pending',
          currentLevel: 1,
        },
      });

      const grn = await tx.goodsReceivedNote.create({
        data: {
          grnCode,
          approvalRequestId: approvalRequest.id,
          purchaseOrderId:   Number(purchaseOrderId),
          supplierId:        Number(supplierId),
          supplierInvoiceNo: supplierInvoiceNo || null,
          receivedDate:      new Date(receivedDate),
          grossValue,
          netValue,
          status:       'pending_approval',
          currentLevel: 1,
          storeId:      Number(storeId),
          items: { create: grnItemData },
        },
        include: { items: true, store: true, supplier: true },
      });

      return grn;
    });

    res.status(201).json(result);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// ─── APPROVE GRN ──────────────────────────────────────────────────────────────

router.post('/:id/approve', async (req, res) => {
  try {
    const { levelId, comment } = req.body;
    if (!levelId) return res.status(400).json({ error: 'levelId is required' });

    const grn = await prisma.goodsReceivedNote.findUnique({
      where: { id: Number(req.params.id) },
      include: { approvalRequest: true, items: true },
    });
    if (!grn) return res.status(404).json({ error: 'GRN not found' });
    if (grn.status !== 'pending_approval') {
      return res.status(409).json({ error: `Cannot approve: GRN is already '${grn.status}'` });
    }

    const levels = await getOrderedLevels('grn_receiving');
    const level = getCurrentLevelRecord(grn.currentLevel, levels);
    if (!level || level.id !== Number(levelId)) {
      return res.status(409).json({ error: 'levelId does not match the current pending level' });
    }

    validateApproverRole(req.user, level);
    await assertNotAlreadyActioned(grn.approvalRequestId, level.id);

    const maxLevel = Math.max(...levels.map(l => l.levelOrder));
    const isFinal  = grn.currentLevel >= maxLevel;

    const result = await prisma.$transaction(async (tx) => {
      // Advance the generic approval request
      const updatedAR = await advance(tx, grn.approvalRequest, levels, req.user.id, level.id, comment);

      // Update GRN status / level
      const updatedGrn = await tx.goodsReceivedNote.update({
        where: { id: grn.id },
        data: {
          status:       isFinal ? 'approved' : 'pending_approval',
          currentLevel: isFinal ? grn.currentLevel : grn.currentLevel + 1,
        },
      });

      // On final approval — post to stock (increment PO receivedQty per item)
      if (isFinal) {
        for (const grnItem of grn.items) {
          await tx.purchaseOrderItem.updateMany({
            where: {
              purchaseOrderId: grn.purchaseOrderId,
              itemId: grnItem.itemId,
            },
            data: {
              receivedQty: { increment: Number(grnItem.quantity) },
            },
          });
        }

        // Recompute PO status
        const poItems = await tx.purchaseOrderItem.findMany({
          where: { purchaseOrderId: grn.purchaseOrderId },
        });
        const allComplete = poItems.every(i => Number(i.receivedQty) >= Number(i.quantity));
        const anyReceived = poItems.some(i => Number(i.receivedQty) > 0);
        const newPoStatus = allComplete ? 'completed' : anyReceived ? 'partially_received' : 'open';
        await tx.purchaseOrder.update({
          where: { id: grn.purchaseOrderId },
          data: { status: newPoStatus },
        });

        // TODO Sprint 4: post to bin-card / store stock ledger
        console.log(`[GRN ${grn.grnCode}] Final approval — stock post to store ${grn.storeId} pending Sprint 4 bin-card implementation`);
      }

      return { grn: updatedGrn, approvalRequest: updatedAR };
    });

    res.json(result);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// ─── REJECT GRN ───────────────────────────────────────────────────────────────

router.post('/:id/reject', async (req, res) => {
  try {
    const { levelId, comment } = req.body;
    if (!levelId) return res.status(400).json({ error: 'levelId is required' });
    if (!comment || !comment.trim()) return res.status(400).json({ error: 'comment (rejection reason) is required' });

    const grn = await prisma.goodsReceivedNote.findUnique({
      where: { id: Number(req.params.id) },
      include: { approvalRequest: true },
    });
    if (!grn) return res.status(404).json({ error: 'GRN not found' });
    if (grn.status !== 'pending_approval') {
      return res.status(409).json({ error: `Cannot reject: GRN is already '${grn.status}'` });
    }

    const levels = await getOrderedLevels('grn_receiving');
    const level = getCurrentLevelRecord(grn.currentLevel, levels);
    if (!level || level.id !== Number(levelId)) {
      return res.status(409).json({ error: 'levelId does not match the current pending level' });
    }

    validateApproverRole(req.user, level);
    await assertNotAlreadyActioned(grn.approvalRequestId, level.id);

    const result = await prisma.$transaction(async (tx) => {
      await reject(tx, grn.approvalRequest, req.user.id, level.id, comment);
      const updatedGrn = await tx.goodsReceivedNote.update({
        where: { id: grn.id },
        data: { status: 'rejected' },
      });
      return updatedGrn;
    });

    res.json(result);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

module.exports = router;
