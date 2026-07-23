import * as crudService from "../services/crudService.js";
import db from "../db.js";

/**
 * Generic factory to create CRUD controllers for a given table.
 * Each controller wraps the crudService with try/catch and consistent JSON responses.
 *
 * @param {string} table - Database table name
 * @param {Object} options
 * @param {Function} [options.onDelete] - Optional cleanup function called after delete
 * @returns {{ list, get, create: createHandler, update: updateHandler, remove: removeHandler }}
 */
export function createResourceController(table, options = {}) {
  const { onDelete } = options;

  async function list(req, res) {
    try {
      const records = await crudService.getAll(table);
      return res.json({ success: true, data: records });
    } catch (error) {
      return res.status(500).json({ success: false, message: `Failed to fetch ${table}` });
    }
  }

  async function get(req, res) {
    try {
      const record = await crudService.getById(table, req.params.id);
      if (!record) {
        return res.status(404).json({ success: false, message: `${table} not found` });
      }
      return res.json({ success: true, data: record });
    } catch (error) {
      return res.status(500).json({ success: false, message: `Failed to fetch ${table}` });
    }
  }

  async function createHandler(req, res) {
    try {
      const record = await crudService.create(table, req.body);
      const all = await crudService.getAll(table);
      return res.status(201).json({ success: true, data: all });
    } catch (error) {
      return res.status(400).json({ success: false, message: error.message || `Failed to create ${table}` });
    }
  }

  async function updateHandler(req, res) {
    try {
      const record = await crudService.update(table, req.params.id, req.body);
      const all = await crudService.getAll(table);
      return res.json({ success: true, data: all });
    } catch (error) {
      const statusCode = error.statusCode || 400;
      return res.status(statusCode).json({ success: false, message: error.message || `Failed to update ${table}` });
    }
  }

  async function removeHandler(req, res) {
    try {
      await crudService.remove(table, req.params.id);
      if (onDelete) {
        await onDelete(req.params.id);
      }
      const all = await crudService.getAll(table);
      return res.json({ success: true, data: all });
    } catch (error) {
      const statusCode = error.statusCode || 400;
      return res.status(statusCode).json({ success: false, message: error.message || `Failed to delete ${table}` });
    }
  }

  return { list, get, create: createHandler, update: updateHandler, remove: removeHandler };
}