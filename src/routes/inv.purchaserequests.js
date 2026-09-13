const express = require('express');
const router = express.Router();
const prisma = require('../prismaClient');
const {
  getOrderedLevels,
  getCurrentLevelRecord,
  validateApproverRole,
  assertNotAlreadyActioned,
  snapshotItems,
  getAllSnapshots,
  advance,
  reject,
  generateCode,
} = require('../services/approvalService');

// ─── CREATE PR ────────────────────────────────────────────────────────────────

/**
 * POST /api/inv/purchase-requests
 * Body: {
 *   requestedDate: 'YYYY-MM-DD',
 *   subDepartmentId?: number,
 *   advanceAmount?: number,
 *   eventName?: string,
 *   items: [{ itemId, quantity, unitPrice?, vat?, discount?, chartOfAccount?, reason? }]
 * }
 */
router.post('/', async (req, res) => {
  try {
    const { requestedDate, subDepartmentId, advanceAmount, eventName, items } = req.body;
    if (!requestedDate || !items || items.length === 0) {
      return res.status(400).json({ error: 'requestedDate and at least one item are required' });
    }

    const result = await prisma.$transaction(async (tx) => {
      // Count existing PRs to generate code
      const count = await tx.purchaseRequest.count();
      const prCode = generateCode('PR', count + 1);

      // Create the generic approval request
      const approvalRequest = await tx.approvalRequest.create({
        data: {
          requestType: 'purchase_request',
          requestedBy: req.user.id,
          departmentId: subDepartmentId ? Number(subDepartmentId) : null,
          status: 'pending',
          currentLevel: 1,
        },
      });

      // Create the PR extension record
      const pr = await tx.purchaseRequest.create({
        data: {
          approvalRequestId: approvalRequest.id,
          prCode,
          requestedDate: new Date(requestedDate),
          subDepartmentId: subDepartmentId ? Number(subDepartmentId) : null,
          advanceAmount: advanceAmount != null ? Number(advanceAmount) : null,
          eventName: eventName || null,
        },
      });

      // Write original item snapshot (levelId = null)
      await snapshotItems(tx, approvalRequest.id, null, items);

      return { pr, approvalRequest };
    });

    res.status(201).json(result);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// ─── LIST PRs ─────────────────────────────────────────────────────────────────

/**
 * GET /api/inv/purchase-requests
 * Query: status, departmentId, fromDate, toDate
 */
router.get('/', async (req, res) => {
  try {
    const { status, departmentId, fromDate, toDate } = req.query;

    const arWhere = {};
    if (status) arWhere.status = status;
    if (departmentId) arWhere.departmentId = Number(departmentId);

    const prWhere = {};
    if (fromDate || toDate) {
      prWhere.requestedDate = {};
      if (fromDate) prWhere.requestedDate.gte = new Date(fromDate);
      if (toDate)   prWhere.requestedDate.lte = new Date(toDate);
    }

    const prs = await prisma.purchaseRequest.findMany({
      where: {
        ...prWhere,
        approvalRequest: arWhere,
      },
      include: {
        approvalRequest: true,
        subDepartment: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(prs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET PR DETAIL ────────────────────────────────────────────────────────────

/**
 * GET /api/inv/purchase-requests/:id
 */
router.get('/:id', async (req, res) => {
  try {
    const pr = await prisma.purchaseRequest.findUnique({
      where: { id: Number(req.params.id) },
      include: {
        approvalRequest: {
          include: { actions: { include: { level: true }, orderBy: { actedAt: 'asc' } } },
        },
        subDepartment: true,
      },
    });
    if (!pr) return res.status(404).json({ error: 'Purchase request not found' });

    // Attach all item snapshots
    const snapshots = await getAllSnapshots(pr.approvalRequestId);

    // Attach current level info
    const levels = await getOrderedLevels('purchase_request');
    const currentLevel = getCurrentLevelRecord(pr.approvalRequest.currentLevel, levels);

    res.json({ ...pr, snapshots, levels, currentLevel });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── APPROVE PR ───────────────────────────────────────────────────────────────

/**
 * POST /api/inv/purchase-requests/:id/approve
 * Body: { levelId, items?: [...], comment? }
 */
router.post('/:id/approve', async (req, res) => {
  try {
    const { levelId, items, comment } = req.body;
    if (!levelId) return res.status(400).json({ error: 'levelId is required' });

    const pr = await prisma.purchaseRequest.findUnique({
      where: { id: Number(req.params.id) },
      include: { approvalRequest: true },
    });
    if (!pr) return res.status(404).json({ error: 'Purchase request not found' });

    const { approvalRequest } = pr;
    if (approvalRequest.status !== 'pending') {
      return res.status(409).json({ error: `Cannot approve: request is already '${approvalRequest.status}'` });
    }

    const levels = await getOrderedLevels('purchase_request');
    const level = getCurrentLevelRecord(approvalRequest.currentLevel, levels);
    if (!level || level.id !== Number(levelId)) {
      return res.status(409).json({ error: 'levelId does not match the current pending level' });
    }

    validateApproverRole(req.user, level);
    await assertNotAlreadyActioned(approvalRequest.id, level.id);

    const result = await prisma.$transaction(async (tx) => {
      // Write Option A snapshot for this level
      await snapshotItems(tx, approvalRequest.id, level.id, items || []);
      // Advance or complete
      const updated = await advance(tx, approvalRequest, levels, req.user.id, level.id, comment);
      return updated;
    });

    res.json(result);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// ─── REJECT PR ────────────────────────────────────────────────────────────────

/**
 * POST /api/inv/purchase-requests/:id/reject
 * Body: { levelId, comment }
 */
router.post('/:id/reject', async (req, res) => {
  try {
    const { levelId, comment } = req.body;
    if (!levelId) return res.status(400).json({ error: 'levelId is required' });
    if (!comment || !comment.trim()) return res.status(400).json({ error: 'comment (rejection reason) is required' });

    const pr = await prisma.purchaseRequest.findUnique({
      where: { id: Number(req.params.id) },
      include: { approvalRequest: true },
    });
    if (!pr) return res.status(404).json({ error: 'Purchase request not found' });

    const { approvalRequest } = pr;
    if (approvalRequest.status !== 'pending') {
      return res.status(409).json({ error: `Cannot reject: request is already '${approvalRequest.status}'` });
    }

    const levels = await getOrderedLevels('purchase_request');
    const level = getCurrentLevelRecord(approvalRequest.currentLevel, levels);
    if (!level || level.id !== Number(levelId)) {
      return res.status(409).json({ error: 'levelId does not match the current pending level' });
    }

    validateApproverRole(req.user, level);
    await assertNotAlreadyActioned(approvalRequest.id, level.id);

    const result = await prisma.$transaction(async (tx) => {
      return reject(tx, approvalRequest, req.user.id, level.id, comment);
    });

    res.json(result);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

module.exports = router;
