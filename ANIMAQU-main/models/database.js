const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcrypt');
const { promisify } = require('util');

const dbPath = path.join(__dirname, '..', 'data', 'animaqu.db');

let db;

function connectToDatabase() {
  return new Promise((resolve, reject) => {
    db = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        console.error('Error opening database:', err.message);
        reject(err);
      } else {
        console.log('Connected to SQLite database');
        resolve();
      }
    });
  });
}

const dbRun = (query, params = []) => {
  return new Promise((resolve, reject) => {
    db.run(query, params, function(err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
};

const dbGet = (query, params = []) => {
  return new Promise((resolve, reject) => {
    db.get(query, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
};

const dbAll = (query, params = []) => {
  return new Promise((resolve, reject) => {
    db.all(query, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
};

async function initializeDatabase() {
  await connectToDatabase();

  await dbRun(`CREATE TABLE IF NOT EXISTS api_endpoints (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    url TEXT NOT NULL,
    is_active INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  await dbRun(`CREATE TABLE IF NOT EXISTS ad_slots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    position TEXT NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('adsense', 'banner')),
    content TEXT NOT NULL,
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  await dbRun(`CREATE TABLE IF NOT EXISTS admin_users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    email TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  await dbRun(`CREATE TABLE IF NOT EXISTS settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    key TEXT NOT NULL UNIQUE,
    value TEXT,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  await insertDefaultData();
}

async function insertDefaultData() {
  const apiEndpointsCount = await dbGet("SELECT COUNT(*) as count FROM api_endpoints");
  if (apiEndpointsCount.count === 0) {
    await dbRun(`INSERT INTO api_endpoints (name, url, is_active) VALUES
      ('Default API', 'http://localhost:3000/v1', 1)`);
  }

  const adminUsersCount = await dbGet("SELECT COUNT(*) as count FROM admin_users");
  if (adminUsersCount.count === 0) {
    const hashedPassword = await bcrypt.hash('admin123', 10);
    await dbRun(`INSERT INTO admin_users (username, password_hash, email) VALUES
      ('admin', ?, 'admin@animaqu.com')`, [hashedPassword]);
  }

  const adSlotsCount = await dbGet("SELECT COUNT(*) as count FROM ad_slots");
  if (adSlotsCount.count === 0) {
    await dbRun(`INSERT INTO ad_slots (name, position, type, content, is_active) VALUES
      ('Header Banner', 'header', 'banner', '<img src="/images/ads/header-banner.jpg" alt="Advertisement" class="w-full h-20 object-cover rounded-lg">', 1),
      ('Sidebar Top', 'sidebar-top', 'adsense', '<ins class="adsbygoogle" style="display:block" data-ad-client="ca-pub-xxxxxxxxxx" data-ad-slot="xxxxxxxxxx" data-ad-format="auto"></ins>', 1),
      ('Content Bottom', 'content-bottom', 'banner', '<img src="/images/ads/content-banner.jpg" alt="Advertisement" class="w-full h-32 object-cover rounded-lg">', 1)`);
  }

  const settingsCount = await dbGet("SELECT COUNT(*) as count FROM settings");
  if (settingsCount.count === 0) {
    await dbRun(`INSERT INTO settings (key, value, description) VALUES
      ('site_title', 'ANIMAQU - Streaming Anime Subtitle Indonesia', 'Judul website'),
      ('site_description', 'Nonton anime subtitle Indonesia terlengkap dan terbaru', 'Deskripsi website'),
      ('cookie_consent_enabled', '1', 'Enable cookie consent popup'),
      ('adsense_enabled', '0', 'Enable Google AdSense')`);
  }
}

const dbHelpers = {
  getActiveApiEndpoint: () => dbGet("SELECT url FROM api_endpoints WHERE is_active = 1 LIMIT 1").then(row => row ? row.url : null),
  getAllApiEndpoints: () => dbAll("SELECT * FROM api_endpoints ORDER BY created_at DESC"),
  async updateApiEndpoint(id, url, isActive) {
    if (isActive) {
      await dbRun("UPDATE api_endpoints SET is_active = 0");
    }
    const result = await dbRun("UPDATE api_endpoints SET url = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", [url, isActive ? 1 : 0, id]);
    return result.changes;
  },
  getAdSlotsByPosition: (position) => dbAll("SELECT * FROM ad_slots WHERE position = ? AND is_active = 1", [position]),
  getAllAdSlots: () => dbAll("SELECT * FROM ad_slots ORDER BY position, created_at DESC"),
  addAdSlot: (name, position, type, content, isActive) => dbRun("INSERT INTO ad_slots (name, position, type, content, is_active) VALUES (?, ?, ?, ?, ?)", [name, position, type, content, isActive ? 1 : 0]).then(res => res.lastID),
  updateAdSlot: (id, name, position, type, content, isActive) => dbRun("UPDATE ad_slots SET name = ?, position = ?, type = ?, content = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", [name, position, type, content, isActive ? 1 : 0, id]).then(res => res.changes),
  deleteAdSlot: (id) => dbRun("DELETE FROM ad_slots WHERE id = ?", [id]).then(res => res.changes),
  getAdminByUsername: (username) => dbGet("SELECT * FROM admin_users WHERE username = ?", [username]),
  getSetting: (key) => dbGet("SELECT value FROM settings WHERE key = ?", [key]).then(row => row ? row.value : null),
  updateSetting: (key, value) => dbRun("UPDATE settings SET value = ?, updated_at = CURRENT_TIMESTAMP WHERE key = ?", [value, key]).then(res => res.changes)
};

module.exports = {
  get db() { return db; },
  initializeDatabase,
  ...dbHelpers
};
