import { verifyToken } from "../utils/jwt.js";
import { getUserById, getUserPermissions } from "../services/authService.js";

function getTokenFromRequest(req) {
  const raw = req.headers.authorization || "";
  if (!raw.startsWith("Bearer ")) {
    return null;
  }
  return raw.slice(7).trim();
}

export async function requireAuth(req, res, next) {
  try {
    const token = getTokenFromRequest(req);
    if (!token) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const decoded = verifyToken(token);
    const user = await getUserById(decoded.userId);

    if (!user || Number(user.is_active) !== 1) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const permissions =
      Number(user.is_super_admin) === 1 ? {} : await getUserPermissions(user.role_id);

    req.user = {
      id: user.id,
      username: user.username,
      email: user.email,
      fullName: user.full_name,
      roleId: user.role_id,
      roleName: user.role_name,
      isSuperAdmin: Number(user.is_super_admin) === 1,
      permissions
    };

    return next();
  } catch (error) {
    return res.status(401).json({ error: "Unauthorized" });
  }
}

export function requireSuperAdmin(req, res, next) {
  if (!req.user || !req.user.isSuperAdmin) {
    return res.status(403).json({ error: "Super admin access required" });
  }
  return next();
}

export function requirePermission(pageKey, mode = "view") {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    if (req.user.isSuperAdmin) {
      return next();
    }

    const permission = req.user.permissions?.[pageKey];
    const allowed = mode === "edit" ? permission?.canEdit : permission?.canView;

    if (!allowed) {
      return res.status(403).json({ error: "Forbidden" });
    }

    return next();
  };
}

