const express = require('express');
const router = express.Router();
const prisma = require('../prismaClient');

const VALID_REQUEST_TYPES = ['purchase_request', 'store_request', 'kitchen_request'];

/**
 * GET /api/inv/approval-levels
 * Query params: requestType (purchase_request | store_request | kitchen_request)
 */
router.get('/', async (req, res) => {
  try {
    const { requestType } = req.query;
    const where = {};
    if (requestType) {
      if (!VALID_REQUEST_TYPES.includes(requestType)) {
        return res.status(400).json({ error: `requestType must be one of: ${VALID_REQUEST_TYPES.join(', ')}` });
      }
      where.requestType = requestType;
    }
    const levels = await prisma.approvalLevel.findMany({
      where,
      orderBy: [{ requestType: 'asc' }, { levelOrder: 'asc' }],
    });
    res.json(levels);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/inv/approval-levels/:id
 */
router.get('/:id', async (req, res) => {
  try {
    const level = await prisma.approvalLevel.findUnique({ where: { id: Number(req.params.id) } });
    if (!level) return res.status(404).json({ error: 'Approval level not found' });
    res.json(level);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/inv/approval-levels
 * Body: { requestType, levelOrder, levelName, requiredRole }
 */
router.post('/', async (req, res) => {
  try {
    const { requestType, levelOrder, levelName, requiredRole } = req.body;
    if (!requestType || levelOrder == null || !levelName || !requiredRole) {
      return res.status(400).json({ error: 'requestType, levelOrder, levelName, requiredRole are required' });
    }
    if (!VALID_REQUEST_TYPES.includes(requestType)) {
      return res.status(400).json({ error: `requestType must be one of: ${VALID_REQUEST_TYPES.join(', ')}` });
    }
    const level = await prisma.approvalLevel.create({
      data: { requestType, levelOrder: Number(levelOrder), levelName, requiredRole },
    });
    res.status(201).json(level);
  } catch (err) {
    if (err.code === 'P2002') return res.status(409).json({ error: 'A level with this order already exists for this request type' });
    res.status(500).json({ error: err.message });
  }
});

/**
 * PUT /api/inv/approval-levels/:id
 */
router.put('/:id', async (req, res) => {
  try {
    const { requestType, levelOrder, levelName, requiredRole } = req.body;
    if (requestType && !VALID_REQUEST_TYPES.includes(requestType)) {
      return res.status(400).json({ error: `requestType must be one of: ${VALID_REQUEST_TYPES.join(', ')}` });
    }
    const level = await prisma.approvalLevel.update({
      where: { id: Number(req.params.id) },
      data: {
        ...(requestType !== undefined && { requestType }),
        ...(levelOrder !== undefined && { levelOrder: Number(levelOrder) }),
        ...(levelName !== undefined && { levelName }),
        ...(requiredRole !== undefined && { requiredRole }),
      },
    });
    res.json(level);
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Approval level not found' });
    if (err.code === 'P2002') return res.status(409).json({ error: 'A level with this order already exists for this request type' });
    res.status(500).json({ error: err.message });
  }
});

/**
 * DELETE /api/inv/approval-levels/:id
 */
router.delete('/:id', async (req, res) => {
  try {
    await prisma.approvalLevel.delete({ where: { id: Number(req.params.id) } });
    res.json({ success: true });
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Approval level not found' });
    res.status(500).json({ error: err.message });
  }
});

/**
 * PUT /api/inv/approval-levels/reorder
 * Body: { requestType, levels: [{ id, levelOrder }] }
 * Reorders all levels for a given request type atomically.
 */
router.put('/reorder/batch', async (req, res) => {
  try {
    const { requestType, levels } = req.body;
    if (!requestType || !Array.isArray(levels)) {
      return res.status(400).json({ error: 'requestType and levels array are required' });
    }
    await prisma.$transaction(
      levels.map(({ id, levelOrder }) =>
        prisma.approvalLevel.update({
          where: { id: Number(id) },
          data: { levelOrder: Number(levelOrder) },
        })
      )
    );
    const updated = await prisma.approvalLevel.findMany({
      where: { requestType },
      orderBy: { levelOrder: 'asc' },
    });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
