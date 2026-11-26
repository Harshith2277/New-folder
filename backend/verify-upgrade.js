const { db, getAllSchemesWithVersions } = require('./db');
const { hashPassword, verifyPassword } = require('./cryptoHelper');
const { evaluateScheme, evaluateDocumentReadiness } = require('./ruleEngine');

console.log('=== TEST 1: User Auth (Hashing & Verification) ===');
const { salt, hash } = hashPassword('mySecurePass2026');
const match = verifyPassword('mySecurePass2026', salt, hash);
const badMatch = verifyPassword('wrongPass', salt, hash);
console.log('Password verified successfully:', match, '| Wrong rejected:', !badMatch);
if (!match || badMatch) throw new Error('Password hashing verification failed!');

console.log('\n=== TEST 2: Active Verified Schemes Ingested ===');
const schemes = getAllSchemesWithVersions();
console.log(`Ingested ${schemes.length} schemes into SQLite database:`);
schemes.forEach((s) => {
  console.log(`* [${s.id}] ${s.name} (State: ${s.state}, New: ${s.isNew}, Versions: ${s.versions.length})`);
});
if (schemes.length < 5) throw new Error('Expected at least 5 ingested schemes.');

console.log('\n=== TEST 3: Actionable "How to Qualify" & Remediation Steps ===');
const profileIneligibleAge = {
  age: 32,
  annualIncome: 1000000,
  occupation: 'Salaried',
  category: 'General',
  location: 'Urban',
  state: 'Karnataka',
};
const internScheme = schemes.find((s) => s.id === 'PM-YUVA-INTERN');
const res = evaluateScheme(internScheme, profileIneligibleAge, '2026-05-15');
console.log(`PM Internship for age 32: Eligible=${res.eligible}, Match=${res.matchScore}%`);
console.log('Remediations generated:', res.remediations);
if (res.remediations.length === 0) throw new Error('Expected actionable remediation steps for ineligible candidate!');

console.log('\n=== TEST 4: Expired Document Detection & Renewal Guidance ===');
const sampleReqDocs = [
  { id: 'DOC-INC', name: 'Annual Income Certificate' },
  { id: 'DOC-ID', name: 'Aadhaar Card' },
];
const heldDocsWithExpired = [
  { id: 'DOC-ID', docTypeId: 'DOC-ID', name: 'Aadhaar Card' },
  { id: 'DOC-INC', docTypeId: 'DOC-INC', name: 'Annual Income Certificate', expiryDate: '2026-03-31' },
];
// Evaluate on 2026-05-15 (after 2026-03-31)
const docCheck = evaluateDocumentReadiness(sampleReqDocs, heldDocsWithExpired, '2026-05-15');
console.log(`Docs: Ready=${docCheck.readyCount}/${docCheck.totalRequired}, Expired=${docCheck.expiredCount}`);
console.log('Expired renewal instruction:', docCheck.expiredDocuments[0]?.renewalGuidance);
if (docCheck.expiredCount !== 1) throw new Error('Failed to detect expired document!');

console.log('\n=== TEST 5: Temporal Rule Versioning (Before vs After 2026-06-01 for Age 26) ===');
const youth26 = {
  age: 26,
  annualIncome: 300000,
  occupation: 'Unemployed',
  category: 'OBC',
  location: 'Urban',
  state: 'Karnataka',
};
const evalBefore = evaluateScheme(internScheme, youth26, '2026-05-15');
console.log(`Before amendment (2026-05-15): v${evalBefore.appliedVersion} Eligible=${evalBefore.eligible} (Expected: false)`);
const evalAfter = evaluateScheme(internScheme, youth26, '2026-06-15');
console.log(`After amendment (2026-06-15): v${evalAfter.appliedVersion} Eligible=${evalAfter.eligible} (Expected: true)`);

if (evalBefore.eligible !== false || evalAfter.eligible !== true) {
  throw new Error('Temporal rule versioning test failed for age 26!');
}

console.log('\n=== ALL END-TO-END TESTS PASSED WITH 100% SUCCESS! ===');
