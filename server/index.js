import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import multer from 'multer';
import { fileTypeFromFile } from 'file-type';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import initSqlJs from 'sql.js';
import { z } from 'zod';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const dataDir = path.resolve(process.env.DATA_DIR || path.join(root, 'data'));
const uploadDir = path.resolve(process.env.UPLOAD_DIR || path.join(root, 'uploads'));
fs.mkdirSync(dataDir, { recursive: true });
fs.mkdirSync(uploadDir, { recursive: true });

const jwtSecretPath = path.join(dataDir, '.jwt-secret');
if (!process.env.JWT_SECRET || process.env.JWT_SECRET === 'replace-with-a-long-random-secret') {
  process.env.JWT_SECRET = fs.existsSync(jwtSecretPath)
    ? fs.readFileSync(jwtSecretPath, 'utf8').trim()
    : randomBytes(48).toString('hex');
  if (!fs.existsSync(jwtSecretPath)) fs.writeFileSync(jwtSecretPath, process.env.JWT_SECRET, { mode: 0o600 });
}

const databasePath = path.join(dataDir, 'ever-after.sqlite');
const SQL = await initSqlJs({ locateFile: (file) => path.join(root, 'node_modules', 'sql.js', 'dist', file) });
const sqlite = fs.existsSync(databasePath) ? new SQL.Database(new Uint8Array(fs.readFileSync(databasePath))) : new SQL.Database();
let transactionDepth = 0;
function persistDatabase() {
  if (transactionDepth === 0) fs.writeFileSync(databasePath, Buffer.from(sqlite.export()));
}
const db = {
  exec(statement) {
    sqlite.exec(statement);
    persistDatabase();
  },
  pragma(statement) {
    if (/foreign_keys/i.test(statement)) sqlite.exec('PRAGMA foreign_keys = ON');
  },
  prepare(statement) {
    function query(params, collect) {
      const queryStatement = sqlite.prepare(statement);
      try {
        queryStatement.bind(params);
        if (!queryStatement.step()) return collect ? [] : undefined;
        if (!collect) return queryStatement.getAsObject();
        const rows = [queryStatement.getAsObject()];
        while (queryStatement.step()) rows.push(queryStatement.getAsObject());
        return rows;
      } finally {
        queryStatement.free();
      }
    }
    return {
      get: (...params) => query(params, false),
      all: (...params) => query(params, true),
      run: (...params) => {
        const queryStatement = sqlite.prepare(statement);
        try {
          queryStatement.bind(params);
          while (queryStatement.step()) { /* consume any returned rows */ }
        } finally {
          queryStatement.free();
        }
        const changes = sqlite.getRowsModified();
        const lastInsertRowid = sqlite.exec('SELECT last_insert_rowid() AS id')[0]?.values[0]?.[0] ?? 0;
        persistDatabase();
        return { changes, lastInsertRowid };
      },
    };
  },
  transaction(callback) {
    return (...args) => {
      sqlite.run('BEGIN');
      transactionDepth += 1;
      try {
        const result = callback(...args);
        sqlite.run('COMMIT');
        transactionDepth -= 1;
        persistDatabase();
        return result;
      } catch (error) {
        sqlite.run('ROLLBACK');
        transactionDepth -= 1;
        throw error;
      }
    };
  },
};
db.pragma('foreign_keys = ON');
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'owner',
    status TEXT NOT NULL DEFAULT 'active', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS weddings (
    id INTEGER PRIMARY KEY AUTOINCREMENT, owner_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    slug TEXT NOT NULL UNIQUE, title TEXT NOT NULL, bride TEXT NOT NULL DEFAULT '',
    groom TEXT NOT NULL DEFAULT '', wedding_date TEXT NOT NULL DEFAULT '',
    venue TEXT NOT NULL DEFAULT '', address TEXT NOT NULL DEFAULT '', maps_url TEXT NOT NULL DEFAULT '',
    story TEXT NOT NULL DEFAULT '', published INTEGER NOT NULL DEFAULT 0,
    template TEXT NOT NULL DEFAULT 'The Botanica', primary_color TEXT NOT NULL DEFAULT '#9a7359',
    media TEXT NOT NULL DEFAULT '[]', payment_qr_media_id TEXT NOT NULL DEFAULT '',
    welcome_video_media_id TEXT NOT NULL DEFAULT '', music_media_id TEXT NOT NULL DEFAULT '',
    ceremony_schedule TEXT NOT NULL DEFAULT '[]', love_timeline TEXT NOT NULL DEFAULT '[]',
    parking_info TEXT NOT NULL DEFAULT '',
    contact_phone TEXT NOT NULL DEFAULT '', contact_telegram TEXT NOT NULL DEFAULT '',
    gift_payment_info TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS guests (
    id INTEGER PRIMARY KEY AUTOINCREMENT, wedding_id INTEGER NOT NULL REFERENCES weddings(id) ON DELETE CASCADE,
    name TEXT NOT NULL, email TEXT NOT NULL DEFAULT '', phone TEXT NOT NULL DEFAULT '',
    category TEXT NOT NULL DEFAULT 'Friends', party_size INTEGER NOT NULL DEFAULT 1,
    rsvp TEXT NOT NULL DEFAULT 'Pending', attendees INTEGER NOT NULL DEFAULT 0,
    checked_in INTEGER NOT NULL DEFAULT 0, note TEXT NOT NULL DEFAULT '',
    invitation_token TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS rsvps (
    id INTEGER PRIMARY KEY AUTOINCREMENT, wedding_id INTEGER NOT NULL REFERENCES weddings(id) ON DELETE CASCADE,
    name TEXT NOT NULL, email TEXT NOT NULL DEFAULT '', attending INTEGER NOT NULL,
    attendees INTEGER NOT NULL DEFAULT 1, message TEXT NOT NULL DEFAULT '',
    guest_id INTEGER, phone TEXT NOT NULL DEFAULT '', meal_preference TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE INDEX IF NOT EXISTS idx_weddings_owner ON weddings(owner_id);
  CREATE INDEX IF NOT EXISTS idx_guests_wedding ON guests(wedding_id);
`);
const weddingColumns = db.prepare('PRAGMA table_info(weddings)').all().map((column) => column.name);
const weddingColumnDefaults = {
  payment_qr_media_id: "TEXT NOT NULL DEFAULT ''",
  welcome_video_media_id: "TEXT NOT NULL DEFAULT ''",
  music_media_id: "TEXT NOT NULL DEFAULT ''",
  ceremony_schedule: "TEXT NOT NULL DEFAULT '[]'",
  love_timeline: "TEXT NOT NULL DEFAULT '[]'",
  parking_info: "TEXT NOT NULL DEFAULT ''",
  contact_phone: "TEXT NOT NULL DEFAULT ''",
  contact_telegram: "TEXT NOT NULL DEFAULT ''",
  gift_payment_info: "TEXT NOT NULL DEFAULT ''",
};
for (const [column, definition] of Object.entries(weddingColumnDefaults)) {
  if (!weddingColumns.includes(column)) db.exec(`ALTER TABLE weddings ADD COLUMN ${column} ${definition}`);
}
const rsvpColumns = db.prepare('PRAGMA table_info(rsvps)').all().map((column) => column.name);
for (const column of ['guest_id', 'phone', 'meal_preference']) {
  if (!rsvpColumns.includes(column)) db.exec(`ALTER TABLE rsvps ADD COLUMN ${column} ${column === 'guest_id' ? 'INTEGER' : "TEXT NOT NULL DEFAULT ''"}`);
}
db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_rsvps_guest ON rsvps(guest_id) WHERE guest_id IS NOT NULL');
const guestColumns = db.prepare('PRAGMA table_info(guests)').all().map((column) => column.name);
if (!guestColumns.includes('invitation_token')) db.exec('ALTER TABLE guests ADD COLUMN invitation_token TEXT');
const updateInvitationToken = db.prepare('UPDATE guests SET invitation_token = ? WHERE id = ?');
for (const guest of db.prepare('SELECT id FROM guests WHERE invitation_token IS NULL OR invitation_token = ?').all('')) {
  updateInvitationToken.run(randomBytes(32).toString('hex'), guest.id);
}
db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_guests_invitation_token ON guests(invitation_token)');

const hasAdminPasswordHash = /^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/.test(process.env.SUPERADMIN_PASSWORD_HASH || '');
if (process.env.SUPERADMIN_EMAIL && !hasAdminPasswordHash) {
  console.warn('Skipping environment-based administrator setup because SUPERADMIN_PASSWORD_HASH is not a valid bcrypt hash.');
}
if (process.env.SUPERADMIN_EMAIL && hasAdminPasswordHash) {
  const email = process.env.SUPERADMIN_EMAIL.trim().toLowerCase();
  const configuredAdmin = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (configuredAdmin) {
    db.prepare("UPDATE users SET role = 'admin' WHERE id = ?").run(configuredAdmin.id);
  } else {
    const password_hash = process.env.SUPERADMIN_PASSWORD_HASH;
    const name = process.env.SUPERADMIN_NAME?.trim().slice(0, 80) || 'Studio Admin';
    db.prepare("INSERT INTO users (name,email,password_hash,role) VALUES (?, ?, ?, 'admin')").run(name, email, password_hash);
    console.log(`Initial administrator account created for ${email}.`);
  }
}

const adminSetupPath = path.join(root, '.setup-admin.json');
if (fs.existsSync(adminSetupPath)) {
  try {
    const setup = z.object({
      name: z.string().trim().min(2).max(80),
      email: z.string().trim().email().max(254),
      password: z.string().min(8).max(128),
    }).parse(JSON.parse(fs.readFileSync(adminSetupPath, 'utf8')));
    const email = setup.email.toLowerCase();
    const password_hash = await bcrypt.hash(setup.password, 12);
    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (existing) {
      db.prepare("UPDATE users SET name = ?, password_hash = ?, role = 'admin', status = 'active' WHERE id = ?")
        .run(setup.name, password_hash, existing.id);
    } else {
      db.prepare("INSERT INTO users (name,email,password_hash,role) VALUES (?, ?, ?, 'admin')")
        .run(setup.name, email, password_hash);
    }
    fs.unlinkSync(adminSetupPath);
    console.log(`Administrator account is ready for ${email}. The one-time setup file has been removed.`);
  } catch (error) {
    console.error(`Administrator setup failed: ${error.message}. The one-time setup file has been retained for correction.`);
  }
}

const app = express();
app.disable('x-powered-by');
app.use(cors({ origin: process.env.CLIENT_ORIGIN?.split(',') ?? 'http://localhost:5173' }));
app.use(express.json({ limit: '1mb' }));
app.use('/uploads', express.static(uploadDir, { dotfiles: 'deny', index: false, maxAge: '1d' }));
app.use('/api/auth', rateLimit({ windowMs: 15 * 60 * 1000, limit: 40, standardHeaders: 'draft-7', legacyHeaders: false }));
app.use('/api/public', rateLimit({ windowMs: 15 * 60 * 1000, limit: 100, standardHeaders: 'draft-7', legacyHeaders: false }));

const signupSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().email().max(254),
  password: z.string().min(10).max(128),
});
const weddingFields = [
  'title', 'bride', 'groom', 'wedding_date', 'venue', 'address', 'maps_url', 'story',
  'template', 'primary_color', 'payment_qr_media_id', 'welcome_video_media_id', 'music_media_id',
  'ceremony_schedule', 'love_timeline', 'parking_info', 'contact_phone', 'contact_telegram', 'gift_payment_info',
];
const ceremonyScheduleSchema = z.array(z.object({
  name: z.string().trim().min(1).max(120),
  date: z.string().trim().max(30).optional().default(''),
  time: z.string().trim().max(30).optional().default(''),
  description: z.string().trim().max(500).optional().default(''),
  location: z.string().trim().max(200).optional().default(''),
})).max(20);
const loveTimelineSchema = z.array(z.object({
  title: z.string().trim().min(1).max(120),
  date: z.string().trim().max(30).optional().default(''),
  description: z.string().trim().max(500).optional().default(''),
  photo_media_id: z.string().trim().max(100).optional().default(''),
})).max(20);

function safeUser(user) {
  return { id: user.id, name: user.name, email: user.email, role: user.role, status: user.status };
}
function jwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) throw new Error('JWT_SECRET must be configured with at least 32 characters.');
  return secret;
}
function signIn(user) {
  return { token: jwt.sign({ sub: String(user.id) }, jwtSecret(), { expiresIn: '7d', issuer: 'ever-after' }), user: safeUser(user) };
}
function safeEqual(left, right) {
  const leftBytes = Buffer.from(left);
  const rightBytes = Buffer.from(right);
  return leftBytes.length === rightBytes.length && timingSafeEqual(leftBytes, rightBytes);
}
function auth(requiredRole) {
  return (req, res, next) => {
    try {
      const token = req.headers.authorization?.replace(/^Bearer\s+/i, '');
      if (!token) return res.status(401).json({ error: 'Sign in to continue.' });
      const payload = jwt.verify(token, jwtSecret(), { issuer: 'ever-after' });
      const user = db.prepare('SELECT * FROM users WHERE id = ?').get(payload.sub);
      if (!user || user.status !== 'active') return res.status(401).json({ error: 'This account is unavailable.' });
      if (requiredRole && user.role !== requiredRole) return res.status(403).json({ error: 'Administrator access is required.' });
      req.user = user;
      next();
    } catch (error) {
      if (error instanceof jwt.JsonWebTokenError || error instanceof jwt.TokenExpiredError) return res.status(401).json({ error: 'Your session has expired. Please sign in again.' });
      next(error);
    }
  };
}
function weddingForOwner(req, res, next) {
  const wedding = db.prepare('SELECT * FROM weddings WHERE id = ?').get(Number(req.params.id));
  if (!wedding || (req.user.role !== 'admin' && wedding.owner_id !== req.user.id)) return res.status(404).json({ error: 'Wedding not found.' });
  req.wedding = wedding;
  next();
}
function serializeWedding(wedding) {
  return {
    ...wedding,
    published: Boolean(wedding.published),
    media: JSON.parse(wedding.media || '[]'),
    ceremony_schedule: JSON.parse(wedding.ceremony_schedule || '[]'),
    love_timeline: JSON.parse(wedding.love_timeline || '[]'),
  };
}
function slugify(value) {
  return value.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 42) || 'our-wedding';
}

app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));
app.post('/api/auth/register', async (req, res, next) => {
  try {
    jwtSecret();
    const input = signupSchema.parse(req.body);
    const email = input.email.toLowerCase();
    const password_hash = await bcrypt.hash(input.password, 12);
    const result = db.prepare('INSERT INTO users (name,email,password_hash,role) VALUES (?,?,?,?)').run(input.name, email, password_hash, 'owner');
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(signIn(user));
  } catch (error) {
    if (error?.code === 'SQLITE_CONSTRAINT_UNIQUE') return res.status(409).json({ error: 'An account with this email already exists.' });
    next(error);
  }
});
app.post('/api/auth/login', async (req, res, next) => {
  try {
    jwtSecret();
    const input = z.object({ email: z.string().email(), password: z.string().min(1).max(128) }).parse(req.body);
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(input.email.trim().toLowerCase());
    if (!user || user.status !== 'active' || !(await bcrypt.compare(input.password, user.password_hash))) return res.status(401).json({ error: 'Email or password is incorrect.' });
    res.json(signIn(user));
  } catch (error) { next(error); }
});
app.get('/api/auth/me', auth(), (req, res) => res.json({ user: safeUser(req.user) }));

app.get('/api/weddings', auth(), (req, res) => {
  const rows = req.user.role === 'admin'
    ? db.prepare('SELECT * FROM weddings ORDER BY created_at DESC').all()
    : db.prepare('SELECT * FROM weddings WHERE owner_id = ? ORDER BY created_at DESC').all(req.user.id);
  res.json({ weddings: rows.map(serializeWedding) });
});
app.post('/api/weddings', auth(), (req, res) => {
  const body = z.object({ title: z.string().trim().min(2).max(120).optional(), bride: z.string().max(100).optional(), groom: z.string().max(100).optional() }).parse(req.body);
  const title = body.title || [body.bride, body.groom].filter(Boolean).join(' & ') || 'Our Wedding';
  const slug = `${slugify(title)}-${randomBytes(3).toString('hex')}`;
  const result = db.prepare('INSERT INTO weddings (owner_id,slug,title,bride,groom) VALUES (?,?,?,?,?)').run(req.user.id, slug, title, body.bride || '', body.groom || '');
  res.status(201).json({ wedding: serializeWedding(db.prepare('SELECT * FROM weddings WHERE id = ?').get(result.lastInsertRowid)) });
});
app.put('/api/weddings/:id', auth(), weddingForOwner, (req, res) => {
  const updates = {};
  for (const field of weddingFields) {
    if (!Object.hasOwn(req.body, field)) continue;
    const maxLength = field === 'story' || field === 'gift_payment_info' ? 5000 : ['ceremony_schedule', 'love_timeline'].includes(field) ? 12000 : 500;
    const value = z.string().trim().max(maxLength).parse(req.body[field]);
    if (field === 'ceremony_schedule' || field === 'love_timeline') {
      let schedule;
      try { schedule = JSON.parse(value); } catch { throw new z.ZodError([{ code: 'custom', path: [field], message: `${field === 'ceremony_schedule' ? 'Ceremony schedule' : 'Love timeline'} must be valid JSON.` }]); }
      const parsedSchedule = (field === 'ceremony_schedule' ? ceremonyScheduleSchema : loveTimelineSchema).parse(schedule);
      if (field === 'love_timeline') {
        const media = JSON.parse(req.wedding.media || '[]');
        if (parsedSchedule.some((milestone) => milestone.photo_media_id && !media.some((item) => item.id === milestone.photo_media_id && item.type === 'image'))) {
          throw new z.ZodError([{ code: 'custom', path: [field], message: 'Timeline photos must be images uploaded to this wedding.' }]);
        }
      }
      updates[field] = JSON.stringify(parsedSchedule);
    } else if ((field === 'maps_url' || field === 'contact_telegram') && value) {
      updates[field] = z.string().url().refine((url) => /^https?:\/\//i.test(url), 'Please enter a valid HTTP or HTTPS link.').parse(value);
    } else {
      updates[field] = value;
    }
  }
  if (Object.hasOwn(req.body, 'published')) updates.published = z.boolean().parse(req.body.published) ? 1 : 0;
  if (!Object.keys(updates).length) return res.status(400).json({ error: 'No editable wedding fields were provided.' });
  const keys = Object.keys(updates);
  db.prepare(`UPDATE weddings SET ${keys.map((key) => `${key} = ?`).join(', ')} WHERE id = ?`).run(...keys.map((key) => updates[key]), req.wedding.id);
  res.json({ wedding: serializeWedding(db.prepare('SELECT * FROM weddings WHERE id = ?').get(req.wedding.id)) });
});
app.delete('/api/weddings/:id', auth(), weddingForOwner, (req, res) => {
  db.prepare('DELETE FROM weddings WHERE id = ?').run(req.wedding.id);
  res.status(204).end();
});
app.get('/api/templates', (_req, res) => res.json({ templates: [
  { name: 'The Botanica', category: 'Garden', color: '#77876e' },
  { name: 'Golden Hour', category: 'Khmer Luxury', color: '#bd9a5d' },
  { name: 'The Heirloom', category: 'Classic', color: '#a87777' },
  { name: 'Still & Simple', category: 'Minimal', color: '#8a9291' },
  { name: 'Petal & Pearl', category: 'Romantic', color: '#ca9293' },
  { name: 'Midnight Vows', category: 'Modern', color: '#504a57' },
  { name: 'Khmer Heritage', category: 'Khmer', color: '#bd9a5d' },
  { name: 'Angkor Royal', category: 'Khmer', color: '#C8A45D' },
  { name: 'Khmer Ceremonial', category: 'Khmer', color: '#D4AF37' },
  { name: 'Khmer Ceremonial Gold', category: 'Khmer', color: '#D4AF37' },
] }));

app.get('/api/weddings/:id/guests', auth(), weddingForOwner, (req, res) => {
  res.json({ guests: db.prepare(`SELECT g.*, r.phone AS rsvp_phone, r.meal_preference, r.message AS rsvp_message
    FROM guests g LEFT JOIN rsvps r ON r.guest_id = g.id
    WHERE g.wedding_id = ? ORDER BY g.created_at DESC`).all(req.wedding.id) });
});
app.post('/api/weddings/:id/guests', auth(), weddingForOwner, (req, res) => {
  const input = z.object({
    name: z.string().trim().min(2).max(120), email: z.string().trim().email().max(254).or(z.literal('')).optional(),
    phone: z.string().max(40).optional(), category: z.string().max(40).optional(),
    party_size: z.coerce.number().int().min(1).max(20).default(1), note: z.string().max(500).optional(),
  }).parse(req.body);
  const invitationToken = randomBytes(32).toString('hex');
  const result = db.prepare('INSERT INTO guests (wedding_id,name,email,phone,category,party_size,note,invitation_token) VALUES (?,?,?,?,?,?,?,?)').run(req.wedding.id, input.name, input.email || '', input.phone || '', input.category || 'Friends', input.party_size, input.note || '', invitationToken);
  res.status(201).json({ guest: db.prepare('SELECT * FROM guests WHERE id = ?').get(result.lastInsertRowid) });
});
app.put('/api/weddings/:id/guests/:guestId', auth(), weddingForOwner, (req, res) => {
  const guest = db.prepare('SELECT * FROM guests WHERE id = ? AND wedding_id = ?').get(Number(req.params.guestId), req.wedding.id);
  if (!guest) return res.status(404).json({ error: 'Guest not found.' });
  const updates = z.object({
    name: z.string().trim().min(2).max(120).optional(), email: z.string().email().max(254).or(z.literal('')).optional(),
    phone: z.string().max(40).optional(), category: z.string().max(40).optional(),
    party_size: z.coerce.number().int().min(1).max(20).optional(),
    rsvp: z.enum(['Pending', 'Attending', 'Declined', 'Maybe']).optional(),
    attendees: z.coerce.number().int().min(0).max(20).optional(), checked_in: z.boolean().optional(),
  }).parse(req.body);
  const fields = Object.keys(updates);
  if (!fields.length) return res.status(400).json({ error: 'No guest fields were provided.' });
  db.prepare(`UPDATE guests SET ${fields.map((key) => `${key} = ?`).join(', ')} WHERE id = ?`).run(...fields.map((key) => key === 'checked_in' ? Number(updates[key]) : updates[key]), guest.id);
  res.json({ guest: db.prepare('SELECT * FROM guests WHERE id = ?').get(guest.id) });
});
app.delete('/api/weddings/:id/guests/:guestId', auth(), weddingForOwner, (req, res) => {
  const guest = db.prepare('SELECT id FROM guests WHERE id = ? AND wedding_id = ?').get(Number(req.params.guestId), req.wedding.id);
  if (!guest) return res.status(404).json({ error: 'Guest not found.' });
  db.transaction(() => {
    db.prepare('DELETE FROM rsvps WHERE guest_id = ?').run(guest.id);
    db.prepare('DELETE FROM guests WHERE id = ? AND wedding_id = ?').run(guest.id, req.wedding.id);
  })();
  res.status(204).end();
});
app.get('/api/weddings/:id/guests.csv', auth(), weddingForOwner, (req, res) => {
  const guests = db.prepare(`SELECT g.name,g.email,g.phone,g.category,g.party_size,g.rsvp,g.attendees,g.checked_in,
    r.phone AS rsvp_phone,r.meal_preference,r.message AS rsvp_message
    FROM guests g LEFT JOIN rsvps r ON r.guest_id = g.id WHERE g.wedding_id = ? ORDER BY g.name`).all(req.wedding.id);
  const csv = ['name,email,phone,category,party_size,rsvp,attendees,checked_in,rsvp_phone,meal_preference,rsvp_message', ...guests.map((guest) => Object.values(guest).map((value) => {
    const content = String(value).replace(/^\s*([=+\-@])/, "'$1");
    return `"${content.replaceAll('"', '""')}"`;
  }).join(','))].join('\r\n');
  res.type('text/csv').attachment(`wedding-${req.wedding.id}-guests.csv`).send(csv);
});
app.post('/api/weddings/:id/guests/import', auth(), weddingForOwner, (req, res) => {
  const rows = z.array(z.object({ name: z.string().trim().min(2).max(120), email: z.string().trim().email().max(254).or(z.literal('')).optional(), phone: z.string().max(40).optional(), category: z.string().max(40).optional(), party_size: z.coerce.number().int().min(1).max(20).default(1) })).max(1000).parse(req.body.guests);
  const insert = db.prepare('INSERT INTO guests (wedding_id,name,email,phone,category,party_size,invitation_token) VALUES (?,?,?,?,?,?,?)');
  const importRows = db.transaction((items) => items.map((guest) => insert.run(req.wedding.id, guest.name, guest.email || '', guest.phone || '', guest.category || 'Friends', guest.party_size, randomBytes(32).toString('hex')).lastInsertRowid));
  res.status(201).json({ imported: importRows(rows).length });
});

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => cb(null, `${randomUUID()}${path.extname(file.originalname).toLowerCase()}`),
});
const upload = multer({
  storage, limits: { fileSize: 25 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => cb(null, /^(image\/(jpeg|png|webp)|video\/(mp4|webm)|audio\/(mpeg|mp4|ogg))$/.test(file.mimetype)),
});
const supportedMediaExtensions = {
  'image/jpeg': ['jpg', 'jpeg'],
  'image/png': ['png'],
  'image/webp': ['webp'],
  'video/mp4': ['mp4'],
  'video/webm': ['webm'],
  'audio/mpeg': ['mp3'],
  'audio/mp4': ['m4a', 'mp4'],
  'audio/ogg': ['ogg'],
};
app.post('/api/weddings/:id/media', auth(), weddingForOwner, upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Choose a supported image, video, or audio file up to 25 MB.' });
    const detectedType = await fileTypeFromFile(req.file.path);
    const allowedExtensions = supportedMediaExtensions[req.file.mimetype];
    const extension = path.extname(req.file.originalname).slice(1).toLowerCase();
    if (!detectedType || detectedType.mime !== req.file.mimetype || !allowedExtensions?.includes(detectedType.ext) || !allowedExtensions.includes(extension)) {
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ error: 'The file contents do not match a supported media format.' });
    }
    const media = JSON.parse(req.wedding.media || '[]');
    const item = { id: randomUUID(), name: path.basename(req.file.originalname).slice(0, 120), type: req.file.mimetype.split('/')[0], url: `/uploads/${req.file.filename}`, size: req.file.size };
    media.push(item);
    db.prepare('UPDATE weddings SET media = ? WHERE id = ?').run(JSON.stringify(media), req.wedding.id);
    res.status(201).json({ media: item });
  } catch (error) {
    if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    next(error);
  }
});
app.delete('/api/weddings/:id/media/:mediaId', auth(), weddingForOwner, (req, res) => {
  const media = JSON.parse(req.wedding.media || '[]');
  const item = media.find((entry) => entry.id === req.params.mediaId);
  if (!item) return res.status(404).json({ error: 'Media not found.' });
  const filename = path.basename(item.url);
  const filePath = path.join(uploadDir, filename);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  db.prepare('UPDATE weddings SET media = ? WHERE id = ?').run(JSON.stringify(media.filter((entry) => entry.id !== item.id)), req.wedding.id);
  const assignments = ['payment_qr_media_id', 'welcome_video_media_id', 'music_media_id']
    .filter((field) => req.wedding[field] === item.id)
    .map((field) => [field, '']);
  if (item.type === 'image') {
    const timeline = JSON.parse(req.wedding.love_timeline || '[]');
    if (timeline.some((milestone) => milestone.photo_media_id === item.id)) {
      assignments.push(['love_timeline', JSON.stringify(timeline.map((milestone) => milestone.photo_media_id === item.id ? { ...milestone, photo_media_id: '' } : milestone))]);
    }
  }
  if (assignments.length) db.prepare(`UPDATE weddings SET ${assignments.map(([field]) => `${field} = ?`).join(', ')} WHERE id = ?`).run(...assignments.map(([, value]) => value), req.wedding.id);
  res.status(204).end();
});

