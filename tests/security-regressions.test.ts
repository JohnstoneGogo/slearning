import assert from 'node:assert/strict';
import test from 'node:test';
import { isLessonInPublishedCourse } from '../src/server/lesson-access';
import { getSeedAdminCredentials } from '../src/server/seed-admin';
import { canAccessCourse } from '../src/server/course-access';

test('seed admin credentials require an explicit strong password', () => {
  assert.throws(
    () => getSeedAdminCredentials({}),
    /Set ADMIN_USERNAME, ADMIN_EMAIL, and ADMIN_PASSWORD/,
  );
  assert.throws(
    () => getSeedAdminCredentials({
      ADMIN_USERNAME: 'admin',
      ADMIN_EMAIL: 'admin@example.com',
      ADMIN_PASSWORD: 'Admin#12345',
    }),
    /at least 16 characters/,
  );
  assert.throws(
    () => getSeedAdminCredentials({
      ADMIN_USERNAME: 'admin',
      ADMIN_EMAIL: 'admin@example.com',
      ADMIN_PASSWORD: 'aaaaaaaaaaaaaaaa',
    }),
    /at least 16 characters/,
  );

  assert.deepEqual(
    getSeedAdminCredentials({
      ADMIN_USERNAME: 'AdminUser',
      ADMIN_EMAIL: 'ADMIN@EXAMPLE.COM',
      ADMIN_PASSWORD: 'unique-long-password-123',
    }),
    {
      username: 'adminuser',
      email: 'admin@example.com',
      password: 'unique-long-password-123',
    },
  );
});

test('lesson access is allowed only when its course is published', () => {
  assert.equal(isLessonInPublishedCourse({ course: { published: false } }), false);
  assert.equal(isLessonInPublishedCourse({ course: { published: true } }), true);
});

test('course access respects previews, zero prices, activation, and paid entitlements', () => {
  const noAccess = { activated: false, preview: false, price: 5000, paidAt: null };
  assert.equal(canAccessCourse(noAccess), false);
  assert.equal(canAccessCourse({ ...noAccess, preview: true }), true);
  assert.equal(canAccessCourse({ ...noAccess, activated: true }), true);
  assert.equal(canAccessCourse({ ...noAccess, price: 0 }), true);
  assert.equal(canAccessCourse({ ...noAccess, paidAt: new Date() }), true);
  assert.equal(canAccessCourse({ ...noAccess, price: null }), false);
});
