import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error("JWT_SECRET environment variable is not set");
}

const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "8h";

/**
 * @typedef {Object} JwtPayload
 * @property {number} id
 * @property {string} email
 * @property {string} role
 */

/**
 * Create a signed JWT for the given user.
 * @param {JwtPayload} user
 * @returns {string} signed JWT
 */
export function createToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
}

/**
 * Verify and decode a JWT token.
 * @param {string} token
 * @returns {JwtPayload}
 */
export function verifyToken(token) {
  return jwt.verify(token, JWT_SECRET);
}