import db from "../db.js";
import logger from "../utils/logger.js";

export async function updateTeacher(req, res) {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const { code, name, subject, workload, availability } = req.body;

    const result = await db.run(
      `UPDATE teachers
       SET code = ?, name = ?, subject = ?, workload = ?, availability = ?, updatedAt = ?
       WHERE id = ? AND userId = ?`,
      code,
      name,
      subject,
      workload,
      availability ?? "Mon,Tue,Wed,Thu,Fri",
      new Date().toISOString(),
      id,
      userId
    );

    if (result.changes === 0) {
      return res.status(404).json({ success: false, message: "Teacher not found" });
    }

    const all = await db.all(
      "SELECT * FROM teachers WHERE userId = ? ORDER BY createdAt DESC",
      userId
    );
    logger.info(`Teacher updated: ${id} (user: ${userId})`);
    return res.json({ success: true, data: all });
  } catch (error) {
    logger.error(`Failed to update teacher: ${error.message}`);
    const statusCode = error.statusCode || 400;
    return res.status(statusCode).json({
      success: false,
      message: error.message || "Failed to update teacher",
    });
  }
}

export async function createTeacher(req, res) {
  try {
    const userId = req.user.id;
    const { id, code, name, subject, workload } = req.body;
    const now = new Date().toISOString();
    await db.run(
      "INSERT INTO teachers (id, userId, code, name, subject, workload, availability, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
      id,
      userId,
      code,
      name,
      subject,
      workload,
      "Mon,Tue,Wed,Thu,Fri",
      now,
      now
    );
    const all = await db.all(
      "SELECT * FROM teachers WHERE userId = ? ORDER BY createdAt DESC",
      userId
    );
    logger.info(`Teacher created: ${id} (user: ${userId})`);
    return res.status(201).json({ success: true, data: all });
  } catch (error) {
    logger.error(`Failed to create teacher: ${error.message}`);
    const statusCode = error.statusCode || 400;
    return res.status(statusCode).json({
      success: false,
      message: error.message || "Failed to create teacher",
    });
  }
}
