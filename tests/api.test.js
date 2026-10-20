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
  assert.equal(wedding.payment_qr_media_id, '');
  assert.deepEqual(wedding.ceremony_schedule, []);
  assert.deepEqual(wedding.love_timeline, []);
  const templates = await request('/api/templates');
  assert.ok(templates.data.templates.some((template) => template.name === 'Khmer Heritage' && template.category === 'Khmer'));
  assert.ok(templates.data.templates.some((template) => template.name === 'Angkor Royal' && template.category === 'Khmer'));
  assert.ok(templates.data.templates.some((template) => template.name === 'Khmer Ceremonial' && template.category === 'Khmer' && template.color === '#D4AF37'));
  assert.ok(templates.data.templates.some((template) => template.name === 'Khmer Ceremonial Gold' && template.category === 'Khmer' && template.color === '#D4AF37'));
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
  assert.equal((await request(`/api/weddings/${wedding.id}`, {
    token: ownerToken, method: 'PUT',
    body: {
      payment_qr_media_id: uploadedImage.data.media.id,
      love_timeline: JSON.stringify([{ title: 'A memory', photo_media_id: uploadedImage.data.media.id }]),
    },
  })).status, 200);
  assert.equal((await request(`/api/weddings/${wedding.id}`, {
    token: ownerToken, method: 'PUT', body: { ceremony_schedule: 'not valid json' },
  })).status, 400);
  assert.equal((await request(`/api/weddings/${wedding.id}/media/${uploadedImage.data.media.id}`, { token: ownerToken, method: 'DELETE' })).status, 204);
  const afterImageRemoval = await request(`/api/weddings/${wedding.id}`, { token: ownerToken });
  assert.equal(afterImageRemoval.data.wedding.payment_qr_media_id, '');
  assert.equal(afterImageRemoval.data.wedding.love_timeline[0].photo_media_id, '');

  assert.equal((await request(`/api/weddings/${wedding.id}/guests`, { token: otherOwnerToken })).status, 404);
  assert.equal((await request(`/api/weddings/${wedding.id}`, { token: otherOwnerToken, method: 'PUT', body: { title: 'Changed' } })).status, 404);

  const published = await request(`/api/weddings/${wedding.id}`, {
    token: ownerToken, method: 'PUT',
    body: {
      published: true, template: 'Angkor Royal', payment_qr_media_id: 'qr-image',
      welcome_video_media_id: 'welcome-video', music_media_id: 'wedding-music',
      ceremony_schedule: JSON.stringify([{ name: 'ពិធីសូត្រមន្ត', time: '08:00', location: 'Main Hall' }]),
      love_timeline: JSON.stringify([{ title: 'Our beginning', date: '2020-02-14', description: 'We met on a lovely day.' }]),
      parking_info: 'Guest parking is behind the hall.',
      contact_phone: '+85512345678',
      contact_telegram: 'https://t.me/example',
      gift_payment_info: 'Optional gift details',
    },
  });
  assert.equal(published.status, 200);
  assert.equal(published.data.wedding.template, 'Angkor Royal');
  assert.equal(published.data.wedding.payment_qr_media_id, 'qr-image');
  assert.equal(published.data.wedding.welcome_video_media_id, 'welcome-video');
  assert.equal(published.data.wedding.music_media_id, 'wedding-music');
  assert.deepEqual(published.data.wedding.ceremony_schedule, [{ name: 'ពិធីសូត្រមន្ត', date: '', time: '08:00', description: '', location: 'Main Hall' }]);
  assert.deepEqual(published.data.wedding.love_timeline, [{ title: 'Our beginning', date: '2020-02-14', description: 'We met on a lovely day.', photo_media_id: '' }]);
  assert.equal((await request(`/api/public/${wedding.slug}`)).data.wedding.parking_info, 'Guest parking is behind the hall.');
  const selectedCeremonial = await request(`/api/weddings/${wedding.id}`, {
    token: ownerToken, method: 'PUT', body: { template: 'Khmer Ceremonial', primary_color: '#D4AF37' },
  });
  assert.equal(selectedCeremonial.status, 200);
  assert.equal(selectedCeremonial.data.wedding.template, 'Khmer Ceremonial');
  assert.equal((await request(`/api/public/${wedding.slug}`)).data.wedding.template, 'Khmer Ceremonial');
  const selectedCeremonialGold = await request(`/api/weddings/${wedding.id}`, {
    token: ownerToken, method: 'PUT', body: { template: 'Khmer Ceremonial Gold', primary_color: '#D4AF37' },
  });
  assert.equal(selectedCeremonialGold.status, 200);
  assert.equal(selectedCeremonialGold.data.wedding.template, 'Khmer Ceremonial Gold');
  assert.equal((await request(`/api/public/${wedding.slug}`)).data.wedding.template, 'Khmer Ceremonial Gold');
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
    method: 'POST', body: { name: 'Sam Guest', invitation_token: invitationToken, attending: true, attendees: 2, phone: '+85512345678', meal_preference: 'Vegetarian' },
  })).status, 201);
  assert.equal((await request(`/api/public/${wedding.slug}/rsvp`, {
    method: 'POST', body: { name: 'Sam Guest', invitation_token: invitationToken, attending: true, attendees: 1, phone: '+85512345678', meal_preference: 'Vegan' },
  })).status, 201);

  const updatedGuest = await request(`/api/weddings/${wedding.id}/guests`, { token: ownerToken });
  assert.equal(updatedGuest.data.guests[0].rsvp, 'Attending');
  assert.equal(updatedGuest.data.guests[0].attendees, 1);
  assert.equal(updatedGuest.data.guests[0].rsvp_phone, '+85512345678');
  assert.equal(updatedGuest.data.guests[0].meal_preference, 'Vegan');
  assert.equal(updatedGuest.data.guests[0].rsvp_message, '');
  const csvResponse = await fetch(`${origin}/api/weddings/${wedding.id}/guests.csv`, { headers: { Authorization: `****** } });
  const guestCsv = await csvResponse.text();
  assert.match(guestCsv, /meal_preference/);
  assert.match(guestCsv, /Vegan/);

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
