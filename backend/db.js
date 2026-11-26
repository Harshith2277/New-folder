const path = require('path');
const { DatabaseSync } = require('node:sqlite');

const dbPath = path.join(__dirname, 'schemesaathi.db');
const db = new DatabaseSync(dbPath);
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');

// Create/upgrade SQL tables
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    salt TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'CITIZEN', -- 'CITIZEN' or 'OFFICER'
    full_name TEXT NOT NULL,
    synthetic_id TEXT,
    age INTEGER,
    annual_income INTEGER,
    category TEXT,
    location TEXT,
    occupation TEXT,
    state TEXT DEFAULT 'Karnataka',
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS schemes (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    department TEXT NOT NULL,
    ministry TEXT,
    state_or_central TEXT NOT NULL DEFAULT 'Central',
    state TEXT,
    is_new INTEGER NOT NULL DEFAULT 0,
    source_url TEXT,
    verified_gov_domain TEXT,
    is_gov_verified INTEGER NOT NULL DEFAULT 1,
    benefit_summary TEXT NOT NULL,
    description TEXT NOT NULL,
    required_documents_json TEXT NOT NULL,
    last_synced_at TEXT
  );

  CREATE TABLE IF NOT EXISTS scheme_versions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    scheme_id TEXT NOT NULL,
    version INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'APPROVED',
    effective_date TEXT NOT NULL,
    updated_by TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    change_note TEXT NOT NULL,
    rules_json TEXT NOT NULL,
    UNIQUE(scheme_id, version),
    FOREIGN KEY (scheme_id) REFERENCES schemes(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS documents (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    doc_type_id TEXT NOT NULL,
    name TEXT NOT NULL,
    original_filename TEXT NOT NULL,
    stored_filename TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    file_size INTEGER NOT NULL,
    issue_date TEXT,
    expiry_date TEXT,
    uploaded_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS applications (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    citizen_name TEXT NOT NULL,
    encrypted_citizen_id TEXT NOT NULL,
    scheme_id TEXT NOT NULL,
    scheme_name TEXT NOT NULL,
    applied_version INTEGER NOT NULL,
    evaluation_date TEXT NOT NULL,
    snapshot_profile_json TEXT NOT NULL,
    submitted_documents_json TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'SUBMITTED',
    officer_remarks TEXT NOT NULL,
    submitted_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (scheme_id) REFERENCES schemes(id)
  );

  CREATE TABLE IF NOT EXISTS audit_logs (
    id TEXT PRIMARY KEY,
    timestamp TEXT NOT NULL,
    officer_name TEXT NOT NULL,
    action TEXT NOT NULL,
    details TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS sync_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    synced_at TEXT NOT NULL,
    source TEXT NOT NULL,
    schemes_ingested INTEGER NOT NULL,
    schemes_updated INTEGER NOT NULL,
    schemes_rejected INTEGER NOT NULL,
    status TEXT NOT NULL,
    details TEXT
  );
`);

// Alter existing tables if missing newly added columns from earlier migrations
try {
  const schemeCols = new Set(db.prepare("PRAGMA table_info(schemes)").all().map((c) => c.name));
  if (!schemeCols.has('state')) db.exec("ALTER TABLE schemes ADD COLUMN state TEXT;");
  if (!schemeCols.has('is_new')) db.exec("ALTER TABLE schemes ADD COLUMN is_new INTEGER DEFAULT 0;");
  
  const appCols = new Set(db.prepare("PRAGMA table_info(applications)").all().map((c) => c.name));
  if (!appCols.has('user_id')) db.exec("ALTER TABLE applications ADD COLUMN user_id TEXT;");
} catch (e) {
  console.warn('Notice when upgrading schema columns:', e.message);
}

function getAllSchemesWithVersions(filters = {}) {
  let query = 'SELECT * FROM schemes WHERE 1=1';
  const params = [];

  if (filters.isNew) {
    query += ' AND is_new = 1';
  }
  if (filters.state) {
    query += ' AND (state_or_central = ? OR state = ?)';
    params.push('Central', filters.state);
  }

  query += ' ORDER BY is_new DESC, name ASC';
  const schemes = db.prepare(query).all(...params);
  const versions = db
    .prepare('SELECT * FROM scheme_versions ORDER BY scheme_id ASC, version ASC')
    .all();

  return schemes.map((s) => ({
    id: s.id,
    name: s.name,
    department: s.department,
    ministry: s.ministry || s.department,
    stateOrCentral: s.state_or_central || 'Central',
    state: s.state || 'All-India',
    isNew: Boolean(s.is_new),
    sourceUrl: s.source_url || '',
    verifiedGovDomain: s.verified_gov_domain || '',
    isGovVerified: Boolean(s.is_gov_verified),
    benefitSummary: s.benefit_summary,
    description: s.description,
    lastSyncedAt: s.last_synced_at || '',
    requiredDocuments: typeof s.required_documents_json === 'string'
      ? JSON.parse(s.required_documents_json)
      : s.required_documents_json,
    versions: versions
      .filter((v) => v.scheme_id === s.id)
      .map((v) => ({
        version: v.version,
        status: v.status,
        effectiveDate: v.effective_date,
        updatedBy: v.updated_by,
        updatedAt: v.updated_at,
        changeNote: v.change_note,
        rules: typeof v.rules_json === 'string' ? JSON.parse(v.rules_json) : v.rules_json,
      })),
  }));
}

module.exports = {
  db,
  getAllSchemesWithVersions,
};
