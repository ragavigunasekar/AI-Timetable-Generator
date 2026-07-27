import db, { isValidTable } from "../db.js";
import logger from "../utils/logger.js";

function assertValidTable(table) {
  if (!isValidTable(table)) {
    const err = new Error(`Invalid table name: ${table}`);
    err.statusCode = 400;
    throw err;
  }
}

export async function getAll(table, userId) {
  assertValidTable(table);

  if (table === "users") {
    return db.all(`SELECT id, email, role, createdAt FROM users WHERE id = ?`, userId);
  }

  return db.all(`SELECT * FROM ${table} WHERE userId = ? ORDER BY createdAt DESC`, userId);
}

export async function getById(table, id, userId) {
  assertValidTable(table);

  if (table === "users") {
    return db.get(`SELECT id, email, role, createdAt FROM users WHERE id = ?`, userId);
  }

  return db.get(`SELECT * FROM ${table} WHERE id = ? AND userId = ?`, id, userId);
}

export async function create(table, data, userId) {
  assertValidTable(table);

  const scopedData = { ...data };
  if (table !== "users") {
    scopedData.userId = userId;
  }
  scopedData.createdAt = new Date().toISOString();
  scopedData.updatedAt = new Date().toISOString();

  const columns = Object.keys(scopedData);
  const values = Object.values(scopedData);
  const placeholders = columns.map(() => "?").join(", ");

  await db.run(
    `INSERT INTO ${table} (${columns.join(", ")}) VALUES (${placeholders})`,
    ...values
  );

  logger.info(`Created record in ${table}: ${scopedData.id || "unknown"} (user: ${userId})`);
  return getById(table, scopedData.id, userId);
}

export async function update(table, id, data, userId) {
  assertValidTable(table);

  const updateData = { ...data };
  updateData.updatedAt = new Date().toISOString();
  delete updateData.userId;
  delete updateData.createdAt;

  const columns = Object.keys(updateData);
  const values = Object.values(updateData);
  const setClause = columns.map((col) => `${col} = ?`).join(", ");

  let result;
  if (table === "users") {
    result = await db.run(
      `UPDATE ${table} SET ${setClause} WHERE id = ?`,
      ...values,
      userId
    );
  } else {
    result = await db.run(
      `UPDATE ${table} SET ${setClause} WHERE id = ? AND userId = ?`,
      ...values,
      id,
      userId
    );
  }

  if (result.changes === 0) {
    const error = new Error(`Record not found in ${table} with id: ${id}`);
    error.statusCode = 404;
    throw error;
  }

  logger.info(`Updated record in ${table}: ${id} (user: ${userId})`);
  return getById(table, id, userId);
}

export async function remove(table, id, userId) {
  assertValidTable(table);

  let result;
  if (table === "users") {
    result = await db.run(`DELETE FROM ${table} WHERE id = ?`, userId);
  } else {
    result = await db.run(
      `DELETE FROM ${table} WHERE id = ? AND userId = ?`,
      id,
      userId
    );
  }

  if (result.changes === 0) {
    const error = new Error(`Record not found in ${table} with id: ${id}`);
    error.statusCode = 404;
    throw error;
  }

  logger.info(`Deleted record from ${table}: ${id} (user: ${userId})`);
  return true;
}