app.get('/api/public/:slug', (req, res) => {
  const guestToken = typeof req.query.guest === 'string' ? req.query.guest : '';
  let wedding = db.prepare('SELECT * FROM weddings WHERE slug = ? AND published = 1').get(req.params.slug);
  if (!wedding && /^[a-f0-9]{64}$/i.test(guestToken)) {
    wedding = db.prepare(`SELECT w.* FROM weddings w
      INNER JOIN guests g ON g.wedding_id = w.id
      WHERE w.published = 1 AND g.invitation_token = ?`).get(guestToken);
  }
  if (!wedding) return res.status(404).json({ error: 'This invitation is not available. Check the invitation link, or ask the couple to publish their website and share the updated link.' });
  const { owner_id, ...publicWedding } = serializeWedding(wedding);
  const guest = /^[a-f0-9]{64}$/i.test(guestToken)
    ? db.prepare('SELECT name,party_size FROM guests WHERE wedding_id = ? AND invitation_token = ?').get(wedding.id, guestToken)
    : undefined;
  res.json({ wedding: publicWedding, invited_guest: guest || null });
});
app.get('/api/preview/:slug', auth(), (req, res) => {
  const wedding = db.prepare('SELECT * FROM weddings WHERE slug = ?').get(req.params.slug);
  if (!wedding || (req.user.role !== 'admin' && wedding.owner_id !== req.user.id)) return res.status(404).json({ error: 'Wedding not found.' });
  const { owner_id, ...previewWedding } = serializeWedding(wedding);
  const guestToken = typeof req.query.guest === 'string' ? req.query.guest : '';
  const guest = /^[a-f0-9]{64}$/i.test(guestToken)
    ? db.prepare('SELECT name,party_size FROM guests WHERE wedding_id = ? AND invitation_token = ?').get(wedding.id, guestToken)
    : undefined;
  res.setHeader('Cache-Control', 'private, no-store');
  res.json({ wedding: previewWedding, invited_guest: guest || null });
});
app.post('/api/public/:slug/rsvp', (req, res) => {
  const wedding = db.prepare('SELECT * FROM weddings WHERE slug = ? AND published = 1').get(req.params.slug);
  if (!wedding) return res.status(404).json({ error: 'This invitation is not available.' });
  const input = z.object({
    name: z.string().trim().min(2).max(120), email: z.string().trim().email().max(254).or(z.literal('')).optional(),
    invitation_token: z.string().regex(/^[a-f0-9]{64}$/i),
    attending: z.boolean(), attendees: z.coerce.number().int().min(0).max(20), message: z.string().max(500).optional(),
    phone: z.string().trim().max(40).optional().default(''),
    meal_preference: z.string().trim().max(120).optional().default(''),
  }).parse(req.body);
  const attendees = input.attending ? Math.max(1, input.attendees) : 0;
  const guest = db.prepare('SELECT * FROM guests WHERE wedding_id = ? AND invitation_token = ?').get(wedding.id, input.invitation_token);
  if (!guest || !safeEqual(guest.name.trim().toLocaleLowerCase(), input.name.trim().toLocaleLowerCase())) return res.status(404).json({ error: 'We couldn’t match that name to an invitation. Please contact the couple.' });
  if (attendees > guest.party_size) return res.status(400).json({ error: `This invitation is for up to ${guest.party_size} ${guest.party_size === 1 ? 'guest' : 'guests'}.` });
  const transaction = db.transaction(() => {
    db.prepare(`INSERT INTO rsvps (wedding_id,name,email,attending,attendees,message,guest_id,phone,meal_preference)
      VALUES (?,?,?,?,?,?,?,?,?)
      ON CONFLICT(guest_id) WHERE guest_id IS NOT NULL DO UPDATE SET
      name = excluded.name, email = excluded.email, attending = excluded.attending,
      attendees = excluded.attendees, message = excluded.message, phone = excluded.phone,
      meal_preference = excluded.meal_preference`).run(
      wedding.id, input.name, input.email || '', Number(input.attending), attendees, input.message || '',
      guest.id, input.phone, input.meal_preference,
    );
    db.prepare('UPDATE guests SET rsvp = ?, attendees = ? WHERE id = ?').run(input.attending ? 'Attending' : 'Declined', attendees, guest.id);
  });
  transaction();
  res.status(201).json({ message: 'Thank you for letting us know. We can’t wait to celebrate with you!' });
});

