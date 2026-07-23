import bcrypt from "bcryptjs";
import db from "../db.js";
import logger from "../utils/logger.js";

/**
 * Normalize an email address for storage and comparison.
 * @param {string} email
 * @returns {string}
 */
export function normalizeEmail(email) {
  return email.trim().toLowerCase();
}

/**
 * Register a new user.
 * @param {string} email
 * @param {string} password
 * @returns {Promise<{ id: number, email: string, role: string }>}
 * @throws {Error} if email already exists
 */
export async function registerUser(email, password) {
  const normalizedEmail = normalizeEmail(email);

  // Check if email already exists
  const existing = await db.get("SELECT id FROM users WHERE email = ?", normalizedEmail);
  if (existing) {
    const error = new Error("An account with this email already exists.");
    error.statusCode = 409;
    throw error;
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const result = await db.run(
    "INSERT INTO users (email, passwordHash) VALUES (?, ?)",
    normalizedEmail,
    passwordHash
  );

  logger.info(`User registered: ${normalizedEmail}`);
  return { id: result.lastID, email: normalizedEmail, role: "teacher" };
}

/**
 * Authenticate a user by email and password.
 * @param {string} email
 * @param {string} password
 * @returns {Promise<{ id: number, email: string, role: string }>}
 * @throws {Error} if credentials are invalid
 */
export async function authenticateUser(email, password) {
  const normalizedEmail = normalizeEmail(email);

  const user = await db.get("SELECT * FROM users WHERE email = ?", normalizedEmail);
  if (!user) {
    const error = new Error("Invalid credentials");
    error.statusCode = 401;
    throw error;
  }

  const isValid = await bcrypt.compare(password, user.passwordHash);
  if (!isValid) {
    const error = new Error("Invalid credentials");
    error.statusCode = 401;
    throw error;
  }

  logger.info(`User logged in: ${normalizedEmail}`);
  return { id: user.id, email: user.email, role: user.role };
}

/**
 * Get user profile by ID.
 * @param {number} userId
 * @returns {Promise<{ id: number, email: string, role: string }|null>}
 */
export async function getUserProfile(userId) {
  return db.get(
    "SELECT id, email, role FROM users WHERE id = ?",
    userId
  );
}

/**
 * Update user email.
 * @param {number} userId
 * @param {string} newEmail
 * @returns {Promise<{ id: number, email: string, role: string }>}
 * @throws {Error} if email is invalid or taken
 */
export async function updateUserEmail(userId, newEmail) {
  const normalizedEmail = normalizeEmail(newEmail);

  // Check if email is taken by another user
  const existing = await db.get(
    "SELECT id FROM users WHERE email = ? AND id != ?",
    normalizedEmail,
    userId
  );
  if (existing) {
    const error = new Error("This email is already in use by another account.");
    error.statusCode = 409;
    throw error;
  }

  await db.run(
    "UPDATE users SET email = ? WHERE id = ?",
    normalizedEmail,
    userId
  );

  return getUserProfile(userId);
}

/**
 * Change user password after verifying current password.
 * @param {number} userId
 * @param {string} currentPassword
 * @param {string} newPassword
 * @returns {Promise<void>}
 * @throws {Error} if current password is wrong
 */
export async function changePassword(userId, currentPassword, newPassword) {
  const user = await db.get("SELECT passwordHash FROM users WHERE id = ?", userId);
  if (!user) {
    const error = new Error("User not found");
    error.statusCode = 404;
    throw error;
  }

  const isValid = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!isValid) {
    const error = new Error("Current password is incorrect");
    error.statusCode = 401;
    throw error;
  }

  const newHash = await bcrypt.hash(newPassword, 10);
  await db.run("UPDATE users SET passwordHash = ? WHERE id = ?", newHash, userId);
  logger.info(`Password changed for user ${userId}`);
}

/**
 * Delete user account.
 * @param {number} userId
 * @returns {Promise<void>}
 */
export async function deleteUser(userId) {
  await db.run("DELETE FROM users WHERE id = ?", userId);
  logger.info(`User deleted: ${userId}`);
}