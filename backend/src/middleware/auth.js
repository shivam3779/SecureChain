const jwt = require('jsonwebtoken');

function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Missing bearer token' });
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'Admin') {
    return res.status(403).json({ error: 'Access denied: Admin role required' });
  }
  next();
}

function requireRole(allowedRoles = []) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    if (req.user.role === 'Admin') {
      return next(); // Admins have super-user permission across all roles
    }
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        error: `Access denied: Requires one of [${allowedRoles.join(', ')}]`,
      });
    }
    next();
  };
}

function isRepoAuthorized(repo, user, db) {
  if (!repo || !user) return false;
  if (user.role === 'Admin') return true;
  if (repo.ownerId === user.sub) return true;
  const currentUser = db?.data?.users?.find(
    (u) => String(u.githubId) === user.sub || u.googleId === user.sub || u.id === user.sub
  );
  if (currentUser?.orgId) {
    const ownerUser = db?.data?.users?.find(
      (u) => String(u.githubId) === repo.ownerId || u.googleId === repo.ownerId || u.id === repo.ownerId
    );
    if (ownerUser && ownerUser.orgId === currentUser.orgId) return true;
  }
  return false;
}

function getAllowedRepoIds(user, db) {
  if (!user) return new Set();
  if (user.role === 'Admin') {
    return new Set((db?.data?.repositories || []).map((r) => r.id));
  }
  const currentUser = db?.data?.users?.find(
    (u) => String(u.githubId) === user.sub || u.googleId === user.sub || u.id === user.sub
  );
  const allowedOwnerIds = new Set([user.sub]);
  if (currentUser?.orgId) {
    (db?.data?.users || [])
      .filter((u) => u.orgId === currentUser.orgId)
      .forEach((u) => {
        if (u.id) allowedOwnerIds.add(u.id);
        if (u.githubId) allowedOwnerIds.add(String(u.githubId));
        if (u.googleId) allowedOwnerIds.add(u.googleId);
      });
  }
  const allowedRepos = (db?.data?.repositories || []).filter((r) => allowedOwnerIds.has(r.ownerId));
  return new Set(allowedRepos.map((r) => r.id));
}

module.exports = { requireAuth, requireAdmin, requireRole, isRepoAuthorized, getAllowedRepoIds };
