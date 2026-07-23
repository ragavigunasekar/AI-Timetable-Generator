import { createToken } from "../utils/jwt.js";
import * as authService from "../services/authService.js";

/**
 * POST /api/auth/register
 * Register a new user account.
 */
export async function register(req, res) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: "Email and password are required" });
    }

    const user = await authService.registerUser(email, password);
    const token = createToken(user);

    return res.status(201).json({
      success: true,
      data: { token },
    });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      success: false,
      message: error.message || "Registration failed",
    });
  }
}

/**
 * POST /api/auth/login
 * Authenticate user and return JWT token.
 */
export async function login(req, res) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: "Email and password are required" });
    }

    const user = await authService.authenticateUser(email, password);
    const token = createToken(user);

    return res.json({
      success: true,
      data: {
        token,
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
        },
      },
    });
  } catch (error) {
    const statusCode = error.statusCode || 401;
    return res.status(statusCode).json({
      success: false,
      message: error.message || "Login failed",
    });
  }
}

/**
 * GET /api/profile
 * Get the authenticated user's profile.
 */
export async function getProfile(req, res) {
  try {
    const profile = await authService.getUserProfile(req.user.id);
    if (!profile) {
      return res.status(404).json({ success: false, message: "Profile not found" });
    }
    return res.json({ success: true, data: profile });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message || "Failed to fetch profile" });
  }
}

/**
 * PUT /api/profile
 * Update the authenticated user's email.
 */
export async function updateProfile(req, res) {
  try {
    const { email } = req.body;
    if (!email || typeof email !== "string" || !email.includes("@")) {
      return res.status(400).json({ success: false, message: "A valid email is required" });
    }

    const updated = await authService.updateUserEmail(req.user.id, email);
    return res.json({ success: true, data: updated });
  } catch (error) {
    const statusCode = error.statusCode || 400;
    return res.status(statusCode).json({
      success: false,
      message: error.message || "Failed to update profile",
    });
  }
}

/**
 * PUT /api/profile/password
 * Change the authenticated user's password.
 */
export async function changePassword(req, res) {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ success: false, message: "Current password and new password are required" });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({ success: false, message: "New password must be at least 8 characters long" });
    }

    await authService.changePassword(req.user.id, currentPassword, newPassword);
    return res.json({ success: true, message: "Password updated successfully" });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      success: false,
      message: error.message || "Failed to change password",
    });
  }
}

/**
 * DELETE /api/profile
 * Delete the authenticated user's account.
 */
export async function deleteProfile(req, res) {
  try {
    await authService.deleteUser(req.user.id);
    return res.json({ success: true, data: { deleted: true } });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message || "Failed to delete account" });
  }
}