-- SchemeSaathi PostgreSQL Database Schema & Initial Seed
-- Clean, robust, standard PostgreSQL schema without over-complication

-- 1. Create Schemes Table
CREATE TABLE IF NOT EXISTS schemes (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    department VARCHAR(255) NOT NULL,
    benefit_summary TEXT NOT NULL,
    description TEXT NOT NULL,
    required_documents_json JSONB NOT NULL
);

-- 2. Create Scheme Versions Table
CREATE TABLE IF NOT EXISTS scheme_versions (
    id SERIAL PRIMARY KEY,
    scheme_id VARCHAR(50) NOT NULL REFERENCES schemes(id) ON DELETE CASCADE,
    version INTEGER NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'APPROVED',
    effective_date DATE NOT NULL,
    updated_by VARCHAR(100) NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    change_note TEXT NOT NULL,
    rules_json JSONB NOT NULL,
    CONSTRAINT uq_scheme_version UNIQUE(scheme_id, version)
);

-- 3. Create Applications Table
CREATE TABLE IF NOT EXISTS applications (
    id VARCHAR(50) PRIMARY KEY,
    citizen_name VARCHAR(150) NOT NULL,
    encrypted_citizen_id TEXT NOT NULL,
    scheme_id VARCHAR(50) NOT NULL REFERENCES schemes(id),
    scheme_name VARCHAR(255) NOT NULL,
    applied_version INTEGER NOT NULL,
    evaluation_date DATE NOT NULL,
    snapshot_profile_json JSONB NOT NULL,
    submitted_documents_json JSONB NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'SUBMITTED',
    officer_remarks TEXT NOT NULL,
    submitted_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 4. Create Audit Logs Table
CREATE TABLE IF NOT EXISTS audit_logs (
    id VARCHAR(50) PRIMARY KEY,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    officer_name VARCHAR(100) NOT NULL,
    action VARCHAR(100) NOT NULL,
    details TEXT NOT NULL
);

-- 5. Seed Schemes and Rule Versions
INSERT INTO schemes (id, name, department, benefit_summary, description, required_documents_json)
VALUES
(
    'SCH-YUVA-01',
    '[SAMPLE] Yuva Kaushalya Apprenticeship Grant',
    'Department of Skill Development & Youth Affairs (Sample)',
    '₹4,500/month stipend for 12 months + industry certification',
    'Sample scheme demonstrating rule versioning: Version 1 caps age at 25; Version 2 (effective 2026-06-01) raises max age to 28.',
    '[{"id":"DOC-ID","name":"Aadhaar / Synthetic Citizen ID","digilockerSupported":true},{"id":"DOC-INC","name":"Annual Family Income Certificate","digilockerSupported":true},{"id":"DOC-EDU","name":"Graduation / Diploma Marksheet","digilockerSupported":true}]'::jsonb
),
(
    'SCH-AGRI-02',
    '[SAMPLE] Krishi Sinchai Micro-Irrigation Subsidy',
    'Department of Agriculture & Rural Welfare (Sample)',
    '75% capital subsidy up to ₹60,000 for drip/sprinkler units',
    'Sample subsidy for rural farmers.',
    '[{"id":"DOC-ID","name":"Aadhaar / Synthetic Citizen ID","digilockerSupported":true},{"id":"DOC-LAND","name":"RTC / Land Holding Record","digilockerSupported":true},{"id":"DOC-BANK","name":"Bank Passbook Copy","digilockerSupported":false}]'::jsonb
),
(
    'SCH-EDU-03',
    '[SAMPLE] Vidya Jyoti Higher Education Merit-Cum-Means Scholarship',
    'Department of Collegiate Education (Sample)',
    '₹35,000/year tuition reimbursement + book allowance',
    'Sample scholarship for students meeting income or category conditions.',
    '[{"id":"DOC-ID","name":"Aadhaar / Synthetic Citizen ID","digilockerSupported":true},{"id":"DOC-INC","name":"Annual Family Income Certificate","digilockerSupported":true},{"id":"DOC-CASTE","name":"Category / Caste Certificate","digilockerSupported":true},{"id":"DOC-BON","name":"College Bonafide Certificate","digilockerSupported":false}]'::jsonb
),
(
    'SCH-UDYAM-04',
    '[SAMPLE] Swavalambi Micro-Enterprise Seed Fund',
    'Department of Micro & Small Industries (Sample)',
    '₹1,00,000 collateral-free seed grant at 0% interest',
    'Sample seed grant for unemployed or self-employed youth.',
    '[{"id":"DOC-ID","name":"Aadhaar / Synthetic Citizen ID","digilockerSupported":true},{"id":"DOC-INC","name":"Annual Family Income Certificate","digilockerSupported":true},{"id":"DOC-PROJ","name":"1-Page Micro-Business Plan","digilockerSupported":false}]'::jsonb
)
ON CONFLICT (id) DO NOTHING;

-- Seed Versions
INSERT INTO scheme_versions (scheme_id, version, status, effective_date, updated_by, updated_at, change_note, rules_json)
VALUES
(
    'SCH-YUVA-01',
    1,
    'APPROVED',
    '2025-01-01',
    'Officer R. Kulkarni',
    '2025-01-01T09:00:00.000Z',
    'Initial launch with maximum age 25.',
    '{"all":[{"field":"age","operator":">=","value":18,"label":"Minimum Age"},{"field":"age","operator":"<=","value":25,"label":"Maximum Age (v1 Limit)"},{"field":"annualIncome","operator":"<=","value":300000,"label":"Annual Family Income (INR)"},{"field":"occupation","operator":"==","value":"Unemployed","label":"Employment Status"}]}'::jsonb
),
(
    'SCH-YUVA-01',
    2,
    'APPROVED',
    '2026-06-01',
    'Officer S. Deshmukh',
    '2026-05-20T14:30:00.000Z',
    'Policy update: Raised maximum age limit from 25 to 28.',
    '{"all":[{"field":"age","operator":">=","value":18,"label":"Minimum Age"},{"field":"age","operator":"<=","value":28,"label":"Maximum Age (v2 Amended Limit)"},{"field":"annualIncome","operator":"<=","value":300000,"label":"Annual Family Income (INR)"},{"field":"occupation","operator":"==","value":"Unemployed","label":"Employment Status"}]}'::jsonb
),
(
    'SCH-AGRI-02',
    1,
    'APPROVED',
    '2025-01-01',
    'Officer A. Hegde',
    '2025-01-01T10:00:00.000Z',
    'Initial rural farmer criteria.',
    '{"all":[{"field":"occupation","operator":"==","value":"Farmer","label":"Primary Occupation"},{"field":"location","operator":"==","value":"Rural","label":"Area Classification"},{"field":"annualIncome","operator":"<=","value":400000,"label":"Annual Family Income (INR)"}]}'::jsonb
),
(
    'SCH-EDU-03',
    1,
    'APPROVED',
    '2025-01-01',
    'Officer M. Nair',
    '2025-01-01T11:15:00.000Z',
    'Initial scholarship criteria.',
    '{"all":[{"field":"age","operator":">=","value":17,"label":"Minimum Age"},{"field":"age","operator":"<=","value":30,"label":"Maximum Age"},{"field":"occupation","operator":"==","value":"Student","label":"Occupation"},{"any":[{"field":"annualIncome","operator":"<=","value":250000,"label":"Income <= ₹2.5L"},{"field":"category","operator":"!=","value":"General","label":"Reserved Category (SC/ST/OBC)"}]}]}'::jsonb
),
(
    'SCH-UDYAM-04',
    1,
    'APPROVED',
    '2025-01-01',
    'Officer R. Kulkarni',
    '2025-01-01T12:00:00.000Z',
    'Initial entrepreneurship rules.',
    '{"all":[{"field":"age","operator":">=","value":21,"label":"Minimum Age"},{"field":"age","operator":"<=","value":45,"label":"Maximum Age"},{"field":"annualIncome","operator":"<=","value":500000,"label":"Annual Family Income (INR)"},{"any":[{"field":"occupation","operator":"==","value":"Unemployed","label":"Unemployed"},{"field":"occupation","operator":"==","value":"Self-Employed","label":"Self-Employed"}]}]}'::jsonb
)
ON CONFLICT (scheme_id, version) DO NOTHING;
