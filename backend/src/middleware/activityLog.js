/**
 * Log an activity to the activity_log table.
 */
async function logActivity(prisma, userId, action, entityType, entityId) {
  try {
    await prisma.activityLog.create({
      data: { userId, action, entityType, entityId: entityId || null },
    });
  } catch (err) {
    console.error('Activity log error:', err.message);
  }
}

module.exports = { logActivity };
