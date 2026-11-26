const fs = require('fs');
const path = require('path');
const { db } = require('./db');

function isVerifiedIndianGovSource(record) {
  if (!record || typeof record !== 'object') return false;

  const url = String(record.sourceUrl || '').toLowerCase();
  let domain = '';
  try {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      const parsed = new URL(url);
      domain = parsed.hostname;
    }
  } catch (e) {
    domain = '';
  }

  const isGovIn = domain.endsWith('.gov.in');
  const isNicIn = domain.endsWith('.nic.in');
  const isRecognizedGovPortal = [
    'standupmitra.in',
    'udyamregistration.gov.in',
    'swayam.gov.in',
    'myscheme.gov.in',
    'sevasindhu.karnataka.gov.in',
    'mahaswayam.gov.in',
  ].some((recognized) => domain === recognized || domain.endsWith(`.${recognized}`));

  const validDomain = isGovIn || isNicIn || isRecognizedGovPortal;

  const authority = String(record.authority || '').toLowerCase();
  const ministry = String(record.ministry || record.department || '').toLowerCase();
  const validAuthority =
    authority.includes('government of india') ||
    authority.includes('government of') ||
    authority.includes('ministry') ||
    authority.includes('department') ||
    ministry.includes('ministry') ||
    ministry.includes('department') ||
    ministry.includes('commission');

  return {
    valid: validDomain && validAuthority,
    domain: domain || 'unknown',
    reason: !validDomain
      ? `Rejected: Domain '${domain || 'missing'}' is not an authorized .gov.in, .nic.in, or recognized Indian government portal.`
      : !validAuthority
      ? `Rejected: Authority metadata does not verify an official Indian ministry or state authority.`
      : 'Verified Indian Government Source',
  };
}

function normalizeRuleTree(rules) {
  if (!rules || typeof rules !== 'object') {
    return { all: [] };
  }
  if (Array.isArray(rules.all) || Array.isArray(rules.any)) {
    return rules;
  }
  if (Array.isArray(rules)) {
    return { all: rules };
  }
  return { all: [] };
}

