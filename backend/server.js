require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { db, getAllSchemesWithVersions } = require('./db');
const { evaluateScheme, evaluateDocumentReadiness } = require('./ruleEngine');
const { encryptPII, decryptPII, hashPassword, verifyPassword } = require('./cryptoHelper');
const { syncIndianGovSchemes } = require('./schemeSync');
const { handlePdfUpload } = require('./pdfUploadHelper');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

function logOfficerAccess(officerName, action, details) {
  db.prepare(`
    INSERT INTO audit_logs (id, timestamp, officer_name, action, details)
    VALUES (?, ?, ?, ?, ?)
  `).run(
    `LOG-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    new Date().toISOString(),
    officerName || 'System Officer',
    action,
    details
  );
}

function validateProfile(profile) {
  if (!profile || typeof profile !== 'object') {
    return 'Citizen profile object is required.';
  }
  const age = Number(profile.age);
  const income = Number(profile.annualIncome);
  if (Number.isNaN(age) || age < 0 || age > 120) {
    return 'Valid age (0 - 120) is required.';
  }
  if (Number.isNaN(income) || income < 0) {
    return 'Valid non-negative annualIncome is required.';
  }
  if (!profile.category || !profile.location || !profile.occupation) {
    return 'category, location, and occupation are required.';
  }
  return null;
}

// ================= AUTHENTICATION ENDPOINTS =================


// POST /api/auth/login
app.post('/api/auth/login', (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ success: false, error: 'username and password required' });
    }
    const cleanUsername = username.trim().toLowerCase();
    const user = db.prepare('SELECT * FROM users WHERE username = ?').get(cleanUsername);
    if (!user) {
      return res.status(401).json({ success: false, error: 'Invalid username or password' });
    }
    const valid = verifyPassword(password, user.salt, user.password_hash);
    if (!valid) {
      return res.status(401).json({ success: false, error: 'Invalid username or password' });
    }
    const token = `token-${user.id}-${Date.now()}`;
    const userInfo = {
      id: user.id,
      username: user.username,
      role: user.role.toLowerCase(),
      fullName: user.full_name,
      syntheticId: user.synthetic_id,
      age: user.age,
      annualIncome: user.annual_income,
      category: user.category,
      location: user.location,
      occupation: user.occupation,
      state: user.state
    };
    res.json({ success: true, token, user: userInfo });
  } catch (e) {
    console.error('Login error:', e);
    res.status(500).json({ success: false, error: e.message });
  }
});

app.post('/api/auth/register', (req, res) => {
  try {
    const { username, password, role = 'CITIZEN', fullName, syntheticId, age, annualIncome, category, location, occupation, state } = req.body;

    if (!username || !username.trim()) {
      return res.status(400).json({ success: false, error: 'Username is required.' });
    }
    if (!password || password.length < 4) {
      return res.status(400).json({ success: false, error: 'Password must be at least 4 characters long.' });
    }
    if (!fullName || !fullName.trim()) {
      return res.status(400).json({ success: false, error: 'Full name is required.' });
    }

    const cleanUsername = username.trim().toLowerCase();
    const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(cleanUsername);
    if (existing) {
      return res.status(409).json({ success: false, error: `Username '${cleanUsername}' already exists. Please login.` });
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
      role.toUpperCase() === 'OFFICER' ? 'OFFICER' : 'CITIZEN',
      fullName.trim(),
      syntheticId || `SYN-${Date.now().toString().slice(-6)}`,
      age ? Number(age) : 26,
      annualIncome ? Number(annualIncome) : 240000,
      category || 'OBC',
      location || 'Urban',
      occupation || 'Unemployed',
      state || 'Karnataka',
      nowIso
    );

    const user = {
      id: userId,
      username: cleanUsername,
      role: role.toUpperCase() === 'OFFICER' ? 'OFFICER' : 'CITIZEN',
      fullName: fullName.trim(),
      syntheticId: syntheticId || `SYN-${Date.now().toString().slice(-6)}`,
      age: age ? Number(age) : 26,
      annualIncome: annualIncome ? Number(annualIncome) : 240000,
      category: category || 'OBC',
      location: location || 'Urban',
      occupation: occupation || 'Unemployed',
      state: state || 'Karnataka',
    };

    const token = `token-${userId}-${Date.now()}`;

    res.status(201).json({
      success: true,
      message: 'Account registered successfully.',
      user,
      token,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/auth/login
app.post('/api/auth/login', (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ success: false, error: 'Username and password are required.' });
    }

    const cleanUsername = username.trim().toLowerCase();
    const userRow = db.prepare('SELECT * FROM users WHERE username = ?').get(cleanUsername);

    if (!userRow || !verifyPassword(password, userRow.salt, userRow.password_hash)) {
      return res.status(401).json({ success: false, error: 'Invalid credentials. Check username or password.' });
    }

    const user = {
      id: userRow.id,
      username: userRow.username,
      role: (userRow.role || 'CITIZEN').toLowerCase(),
      fullName: userRow.full_name,
      syntheticId: userRow.synthetic_id,
      age: userRow.age,
      annualIncome: userRow.annual_income,
      category: userRow.category,
      location: userRow.location,
      occupation: userRow.occupation,
      state: userRow.state,
    };

    const token = `token-${user.id}-${Date.now()}`;

    res.json({
      success: true,
      message: 'Login successful.',
      user,
      token,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/auth/me
app.get('/api/auth/me', (req, res) => {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.replace(/^Bearer\s+/i, '');
  const username = req.query.username;

  let userRow;
  if (username) {
    userRow = db.prepare('SELECT * FROM users WHERE username = ?').get(username.trim().toLowerCase());
  } else if (token && token.startsWith('token-USR-')) {
    const userIdMatch = token.match(/token-(USR-[0-9]+-[0-9]+)/);
    if (userIdMatch) {
      userRow = db.prepare('SELECT * FROM users WHERE id = ?').get(userIdMatch[1]);
    }
  }

  if (!userRow) {
    // Return default first citizen user if any exists
    userRow = db.prepare('SELECT * FROM users LIMIT 1').get();
  }

  if (!userRow) {
    return res.status(404).json({ success: false, error: 'User not found.' });
  }

  res.json({
    success: true,
    user: {
      id: userRow.id,
      username: userRow.username,
      role: (userRow.role || 'CITIZEN').toLowerCase(),
      fullName: userRow.full_name,
      syntheticId: userRow.synthetic_id,
      age: userRow.age,
      annualIncome: userRow.annual_income,
      category: userRow.category,
      location: userRow.location,
      occupation: userRow.occupation,
      state: userRow.state,
    },
  });
});

// ================= SCHEMES & SYNC ENDPOINTS =================

// GET /api/schemes?isNew=1&state=Karnataka
app.get('/api/schemes', (req, res) => {
  try {
    const { isNew, state } = req.query;
    const schemes = getAllSchemesWithVersions({
      isNew: isNew === '1' || isNew === 'true',
      state: state || null,
    });
    res.json({ success: true, count: schemes.length, schemes });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/schemes/sync
app.post('/api/schemes/sync', async (req, res) => {
  try {
    const { feeds, officerName } = req.body || {};
    const result = await syncIndianGovSchemes(feeds);
    if (officerName) {
      logOfficerAccess(
        officerName,
        'TRIGGER_GOV_SCHEME_SYNC',
        `Synced Indian government feeds: ${result.ingestedCount} ingested, ${result.updatedCount} updated, ${result.rejectedCount} rejected`
      );
    }
    const schemes = getAllSchemesWithVersions();
    res.json({
      success: true,
      ...result,
      schemesCount: schemes.length,
      schemes,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/schemes/sync/history
app.get('/api/schemes/sync/history', (req, res) => {
  try {
    const history = db.prepare('SELECT * FROM sync_history ORDER BY synced_at DESC LIMIT 20').all();
    res.json({ success: true, history });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ================= DOCUMENT UPLOAD & WALLET ENDPOINTS =================

// POST /api/documents/upload - PDF Document Upload with issue and expiry dates
app.post('/api/documents/upload', handlePdfUpload, (req, res) => {
  try {
    const { userId, docTypeId, docName, issueDate, expiryDate } = req.body;

    if (!docTypeId) {
      return res.status(400).json({ success: false, error: 'docTypeId is required (e.g. DOC-INC, DOC-ID).' });
    }

    const docId = `DOC-UP-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const nowIso = new Date().toISOString();
    const cleanUserId = userId || 'default-citizen';

    const filename = req.file ? req.file.filename : `simulated-${docTypeId}.pdf`;
    const originalName = req.file ? req.file.originalname : `${docName || docTypeId}.pdf`;
    const fileSize = req.file ? req.file.size : 102400;

    db.prepare(`
      INSERT INTO documents (
        id, user_id, doc_type_id, name, original_filename, stored_filename,
        mime_type, file_size, issue_date, expiry_date, uploaded_at
      ) VALUES (?, ?, ?, ?, ?, ?, 'application/pdf', ?, ?, ?, ?)
    `).run(
      docId,
      cleanUserId,
      docTypeId,
      docName || docTypeId,
      originalName,
      filename,
      fileSize,
      issueDate || null,
      expiryDate || null,
      nowIso
    );

    res.status(201).json({
      success: true,
      message: 'PDF document uploaded and registered in wallet.',
      document: {
        id: docId,
        docTypeId,
        name: docName || docTypeId,
        originalFilename: originalName,
        issueDate: issueDate || null,
        expiryDate: expiryDate || null,
        uploadedAt: nowIso,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/documents - Fetch uploaded & held documents for user
app.get('/api/documents', (req, res) => {
  try {
    const { userId } = req.query;
    const query = userId
      ? 'SELECT * FROM documents WHERE user_id = ? ORDER BY uploaded_at DESC'
      : 'SELECT * FROM documents ORDER BY uploaded_at DESC';
    const docs = userId
      ? db.prepare(query).all(userId)
      : db.prepare(query).all();

    res.json({
      success: true,
      count: docs.length,
      documents: docs.map((d) => ({
        id: d.id,
        userId: d.user_id,
        docTypeId: d.doc_type_id,
        name: d.name,
        originalFilename: d.original_filename,
        storedFilename: d.stored_filename,
        issueDate: d.issue_date,
        expiryDate: d.expiry_date,
        uploadedAt: d.uploaded_at,
      })),
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ================= ELIGIBILITY ENGINE ENDPOINTS =================

// POST /api/eligibility/check
app.post('/api/eligibility/check', (req, res) => {
  try {
    const { profile, schemeId, evaluationDate, availableDocuments = [] } = req.body;
    const errorMsg = validateProfile(profile);
    if (errorMsg) {
      return res.status(400).json({ success: false, error: errorMsg });
    }

    const normalizedProfile = {
      ...profile,
      age: Number(profile.age),
      annualIncome: Number(profile.annualIncome),
      state: profile.state || 'Karnataka',
    };

    const allSchemes = getAllSchemesWithVersions();
    const targets = schemeId ? allSchemes.filter((s) => s.id === schemeId) : allSchemes;

    if (schemeId && targets.length === 0) {
      return res.status(404).json({ success: false, error: `Scheme ${schemeId} not found.` });
    }

    const evalDate = evaluationDate || new Date().toISOString().split('T')[0];

    // Format available documents (some can be string IDs, others object with { id/docTypeId, expiryDate })
    const userDocsList = availableDocuments.map((doc) => {
      if (typeof doc === 'string') return { id: doc, docTypeId: doc };
      return { id: doc.docTypeId || doc.id, docTypeId: doc.docTypeId || doc.id, expiryDate: doc.expiryDate };
    });

    const evaluatedResults = targets.map((scheme) => {
      const evaluated = evaluateScheme(scheme, normalizedProfile, evalDate);
      const documentReadiness = evaluateDocumentReadiness(scheme.requiredDocuments || [], userDocsList, evalDate);

      return {
        ...evaluated,
        documentReadiness,
      };
    });

    // Sort so Eligible Schemes appear first, followed by highest match score
    evaluatedResults.sort((a, b) => {
      if (a.eligible !== b.eligible) return a.eligible ? -1 : 1;
      return b.matchScore - a.matchScore;
    });

    res.json({ success: true, evaluationDate: evalDate, results: evaluatedResults });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/eligibility/alternatives
app.post('/api/eligibility/alternatives', (req, res) => {
  try {
    const { profile, excludedSchemeId, evaluationDate } = req.body;
    const errorMsg = validateProfile(profile);
    if (errorMsg) {
      return res.status(400).json({ success: false, error: errorMsg });
    }

    const normalizedProfile = {
      ...profile,
      age: Number(profile.age),
      annualIncome: Number(profile.annualIncome),
      state: profile.state || 'Karnataka',
    };

    const evalDate = evaluationDate || new Date().toISOString().split('T')[0];
    const alternatives = getAllSchemesWithVersions()
      .filter((s) => s.id !== excludedSchemeId)
      .map((s) => evaluateScheme(s, normalizedProfile, evalDate))
      .sort((a, b) => {
        if (a.eligible !== b.eligible) return a.eligible ? -1 : 1;
        return b.matchScore - a.matchScore;
      });

    res.json({ success: true, evaluationDate: evalDate, alternatives });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/schemes/:id/versions
app.get('/api/schemes/:id/versions', (req, res) => {
  try {
    const scheme = getAllSchemesWithVersions().find((s) => s.id === req.params.id);
    if (!scheme) {
      return res.status(404).json({ success: false, error: 'Scheme not found.' });
    }
    res.json({
      success: true,
      schemeId: scheme.id,
      schemeName: scheme.name,
      versions: scheme.versions,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/schemes/:id/rules
app.put('/api/schemes/:id/rules', (req, res) => {
  try {
    const { rules, effectiveDate, officerName, changeNote } = req.body;

    if (!rules || (!rules.all && !rules.any)) {
      return res.status(400).json({
        success: false,
        error: 'JSON rules must contain a top-level "all" or "any" array.',
      });
    }
    if (!effectiveDate || Number.isNaN(Date.parse(effectiveDate))) {
      return res.status(400).json({ success: false, error: 'Valid effectiveDate is required.' });
    }
    if (!officerName || !officerName.trim()) {
      return res.status(400).json({ success: false, error: 'officerName is required.' });
    }

    const scheme = getAllSchemesWithVersions().find((s) => s.id === req.params.id);
    if (!scheme) {
      return res.status(404).json({ success: false, error: 'Scheme not found.' });
    }

    const nextVersion = scheme.versions.reduce((max, v) => Math.max(max, v.version), 0) + 1;
    const nowIso = new Date().toISOString();
    const note = changeNote || `Rule v${nextVersion} published by ${officerName.trim()}`;

    db.prepare(`
      INSERT INTO scheme_versions
        (scheme_id, version, status, effective_date, updated_by, updated_at, change_note, rules_json)
      VALUES (?, ?, 'APPROVED', ?, ?, ?, ?, ?)
    `).run(
      scheme.id,
      nextVersion,
      effectiveDate,
      officerName.trim(),
      nowIso,
      note,
      JSON.stringify(rules)
    );

    logOfficerAccess(
      officerName.trim(),
      'RULE_VERSION_CREATED',
      `Created Version ${nextVersion} for ${scheme.id} effective ${effectiveDate}`
    );

    res.json({
      success: true,
      message: `Published Version ${nextVersion} for ${scheme.id}. Existing approved applications remain locked to their original version.`,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ================= APPLICATIONS ENDPOINTS =================

// POST /api/applications
app.post('/api/applications', (req, res) => {
  try {
    const {
      userId,
      citizenName,
      syntheticId,
      profile,
      schemeId,
      evaluationDate,
      submittedDocuments = [],
    } = req.body;

    if (!citizenName || !citizenName.trim()) {
      return res.status(400).json({ success: false, error: 'citizenName is required.' });
    }
    const errorMsg = validateProfile(profile);
    if (errorMsg) {
      return res.status(400).json({ success: false, error: errorMsg });
    }

    const scheme = getAllSchemesWithVersions().find((s) => s.id === schemeId);
    if (!scheme) {
      return res.status(404).json({ success: false, error: 'Scheme not found.' });
    }

    const normalizedProfile = {
      ...profile,
      age: Number(profile.age),
      annualIncome: Number(profile.annualIncome),
      state: profile.state || 'Karnataka',
    };
    const evalDate = evaluationDate || new Date().toISOString().split('T')[0];
    const evaluated = evaluateScheme(scheme, normalizedProfile, evalDate);

    if (!evaluated.eligible) {
      return res.status(400).json({
        success: false,
        error: 'Not eligible under the rule version active on the evaluation date.',
        failedReasons: evaluated.failedReasons,
        remediations: evaluated.remediations,
      });
    }

    const appId = `APP-2026-${Date.now().toString().slice(-5)}`;
    const nowIso = new Date().toISOString();
    const application = {
      id: appId,
      userId: userId || null,
      citizenName: citizenName.trim(),
      encryptedCitizenId: encryptPII(syntheticId || `SYN-${Date.now()}`),
      schemeId: scheme.id,
      schemeName: scheme.name,
      appliedVersion: evaluated.appliedVersion,
      evaluationDate: evalDate,
      snapshotProfile: normalizedProfile,
      submittedDocuments,
      status: 'SUBMITTED',
      officerRemarks: 'Awaiting officer review.',
      submittedAt: nowIso,
      updatedAt: nowIso,
    };

    db.prepare(`
      INSERT INTO applications (
        id, user_id, citizen_name, encrypted_citizen_id, scheme_id, scheme_name,
        applied_version, evaluation_date, snapshot_profile_json,
        submitted_documents_json, status, officer_remarks, submitted_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      application.id,
      application.userId,
      application.citizenName,
      application.encryptedCitizenId,
      application.schemeId,
      application.schemeName,
      application.appliedVersion,
      application.evaluationDate,
      JSON.stringify(application.snapshotProfile),
      JSON.stringify(application.submittedDocuments),
      application.status,
      application.officerRemarks,
      application.submittedAt,
      application.updatedAt
    );

    res.status(201).json({ success: true, application });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/applications
app.get('/api/applications', (req, res) => {
  try {
    const { role, officerName, userId } = req.query;
    let query = 'SELECT * FROM applications';
    const params = [];

    if (userId && role !== 'officer') {
      query += ' WHERE user_id = ?';
      params.push(userId);
    }
    query += ' ORDER BY submitted_at DESC';

    const rows = db.prepare(query).all(...params);
    const applications = rows.map((r) => ({
      id: r.id,
      userId: r.user_id,
      citizenName: r.citizen_name,
      encryptedCitizenId: r.encrypted_citizen_id,
      schemeId: r.scheme_id,
      schemeName: r.scheme_name,
      appliedVersion: r.applied_version,
      evaluationDate: r.evaluation_date,
      snapshotProfile: JSON.parse(r.snapshot_profile_json),
      submittedDocuments: JSON.parse(r.submitted_documents_json),
      status: r.status,
      officerRemarks: r.officer_remarks,
      submittedAt: r.submitted_at,
      updatedAt: r.updated_at,
    }));

    if (role === 'officer') {
      logOfficerAccess(
        officerName || 'Officer Portal',
        'VIEW_APPLICATIONS',
        `Viewed ${applications.length} applications`
      );
    }

    res.json({ success: true, applications });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/applications/:id - Edit submitted application and re-check against locked rule version
app.put('/api/applications/:id', (req, res) => {
  try {
    const appId = req.params.id;
    const { profile, citizenName, submittedDocuments } = req.body;

    const existing = db.prepare('SELECT * FROM applications WHERE id = ?').get(appId);
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Application not found.' });
    }

    if (existing.status === 'APPROVED') {
      return res.status(400).json({ success: false, error: 'Cannot edit already APPROVED application.' });
    }

    const scheme = getAllSchemesWithVersions().find((s) => s.id === existing.scheme_id);
    if (!scheme) {
      return res.status(404).json({ success: false, error: 'Associated scheme not found.' });
    }

    const lockedVersionObj = scheme.versions.find((v) => v.version === existing.applied_version);
    if (!lockedVersionObj) {
      return res.status(400).json({ success: false, error: `Locked Version ${existing.applied_version} not found for scheme.` });
    }

    const normalizedProfile = {
      ...(profile || JSON.parse(existing.snapshot_profile_json)),
      age: Number((profile ? profile.age : null) || JSON.parse(existing.snapshot_profile_json).age),
      annualIncome: Number((profile ? profile.annualIncome : null) || JSON.parse(existing.snapshot_profile_json).annualIncome),
    };

    // Re-evaluate strictly against the locked version
    const { eligible, criterionEvaluations } = require('./ruleEngine').evaluateRules(lockedVersionObj.rules, normalizedProfile);
    if (!eligible) {
      const failed = criterionEvaluations.filter((c) => !c.passed).map((c) => c.reason);
      return res.status(400).json({
        success: false,
        error: `Updated profile fails requirements for locked Version ${existing.applied_version}.`,
        failedReasons: failed,
      });
    }

    const nowIso = new Date().toISOString();
    const updatedDocs = submittedDocuments || JSON.parse(existing.submitted_documents_json);
    const updatedName = citizenName ? citizenName.trim() : existing.citizen_name;

    db.prepare(`
      UPDATE applications SET
        citizen_name = ?,
        snapshot_profile_json = ?,
        submitted_documents_json = ?,
        updated_at = ?
      WHERE id = ?
    `).run(
      updatedName,
      JSON.stringify(normalizedProfile),
      JSON.stringify(updatedDocs),
      nowIso,
      appId
    );

    res.json({
      success: true,
      message: `Application ${appId} successfully updated and verified against locked Version ${existing.applied_version}.`,
      application: {
        id: appId,
        citizenName: updatedName,
        schemeId: existing.scheme_id,
        appliedVersion: existing.applied_version,
        snapshotProfile: normalizedProfile,
        submittedDocuments: updatedDocs,
        status: existing.status,
        updatedAt: nowIso,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PATCH /api/applications/:id/status - Status transitions
app.patch('/api/applications/:id/status', (req, res) => {
  try {
    const { status, officerRemarks, officerName } = req.body;
    const valid = ['SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED'];
    if (!valid.includes(status)) {
      return res.status(400).json({ success: false, error: 'Invalid status value. Allowed: SUBMITTED, UNDER_REVIEW, APPROVED, REJECTED' });
    }

    const existing = db.prepare('SELECT * FROM applications WHERE id = ?').get(req.params.id);
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Application not found.' });
    }

    const updatedRemarks = officerRemarks || existing.officer_remarks;
    const updatedAt = new Date().toISOString();

    db.prepare(`
      UPDATE applications
      SET status = ?, officer_remarks = ?, updated_at = ?
      WHERE id = ?
    `).run(status, updatedRemarks, updatedAt, req.params.id);

    logOfficerAccess(
      officerName || 'Officer Portal',
      'UPDATE_APPLICATION_STATUS',
      `Updated ${req.params.id} to ${status}`
    );

    res.json({ success: true, id: req.params.id, status });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ---------- OFFICER: Bulk scheme upload (JSON array) ----------
app.post('/api/officer/schemes/batch', (req, res) => {
  try {
    const schemes = req.body.schemes;
    if (!Array.isArray(schemes)) {
      return res.status(400).json({ success: false, error: 'Request body must contain a "schemes" array.' });
    }
    const insert = db.prepare(`
      INSERT OR REPLACE INTO schemes (
        id, name, department, ministry, state_or_central, state, is_new, source_url,
        verified_gov_domain, is_gov_verified, benefit_summary, description, required_documents_json, last_synced_at
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `);
    const insertMany = db.transaction((list) => {
      for (const s of list) {
        insert.run(
          s.id,
          s.name,
          s.department,
          s.ministry || s.department,
          s.state_or_central || 'Central',
          s.state || null,
          s.is_new ? 1 : 0,
          s.source_url || null,
          s.verified_gov_domain || null,
          s.is_gov_verified ? 1 : 0,
          s.benefit_summary,
          s.description,
          JSON.stringify(s.required_documents || []),
          s.last_synced_at || null
        );
      }
    });
    insertMany(schemes);
    res.json({ success: true, inserted: schemes.length });
  } catch (e) {
    console.error('Bulk scheme upload error:', e);
    res.status(500).json({ success: false, error: e.message });
  }
});

// GET /api/audit-logs
app.get('/api/audit-logs', (req, res) => {
app.patch('/api/applications/:id/status', (req, res) => {
  try {
    const { status, officerRemarks, officerName } = req.body;
    const valid = ['SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED'];
    if (!valid.includes(status)) {
      return res.status(400).json({ success: false, error: 'Invalid status value. Allowed: SUBMITTED, UNDER_REVIEW, APPROVED, REJECTED' });
    }

    const existing = db.prepare('SELECT * FROM applications WHERE id = ?').get(req.params.id);
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Application not found.' });
    }

    const updatedRemarks = officerRemarks || existing.officer_remarks;
    const updatedAt = new Date().toISOString();

    db.prepare(`
      UPDATE applications
      SET status = ?, officer_remarks = ?, updated_at = ?
      WHERE id = ?
    `).run(status, updatedRemarks, updatedAt, req.params.id);

    logOfficerAccess(
      officerName || 'Officer Portal',
      'UPDATE_APPLICATION_STATUS',
      `Updated ${req.params.id} to ${status}`
    );

    res.json({ success: true, id: req.params.id, status });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/audit-logs
app.get('/api/audit-logs', (req, res) => {
  try {
    const logs = db.prepare('SELECT * FROM audit_logs ORDER BY timestamp DESC LIMIT 100').all();
    res.json({ success: true, logs });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Initial startup sync & periodic background sync (every 6 hours)
(async () => {
  try {
    const currentCount = db.prepare('SELECT COUNT(*) AS cnt FROM schemes').get();
    if (currentCount.cnt === 0) {
      console.log('Zero schemes in database. Running initial automated Indian Gov Scheme feed sync...');
      await syncIndianGovSchemes();
    }
  } catch (e) {
    console.error('Initial scheme sync notice:', e.message);
  }
})();

const SYNC_INTERVAL_MS = Number(process.env.SYNC_INTERVAL_MS) || 6 * 60 * 60 * 1000;
setInterval(async () => {
  try {
    console.log('[Background Sync] Checking Indian government scheme feeds for updates...');
    const result = await syncIndianGovSchemes();
    console.log(`[Background Sync Completed] Ingested: ${result.ingestedCount}, Updated: ${result.updatedCount}`);
  } catch (e) {
    console.error('[Background Sync Error]:', e.message);
  }
}, SYNC_INTERVAL_MS);

app.listen(PORT, () => {
  console.log(`SchemeSaathi SQL + Express Backend running on http://localhost:${PORT}`);
});
