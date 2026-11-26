/**
 * Pure Deterministic Rule Engine for SchemeSaathi
 * Evaluates profile eligibility against JSON rules without opaque black-box decisions or eval().
 * Supports nested all/any combinators, operators, condition breakdowns,
 * actionable "How to Qualify" remediation steps, and expired document detection with renewal instructions.
 */

function compare(fieldVal, operator, ruleVal) {
  switch (operator) {
    case '==':
      return String(fieldVal).toLowerCase() === String(ruleVal).toLowerCase();
    case '!=':
      return String(fieldVal).toLowerCase() !== String(ruleVal).toLowerCase();
    case '>=':
      return Number(fieldVal) >= Number(ruleVal);
    case '<=':
      return Number(fieldVal) <= Number(ruleVal);
    case '>':
      return Number(fieldVal) > Number(ruleVal);
    case '<':
      return Number(fieldVal) < Number(ruleVal);
    case 'in':
      if (Array.isArray(ruleVal)) {
        return ruleVal.map((v) => String(v).toLowerCase()).includes(String(fieldVal).toLowerCase());
      }
      return false;
    default:
      return false;
  }
}

function getRemediationAdvice(condition, actualVal) {
  const field = condition.field;
  const op = condition.operator;
  const val = condition.value;

  switch (field) {
    case 'age':
      if (op === '<=' || op === '<') {
        return `Age limit exceeded (${actualVal} > ${val}). Consider checking senior or entrepreneur category schemes, or apply before policy cut-off dates.`;
      }
      if (op === '>=' || op === '>') {
        return `Minimum age requirement is ${val} years (current: ${actualVal}). You can apply upon reaching ${val} years.`;
      }
      break;
    case 'annualIncome':
      if (op === '<=' || op === '<') {
        return `Family income ₹${Number(actualVal).toLocaleString('en-IN')} exceeds threshold of ₹${Number(val).toLocaleString('en-IN')}. Verify against most recent Tahsildar / Revenue Revenue Income Certificate.`;
      }
      break;
    case 'occupation':
      if (op === '==') {
        return `Targeted for '${val}' (current profile: '${actualVal}'). Register on National Career Service (NCS) portal or local District Employment Exchange if seeking relevant classification.`;
      }
      if (op === '!=') {
        return `Citizens currently registered as '${val}' are not eligible. Transitioning status or part-time apprenticeships may qualify.`;
      }
      break;
    case 'category':
      if (op === '!=') {
        return `This affirmative benefit is reserved for non-${val} categories (SC/ST/OBC). Look into General EWS or Merit schemes.`;
      }
      if (op === '==') {
        return `Specific reservation for ${val} category. Check applicable certificates or general category grant alternatives.`;
      }
      break;
    case 'location':
      return `Restricted to '${val}' geographical jurisdiction (current: '${actualVal}'). Ensure domicile address on Aadhaar / Ration card matches scheme area.`;
    case 'state':
      return `Scheme belongs to ${val} state jurisdiction. Check central counterparts or resident schemes for your state.`;
    default:
      return `Requirement: ${condition.label || field} must be ${op} ${val}. Update supporting certificates accordingly.`;
  }
  return `Adjust profile parameter '${field}' to satisfy: ${op} ${val}.`;
}

function evaluateRuleCondition(condition, profile) {
  const profileVal = profile[condition.field];
  const passed = compare(profileVal, condition.operator, condition.value);
  const explanation = passed
    ? `Met requirement: ${condition.label || condition.field} (Current: ${profileVal})`
    : `Failed requirement: ${condition.label || condition.field} (Expected ${condition.operator} ${condition.value}, Current: ${profileVal ?? 'N/A'})`;

  const remediation = passed ? null : getRemediationAdvice(condition, profileVal);

  return {
    label: condition.label || `${condition.field} ${condition.operator} ${condition.value}`,
    field: condition.field,
    operator: condition.operator,
    requiredValue: condition.value,
    actualValue: profileVal,
    passed,
    explanation,
    reason: explanation,
    remediation,
  };
}

function evaluateRules(ruleTree, profile) {
  const criterionEvaluations = [];

  if (ruleTree.all && Array.isArray(ruleTree.all)) {
    let allPassed = true;
    for (const rule of ruleTree.all) {
      if (rule.any && Array.isArray(rule.any)) {
        const nestedEval = evaluateRules({ any: rule.any }, profile);
        criterionEvaluations.push(...nestedEval.criterionEvaluations);
        if (!nestedEval.eligible) allPassed = false;
      } else {
        const res = evaluateRuleCondition(rule, profile);
        criterionEvaluations.push(res);
        if (!res.passed) allPassed = false;
      }
    }
    return { eligible: allPassed, criterionEvaluations };
  }

  if (ruleTree.any && Array.isArray(ruleTree.any)) {
    let anyPassed = false;
    const branchResults = [];
    for (const rule of ruleTree.any) {
      const res = evaluateRuleCondition(rule, profile);
      branchResults.push(res);
      if (res.passed) anyPassed = true;
    }
    criterionEvaluations.push(...branchResults);
    return { eligible: anyPassed, criterionEvaluations };
  }

  return { eligible: true, criterionEvaluations: [] };
}

