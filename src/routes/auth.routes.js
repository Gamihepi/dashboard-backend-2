import express from "express";
import bcrypt from "bcryptjs";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { pool } from "../db/pool.js";
import { getUserByLogin, getUserPermissions } from "../services/authService.js";
import { signToken } from "../utils/jwt.js";
import { requireAuth } from "../middleware/auth.js";

const router = express.Router();

function mapUser(user, permissions = {}) {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    fullName: user.full_name,
    roleId: user.role_id,
    roleName: user.role_name,
    isSuperAdmin: Number(user.is_super_admin) === 1,
    permissions
  };
}

router.post(
  "/login",
  asyncHandler(async (req, res) => {
    const username = String(req.body.username || "").trim();
    const password = String(req.body.password || "");
   console.log("Login attempt received:", { username });

    if (!username || !password) {
      return res.status(400).json({ error: "Username and password are required" });
    }

    const user = await getUserByLogin(username);
    if (!user) {
      return res.status(401).json({ error: "Invalid username or password" });
    }

    const passwordOk = await bcrypt.compare(password, user.password);
    if (!passwordOk) {
      return res.status(401).json({ error: "Invalid username or password" });
    }

    await pool.execute("UPDATE addon_android_dashboard_users SET updated_at = NOW() WHERE id = ?", [
      user.id
    ]);

    const permissions =
      Number(user.is_super_admin) === 1 ? {} : await getUserPermissions(user.role_id);
    const token = signToken({ userId: user.id });

    return res.json({
      token,
      user: mapUser(user, permissions)
    });
  })
);

router.get(
  "/me",
  requireAuth,
  asyncHandler(async (req, res) => {
    return res.json({ user: req.user });
  })
);

router.post(
  "/logout",
  requireAuth,
  asyncHandler(async (req, res) => {
    return res.json({ ok: true });
  })
);

export default router;

