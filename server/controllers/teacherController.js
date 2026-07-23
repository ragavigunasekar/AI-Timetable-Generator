import db from "../db.js";
import logger from "../utils/logger.js";

/**
 * Custom teacher update that handles the availability field with a default.
 */
export async function updateTeacher(req, res) {
  try {
    const { id } = req.params;
    const { code, name, subject, workload, availability } = req.body;

    const result = await db.run(
      `UPDATE teachers
       SET code = ?, name = ?, subject = ?, workload = ?, availability = ?
       WHERE id = ?`,
      code,
      name,
      subject,
      workload,
      availability ?? "Mon,Tue,Wed,Thu,Fri",
      id
    );

    if (result.changes === 0) {
      return res.status(404).json({ success: false, message: "Teacher not found" });
    }

    const all = await db.all("SELECT * FROM teachers");
    logger.info(`Teacher updated: ${id}`);
    return res.json({ success: true, data: all });
  } catch (error) {
    logger.error(`Failed to update teacher: ${error.message}`);
    return res.status(400).json({ success: false, message: error.message || "Failed to update teacher" });
  }
}

/**
 * Custom teacher update that handles the availability field with a default.
 * Also handles the creation with id from the request body.
 */
export async function createTeacher(req, res) {
  try {
    const { id, code, name, subject, workload } = req.body;
    await db.run(
      "INSERT INTO teachers (id, code, name, subject, workload) VALUES (?, ?, ?, ?, ?)",
      id, code, name, subject, workload
    );
    const all = await db.all("SELECT * FROM teachers");
    logger.info(`Teacher created: ${id}`);
    return res.status(201).json({ success: true, data: all });
  } catch (error) {
    logger.error(`Failed to create teacher: ${error.message}`);
    return res.status(400).json({ success: false, message: error.message || "Failed to create teacher" });
  }
}