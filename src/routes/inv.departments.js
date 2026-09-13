const express = require('express');
const router = express.Router();
const prisma = require('../prismaClient');

router.get('/', async (req, res) => {
  try {
    const { isActive } = req.query;
    const where = {};
    if (isActive !== undefined) where.isActive = isActive === 'true';
    const departments = await prisma.department.findMany({ where, orderBy: { name: 'asc' } });
    res.json(departments);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'name is required' });
    const dept = await prisma.department.create({ data: { name } });
    res.status(201).json(dept);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/:id', async (req, res) => {
  try {
    const { name, isActive } = req.body;
    const dept = await prisma.department.update({
      where: { id: Number(req.params.id) },
      data: {
        ...(name !== undefined && { name }),
        ...(isActive !== undefined && { isActive }),
      },
    });
    res.json(dept);
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Department not found' });
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
