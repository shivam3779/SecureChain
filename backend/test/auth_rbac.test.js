const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { requireAuth, requireAdmin, requireRole } = require('../src/middleware/auth');
const adminLayer = require('../src/modules/adminLayer');
const { db } = require('../src/db/store');

describe('Auth & RBAC Enforcement', () => {
  test('requireAdmin rejects unauthenticated or non-admin requests with 403', () => {
    let statusCode = null;
    let jsonBody = null;
    let nextCalled = false;

    const res = {
      status(code) {
        statusCode = code;
        return {
          json(b) { jsonBody = b; }
        };
      }
    };

    // Case 1: No user
    requireAdmin({ user: null }, res, () => { nextCalled = true; });
    assert.equal(statusCode, 403);
    assert.equal(nextCalled, false);

    // Case 2: Viewer role
    statusCode = null;
    requireAdmin({ user: { role: 'Viewer' } }, res, () => { nextCalled = true; });
    assert.equal(statusCode, 403);
    assert.equal(nextCalled, false);

    // Case 3: Developer role
    statusCode = null;
    requireAdmin({ user: { role: 'Developer' } }, res, () => { nextCalled = true; });
    assert.equal(statusCode, 403);
    assert.equal(nextCalled, false);

    // Case 4: Admin role succeeds
    statusCode = null;
    requireAdmin({ user: { role: 'Admin' } }, res, () => { nextCalled = true; });
    assert.equal(statusCode, null);
    assert.equal(nextCalled, true);
  });

  test('requireRole enforces allowed role sets', () => {
    const middleware = requireRole(['SecurityAnalyst', 'DevOpsEngineer']);
    let passed = false;
    let status = null;

    const res = {
      status(code) {
        status = code;
        return { json() {} };
      }
    };

    // Deny viewer
    middleware({ user: { role: 'Viewer' } }, res, () => { passed = true; });
    assert.equal(status, 403);
    assert.equal(passed, false);

    // Allow SecurityAnalyst
    status = null;
    middleware({ user: { role: 'SecurityAnalyst' } }, res, () => { passed = true; });
    assert.equal(passed, true);

    // Admin always allowed
    passed = false;
    middleware({ user: { role: 'Admin' } }, res, () => { passed = true; });
    assert.equal(passed, true);
  });

  test('adminLayer.setUserRole prevents non-admin modification and last-admin demotion', async () => {
    await db.read();
    const originalUsers = [...(db.data.users || [])];
    db.data.users.push(
      { id: 'test-admin-1', login: 'superadmin', role: 'Admin' },
      { id: 'test-user-1', login: 'devuser', role: 'Developer' }
    );
    await db.write();

    try {
      // Non-admin attempting modification throws unauthorized
      await assert.rejects(
        async () => {
          await adminLayer.setUserRole('test-user-1', 'Admin', { id: 'test-user-1', login: 'devuser', role: 'Developer' });
        },
        /Unauthorized/
      );

      // Admin modifying developer succeeds
      const updated = await adminLayer.setUserRole('test-user-1', 'SecurityAnalyst', { id: 'test-admin-1', login: 'superadmin', role: 'Admin' });
      assert.equal(updated.role, 'SecurityAnalyst');

      // Attempting to demote the only remaining Admin when adminCount <= 1
      const allAdmins = db.data.users.filter(u => u.role === 'Admin');
      if (allAdmins.length <= 1) {
        await assert.rejects(
          async () => {
            await adminLayer.setUserRole(allAdmins[0].id, 'Developer', { id: 'test-admin-1', login: 'superadmin', role: 'Admin' });
          },
          /Cannot demote the last remaining administrator/
        );
      }
    } finally {
      db.data.users = originalUsers;
      await db.write();
    }
  });
});
