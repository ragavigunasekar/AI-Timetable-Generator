import db from "../db.js";
import logger from "../utils/logger.js";

/**
 * Generic CRUD service for simple table operations.
 * Provides consistent error handling and logging.
 */

/**
 * Get all records from a table.
 * @param {string} table - Table name
 * @returns {Promise<Array>}
 */
export async function getAll(table) {
  return db.all(`SELECT * FROM ${table}`);
}

/**
 * Get a single record by ID.
 * @param {string} table - Table name
 * @param {string} id - Record ID
 * @returns {Promise<Object|undefined>}
 */
export async function getById(table, id) {
  return db.get(`SELECT * FROM ${table} WHERE id = ?`, id);
}

/**
 * Insert a record into a table.
 * @param {string} table - Table name
 * @param {Object} data - Record data { column: value, ... }
 * @returns {Promise<Object>} - The inserted record
 */
export async function create(table, data) {
  const columns = Object.keys(data);
  const values = Object.values(data);
  const placeholders = columns.map(() => "?").join(", ");

  await db.run(
    `INSERT INTO ${table} (${columns.join(", ")}) VALUES (${placeholders})`,
    ...values
  );

  logger.info(`Created record in ${table}: ${data.id || "unknown"}`);
  return getById(table, data.id);
}

/**
 * Update a record by ID.
 * @param {string} table - Table name
 * @param {string} id - Record ID
 * @param {Object} data - Fields to update { column: value, ... }
 * @returns {Promise<Object|undefined>} - The updated record
 */
export async function update(table, id, data) {
  const columns = Object.keys(data);
  const values = Object.values(data);
  const setClause = columns.map((col) => `${col} = ?`).join(", ");

  const result = await db.run(
    `UPDATE ${table} SET ${setClause} WHERE id = ?`,
    ...values,
    id
  );

  if (result.changes === 0) {
    const error = new Error(`Record not found in ${table} with id: ${id}`);
    error.statusCode = 404;
    throw error;
  }

  logger.info(`Updated record in ${table}: ${id}`);
  return getById(table, id);
}

/**
 * Delete a record by ID.
 * @param {string} table - Table name
 * @param {string} id - Record ID
 * @returns {Promise<boolean>} - true if deleted
 */
export async function remove(table, id) {
  const result = await db.run(`DELETE FROM ${table} WHERE id = ?`, id);

  if (result.changes === 0) {
    const error = new Error(`Record not found in ${table} with id: ${id}`);
    error.statusCode = 404;
    throw error;
  }

  logger.info(`Deleted record from ${table}: ${id}`);
  return true;
}