function getActiveVersionForDate(versions, targetDateStr) {
  if (!versions || versions.length === 0) return null;
  const targetDate = new Date(targetDateStr || new Date().toISOString().split('T')[0]);

  // Approved versions effective on or before the target date, sorted by latest effective date & highest version
  const validVersions = versions
    .filter((v) => v.status === 'APPROVED' && new Date(v.effectiveDate) <= targetDate)
    .sort((a, b) => new Date(b.effectiveDate) - new Date(a.effectiveDate) || b.version - a.version);

  if (validVersions.length > 0) {
    return validVersions[0];
  }

  // Fallback to earliest version if all are in the future
  return versions.slice().sort((a, b) => a.version - b.version)[0];
}

/**
 * Checks document readiness, detects expired documents, and returns renewal instructions.
 */
function evaluateDocumentReadiness(requiredDocuments, userDocuments = [], evaluationDateStr) {
  const evalDate = new Date(evaluationDateStr || new Date().toISOString().split('T')[0]);

  const docs = (requiredDocuments || []).map((reqDoc) => {
    // Check if user has uploaded or holds this document type
    const held = userDocuments.find((ud) => ud.docTypeId === reqDoc.id || ud.id === reqDoc.id);

    let isHeld = Boolean(held);
    let isExpired = false;
    let expiryDate = held?.expiryDate || held?.validUntil || null;
    let renewalGuidance = null;

    if (held && expiryDate) {
      const exp = new Date(expiryDate);
      if (exp < evalDate) {
        isExpired = true;
        renewalGuidance = getRenewalGuidance(reqDoc.id, reqDoc.name);
      }
    }

    return {
      id: reqDoc.id,
      name: reqDoc.name,
      digilockerSupported: Boolean(reqDoc.digilockerSupported),
      ready: isHeld && !isExpired,
      isHeld,
      isExpired,
      expiryDate,
      renewalGuidance,
    };
  });

  const readyCount = docs.filter((d) => d.ready).length;
  const missingCount = docs.filter((d) => !d.isHeld).length;
  const expiredCount = docs.filter((d) => d.isExpired).length;

  return {
    readyCount,
    totalRequired: docs.length,
    isComplete: readyCount === docs.length,
    missingCount,
    expiredCount,
    documents: docs,
    missingDocuments: docs.filter((d) => !d.isHeld),
    expiredDocuments: docs.filter((d) => d.isExpired),
  };
}

function getRenewalGuidance(docId, docName) {
  switch (docId) {
    case 'DOC-INC':
      return 'Income certificates in India are valid for 1 fiscal year (April 1 to March 31). Visit your state e-Seva / Nadakacheri / MeeSeva portal or local Tahsildar office with salary slips or Form 16 to renew.';
    case 'DOC-CASTE':
      return 'Caste certificates are generally permanent, but OBC Non-Creamy Layer (NCL) certificates expire annually. Apply for NCL renewal on your state revenue portal with current year income certificate.';
    case 'DOC-BON':
      return 'Bonafide & fee receipts must be renewed every academic semester/year. Request an updated certificate stamped by your Dean / College Registrar.';
    case 'DOC-LAND':
      return 'Land records (RTC / Khatauni) must reflect current mutation status. Fetch latest digitized Pahani / Record of Rights from Bhoomi / Bhulekh portal.';
    default:
      return `Certificate for '${docName}' has expired. Submit a re-verification application on your state portal or visit the issuing department desk.`;
  }
}

function evaluateScheme(scheme, profile, evaluationDate) {
  const activeVersion = getActiveVersionForDate(scheme.versions, evaluationDate);
  if (!activeVersion) {
    return {
      schemeId: scheme.id,
      schemeName: scheme.name,
      eligible: false,
      appliedVersion: 0,
      matchScore: 0,
      failedReasons: ['No active policy version found for the evaluation date.'],
      remediations: ['Check scheme launch timeline or contact scheme administrator.'],
      criteriaBreakdown: [],
      conditions: [],
    };
  }

  const { eligible, criterionEvaluations } = evaluateRules(activeVersion.rules, profile);
  const passedCount = criterionEvaluations.filter((c) => c.passed).length;
  const totalConditions = criterionEvaluations.length;
  const matchScore = totalConditions > 0
    ? Math.round((passedCount / totalConditions) * 100)
    : 100;

  const failedReasons = criterionEvaluations.filter((c) => !c.passed).map((c) => c.reason);
  const remediations = criterionEvaluations.filter((c) => !c.passed && c.remediation).map((c) => c.remediation);

  return {
    schemeId: scheme.id,
    schemeName: scheme.name,
    department: scheme.department,
    ministry: scheme.ministry,
    stateOrCentral: scheme.stateOrCentral,
    state: scheme.state,
    isNew: scheme.isNew,
    benefitSummary: scheme.benefitSummary,
    description: scheme.description,
    sourceUrl: scheme.sourceUrl,
    verifiedGovDomain: scheme.verifiedGovDomain,
    isGovVerified: scheme.isGovVerified,
    eligible,
    appliedVersion: activeVersion.version,
    effectiveDate: activeVersion.effectiveDate,
    matchScore,
    passedCount,
    totalConditions,
    failedReasons,
    remediations,
    conditions: criterionEvaluations,
    criteriaBreakdown: criterionEvaluations,
  };
}

module.exports = {
  compare,
  evaluateRuleCondition,
  evaluateRules,
  getActiveVersionForDate,
  evaluateDocumentReadiness,
  evaluateScheme,
};
