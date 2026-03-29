import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

function getDbPath(): string {
  if ((process as NodeJS.Process & { pkg?: unknown }).pkg) {
    const exeDir = path.dirname(process.execPath);
    return path.join(exeDir, "flux.db");
  }
  // Dev: resolve relative to project root
  const dbUrl = process.env.DATABASE_URL ?? "file:./flux.db";
  return dbUrl.replace(/^file:/, "");
}

function getBindingPath(): string | undefined {
  if ((process as NodeJS.Process & { pkg?: unknown }).pkg) {
    return path.join(path.dirname(process.execPath), "better_sqlite3.node");
  }
  return undefined;
}

const dbPath = getDbPath();

// Ensure directory exists
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });

const bindingPath = getBindingPath();
const db = bindingPath
  ? new Database(dbPath, { nativeBinding: bindingPath })
  : new Database(dbPath);

// Enable WAL for better performance and enable foreign keys
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

// ─── Create all tables ────────────────────────────────────────────────────────
db.exec(`
CREATE TABLE IF NOT EXISTS User (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  username TEXT UNIQUE NOT NULL,
  createdAt TEXT NOT NULL DEFAULT (datetime('now')),
  updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS Favorite (
  id TEXT PRIMARY KEY,
  url TEXT NOT NULL,
  title TEXT NOT NULL,
  icon TEXT,
  createdAt TEXT NOT NULL DEFAULT (datetime('now')),
  userId TEXT NOT NULL,
  FOREIGN KEY (userId) REFERENCES User(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS History (
  id TEXT PRIMARY KEY,
  url TEXT NOT NULL,
  title TEXT NOT NULL,
  timestamp TEXT NOT NULL DEFAULT (datetime('now')),
  userId TEXT NOT NULL,
  FOREIGN KEY (userId) REFERENCES User(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS Tab (
  id TEXT PRIMARY KEY,
  url TEXT NOT NULL,
  title TEXT NOT NULL,
  favicon TEXT,
  groupId TEXT,
  createdAt TEXT NOT NULL DEFAULT (datetime('now')),
  userId TEXT NOT NULL,
  FOREIGN KEY (userId) REFERENCES User(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS TabGroup (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  color TEXT NOT NULL,
  collapsed INTEGER NOT NULL DEFAULT 0,
  userId TEXT NOT NULL,
  createdAt TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (userId) REFERENCES User(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS QuickNote (
  id TEXT PRIMARY KEY,
  text TEXT NOT NULL,
  url TEXT NOT NULL,
  color TEXT NOT NULL,
  userId TEXT NOT NULL,
  createdAt TEXT NOT NULL DEFAULT (datetime('now')),
  updatedAt TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (userId) REFERENCES User(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS QuickTask (
  id TEXT PRIMARY KEY,
  text TEXT NOT NULL,
  completed INTEGER NOT NULL DEFAULT 0,
  userId TEXT NOT NULL,
  createdAt TEXT NOT NULL DEFAULT (datetime('now')),
  updatedAt TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (userId) REFERENCES User(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS FocusSession (
  id TEXT PRIMARY KEY,
  durationMs INTEGER NOT NULL,
  elapsedMs INTEGER NOT NULL DEFAULT 0,
  completed INTEGER NOT NULL DEFAULT 0,
  userId TEXT NOT NULL,
  createdAt TEXT NOT NULL DEFAULT (datetime('now')),
  updatedAt TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (userId) REFERENCES User(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS BlockedSite (
  id TEXT PRIMARY KEY,
  domain TEXT NOT NULL,
  userId TEXT NOT NULL,
  FOREIGN KEY (userId) REFERENCES User(id) ON DELETE CASCADE,
  UNIQUE(domain, userId)
);

CREATE TABLE IF NOT EXISTS BrowsingStats (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL,
  minutesBrowsed INTEGER NOT NULL DEFAULT 0,
  sitesVisited INTEGER NOT NULL DEFAULT 0,
  trackersBlocked INTEGER NOT NULL DEFAULT 0,
  dataSavedBytes INTEGER NOT NULL DEFAULT 0,
  userId TEXT NOT NULL,
  FOREIGN KEY (userId) REFERENCES User(id) ON DELETE CASCADE,
  UNIQUE(date, userId)
);

CREATE TABLE IF NOT EXISTS SiteVisit (
  id TEXT PRIMARY KEY,
  domain TEXT NOT NULL,
  minutes INTEGER NOT NULL DEFAULT 0,
  userId TEXT NOT NULL,
  date TEXT NOT NULL DEFAULT (date('now')),
  FOREIGN KEY (userId) REFERENCES User(id) ON DELETE CASCADE,
  UNIQUE(domain, userId, date)
);

CREATE TABLE IF NOT EXISTS UserPreference (
  id TEXT PRIMARY KEY,
  theme TEXT NOT NULL DEFAULT 'dark',
  defaultZoom INTEGER NOT NULL DEFAULT 100,
  blockTrackers INTEGER NOT NULL DEFAULT 1,
  blockThirdPartyCookies INTEGER NOT NULL DEFAULT 1,
  antiFingerprint INTEGER NOT NULL DEFAULT 1,
  forceHttps INTEGER NOT NULL DEFAULT 1,
  blockMining INTEGER NOT NULL DEFAULT 1,
  userId TEXT UNIQUE NOT NULL,
  FOREIGN KEY (userId) REFERENCES User(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS HourlyActivity (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL DEFAULT (date('now')),
  hour INTEGER NOT NULL,
  hits INTEGER NOT NULL DEFAULT 1,
  userId TEXT NOT NULL,
  FOREIGN KEY (userId) REFERENCES User(id) ON DELETE CASCADE,
  UNIQUE(date, hour, userId)
);

CREATE TABLE IF NOT EXISTS DetectedSong (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  artist TEXT NOT NULL,
  album TEXT,
  coverUrl TEXT,
  previewUrl TEXT,
  sourceUrl TEXT NOT NULL,
  confidence REAL NOT NULL DEFAULT 0,
  genre TEXT,
  year TEXT,
  userId TEXT NOT NULL,
  createdAt TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (userId) REFERENCES User(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS MediaDownload (
  id TEXT PRIMARY KEY,
  url TEXT NOT NULL,
  title TEXT NOT NULL,
  type TEXT NOT NULL,
  size INTEGER,
  sourceUrl TEXT NOT NULL,
  userId TEXT NOT NULL,
  createdAt TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (userId) REFERENCES User(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS AiConversation (
  id TEXT PRIMARY KEY,
  query TEXT NOT NULL,
  response TEXT NOT NULL,
  userId TEXT NOT NULL,
  createdAt TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (userId) REFERENCES User(id) ON DELETE CASCADE
);
`);

export default db;
