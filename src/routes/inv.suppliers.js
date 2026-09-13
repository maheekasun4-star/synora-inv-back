const express = require('express');
const router = express.Router();
const prisma = require('../prismaClient');

/**
 * GET /api/inv/suppliers
 * Query params: isActive (true/false), search
 */
router.get('/', async (req, res) => {
  try {
    const { isActive, search } = req.query;
    const where = {};
    if (isActive !== undefined) where.isActive = isActive === 'true';
    if (search) where.name = { contains: search };
    const suppliers = await prisma.supplier.findMany({
      where,
      orderBy: { name: 'asc' },
    });
    res.json(suppliers);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/inv/suppliers/:id
 */
router.get('/:id', async (req, res) => {
  try {
    const supplier = await prisma.supplier.findUnique({ where: { id: Number(req.params.id) } });
    if (!supplier) return res.status(404).json({ error: 'Supplier not found' });
    res.json(supplier);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/inv/suppliers
 * Body: { name, contactInfo? }
 */
router.post('/', async (req, res) => {
  try {
    const { name, contactInfo } = req.body;
    if (!name) return res.status(400).json({ error: 'name is required' });
    const supplier = await prisma.supplier.create({
      data: { name, contactInfo: contactInfo || null },
    });
    res.status(201).json(supplier);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * PUT /api/inv/suppliers/:id
 */
router.put('/:id', async (req, res) => {
  try {
    const { name, contactInfo, isActive } = req.body;
    const supplier = await prisma.supplier.update({
      where: { id: Number(req.params.id) },
      data: {
        ...(name !== undefined && { name }),
        ...(contactInfo !== undefined && { contactInfo }),
        ...(isActive !== undefined && { isActive }),
      },
    });
    res.json(supplier);
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Supplier not found' });
    res.status(500).json({ error: err.message });
  }
});

/**
 * DELETE /api/inv/suppliers/:id (soft delete)
 */
router.delete('/:id', async (req, res) => {
  try {
    await prisma.supplier.update({
      where: { id: Number(req.params.id) },
      data: { isActive: false },
    });
    res.json({ success: true });
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Supplier not found' });
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
