const { getAllSchemesWithVersions } = require('./db');
const { evaluateScheme, evaluateRules } = require('./ruleEngine');
const { encryptPII, decryptPII } = require('./cryptoHelper');

console.log('--- 1. Testing Schemes & Versions Seed ---');
const schemes = getAllSchemesWithVersions();
console.log(`Loaded ${schemes.length} sample schemes.`);
if (schemes.length < 4) {
  throw new Error('Expected at least 4 sample schemes');
}

console.log('--- 2. Testing SCH-YUVA-01 Version Amendment Scenario ---');
const yuva = schemes.find((s) => s.id === 'SCH-YUVA-01');
if (!yuva) throw new Error('SCH-YUVA-01 not found');

const age26Profile = {
  age: 26,
  annualIncome: 200000,
  occupation: 'Unemployed',
  category: 'OBC',
  location: 'Urban',
};

// Test before amendment (2026-05-15) -> Version 1 (Max Age 25) -> Ineligible
const r1 = evaluateScheme(yuva, age26Profile, '2026-05-15');
console.log(`Date 2026-05-15 (v${r1.appliedVersion}): Eligible=${r1.eligible}, Reason:`, r1.failedReasons);
if (r1.eligible !== false || r1.appliedVersion !== 1) {
  throw new Error('Test failed: Age 26 should NOT be eligible under v1 on 2026-05-15');
}

// Test after amendment (2026-06-15) -> Version 2 (Max Age 28) -> Eligible
const r2 = evaluateScheme(yuva, age26Profile, '2026-06-15');
console.log(`Date 2026-06-15 (v${r2.appliedVersion}): Eligible=${r2.eligible}, MatchScore=${r2.matchScore}%`);
if (r2.eligible !== true || r2.appliedVersion !== 2) {
  throw new Error('Test failed: Age 26 SHOULD be eligible under v2 on 2026-06-15');
}

console.log('--- 3. Testing AES-256 PII Encryption ---');
const rawAadhaar = 'SYN-AADHAAR-8841-9920';
const encrypted = encryptPII(rawAadhaar);
const decrypted = decryptPII(encrypted);
console.log(`Encrypted: ${encrypted}`);
console.log(`Decrypted: ${decrypted}`);
if (decrypted !== rawAadhaar) {
  throw new Error('Encryption/Decryption mismatch');
}

console.log('--- ALL BACKEND CORE VERIFICATION TESTS PASSED SUCCESSFULLY! ---');
