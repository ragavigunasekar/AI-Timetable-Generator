import { Router } from "express";
import { authenticate } from "../middleware/auth.js";
import { authValidation } from "../middleware/validator.js";
import * as authController from "../controllers/authController.js";

const router = Router();

// POST /api/auth/register
router.post("/register", authValidation.register, authController.register);

// POST /api/auth/login
router.post("/login", authValidation.login, authController.login);

// GET /api/profile - Get authenticated user's profile
router.get("/profile", authenticate, authController.getProfile);

// PUT /api/profile - Update authenticated user's email
router.put("/profile", authenticate, authController.updateProfile);

// PUT /api/profile/password - Change password
router.put("/profile/password", authenticate, authController.changePassword);

// DELETE /api/profile - Delete authenticated user's account
router.delete("/profile", authenticate, authController.deleteProfile);

export default router;