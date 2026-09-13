/**
 * approvalService.js
 * Shared approval engine used by Purchase Requests, GRN, and future request types.
 * All mutation methods accept a `prisma` instance so they can participate in transactions.
 */
const prisma = require('../prismaClient');

/**
 * Get approval levels for a request type, ordered by levelOrder ascending.
 */
async function getOrderedLevels(requestType) {
  return prisma.approvalLevel.findMany({
    where: { requestType },
    orderBy: { levelOrder: 'asc' },
  });
}

/**
 * Return the ApprovalLevel record that corresponds to the request's currentLevel.
 */
function getCurrentLevelRecord(currentLevelOrder, levels) {
  return levels.find(l => l.levelOrder === currentLevelOrder) || null;
}

/**
 * Validate that the acting user's role matches the required role for a level.
 * Throws an object { status, error } that callers can forward as an HTTP error.
 */
function validateApproverRole(user, level) {
  // admin can act at any level
  if (user.role === 'admin') return;
  if (user.role !== level.requiredRole) {
    const err = new Error(`Forbidden: this level requires role '${level.requiredRole}', you have '${user.role}'`);
    err.status = 403;
    throw err;
  }
}

/**
 * Check that no ApprovalAction has already been recorded at this level for this request.
 */
async function assertNotAlreadyActioned(approvalRequestId, levelId) {
  const existing = await prisma.approvalAction.findFirst({
    where: { approvalRequestId, levelId },
  });
  if (existing) {
    const err = new Error('Already actioned at this level');
    err.status = 409;
    throw err;
  }
}

/**
 * Write an Option A snapshot for an approval level.
 * If `submittedItems` is provided, those replace the previous snapshot lines (for that level).
 * If not provided, copies the latest snapshot forward unchanged.
 */
async function snapshotItems(tx, approvalRequestId, levelId, submittedItems) {
  if (!submittedItems || submittedItems.length === 0) {
    // Copy forward from previous snapshot
    const previous = await getLatestSnapshotRaw(tx, approvalRequestId);
    submittedItems = previous.map(i => ({
      itemId:         i.itemId,
      quantity:       Number(i.quantity),
      unitPrice:      i.unitPrice != null ? Number(i.unitPrice) : null,
      vat:            Number(i.vat),
      discount:       Number(i.discount),
      chartOfAccount: i.chartOfAccount,
      reason:         i.reason,
    }));
  }

  await tx.approvalRequestItem.createMany({
    data: submittedItems.map(item => ({
      approvalRequestId,
      levelId,
      itemId:         Number(item.itemId),
      quantity:       Number(item.quantity),
      unitPrice:      item.unitPrice != null ? Number(item.unitPrice) : null,
      vat:            item.vat != null ? Number(item.vat) : 0,
      discount:       item.discount != null ? Number(item.discount) : 0,
      chartOfAccount: item.chartOfAccount || null,
      reason:         item.reason || null,
    })),
  });
}

/**
 * Internal — get items for the highest level snapshot (or original if none).
 */
async function getLatestSnapshotRaw(tx, approvalRequestId) {
  const client = tx || prisma;
  // Get the most recent level snapshot
  const latestAction = await client.approvalAction.findFirst({
    where: { approvalRequestId, action: 'approved' },
    orderBy: { actedAt: 'desc' },
  });

  const levelId = latestAction ? latestAction.levelId : null;
  return client.approvalRequestItem.findMany({
    where: { approvalRequestId, levelId },
    include: { item: true },
  });
}

/**
 * Public version — get the most recent approved snapshot (or original).
 * Used for PO pre-fill and UI display.
 */
async function getLatestSnapshot(approvalRequestId) {
  return getLatestSnapshotRaw(null, approvalRequestId);
}

/**
 * Get ALL snapshots grouped by level (for detail view).
 * Returns: { original: [...], levels: [{ level, items: [...] }] }
 */
async function getAllSnapshots(approvalRequestId) {
  const allItems = await prisma.approvalRequestItem.findMany({
    where: { approvalRequestId },
    include: { item: true, level: true },
    orderBy: { id: 'asc' },
  });

  const original = allItems.filter(i => i.levelId === null);
  const byLevel = {};
  for (const item of allItems.filter(i => i.levelId !== null)) {
    const key = item.levelId;
    if (!byLevel[key]) byLevel[key] = { level: item.level, items: [] };
    byLevel[key].items.push(item);
  }

  return { original, levels: Object.values(byLevel) };
}

/**
 * Advance the approval request to the next level, or mark it approved if complete.
 * Records an ApprovalAction.
 * Returns the updated ApprovalRequest.
 */
async function advance(tx, approvalRequest, levels, actorUserId, levelId, comment) {
  const client = tx || prisma;

  // Record the action
  await client.approvalAction.create({
    data: {
      approvalRequestId: approvalRequest.id,
      levelId,
      approvedBy: actorUserId,
      action: 'approved',
      comment: comment || null,
    },
  });

  const maxLevel = Math.max(...levels.map(l => l.levelOrder));
  const isLast = approvalRequest.currentLevel >= maxLevel;

  const updated = await client.approvalRequest.update({
    where: { id: approvalRequest.id },
    data: {
      currentLevel: isLast ? approvalRequest.currentLevel : approvalRequest.currentLevel + 1,
      status: isLast ? 'approved' : 'pending',
    },
  });

  return updated;
}

/**
 * Reject the approval request at any level.
 * Records an ApprovalAction.
 */
async function reject(tx, approvalRequest, actorUserId, levelId, comment) {
  const client = tx || prisma;

  await client.approvalAction.create({
    data: {
      approvalRequestId: approvalRequest.id,
      levelId,
      approvedBy: actorUserId,
      action: 'rejected',
      comment: comment || null,
    },
  });

  const updated = await client.approvalRequest.update({
    where: { id: approvalRequest.id },
    data: { status: 'rejected' },
  });

  return updated;
}

/**
 * Generate a sequential code like "PR-000123" given a prefix and a count.
 */
function generateCode(prefix, count) {
  return `${prefix}-${String(count).padStart(6, '0')}`;
}

module.exports = {
  getOrderedLevels,
  getCurrentLevelRecord,
  validateApproverRole,
  assertNotAlreadyActioned,
  snapshotItems,
  getLatestSnapshot,
  getAllSnapshots,
  advance,
  reject,
  generateCode,
};
