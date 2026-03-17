import express from "express";
import bcrypt from "bcryptjs";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { requireAuth, requirePermission, requireSuperAdmin } from "../middleware/auth.js";
import { pool } from "../db/pool.js";

const router = express.Router();

router.get(
  "/users",
  requireAuth,
  requirePermission("users", "view"),
  asyncHandler(async (req, res) => {
    const [rows] = await pool.execute(
      `SELECT u.id, u.username, u.email, u.full_name, u.role_id, u.is_active, u.created_at, r.role_name
       FROM addon_android_dashboard_users u
       LEFT JOIN addon_android_dashboard_roles r ON r.id = u.role_id
       ORDER BY u.created_at DESC`
    );
    return res.json({ users: rows });
  })
);

router.post(
  "/users",
  requireAuth,
  requirePermission("users", "edit"),
  asyncHandler(async (req, res) => {
    const username = String(req.body.username || "").trim();
    const email = String(req.body.email || "").trim();
    const fullName = String(req.body.fullName || "").trim();
    const roleId = Number(req.body.roleId || 2);
    const isActive = Number(req.body.isActive) === 0 ? 0 : 1;
    const password = String(req.body.password || "");

    if (!username || !email || !password) {
      return res.status(400).json({ error: "Username, email, and password are required" });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const [result] = await pool.execute(
      `INSERT INTO addon_android_dashboard_users (username, email, password, full_name, role_id, is_active)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [username, email, passwordHash, fullName, roleId, isActive]
    );

    return res.status(201).json({ id: Number(result.insertId) });
  })
);

router.put(
  "/users/:id",
  requireAuth,
  requirePermission("users", "edit"),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: "Invalid user id" });
    }

    const username = String(req.body.username || "").trim();
    const email = String(req.body.email || "").trim();
    const fullName = String(req.body.fullName || "").trim();
    const roleId = Number(req.body.roleId || 2);
    const isActive = Number(req.body.isActive) === 0 ? 0 : 1;
    const password = String(req.body.password || "");

    if (!username || !email) {
      return res.status(400).json({ error: "Username and email are required" });
    }

    if (password) {
      const passwordHash = await bcrypt.hash(password, 10);
      await pool.execute(
        `UPDATE addon_android_dashboard_users
         SET username = ?, email = ?, password = ?, full_name = ?, role_id = ?, is_active = ?
         WHERE id = ?`,
        [username, email, passwordHash, fullName, roleId, isActive, id]
      );
    } else {
      await pool.execute(
        `UPDATE addon_android_dashboard_users
         SET username = ?, email = ?, full_name = ?, role_id = ?, is_active = ?
         WHERE id = ?`,
        [username, email, fullName, roleId, isActive, id]
      );
    }

    return res.json({ ok: true });
  })
);

router.delete(
  "/users/:id",
  requireAuth,
  requirePermission("users", "edit"),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: "Invalid user id" });
    }
    if (id === req.user.id) {
      return res.status(400).json({ error: "You cannot delete your own account" });
    }
    await pool.execute(`DELETE FROM addon_android_dashboard_users WHERE id = ?`, [id]);
    return res.json({ ok: true });
  })
);

router.get(
  "/roles",
  requireAuth,
  requireSuperAdmin,
  asyncHandler(async (req, res) => {
    const [roles] = await pool.execute(
      `SELECT r.*, (SELECT COUNT(*) FROM addon_android_dashboard_users u WHERE u.role_id = r.id) AS user_count
       FROM addon_android_dashboard_roles r
       ORDER BY r.is_super_admin DESC, r.created_at ASC`
    );
    return res.json({ roles });
  })
);

router.post(
  "/roles",
  requireAuth,
  requireSuperAdmin,
  asyncHandler(async (req, res) => {
    const roleName = String(req.body.roleName || "").trim();
    const description = String(req.body.description || "").trim();

    if (!roleName) {
      return res.status(400).json({ error: "Role name is required" });
    }

    const [result] = await pool.execute(
      `INSERT INTO addon_android_dashboard_roles (role_name, description, is_super_admin)
       VALUES (?, ?, 0)`,
      [roleName, description]
    );
    return res.status(201).json({ id: Number(result.insertId) });
  })
);

router.put(
  "/roles/:id",
  requireAuth,
  requireSuperAdmin,
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const roleName = String(req.body.roleName || "").trim();
    const description = String(req.body.description || "").trim();
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: "Invalid role id" });
    }
    if (!roleName) {
      return res.status(400).json({ error: "Role name is required" });
    }
    await pool.execute(
      `UPDATE addon_android_dashboard_roles
       SET role_name = ?, description = ?
       WHERE id = ? AND is_super_admin = 0`,
      [roleName, description, id]
    );
    return res.json({ ok: true });
  })
);

router.delete(
  "/roles/:id",
  requireAuth,
  requireSuperAdmin,
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: "Invalid role id" });
    }

    const [roleRows] = await pool.execute(
      `SELECT is_super_admin FROM addon_android_dashboard_roles WHERE id = ? LIMIT 1`,
      [id]
    );
    if (!roleRows[0]) {
      return res.status(404).json({ error: "Role not found" });
    }
    if (Number(roleRows[0].is_super_admin) === 1) {
      return res.status(400).json({ error: "Cannot delete super admin role" });
    }

    const [userRows] = await pool.execute(
      `SELECT COUNT(*) AS total FROM addon_android_dashboard_users WHERE role_id = ?`,
      [id]
    );
    if (Number(userRows[0]?.total || 0) > 0) {
      return res.status(400).json({ error: "Cannot delete role assigned to users" });
    }

    await pool.execute(`DELETE FROM addon_android_dashboard_role_page_permissions WHERE role_id = ?`, [id]);
    await pool.execute(`DELETE FROM addon_android_dashboard_roles WHERE id = ?`, [id]);
    return res.json({ ok: true });
  })
);

router.get(
  "/pages",
  requireAuth,
  requireSuperAdmin,
  asyncHandler(async (req, res) => {
    const [pages] = await pool.execute(
      `SELECT id, page_name, page_key, page_url, category, display_order
       FROM addon_android_dashboard_pages
       ORDER BY category, display_order, page_name`
    );
    return res.json({ pages });
  })
);

router.get(
  "/roles/:id/permissions",
  requireAuth,
  requireSuperAdmin,
  asyncHandler(async (req, res) => {
    const roleId = Number(req.params.id);
    const [rows] = await pool.execute(
      `SELECT page_id, can_view, can_edit
       FROM addon_android_dashboard_role_page_permissions
       WHERE role_id = ?`,
      [roleId]
    );
    return res.json({
      permissions: rows.map((row) => ({
        pageId: Number(row.page_id),
        canView: Number(row.can_view) === 1,
        canEdit: Number(row.can_edit) === 1
      }))
    });
  })
);

router.put(
  "/roles/:id/permissions",
  requireAuth,
  requireSuperAdmin,
  asyncHandler(async (req, res) => {
    const roleId = Number(req.params.id);
    const permissions = Array.isArray(req.body.permissions) ? req.body.permissions : [];

    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      await connection.execute(
        `DELETE FROM addon_android_dashboard_role_page_permissions WHERE role_id = ?`,
        [roleId]
      );

      for (const permission of permissions) {
        const pageId = Number(permission.pageId);
        const canView = permission.canView ? 1 : 0;
        const canEdit = permission.canEdit ? 1 : 0;
        if (!pageId || (!canView && !canEdit)) {
          continue;
        }
        await connection.execute(
          `INSERT INTO addon_android_dashboard_role_page_permissions (role_id, page_id, can_view, can_edit)
           VALUES (?, ?, ?, ?)`,
          [roleId, pageId, canView, canEdit]
        );
      }

      await connection.commit();
      return res.json({ ok: true });
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  })
);

export default router;

