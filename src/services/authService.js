import { pool } from "../db/pool.js";

let hasRoleSuperAdminColumnCache;

async function loadHasRoleSuperAdminColumn() {
  if (typeof hasRoleSuperAdminColumnCache === "boolean") {
    return hasRoleSuperAdminColumnCache;
  }

  try {
    const [rows] = await pool.execute(
      "SHOW COLUMNS FROM addon_android_dashboard_roles LIKE 'is_super_admin'"
    );
    hasRoleSuperAdminColumnCache = rows.length > 0;
  } catch (error) {
    hasRoleSuperAdminColumnCache = false;
  }

  return hasRoleSuperAdminColumnCache;
}

function getSuperAdminSelectSql(hasRoleSuperAdminColumn) {
  if (hasRoleSuperAdminColumn) {
    return "r.is_super_admin AS is_super_admin";
  }

  return "CASE WHEN LOWER(COALESCE(r.role_name, '')) = 'super admin' OR u.role_id = 1 THEN 1 ELSE 0 END AS is_super_admin";
}

export async function getUserById(userId) {
  const hasRoleSuperAdminColumn = await loadHasRoleSuperAdminColumn();
  const [rows] = await pool.execute(
    `SELECT
        u.id,
        u.username,
        u.email,
        u.full_name,
        u.role_id,
        u.is_active,
        r.role_name,
        ${getSuperAdminSelectSql(hasRoleSuperAdminColumn)}
     FROM addon_android_dashboard_users u
     LEFT JOIN addon_android_dashboard_roles r ON u.role_id = r.id
     WHERE u.id = ? LIMIT 1`,
    [userId]
  );
  return rows[0] || null;
}

export async function getUserByLogin(usernameOrEmail) {
  const hasRoleSuperAdminColumn = await loadHasRoleSuperAdminColumn();
  const [rows] = await pool.execute(
    `SELECT
        u.*,
        r.role_name,
        ${getSuperAdminSelectSql(hasRoleSuperAdminColumn)}
     FROM addon_android_dashboard_users u
     LEFT JOIN addon_android_dashboard_roles r ON u.role_id = r.id
     WHERE (u.username = ? OR u.email = ?) AND u.is_active = 1
     LIMIT 1`,
    [usernameOrEmail, usernameOrEmail]
  );
  return rows[0] || null;
}

export async function getUserPermissions(roleId) {
  const [rows] = await pool.execute(
    `SELECT p.page_key, rpp.can_view, rpp.can_edit
     FROM addon_android_dashboard_role_page_permissions rpp
     INNER JOIN addon_android_dashboard_pages p ON p.id = rpp.page_id
     WHERE rpp.role_id = ?`,
    [roleId]
  );

  const permissions = {};
  rows.forEach((row) => {
    permissions[row.page_key] = {
      canView: Number(row.can_view) === 1,
      canEdit: Number(row.can_edit) === 1
    };
  });
  return permissions;
}
