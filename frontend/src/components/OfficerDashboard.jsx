import React, { useState, useEffect } from 'react';
import {
  Shield,
  History,
  Save,
  CheckCircle,
  Lock,
  FileSpreadsheet,
  PlusCircle,
  Check,
  Columns,
  GitCompare,
  AlertCircle,
  RefreshCw,
  Globe2,
  ExternalLink,
} from 'lucide-react';
import { api } from '../api';

export default function OfficerDashboard({ initialOfficer }) {
  const [schemes, setSchemes] = useState([]);
  const [selectedSchemeId, setSelectedSchemeId] = useState('');
  const [versions, setVersions] = useState([]);
  const [officerName, setOfficerName] = useState(
    initialOfficer?.officerName || 'Officer S. Deshmukh'
  );
  const [effectiveDate, setEffectiveDate] = useState('2026-07-01');
  const [changeNote, setChangeNote] = useState('Updated eligibility thresholds via Admin Rule Editor.');
  const [ruleJsonText, setRuleJsonText] = useState('');
  const [applications, setApplications] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [banner, setBanner] = useState(null);
  const [syncLoading, setSyncLoading] = useState(false);

  // Side-by-side comparison version selectors
  const [compareV1, setCompareV1] = useState(1);
  const [compareV2, setCompareV2] = useState(1);

  const loadData = async (schemeId = selectedSchemeId) => {
    try {
      const schemesRes = await api.getSchemes();
      const schemeList = schemesRes.schemes || [];
      setSchemes(schemeList);

      const activeSchemeId = schemeId || (schemeList[0] ? schemeList[0].id : '');
      if (!selectedSchemeId && activeSchemeId) {
        setSelectedSchemeId(activeSchemeId);
      }

      const [versionsRes, appsRes, logsRes] = await Promise.all([
        activeSchemeId ? api.getSchemeVersions(activeSchemeId) : Promise.resolve({ versions: [] }),
        api.getApplications('officer', officerName),
        api.getAuditLogs(),
      ]);

      const verList = versionsRes.versions || [];
      setVersions(verList);
      setApplications(appsRes.applications || []);
      setAuditLogs(logsRes.logs || []);

      if (verList.length >= 2) {
        setCompareV1(verList[verList.length - 2].version);
        setCompareV2(verList[verList.length - 1].version);
      } else if (verList.length === 1) {
        setCompareV1(verList[0].version);
        setCompareV2(verList[0].version);
      }

      const latest = verList[verList.length - 1];
      if (latest) {
        setRuleJsonText(JSON.stringify(latest.rules, null, 2));
      }
    } catch (err) {
      setBanner({ type: 'error', text: err.message });
    }
  };

  useEffect(() => {
    loadData(selectedSchemeId);
  }, [selectedSchemeId]);

  const handleSyncGovFeeds = async () => {
    setSyncLoading(true);
    setBanner(null);
    try {
      const res = await api.syncGovSchemes(officerName);
      setBanner({
        type: 'success',
        text: `Indian Gov Scheme Ingestion Complete: ${res.ingestedCount} new schemes ingested, ${res.updatedCount} versions amended, ${res.rejectedCount} non-gov sources blocked.`,
      });
      await loadData();
    } catch (err) {
      setBanner({ type: 'error', text: err.message });
    } finally {
      setSyncLoading(false);
    }
  };

  const handlePublishNewVersion = async () => {
    setBanner(null);
    let parsedRules;
    try {
      parsedRules = JSON.parse(ruleJsonText);
    } catch (e) {
      setBanner({ type: 'error', text: 'Invalid JSON syntax in Rule Editor.' });
      return;
    }

    try {
      const res = await api.updateSchemeRules(selectedSchemeId, {
        rules: parsedRules,
        effectiveDate,
        officerName,
        changeNote,
      });
      setBanner({ type: 'success', text: res.message });
      loadData(selectedSchemeId);
    } catch (err) {
      setBanner({ type: 'error', text: err.message });
    }
  };

  const handleApplicationDecision = async (appId, newStatus) => {
    try {
      await api.updateApplicationStatus(appId, {
        status: newStatus,
        officerName,
        officerRemarks: `${newStatus} by ${officerName} on ${new Date().toLocaleDateString()}`,
      });
      setBanner({ type: 'success', text: `Application ${appId} marked as ${newStatus}.` });
      loadData(selectedSchemeId);
    } catch (err) {
      setBanner({ type: 'error', text: err.message });
    }
  };

  const v1Obj = versions.find((v) => v.version === Number(compareV1)) || versions[0];
  const v2Obj = versions.find((v) => v.version === Number(compareV2)) || versions[versions.length - 1];

  return (
    <div className="space-y-6">
      {/* Alert banner */}
      {banner && (
        <div
          className={`p-3.5 rounded-xl border text-xs sm:text-sm font-medium ${
            banner.type === 'error'
              ? 'bg-rose-50 border-rose-200 text-rose-800'
              : 'bg-emerald-50 border-emerald-200 text-emerald-800'
          }`}
        >
          {banner.text}
        </div>
      )}

      {/* Top Controls Bar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="bg-emerald-100 text-emerald-800 p-2 rounded-xl shrink-0">
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm sm:text-base font-bold text-slate-900">
              Department Policy & Application Governance
            </h2>
            <p className="text-xs text-slate-500">
              Verified Indian Government Feeds, Audit Trails, and Versioned Rule Governance.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Sync Button */}
          <button
            onClick={handleSyncGovFeeds}
            disabled={syncLoading}
            className="flex items-center gap-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 px-3 py-1.5 rounded-lg text-xs font-bold transition shadow-sm"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${syncLoading ? 'animate-spin' : ''}`} />
            <span>{syncLoading ? 'Ingesting...' : 'Sync Gov Feeds'}</span>
          </button>

          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-0.5">Logged In Officer</label>
            <input
              type="text"
              value={officerName}
              onChange={(e) => setOfficerName(e.target.value)}
              className="text-xs font-semibold bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 focus:bg-white outline-none"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-0.5">Select Scheme</label>
            <select
              value={selectedSchemeId}
              onChange={(e) => setSelectedSchemeId(e.target.value)}
              className="text-xs font-semibold bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 focus:bg-white outline-none max-w-xs truncate"
            >
              {schemes.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.id} - {s.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Side-by-Side Version Comparison Card */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3 mb-4">
          <div className="flex items-center gap-2">
            <GitCompare className="w-5 h-5 text-indigo-600 shrink-0" />
            <div>
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
                Side-by-Side Policy Rule Version Comparison
              </h3>
              <p className="text-xs text-slate-500">
                Compare older vs newer policy rules. Existing applications remain bound to the rule version active when submitted.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 text-xs">
              <span className="font-semibold text-slate-500">Left:</span>
              <select
                value={compareV1}
                onChange={(e) => setCompareV1(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-xs font-bold"
              >
                {versions.map((v) => (
                  <option key={v.version} value={v.version}>
                    v{v.version} ({v.effectiveDate})
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-1.5 text-xs">
              <span className="font-semibold text-slate-500">Right:</span>
              <select
                value={compareV2}
                onChange={(e) => setCompareV2(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-xs font-bold"
              >
                {versions.map((v) => (
                  <option key={v.version} value={v.version}>
                    v{v.version} ({v.effectiveDate})
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Comparison Split Columns */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Left Version */}
          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-900 text-xs">
                Version {v1Obj?.version} ({v1Obj?.status})
              </span>
              <span className="text-[11px] text-slate-500 font-mono">
                Effective: {v1Obj?.effectiveDate}
              </span>
            </div>
            <p className="text-xs text-slate-600 italic">"{v1Obj?.changeNote}"</p>
            <div className="text-[10px] text-slate-500">By {v1Obj?.updatedBy}</div>
            <div className="mt-2 pt-2 border-t border-slate-200">
              <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                Rule Tree JSON:
              </span>
              <pre className="text-[11px] font-mono bg-white p-2.5 rounded-lg border border-slate-200 overflow-x-auto max-h-48 text-slate-700">
                {JSON.stringify(v1Obj?.rules, null, 2)}
              </pre>
            </div>
          </div>

          {/* Right Version */}
          <div className="p-4 rounded-xl border border-indigo-200 bg-indigo-50/30 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-indigo-950 text-xs">
                Version {v2Obj?.version} ({v2Obj?.status})
              </span>
              <span className="text-[11px] text-indigo-700 font-mono font-semibold">
                Effective: {v2Obj?.effectiveDate}
              </span>
            </div>
            <p className="text-xs text-slate-600 italic">"{v2Obj?.changeNote}"</p>
            <div className="text-[10px] text-slate-500">By {v2Obj?.updatedBy}</div>
            <div className="mt-2 pt-2 border-t border-indigo-100">
              <span className="block text-[10px] font-bold uppercase tracking-wider text-indigo-700 mb-1">
                Rule Tree JSON:
              </span>
              <pre className="text-[11px] font-mono bg-white p-2.5 rounded-lg border border-indigo-200 overflow-x-auto max-h-48 text-slate-700">
                {JSON.stringify(v2Obj?.rules, null, 2)}
              </pre>
            </div>
          </div>
        </div>
      </div>

      {/* 2-Column Responsive Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Rule Version Publisher & Editor */}
        <div className="lg:col-span-6 space-y-6">
          {/* New Rule Version Publisher */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide flex items-center gap-1.5 mb-2">
              <PlusCircle className="w-4 h-4 text-indigo-600" />
              <span>Publish Next Rule Version for {selectedSchemeId}</span>
            </h3>
            <p className="text-xs text-slate-500 mb-3">
              Existing approved applications remain immutably locked to their historical version.
            </p>

            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Effective Date
                  </label>
                  <input
                    type="date"
                    value={effectiveDate}
                    onChange={(e) => setEffectiveDate(e.target.value)}
                    className="w-full text-xs rounded-xl border border-slate-200 bg-slate-50/50 p-2 focus:bg-white outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Change Summary Note
                  </label>
                  <input
                    type="text"
                    value={changeNote}
                    onChange={(e) => setChangeNote(e.target.value)}
                    className="w-full text-xs rounded-xl border border-slate-200 bg-slate-50/50 p-2 focus:bg-white outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Rule JSON Tree Definition
                </label>
                <textarea
                  rows={8}
                  value={ruleJsonText}
                  onChange={(e) => setRuleJsonText(e.target.value)}
                  className="w-full font-mono text-xs rounded-xl border border-slate-200 bg-slate-50/50 p-2.5 focus:bg-white outline-none"
                />
              </div>

              <button
                onClick={handlePublishNewVersion}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 px-4 rounded-xl text-xs flex items-center justify-center gap-1.5 transition shadow-sm"
              >
                <Save className="w-3.5 h-3.5" />
                Publish Policy Rule Version
              </button>
            </div>
          </div>
        </div>

        {/* Right: Applications Queue & Decision */}
        <div className="lg:col-span-6 space-y-6">
          {/* Applications Queue */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide flex items-center gap-1.5 mb-3">
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              <span>Pending Applications ({applications.length})</span>
            </h3>

            {applications.length === 0 ? (
              <p className="text-xs text-slate-500 py-6 text-center">
                No citizen applications received yet.
              </p>
            ) : (
              <div className="space-y-3">
                {applications.map((app) => (
                  <div
                    key={app.id}
                    className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2 text-xs"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-slate-800">{app.id}</span>
                        <span className="font-semibold text-slate-900">&bull; {app.citizenName}</span>
                      </div>
                      <span
                        className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                          app.status === 'APPROVED'
                            ? 'bg-emerald-100 text-emerald-800'
                            : app.status === 'REJECTED'
                            ? 'bg-rose-100 text-rose-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {app.status}
                      </span>
                    </div>

                    <div className="text-[11px] text-slate-600 flex flex-wrap gap-x-3 gap-y-1">
                      <span><strong>Scheme:</strong> {app.schemeName}</span>
                      <span><strong>Locked Rule:</strong> Version {app.appliedVersion}</span>
                      <span><strong>Eval Date:</strong> {app.evaluationDate}</span>
                    </div>

                    <div className="flex items-center gap-2 pt-2 border-t border-slate-200">
                      <button
                        onClick={() => handleApplicationDecision(app.id, 'APPROVED')}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-3 py-1.5 rounded-lg text-xs flex items-center gap-1 transition"
                      >
                        <Check className="w-3 h-3" /> Approve
                      </button>
                      <button
                        onClick={() => handleApplicationDecision(app.id, 'REJECTED')}
                        className="bg-rose-600 hover:bg-rose-700 text-white font-bold px-3 py-1.5 rounded-lg text-xs transition"
                      >
                        Reject
                      </button>
                      <button
                        onClick={() => handleApplicationDecision(app.id, 'UNDER_REVIEW')}
                        className="bg-slate-200 hover:bg-slate-300 text-slate-800 font-semibold px-3 py-1.5 rounded-lg text-xs transition"
                      >
                        Review
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Audit Trail */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide flex items-center gap-1.5 mb-3">
              <Lock className="w-4 h-4 text-slate-600" />
              <span>Immutable Officer Audit Trail</span>
            </h3>

            <div className="max-h-60 overflow-y-auto space-y-1.5 pr-1">
              {auditLogs.slice(0, 15).map((log) => (
                <div
                  key={log.id}
                  className="p-2 rounded-lg bg-slate-50 border border-slate-100 text-[11px] flex items-start justify-between gap-2"
                >
                  <div>
                    <span className="font-bold text-slate-800">{log.action}: </span>
                    <span className="text-slate-600">{log.details}</span>
                  </div>
                  <span className="text-[10px] text-slate-400 shrink-0">
                    {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
