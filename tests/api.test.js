import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'ever-after-test-'));
process.env.NODE_ENV = 'test';
process.env.DATA_DIR = tempDirectory;
process.env.UPLOAD_DIR = path.join(tempDirectory, 'uploads');
process.env.JWT_SECRET = 'automated-tests-only-secret-that-is-long-enough';
process.env.SUPERADMIN_EMAIL = 'admin@everafter.test';
process.env.SUPERADMIN_PASSWORD_HASH = await bcrypt.hash('Admin-test-password-secure', 12);

const { app } = await import('../server/index.js');
const server = app.listen(0);
await new Promise((resolve) => server.once('listening', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;

async function request(endpoint, { token, method = 'GET', body } = {}) {
  const response = await fetch(`${origin}${endpoint}`, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  return { status: response.status, data: response.status === 204 ? null : await response.json() };
}

async function upload(endpoint, token, file) {
  const body = new FormData();
  body.append('file', file, 'not-a-real-image.png');
  const response = await fetch(`${origin}${endpoint}`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body });
  return { status: response.status, data: await response.json() };
}

after(async () => {
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  fs.rmSync(tempDirectory, { recursive: true, force: true });
});

test('accounts are isolated and wedding publishing and RSVP work end to end', async () => {
  const health = await request('/api/health');
  assert.equal(health.status, 200);

  const configuredSecret = process.env.JWT_SECRET;
  delete process.env.JWT_SECRET;
  const unconfiguredRegistration = await request('/api/auth/register', {
    method: 'POST',
    body: { name: 'Jamie Taylor', email: 'jamie@everafter.test', password: 'A-secure-test-password' },
  });
  process.env.JWT_SECRET = configuredSecret;
  assert.equal(unconfiguredRegistration.status, 503);

  const registration = await request('/api/auth/register', {
    method: 'POST',
    body: { name: 'Jamie Taylor', email: 'jamie@everafter.test', password: 'A-secure-test-password' },
  });
  assert.equal(registration.status, 201);
  const ownerToken = registration.data.token;

  const secondRegistration = await request('/api/auth/register', {
    method: 'POST',
    body: { name: 'Alex Morgan', email: 'alex@everafter.test', password: 'Another-secure-password' },
  });
  assert.equal(secondRegistration.status, 201);
  const otherOwnerToken = secondRegistration.data.token;

  const created = await request('/api/weddings', { token: ownerToken, method: 'POST', body: { title: 'Jamie & Alex' } });
  assert.equal(created.status, 201);
  const wedding = created.data.wedding;
  assert.equal((await upload(`/api/weddings/${wedding.id}/media`, ownerToken, new Blob(['not an image'], { type: 'image/png' }))).status, 400);

  const guest = await request(`/api/weddings/${wedding.id}/guests`, {
    token: ownerToken, method: 'POST',
    body: { name: 'Sam Guest', email: 'sam@everafter.test', party_size: 2 },
  });
  assert.equal(guest.status, 201);
  const invitationToken = guest.data.guest.invitation_token;
  const preview = await request(`/api/preview/${wedding.slug}`, { token: ownerToken });
  assert.equal(preview.status, 200);
  assert.equal(preview.data.wedding.published, false);
  assert.equal((await request(`/api/preview/${wedding.slug}`, { token: otherOwnerToken })).status, 404);
  assert.equal((await request(`/api/public/${wedding.slug}`)).status, 404);

  const uploadedImage = await upload(
    `/api/weddings/${wedding.id}/media`,
    ownerToken,
    new Blob([Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000b49444154789c636000020000050001a5f645400000000049454e44ae426082', 'hex')], { type: 'image/png' }),
  );
  assert.equal(uploadedImage.status, 201, JSON.stringify(uploadedImage.data));
  assert.equal(uploadedImage.data.media.type, 'image');
  assert.equal((await request(`/api/weddings/${wedding.id}/media/${uploadedImage.data.media.id}`, { token: ownerToken, method: 'DELETE' })).status, 204);

  assert.equal((await request(`/api/weddings/${wedding.id}/guests`, { token: otherOwnerToken })).status, 404);
  assert.equal((await request(`/api/weddings/${wedding.id}`, { token: otherOwnerToken, method: 'PUT', body: { title: 'Changed' } })).status, 404);

  const published = await request(`/api/weddings/${wedding.id}`, { token: ownerToken, method: 'PUT', body: { published: true } });
  assert.equal(published.status, 200);
  assert.equal((await request(`/api/public/${wedding.slug}`)).data.wedding.published, true);
  assert.equal((await request(`/api/public/${wedding.slug}?guest=${invitationToken}`)).data.invited_guest.name, 'Sam Guest');
  const recoveredInvite = await request(`/api/public/undefined?guest=${invitationToken}`);
  assert.equal(recoveredInvite.status, 200);
  assert.equal(recoveredInvite.data.wedding.slug, wedding.slug);

  assert.equal((await request(`/api/public/${wedding.slug}/rsvp`, {
    method: 'POST', body: { name: 'Sam Guest', invitation_token: '0'.repeat(64), attending: true, attendees: 2 },
  })).status, 404);
  assert.equal((await request(`/api/public/${wedding.slug}/rsvp`, {
    method: 'POST', body: { name: 'Sam Guest', invitation_token: invitationToken, attending: true, attendees: 3 },
  })).status, 400);
  assert.equal((await request(`/api/public/${wedding.slug}/rsvp`, {
    method: 'POST', body: { name: 'Sam Guest', invitation_token: invitationToken, attending: true, attendees: 2 },
  })).status, 201);

  const updatedGuest = await request(`/api/weddings/${wedding.id}/guests`, { token: ownerToken });
  assert.equal(updatedGuest.data.guests[0].rsvp, 'Attending');
  assert.equal(updatedGuest.data.guests[0].attendees, 2);

  const admin = await request('/api/auth/login', {
    method: 'POST',
    body: { email: 'admin@everafter.test', password: 'Admin-test-password-secure' },
  });
  assert.equal(admin.data.user.role, 'admin');
  const users = await request('/api/admin/users', { token: admin.data.token });
  assert.equal(users.status, 200);
  assert.equal(users.data.users.length, 3);

  const suspended = await request(`/api/admin/users/${secondRegistration.data.user.id}/status`, {
    token: admin.data.token, method: 'PATCH', body: { status: 'suspended' },
  });
  assert.equal(suspended.status, 200);
  assert.equal((await request('/api/auth/me', { token: otherOwnerToken })).status, 401);
});
