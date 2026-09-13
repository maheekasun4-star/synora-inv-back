const express = require('express');
const router = express.Router();
const prisma = require('../prismaClient');

router.get('/', async (req, res) => {
  try {
    const { isActive } = req.query;
    const where = {};
    if (isActive !== undefined) where.isActive = isActive === 'true';
    const stores = await prisma.store.findMany({ where, orderBy: { name: 'asc' } });
    res.json(stores);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', async (req, res) => {
  try {
    const { name, location } = req.body;
    if (!name) return res.status(400).json({ error: 'name is required' });
    const store = await prisma.store.create({ data: { name, location: location || null } });
    res.status(201).json(store);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/:id', async (req, res) => {
  try {
    const { name, location, isActive } = req.body;
    const store = await prisma.store.update({
      where: { id: Number(req.params.id) },
      data: {
        ...(name !== undefined && { name }),
        ...(location !== undefined && { location }),
        ...(isActive !== undefined && { isActive }),
      },
    });
    res.json(store);
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Store not found' });
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