async function syncIndianGovSchemes(customFeeds = null) {
  const feedList = customFeeds || (process.env.GOV_SCHEME_FEEDS
    ? process.env.GOV_SCHEME_FEEDS.split(',').map((f) => f.trim())
    : ['file://backend/data/india_gov_schemes_feed.json']);

  let totalIngested = 0;
  let totalUpdated = 0;
  let totalRejected = 0;
  const syncLogs = [];

  for (const feedUrl of feedList) {
    try {
      let rawRecords = [];

      if (feedUrl.startsWith('file://')) {
        const relPath = feedUrl.replace('file://', '');
        const fullPath = path.resolve(__dirname, '..', relPath);
        if (fs.existsSync(fullPath)) {
          const content = fs.readFileSync(fullPath, 'utf8');
          rawRecords = JSON.parse(content);
        } else {
          syncLogs.push(`Feed file not found: ${fullPath}`);
          continue;
        }
      } else if (feedUrl.startsWith('http://') || feedUrl.startsWith('https://')) {
        const res = await fetch(feedUrl, { headers: { 'User-Agent': 'SchemeSaathi-GovSync/1.0' } });
        if (!res.ok) {
          syncLogs.push(`Failed HTTP fetch for ${feedUrl}: status ${res.status}`);
          continue;
        }
        rawRecords = await res.json();
      }

      if (!Array.isArray(rawRecords)) {
        syncLogs.push(`Feed ${feedUrl} did not return an array of schemes.`);
        continue;
      }

      for (const item of rawRecords) {
        const validation = isVerifiedIndianGovSource(item);
        if (!validation.valid) {
          totalRejected++;
          syncLogs.push(`[REJECTED] ${item.id || item.name || 'Unknown'}: ${validation.reason}`);
          continue;
        }

        const normalizedRules = normalizeRuleTree(item.rules);
        const nowIso = new Date().toISOString();
        const effectiveDate = item.effectiveDate || nowIso.split('T')[0];
        const isNewVal = item.isNew ? 1 : 0;
        const stateVal = item.state || (item.stateOrCentral === 'State' ? 'State' : 'All-India');

        const existingScheme = db.prepare('SELECT * FROM schemes WHERE id = ?').get(item.id);

        if (!existingScheme) {
          db.prepare(`
            INSERT INTO schemes (
              id, name, department, ministry, state_or_central, state, is_new, source_url,
              verified_gov_domain, is_gov_verified, benefit_summary, description,
              required_documents_json, last_synced_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?)
          `).run(
            item.id,
            item.name,
            item.department || item.ministry || 'Government of India',
            item.ministry || item.department || 'Government of India',
            item.stateOrCentral || 'Central',
            stateVal,
            isNewVal,
            item.sourceUrl,
            validation.domain,
            item.benefitSummary,
            item.description,
            JSON.stringify(item.requiredDocuments || []),
            nowIso
          );

          db.prepare(`
            INSERT INTO scheme_versions (
              scheme_id, version, status, effective_date, updated_by, updated_at, change_note, rules_json
            ) VALUES (?, 1, 'APPROVED', ?, 'Automated Indian Gov Feed Sync', ?, ?, ?)
          `).run(
            item.id,
            effectiveDate,
            nowIso,
            item.changeNote || `Initial ingestion from verified official portal ${validation.domain}`,
            JSON.stringify(normalizedRules)
          );

          // If feed contains defined future/amendment versions (e.g. for testing temporal rule versioning)
          if (Array.isArray(item.futureVersions)) {
            for (const fv of item.futureVersions) {
              db.prepare(`
                INSERT INTO scheme_versions (
                  scheme_id, version, status, effective_date, updated_by, updated_at, change_note, rules_json
                ) VALUES (?, ?, 'APPROVED', ?, 'Automated Indian Gov Feed Sync', ?, ?, ?)
              `).run(
                item.id,
                fv.version,
                fv.effectiveDate,
                nowIso,
                fv.changeNote,
                JSON.stringify(normalizeRuleTree(fv.rules))
              );
            }
          }

          totalIngested++;
          syncLogs.push(`[INGESTED] ${item.id} - ${item.name} (Source: ${validation.domain})`);
        } else {
          db.prepare(`
            UPDATE schemes SET
              name = ?, department = ?, ministry = ?, state_or_central = ?, state = ?, is_new = ?,
              source_url = ?, verified_gov_domain = ?, is_gov_verified = 1,
              benefit_summary = ?, description = ?, required_documents_json = ?,
              last_synced_at = ?
            WHERE id = ?
          `).run(
            item.name,
            item.department || existingScheme.department,
            item.ministry || existingScheme.ministry,
            item.stateOrCentral || existingScheme.state_or_central,
            stateVal,
            isNewVal,
            item.sourceUrl,
            validation.domain,
            item.benefitSummary,
            item.description,
            JSON.stringify(item.requiredDocuments || []),
            nowIso,
            item.id
          );

          const versions = db
            .prepare('SELECT * FROM scheme_versions WHERE scheme_id = ? ORDER BY version DESC LIMIT 1')
            .all();
          const latestVersion = versions[0];
          const latestRulesStr = latestVersion ? latestVersion.rules_json : '';
          const newRulesStr = JSON.stringify(normalizedRules);

          if (!latestVersion || latestRulesStr !== newRulesStr) {
            const nextVersion = latestVersion ? latestVersion.version + 1 : 1;
            db.prepare(`
              INSERT INTO scheme_versions (
                scheme_id, version, status, effective_date, updated_by, updated_at, change_note, rules_json
              ) VALUES (?, ?, 'APPROVED', ?, 'Automated Indian Gov Feed Sync', ?, ?, ?)
            `).run(
              item.id,
              nextVersion,
              effectiveDate,
              nowIso,
              item.changeNote || `Policy rule amendment synced from official portal ${validation.domain}`,
              newRulesStr
            );
            totalUpdated++;
            syncLogs.push(`[RULE UPDATED v${nextVersion}] ${item.id} - New version archived without mutating historical submissions.`);
          } else {
            syncLogs.push(`[VERIFIED UNCHANGED] ${item.id} is up to date.`);
          }
        }
      }
    } catch (feedErr) {
      syncLogs.push(`Error processing feed ${feedUrl}: ${feedErr.message}`);
    }
  }

  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO sync_history (
      synced_at, source, schemes_ingested, schemes_updated, schemes_rejected, status, details
    ) VALUES (?, 'Indian Gov Scheme Feeds (.gov.in / .nic.in)', ?, ?, ?, 'SUCCESS', ?)
  `).run(now, totalIngested, totalUpdated, totalRejected, syncLogs.slice(0, 50).join('\n'));

  db.prepare(`
    INSERT INTO audit_logs (id, timestamp, officer_name, action, details)
    VALUES (?, ?, 'Government Feed Sync Engine', 'SCHEME_SYNC_COMPLETED', ?)
  `).run(
    `SYNC-${Date.now()}`,
    now,
    `Ingested: ${totalIngested}, Updated: ${totalUpdated}, Rejected non-gov sources: ${totalRejected}`
  );

  return {
    success: true,
    timestamp: now,
    ingestedCount: totalIngested,
    updatedCount: totalUpdated,
    rejectedCount: totalRejected,
    logs: syncLogs,
  };
}

module.exports = {
  isVerifiedIndianGovSource,
  normalizeRuleTree,
  syncIndianGovSchemes,
};
