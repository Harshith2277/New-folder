// Script to create a test user in the SQLite DB
const { db } = require('./db');
const { hashPassword } = require('./cryptoHelper');

const username = 'testuser';
const password = 'test1234';
const role = 'CITIZEN';
const fullName = 'Test User';
const syntheticId = 'SYN-TEST';
const age = 30;
const annualIncome = 200000;
const category = 'General';
const location = 'Urban';
const occupation = 'Student';
const state = 'Karnataka';

const cleanUsername = username.trim().toLowerCase();
const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(cleanUsername);
if (existing) {
  console.log('User already exists:', existing.id);
  process.exit(0);
}

const userId = `USR-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
const { salt, hash } = hashPassword(password);
const nowIso = new Date().toISOString();

db.prepare(`
  INSERT INTO users (
    id, username, password_hash, salt, role, full_name, synthetic_id,
    age, annual_income, category, location, occupation, state, created_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`).run(
  userId,
  cleanUsername,
  hash,
  salt,
  role.toUpperCase(),
  fullName,
  syntheticId,
  age,
  annualIncome,
  category,
  location,
  occupation,
  state,
  nowIso
);

console.log('Test user created with id', userId);
