const express = require('express');
const router = express.Router();
const prisma = require('../prismaClient');

// ─── CATEGORIES ───────────────────────────────────────────────────────────────

/**
 * GET /api/inv/categories
 * Returns the full category tree, or flat list with ?flat=1
 */
router.get('/categories', async (req, res) => {
  try {
    const categories = await prisma.itemCategory.findMany({
      orderBy: [{ level: 'asc' }, { name: 'asc' }],
    });
    res.json(categories);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/inv/categories/:id
 */
router.get('/categories/:id', async (req, res) => {
  try {
    const cat = await prisma.itemCategory.findUnique({
      where: { id: Number(req.params.id) },
      include: { children: true, items: { select: { id: true, name: true, itemCode: true } } },
    });
    if (!cat) return res.status(404).json({ error: 'Category not found' });
    res.json(cat);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/inv/categories
 * Body: { name, parentId?, level }
 */
router.post('/categories', async (req, res) => {
  try {
    const { name, parentId, level } = req.body;
    if (!name || !level) return res.status(400).json({ error: 'name and level are required' });
    const cat = await prisma.itemCategory.create({
      data: { name, parentId: parentId ? Number(parentId) : null, level: Number(level) },
    });
    res.status(201).json(cat);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * PUT /api/inv/categories/:id
 */
router.put('/categories/:id', async (req, res) => {
  try {
    const { name, parentId, level } = req.body;
    const cat = await prisma.itemCategory.update({
      where: { id: Number(req.params.id) },
      data: {
        ...(name !== undefined && { name }),
        ...(parentId !== undefined && { parentId: parentId ? Number(parentId) : null }),
        ...(level !== undefined && { level: Number(level) }),
      },
    });
    res.json(cat);
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Category not found' });
    res.status(500).json({ error: err.message });
  }
});

/**
 * DELETE /api/inv/categories/:id
 */
router.delete('/categories/:id', async (req, res) => {
  try {
    await prisma.itemCategory.delete({ where: { id: Number(req.params.id) } });
    res.json({ success: true });
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Category not found' });
    // P2003 = FK constraint (has items or children)
    if (err.code === 'P2003') return res.status(409).json({ error: 'Category has items or sub-categories — remove them first' });
    res.status(500).json({ error: err.message });
  }
});

// ─── ITEMS ────────────────────────────────────────────────────────────────────

/**
 * GET /api/inv/items
 * Query params: categoryId, isActive (true/false), search
 */
router.get('/items', async (req, res) => {
  try {
    const { categoryId, isActive, search } = req.query;
    const where = {};
    if (categoryId) where.categoryId = Number(categoryId);
    if (isActive !== undefined) where.isActive = isActive === 'true';
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { itemCode: { contains: search } },
      ];
    }
    const items = await prisma.item.findMany({
      where,
      include: {
        category: true,
        taxClass: { include: { rates: true } },
      },
      orderBy: { name: 'asc' },
    });
    res.json(items);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/inv/items/:id
 */
router.get('/items/:id', async (req, res) => {
  try {
    const item = await prisma.item.findUnique({
      where: { id: Number(req.params.id) },
      include: { category: true, taxClass: { include: { rates: true } } },
    });
    if (!item) return res.status(404).json({ error: 'Item not found' });
    res.json(item);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/inv/items
 */
router.post('/items', async (req, res) => {
  try {
    const {
      itemCode, name, description, categoryId, unitType,
      reorderLevel, reorderQty, minQty, maxQty,
      taxClassId, chartOfAccount, isActive,
    } = req.body;

    if (!itemCode || !name || !categoryId || !unitType) {
      return res.status(400).json({ error: 'itemCode, name, categoryId, and unitType are required' });
    }

    const item = await prisma.item.create({
      data: {
        itemCode,
        name,
        description: description || null,
        categoryId: Number(categoryId),
        unitType,
        reorderLevel: reorderLevel != null ? Number(reorderLevel) : null,
        reorderQty: reorderQty != null ? Number(reorderQty) : null,
        minQty: minQty != null ? Number(minQty) : null,
        maxQty: maxQty != null ? Number(maxQty) : null,
        taxClassId: taxClassId ? Number(taxClassId) : null,
        chartOfAccount: chartOfAccount || null,
        isActive: isActive !== false,
      },
      include: { category: true, taxClass: { include: { rates: true } } },
    });
    res.status(201).json(item);
  } catch (err) {
    if (err.code === 'P2002') return res.status(409).json({ error: 'Item code already exists' });
    res.status(500).json({ error: err.message });
  }
});

/**
 * PUT /api/inv/items/:id
 */
router.put('/items/:id', async (req, res) => {
  try {
    const {
      itemCode, name, description, categoryId, unitType,
      reorderLevel, reorderQty, minQty, maxQty,
      taxClassId, chartOfAccount, isActive,
    } = req.body;

    const item = await prisma.item.update({
      where: { id: Number(req.params.id) },
      data: {
        ...(itemCode !== undefined && { itemCode }),
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
        ...(categoryId !== undefined && { categoryId: Number(categoryId) }),
        ...(unitType !== undefined && { unitType }),
        ...(reorderLevel !== undefined && { reorderLevel: reorderLevel != null ? Number(reorderLevel) : null }),
        ...(reorderQty !== undefined && { reorderQty: reorderQty != null ? Number(reorderQty) : null }),
        ...(minQty !== undefined && { minQty: minQty != null ? Number(minQty) : null }),
        ...(maxQty !== undefined && { maxQty: maxQty != null ? Number(maxQty) : null }),
        ...(taxClassId !== undefined && { taxClassId: taxClassId ? Number(taxClassId) : null }),
        ...(chartOfAccount !== undefined && { chartOfAccount }),
        ...(isActive !== undefined && { isActive }),
      },
      include: { category: true, taxClass: { include: { rates: true } } },
    });
    res.json(item);
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Item not found' });
    if (err.code === 'P2002') return res.status(409).json({ error: 'Item code already exists' });
    res.status(500).json({ error: err.message });
  }
});

/**
 * DELETE /api/inv/items/:id (soft delete — sets isActive = false)
 */
router.delete('/items/:id', async (req, res) => {
  try {
    await prisma.item.update({
      where: { id: Number(req.params.id) },
      data: { isActive: false },
    });
    res.json({ success: true });
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Item not found' });
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
