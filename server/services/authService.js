import bcrypt from "bcryptjs";
import db, { ensureDefaultSettings } from "../db.js";
import logger from "../utils/logger.js";

export function normalizeEmail(email) {
  return email.trim().toLowerCase();
}

const PASSWORD_MIN_LENGTH = 8;

export function validatePassword(password) {
  if (!password || typeof password !== "string") {
    return { valid: false, message: "Password is required" };
  }
  if (password.length < PASSWORD_MIN_LENGTH) {
    return {
      valid: false,
      message: `Password must be at least ${PASSWORD_MIN_LENGTH} characters long`,
    };
  }
  if (!/[a-z]/.test(password)) {
    return {
      valid: false,
      message: "Password must contain at least one lowercase letter",
    };
  }
  if (!/[A-Z]/.test(password)) {
    return {
      valid: false,
      message: "Password must contain at least one uppercase letter",
    };
  }
  if (!/\d/.test(password)) {
    return {
      valid: false,
      message: "Password must contain at least one number",
    };
  }
  return { valid: true };
}

export async function registerUser(email, password) {
  const normalizedEmail = normalizeEmail(email);

  if (!normalizedEmail || !normalizedEmail.includes("@")) {
    const error = new Error("A valid email address is required.");
    error.statusCode = 400;
    throw error;
  }

  const pwCheck = validatePassword(password);
  if (!pwCheck.valid) {
    const error = new Error(pwCheck.message);
    error.statusCode = 400;
    throw error;
  }

  const existing = await db.get("SELECT id FROM users WHERE email = ?", normalizedEmail);
  if (existing) {
    const error = new Error("An account with this email already exists.");
    error.statusCode = 409;
    throw error;
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const result = await db.run(
    "INSERT INTO users (email, passwordHash, role, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?)",
    normalizedEmail,
    passwordHash,
    "teacher",
    new Date().toISOString(),
    new Date().toISOString()
  );

  const userId = result.lastID;
  await ensureDefaultSettings(userId);

  logger.info(`User registered: ${normalizedEmail} (id: ${userId})`);
  return { id: userId, email: normalizedEmail, role: "teacher" };
}

export async function authenticateUser(email, password) {
  const normalizedEmail = normalizeEmail(email);

  if (!normalizedEmail || !password) {
    const error = new Error("Invalid credentials");
    error.statusCode = 401;
    throw error;
  }

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

  await ensureDefaultSettings(user.id);

  logger.info(`User logged in: ${normalizedEmail} (id: ${user.id})`);
  return { id: user.id, email: user.email, role: user.role };
}

export async function getUserProfile(userId) {
  const user = await db.get(
    "SELECT id, email, role, createdAt FROM users WHERE id = ?",
    userId
  );
  if (!user) return null;

  return {
    id: user.id,
    email: user.email,
    role: user.role,
    createdAt: user.createdAt,
  };
}

export async function updateUserEmail(userId, newEmail) {
  const normalizedEmail = normalizeEmail(newEmail);

  if (!normalizedEmail || !normalizedEmail.includes("@")) {
    const error = new Error("A valid email address is required.");
    error.statusCode = 400;
    throw error;
  }

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
    "UPDATE users SET email = ?, updatedAt = ? WHERE id = ?",
    normalizedEmail,
    new Date().toISOString(),
    userId
  );

  return getUserProfile(userId);
}

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

  const pwCheck = validatePassword(newPassword);
  if (!pwCheck.valid) {
    const error = new Error(pwCheck.message);
    error.statusCode = 400;
    throw error;
  }

  const newHash = await bcrypt.hash(newPassword, 12);
  await db.run(
    "UPDATE users SET passwordHash = ?, updatedAt = ? WHERE id = ?",
    newHash,
    new Date().toISOString(),
    userId
  );
  logger.info(`Password changed for user ${userId}`);
}

export async function deleteUser(userId) {
  await db.run("DELETE FROM users WHERE id = ?", userId);
  logger.info(`User deleted: ${userId}`);
}
