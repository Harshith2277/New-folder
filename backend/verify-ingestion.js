const { getAllSchemesWithVersions, db } = require('./db');
const { evaluateScheme } = require('./ruleEngine');
const { isVerifiedIndianGovSource, syncIndianGovSchemes } = require('./schemeSync');

console.log('=== TEST 1: Source Validation Filter (.gov.in / .nic.in) ===');
const fakeTest = isVerifiedIndianGovSource({ sourceUrl: 'https://privatedomain.com/grant', authority: 'Commercial Ltd' });
console.log('Fake source rejected:', !fakeTest.valid, '| Reason:', fakeTest.reason);
if (fakeTest.valid) throw new Error('Failed to reject unauthorized domain!');

const govTest = isVerifiedIndianGovSource({ sourceUrl: 'https://pminternship.mca.gov.in', authority: 'Government of India' });
console.log('Official gov source accepted:', govTest.valid, '| Domain:', govTest.domain);
if (!govTest.valid) throw new Error('Failed to validate official .gov.in domain!');

console.log('\n=== TEST 2: Active Database Schemes (Ingested, no dummy source of truth) ===');
const activeSchemes = getAllSchemesWithVersions();
console.log(`Total active schemes in persistent DB: ${activeSchemes.length}`);
activeSchemes.forEach((s) => {
  console.log(`- [${s.id}] ${s.name} | Verified: ${s.verifiedGovDomain} | Versions: ${s.versions.length}`);
});

if (activeSchemes.length === 0) throw new Error('No schemes found in DB!');
if (activeSchemes.some((s) => s.id.startsWith('SCH-'))) {
  throw new Error('Old dummy SCH- schemes still present in active evaluation!');
}

console.log('\n=== TEST 3: Evaluating Real Indian Gov Scheme Eligibility ===');
// Youth candidate profile: Age 23, Income 2.4 Lakhs, Unemployed, OBC
const youthProfile = {
  age: 23,
  annualIncome: 240000,
  occupation: 'Unemployed',
  category: 'OBC',
  location: 'Urban',
};

const pmIntern = activeSchemes.find((s) => s.id === 'PM-YUVA-INTERN');
const internEval = evaluateScheme(pmIntern, youthProfile, '2026-05-15');
console.log(`PM Internship Scheme: Eligible=${internEval.eligible}, MatchScore=${internEval.matchScore}%`);
console.log('Conditions Breakdown:');
internEval.criteriaBreakdown.forEach((c) => console.log(`  * ${c.label}: ${c.passed ? 'PASS' : 'FAIL'} (${c.reason})`));

if (!internEval.eligible) throw new Error('Youth candidate should be eligible for PM Internship Scheme!');

// Test Farmer candidate profile:
const farmerProfile = {
  age: 35,
  annualIncome: 180000,
  occupation: 'Farmer',
  category: 'General',
  location: 'Rural',
};

const pmKisan = activeSchemes.find((s) => s.id === 'PM-KISAN');
const kisanEval = evaluateScheme(pmKisan, farmerProfile, '2026-05-15');
console.log(`PM-KISAN Scheme: Eligible=${kisanEval.eligible}, MatchScore=${kisanEval.matchScore}%`);
if (!kisanEval.eligible) throw new Error('Farmer candidate should be eligible for PM-KISAN!');

console.log('\n=== ALL TESTS PASSED SUCCESSFULLY! ===');
