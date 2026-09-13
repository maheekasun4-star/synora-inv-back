const express = require('express');
const router = express.Router();
const prisma = require('../prismaClient');

// ─── TAX CLASSES ──────────────────────────────────────────────────────────────

/**
 * GET /api/inv/tax-classes
 */
router.get('/', async (req, res) => {
  try {
    const classes = await prisma.taxClass.findMany({
      include: { rates: { orderBy: { taxName: 'asc' } } },
      orderBy: { name: 'asc' },
    });
    res.json(classes);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/inv/tax-classes/:id
 */
router.get('/:id', async (req, res) => {
  try {
    const tc = await prisma.taxClass.findUnique({
      where: { id: Number(req.params.id) },
      include: { rates: true },
    });
    if (!tc) return res.status(404).json({ error: 'Tax class not found' });
    res.json(tc);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/inv/tax-classes
 * Body: { name }
 */
router.post('/', async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'name is required' });
    const tc = await prisma.taxClass.create({ data: { name } });
    res.status(201).json(tc);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * PUT /api/inv/tax-classes/:id
 */
router.put('/:id', async (req, res) => {
  try {
    const { name } = req.body;
    const tc = await prisma.taxClass.update({
      where: { id: Number(req.params.id) },
      data: { ...(name !== undefined && { name }) },
      include: { rates: true },
    });
    res.json(tc);
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Tax class not found' });
    res.status(500).json({ error: err.message });
  }
});

/**
 * DELETE /api/inv/tax-classes/:id
 */
router.delete('/:id', async (req, res) => {
  try {
    await prisma.taxClass.delete({ where: { id: Number(req.params.id) } });
    res.json({ success: true });
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Tax class not found' });
    if (err.code === 'P2003') return res.status(409).json({ error: 'Tax class is assigned to items — reassign them first' });
    res.status(500).json({ error: err.message });
  }
});

// ─── TAX RATES (nested) ───────────────────────────────────────────────────────

/**
 * POST /api/inv/tax-classes/:id/rates
 * Body: { taxName, rate }
 */
router.post('/:id/rates', async (req, res) => {
  try {
    const { taxName, rate } = req.body;
    if (!taxName || rate == null) return res.status(400).json({ error: 'taxName and rate are required' });
    const r = await prisma.taxClassRate.create({
      data: { taxClassId: Number(req.params.id), taxName, rate: Number(rate) },
    });
    res.status(201).json(r);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * PUT /api/inv/tax-classes/:id/rates/:rateId
 */
router.put('/:id/rates/:rateId', async (req, res) => {
  try {
    const { taxName, rate } = req.body;
    const r = await prisma.taxClassRate.update({
      where: { id: Number(req.params.rateId) },
      data: {
        ...(taxName !== undefined && { taxName }),
        ...(rate !== undefined && { rate: Number(rate) }),
      },
    });
    res.json(r);
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Rate not found' });
    res.status(500).json({ error: err.message });
  }
});

/**
 * DELETE /api/inv/tax-classes/:id/rates/:rateId
 */
router.delete('/:id/rates/:rateId', async (req, res) => {
  try {
    await prisma.taxClassRate.delete({ where: { id: Number(req.params.rateId) } });
    res.json({ success: true });
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Rate not found' });
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