app.get('/api/admin/users', auth('admin'), (_req, res) => {
  res.json({ users: db.prepare(`SELECT u.id,u.name,u.email,u.role,u.status,u.created_at,COUNT(w.id) AS wedding_count
    FROM users u LEFT JOIN weddings w ON w.owner_id = u.id GROUP BY u.id ORDER BY u.created_at DESC`).all() });
});
app.patch('/api/admin/users/:id/status', auth('admin'), (req, res) => {
  const { status } = z.object({ status: z.enum(['active', 'suspended']) }).parse(req.body);
  if (Number(req.params.id) === req.user.id) return res.status(400).json({ error: 'You cannot suspend your own account.' });
  const result = db.prepare('UPDATE users SET status = ? WHERE id = ?').run(status, Number(req.params.id));
  if (!result.changes) return res.status(404).json({ error: 'User not found.' });
  res.json({ id: Number(req.params.id), status });
});

const clientBuild = path.join(root, 'dist');
if (fs.existsSync(clientBuild)) {
  app.use(express.static(clientBuild));
  app.get('*', (_req, res) => res.sendFile(path.join(clientBuild, 'index.html')));
}

app.use((error, _req, res, _next) => {
  if (error instanceof z.ZodError) return res.status(400).json({ error: error.issues[0]?.message || 'Please check the submitted information.' });
  if (error instanceof multer.MulterError) return res.status(400).json({ error: error.code === 'LIMIT_FILE_SIZE' ? 'Files must be smaller than 25 MB.' : 'The upload could not be completed.' });
  if (error.message === 'JWT_SECRET must be configured with at least 32 characters.') return res.status(503).json({ error: 'The server is not configured yet. Set JWT_SECRET in your environment.' });
  console.error(error);
  res.status(500).json({ error: 'Something went wrong. Please try again.' });
});

const port = Number(process.env.PORT) || 4000;
if (process.env.NODE_ENV !== 'test') app.listen(port, () => console.log(`Ever After API listening on http://localhost:${port}`));

export { app };
