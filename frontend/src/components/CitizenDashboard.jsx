import React, { useState, useEffect } from 'react';
import {
  CheckCircle2,
  XCircle,
  FileCheck2,
  Send,
  Calendar,
  AlertTriangle,
  ArrowRight,
  RefreshCw,
  FolderCheck,
  Clock,
  Sparkles,
  Info,
  Check,
  Layers,
  FileText,
  User,
  ShieldCheck,
  ExternalLink,
  Building2,
  Upload,
  AlertCircle,
  Edit,
  Eye,
  Filter,
  FileUp,
} from 'lucide-react';
import { api } from '../api';

const ALL_DOC_TYPES = [
  { id: 'DOC-ID', name: 'Aadhaar / National ID', digilocker: true },
  { id: 'DOC-INC', name: 'Annual Income Certificate', digilocker: true },
  { id: 'DOC-EDU', name: 'Educational / Marksheet / Diploma', digilocker: true },
  { id: 'DOC-LAND', name: 'Land Record (RTC / Khatauni / RoR)', digilocker: true },
  { id: 'DOC-CASTE', name: 'Category / Caste Certificate', digilocker: true },
  { id: 'DOC-BANK', name: 'Bank Passbook Copy', digilocker: false },
  { id: 'DOC-BON', name: 'Bonafide Certificate / Fee Receipt', digilocker: false },
  { id: 'DOC-PROJ', name: 'Business Project Proposal', digilocker: false },
];

export default function CitizenDashboard({ initialProfile }) {
  const [profile, setProfile] = useState(
    initialProfile || {
      citizenName: 'Rohan Kulkarni',
      syntheticId: 'SYN-KA-2026-8841',
      age: 26,
      annualIncome: 240000,
      category: 'OBC',
      location: 'Urban',
      occupation: 'Unemployed',
      state: 'Karnataka',
    }
  );

  // Tabs: 'schemes' vs 'applied' vs 'wallet'
  const [activeTab, setActiveTab] = useState('schemes');

  // Scheme Filters: filterMode ('all', 'new', 'state') & selectedState
  const [filterMode, setFilterMode] = useState('all');
  const [filterState, setFilterState] = useState('Karnataka');

  const [evaluationDate, setEvaluationDate] = useState('2026-05-15');
  const [availableDocs, setAvailableDocs] = useState([
    { id: 'DOC-ID', docTypeId: 'DOC-ID', name: 'Aadhaar Card' },
    { id: 'DOC-INC', docTypeId: 'DOC-INC', name: 'Income Certificate', expiryDate: '2026-03-31' }, // expired sample to demonstrate renewal
  ]);

  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [results, setResults] = useState([]);
  const [alternatives, setAlternatives] = useState([]);
  const [selectedIneligibleScheme, setSelectedIneligibleScheme] = useState(null);
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(false);
  const [statusBanner, setStatusBanner] = useState(null);

  // PDF Upload Modal State
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadDocType, setUploadDocType] = useState('DOC-INC');
  const [uploadIssueDate, setUploadIssueDate] = useState('2026-04-01');
  const [uploadExpiryDate, setUploadExpiryDate] = useState('2027-03-31');
  const [uploadFile, setUploadFile] = useState(null);

  // Application Edit Modal State
  const [editingApp, setEditingApp] = useState(null);
  const [editProfileAge, setEditProfileAge] = useState(26);
  const [editProfileIncome, setEditProfileIncome] = useState(240000);
  const [editProfileOccupation, setEditProfileOccupation] = useState('Unemployed');

  const runEligibilityCheck = async (overrideDate) => {
    const targetDate = overrideDate || evaluationDate;
    setLoading(true);
    setStatusBanner(null);
    try {
      const data = await api.checkEligibility({
        profile,
        evaluationDate: targetDate,
        availableDocuments: availableDocs,
      });

      // Filter results on frontend matching the filterMode
      let filteredResults = data.results || [];
      if (filterMode === 'new') {
        filteredResults = filteredResults.filter((r) => r.isNew);
      } else if (filterMode === 'state') {
        filteredResults = filteredResults.filter(
          (r) => r.stateOrCentral === 'Central' || r.state === filterState
        );
      }
      setResults(filteredResults);

      const firstFailed = (data.results || []).find((r) => !r.eligible);
      if (firstFailed) {
        setSelectedIneligibleScheme(firstFailed);
        const altData = await api.getAlternatives({
          profile,
          excludedSchemeId: firstFailed.schemeId,
          evaluationDate: targetDate,
        });
        setAlternatives(altData.alternatives || []);
      } else {
        setSelectedIneligibleScheme(null);
        setAlternatives([]);
      }
    } catch (err) {
      setStatusBanner({ type: 'error', text: err.message });
    } finally {
      setLoading(false);
    }
  };

  const loadApplications = async () => {
    try {
      const data = await api.getApplications('citizen', '', profile?.id || '');
      setApplications(data.applications || []);
    } catch (err) {
      console.error(err);
    }
  };

  const loadUploadedDocs = async () => {
    try {
      const data = await api.getDocuments(profile?.id || '');
      setUploadedFiles(data.documents || []);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    runEligibilityCheck();
    loadApplications();
    loadUploadedDocs();
  }, [filterMode, filterState]);

  const handleSimulateDigiLocker = () => {
    const digiDocs = ALL_DOC_TYPES.filter((d) => d.digilocker).map((d) => ({
      id: d.id,
      docTypeId: d.id,
      name: d.name,
      expiryDate: '2028-12-31', // Valid
    }));

    const existingIds = new Set(availableDocs.map((d) => d.docTypeId || d.id));
    const merged = [...availableDocs];
    digiDocs.forEach((d) => {
      if (!existingIds.has(d.docTypeId)) merged.push(d);
    });

    setAvailableDocs(merged);
    setStatusBanner({
      type: 'success',
      text: 'Simulated DigiLocker Vault Sync: Fetched and verified 5 digital certificates.',
    });
    setTimeout(() => runEligibilityCheck(), 150);
  };

  const handleUploadSubmit = async (e) => {
    e.preventDefault();
    try {
      const formData = new FormData();
      formData.append('userId', profile?.id || 'citizen');
      formData.append('docTypeId', uploadDocType);
      const docTypeObj = ALL_DOC_TYPES.find((d) => d.id === uploadDocType);
      formData.append('docName', docTypeObj?.name || uploadDocType);
      formData.append('issueDate', uploadIssueDate);
      formData.append('expiryDate', uploadExpiryDate);

      if (uploadFile) {
        formData.append('document', uploadFile);
      } else {
        // Fallback simulated PDF buffer if user doesn't pick file from disk
        const blob = new Blob(['%PDF-1.4 Simulated valid PDF content'], { type: 'application/pdf' });
        formData.append('document', blob, `${uploadDocType}-document.pdf`);
      }

      const res = await api.uploadDocumentPdf(formData);
      setStatusBanner({
        type: 'success',
        text: `PDF Document (${res.document.name}) uploaded successfully and added to wallet.`,
      });

      // Update available docs in wallet with valid expiry date
      setAvailableDocs((prev) => [
        ...prev.filter((d) => (d.docTypeId || d.id) !== uploadDocType),
        {
          id: res.document.id,
          docTypeId: uploadDocType,
          name: res.document.name,
          expiryDate: uploadExpiryDate,
        },
      ]);

      setShowUploadModal(false);
      loadUploadedDocs();
      setTimeout(() => runEligibilityCheck(), 150);
    } catch (err) {
      setStatusBanner({ type: 'error', text: err.message });
    }
  };

  const handleApply = async (schemeResult) => {
    try {
      setStatusBanner(null);
      const res = await api.submitApplication({
        userId: profile?.id || null,
        citizenName: profile.citizenName,
        syntheticId: profile.syntheticId,
        profile,
        schemeId: schemeResult.schemeId,
        evaluationDate,
        submittedDocuments: availableDocs,
      });
      setStatusBanner({
        type: 'success',
        text: `Application submitted successfully for ${schemeResult.schemeName} (Locked to Rule v${res.application.appliedVersion})!`,
      });
      await loadApplications();
      setActiveTab('applied');
    } catch (err) {
      setStatusBanner({ type: 'error', text: err.message });
    }
  };

  const handleOpenEdit = (app) => {
    setEditingApp(app);
    setEditProfileAge(app.snapshotProfile.age);
    setEditProfileIncome(app.snapshotProfile.annualIncome);
    setEditProfileOccupation(app.snapshotProfile.occupation);
  };

  const handleSaveEditApplication = async (e) => {
    e.preventDefault();
    if (!editingApp) return;

    try {
      const updatedProfile = {
        ...editingApp.snapshotProfile,
        age: Number(editProfileAge),
        annualIncome: Number(editProfileIncome),
        occupation: editProfileOccupation,
      };

      const res = await api.editApplication(editingApp.id, {
        citizenName: editingApp.citizenName,
        profile: updatedProfile,
        submittedDocuments: editingApp.submittedDocuments,
      });

      setStatusBanner({
        type: 'success',
        text: `Application ${editingApp.id} updated and successfully re-verified against locked Version ${editingApp.appliedVersion}.`,
      });
      setEditingApp(null);
      await loadApplications();
    } catch (err) {
      setStatusBanner({ type: 'error', text: err.message });
    }
  };

  return (
    <div className="space-y-6">
      {/* Alert Banner */}
      {statusBanner && (
        <div
          className={`p-3.5 rounded-xl border flex items-center justify-between shadow-sm transition ${
            statusBanner.type === 'error'
              ? 'bg-rose-50 border-rose-200 text-rose-800'
              : 'bg-emerald-50 border-emerald-200 text-emerald-800'
          }`}
        >
          <span className="text-xs sm:text-sm font-medium">{statusBanner.text}</span>
          <button
            onClick={() => setStatusBanner(null)}
            className="text-xs font-bold underline ml-4 hover:opacity-80"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Main Navigation Tabs */}
      <div className="flex bg-slate-200/80 p-1 rounded-2xl max-w-lg shadow-inner">
        <button
          onClick={() => setActiveTab('schemes')}
          className={`flex-1 py-2 px-3 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 transition ${
            activeTab === 'schemes'
              ? 'bg-white text-indigo-700 shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>Schemes ({results.length})</span>
        </button>
        <button
          onClick={() => setActiveTab('wallet')}
          className={`flex-1 py-2 px-3 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 transition ${
            activeTab === 'wallet'
              ? 'bg-white text-sky-700 shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <FolderCheck className="w-4 h-4" />
          <span>Document Wallet ({availableDocs.length})</span>
        </button>
        <button
          onClick={() => setActiveTab('applied')}
          className={`flex-1 py-2 px-3 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 transition ${
            activeTab === 'applied'
              ? 'bg-white text-emerald-700 shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>Applied ({applications.length})</span>
        </button>
      </div>

      {/* VIEW 1: SCHEMES & ELIGIBILITY */}
      {activeTab === 'schemes' && (
        <div className="space-y-6 animate-fadeIn">
          {/* Temporal Rule Version Simulator Preset Bar */}
          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-indigo-600 shrink-0" />
              <div>
                <span className="text-xs sm:text-sm font-bold text-slate-900 block">
                  Temporal Rule Versioning Simulator (Citizen Age: {profile.age})
                </span>
                <span className="text-[11px] text-slate-500">
                  PM Internship Scheme max age was 24 in v1 and raised to 28 in v2 (eff: 2026-06-01).
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => {
                  setEvaluationDate('2026-05-15');
                  runEligibilityCheck('2026-05-15');
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${
                  evaluationDate === '2026-05-15'
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                1. Before Amendment (2026-05-15 &bull; v1 Max 24)
              </button>
              <button
                onClick={() => {
                  setEvaluationDate('2026-06-15');
                  runEligibilityCheck('2026-06-15');
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${
                  evaluationDate === '2026-06-15'
                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                2. After Amendment (2026-06-15 &bull; v2 Max 28)
              </button>
            </div>
          </div>

          {/* Scheme Filters: All, New, State-Wise */}
          <div className="bg-slate-100/70 p-2 rounded-2xl flex flex-wrap items-center justify-between gap-3 border border-slate-200">
            <div className="flex items-center gap-1.5">
              <Filter className="w-4 h-4 text-slate-500 ml-1" />
              <span className="text-xs font-bold text-slate-700 mr-2">Filter Schemes:</span>
              <button
                onClick={() => setFilterMode('all')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                  filterMode === 'all'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                All Schemes
              </button>
              <button
                onClick={() => setFilterMode('new')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1 ${
                  filterMode === 'new'
                    ? 'bg-amber-600 text-white shadow-sm'
                    : 'bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                <Sparkles className="w-3 h-3 text-amber-300" />
                <span>New Schemes Only</span>
              </button>
              <button
                onClick={() => setFilterMode('state')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                  filterMode === 'state'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                State-Wise
              </button>
            </div>

            {filterMode === 'state' && (
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-600">State:</span>
                <select
                  value={filterState}
                  onChange={(e) => setFilterState(e.target.value)}
                  className="bg-white border border-slate-300 text-xs font-bold rounded-lg px-2.5 py-1 outline-none"
                >
                  <option value="Karnataka">Karnataka</option>
                  <option value="Maharashtra">Maharashtra</option>
                  <option value="Tamil Nadu">Tamil Nadu</option>
                  <option value="Delhi">Delhi</option>
                </select>
              </div>
            )}
          </div>

          {/* 2-Column Responsive Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left: Profile Parameters Form */}
            <div className="lg:col-span-4 space-y-6">
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
                <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wide mb-3 flex items-center gap-1.5">
                  <User className="w-4 h-4 text-indigo-600" />
                  <span>Profile Parameters</span>
                </h2>

                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Full Name</label>
                    <input
                      type="text"
                      value={profile.citizenName}
                      onChange={(e) => setProfile({ ...profile, citizenName: e.target.value })}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-sm focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">Age</label>
                      <input
                        type="number"
                        value={profile.age}
                        onChange={(e) => setProfile({ ...profile, age: Number(e.target.value) })}
                        className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-sm focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">Annual Income (₹)</label>
                      <input
                        type="number"
                        value={profile.annualIncome}
                        onChange={(e) =>
                          setProfile({ ...profile, annualIncome: Number(e.target.value) })
                        }
                        className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-sm focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">Category</label>
                      <select
                        value={profile.category}
                        onChange={(e) => setProfile({ ...profile, category: e.target.value })}
                        className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-sm focus:bg-white outline-none transition"
                      >
                        <option value="General">General</option>
                        <option value="OBC">OBC</option>
                        <option value="SC">SC</option>
                        <option value="ST">ST</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">State</label>
                      <select
                        value={profile.state}
                        onChange={(e) => setProfile({ ...profile, state: e.target.value })}
                        className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-sm focus:bg-white outline-none transition"
                      >
                        <option value="Karnataka">Karnataka</option>
                        <option value="Maharashtra">Maharashtra</option>
                        <option value="Tamil Nadu">Tamil Nadu</option>
                        <option value="Delhi">Delhi</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">Occupation</label>
                      <select
                        value={profile.occupation}
                        onChange={(e) => setProfile({ ...profile, occupation: e.target.value })}
                        className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-sm focus:bg-white outline-none transition"
                      >
                        <option value="Unemployed">Unemployed</option>
                        <option value="Student">Student</option>
                        <option value="Farmer">Farmer</option>
                        <option value="Self-Employed">Self-Employed</option>
                        <option value="Salaried">Salaried</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">Evaluation Date</label>
                      <input
                        type="date"
                        value={evaluationDate}
                        onChange={(e) => setEvaluationDate(e.target.value)}
                        className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-sm focus:bg-white outline-none transition"
                      />
                    </div>
                  </div>

                  <button
                    onClick={() => runEligibilityCheck()}
                    disabled={loading}
                    className="w-full mt-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2.5 px-4 rounded-xl text-sm flex items-center justify-center gap-2 transition shadow-sm"
                  >
                    <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                    {loading ? 'Evaluating...' : 'Re-Check Eligibility'}
                  </button>
                </div>
              </div>
            </div>

            {/* Right: Evaluated Schemes (Eligible first) */}
            <div className="lg:col-span-8 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <span>Welfare Schemes (Sorted by Eligibility)</span>
                  <span className="text-xs bg-indigo-100 text-indigo-800 font-bold px-2 py-0.5 rounded-full">
                    {results.length} Matching
                  </span>
                </h2>
                <span className="text-xs text-slate-500">
                  Target Date: <strong className="text-slate-700">{evaluationDate}</strong>
                </span>
              </div>

              {/* Scheme Cards */}
              <div className="space-y-4">
                {results.map((item) => (
                  <div
                    key={item.schemeId}
                    className={`bg-white rounded-2xl shadow-sm border p-5 transition hover:shadow-md ${
                      item.eligible ? 'border-emerald-200/80 bg-emerald-50/10' : 'border-slate-200'
                    }`}
                  >
                    {/* Header */}
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                      <div className="space-y-1.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={`text-xs font-bold px-2.5 py-0.5 rounded-full inline-flex items-center gap-1 ${
                              item.eligible
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-rose-100 text-rose-800'
                            }`}
                          >
                            {item.eligible ? (
                              <>
                                <Check className="w-3 h-3" /> Eligible
                              </>
                            ) : (
                              <>
                                <XCircle className="w-3 h-3" /> Not Eligible ({item.matchScore}% Match)
                              </>
                            )}
                          </span>

                          {item.isNew && (
                            <span className="text-[10px] font-extrabold uppercase bg-amber-500 text-white px-2 py-0.5 rounded-full shadow-xs">
                              NEW
                            </span>
                          )}

                          <span className="text-[11px] bg-slate-100 text-slate-700 border border-slate-200 font-semibold px-2 py-0.5 rounded-md">
                            {item.stateOrCentral === 'State' ? `State: ${item.state}` : 'Central Scheme'}
                          </span>

                          <span className="text-xs text-slate-500 font-medium">
                            Version {item.appliedVersion} (Eff: {item.effectiveDate})
                          </span>
                        </div>

                        <h3 className="text-base font-bold text-slate-900">{item.schemeName}</h3>
                        <p className="text-xs text-slate-500 flex items-center gap-1.5">
                          <Building2 className="w-3.5 h-3.5 text-slate-400" />
                          <span>{item.department || item.ministry}</span>
                        </p>
                        <p className="text-xs font-medium text-indigo-700">{item.benefitSummary}</p>
                      </div>

                      <div className="flex flex-col sm:items-end gap-2 shrink-0">
                        {item.eligible && (
                          <button
                            onClick={() => handleApply(item)}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-4 py-2.5 rounded-xl flex items-center gap-1.5 shadow-sm transition"
                          >
                            <Send className="w-3.5 h-3.5" />
                            Apply Now
                          </button>
                        )}
                        {item.sourceUrl && (
                          <a
                            href={item.sourceUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[11px] text-slate-500 hover:text-indigo-600 flex items-center gap-1 font-medium transition"
                          >
                            <span>Official Portal</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                      </div>
                    </div>

                    {/* Breakdown */}
                    <div className="mt-4 pt-3 border-t border-slate-100">
                      <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                        Rule Evaluation ({item.passedCount ?? 0}/
                        {item.totalConditions ?? (item.conditions || []).length} Conditions Met)
                      </p>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {(item.conditions || []).map((cond, idx) => (
                          <div
                            key={idx}
                            className={`text-xs p-2.5 rounded-xl border flex items-start gap-2 ${
                              cond.passed
                                ? 'bg-emerald-50/60 border-emerald-200 text-emerald-950'
                                : 'bg-rose-50/70 border-rose-200 text-rose-900 font-medium'
                            }`}
                          >
                            {cond.passed ? (
                              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                            ) : (
                              <XCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                            )}
                            <div>
                              <span>{cond.explanation || cond.reason}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Actionable "How to Qualify" Remediation Steps */}
                    {!item.eligible && (
                      <div className="mt-3 bg-amber-50/80 border border-amber-200 rounded-xl p-3.5 space-y-2">
                        <p className="text-xs font-bold text-amber-950 flex items-center gap-1.5">
                          <Sparkles className="w-4 h-4 text-amber-600 shrink-0" />
                          <span>Actionable "How to Qualify" Guidance:</span>
                        </p>
                        <ul className="list-disc list-inside text-xs text-amber-900 space-y-1">
                          {item.remediations?.map((advice, i) => (
                            <li key={i}>{advice}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Document Readiness & Expired Document Guidance */}
                    {item.documentReadiness && (
                      <div className="mt-3 pt-3 border-t border-slate-100 space-y-2">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="text-xs font-semibold text-slate-600 flex items-center gap-1">
                            <FileCheck2 className="w-3.5 h-3.5 text-slate-500" />
                            Required Documents ({item.documentReadiness.readyCount}/{item.documentReadiness.totalRequired}):
                          </span>
                          <div className="flex flex-wrap items-center gap-1.5">
                            {item.documentReadiness.documents.map((d) => (
                              <span
                                key={d.id}
                                className={`text-[11px] px-2 py-0.5 rounded-md font-medium ${
                                  d.ready
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : d.isExpired
                                    ? 'bg-rose-100 text-rose-800'
                                    : 'bg-amber-100 text-amber-800'
                                }`}
                              >
                                {d.ready ? '✓' : d.isExpired ? '⚠ Expired:' : 'Missing:'} {d.name}
                              </span>
                            ))}
                          </div>
                        </div>

                        {/* Expired Document Step-by-Step Renewal Instructions */}
                        {item.documentReadiness.expiredDocuments?.length > 0 && (
                          <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs space-y-1.5">
                            <p className="font-bold text-rose-900 flex items-center gap-1">
                              <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
                              <span>Document Renewal Required for Submission:</span>
                            </p>
                            {item.documentReadiness.expiredDocuments.map((expDoc) => (
                              <div key={expDoc.id} className="text-[11px] text-rose-800 bg-white/70 p-2 rounded-lg border border-rose-100">
                                <strong>{expDoc.name}:</strong> {expDoc.renewalGuidance}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* VIEW 2: DOCUMENT WALLET & PDF UPLOADS */}
      {activeTab === 'wallet' && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-6 animate-fadeIn">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div>
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <FolderCheck className="w-5 h-5 text-sky-600" />
                <span>Citizen Document Wallet & PDF Manager</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Upload official PDF certificates with issue and expiry dates or sync via simulated DigiLocker.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleSimulateDigiLocker}
                className="bg-sky-50 text-sky-700 hover:bg-sky-100 border border-sky-200 text-xs font-bold px-3 py-2 rounded-xl transition"
              >
                Fetch DigiLocker (Demo)
              </button>
              <button
                onClick={() => setShowUploadModal(true)}
                className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-3.5 py-2 rounded-xl flex items-center gap-1.5 transition shadow-sm"
              >
                <Upload className="w-3.5 h-3.5" />
                Upload PDF Document
              </button>
            </div>
          </div>

          {/* Held / Uploaded Documents Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {ALL_DOC_TYPES.map((dt) => {
              const held = availableDocs.find((d) => (d.docTypeId || d.id) === dt.id);
              const isExpired = held?.expiryDate && new Date(held.expiryDate) < new Date(evaluationDate);

              return (
                <div
                  key={dt.id}
                  className={`p-3.5 rounded-xl border flex flex-col justify-between text-xs transition ${
                    held
                      ? isExpired
                        ? 'bg-rose-50/60 border-rose-200'
                        : 'bg-emerald-50/50 border-emerald-200'
                      : 'bg-slate-50 border-slate-200 text-slate-500'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="font-bold text-slate-900">{dt.name}</span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          held
                            ? isExpired
                              ? 'bg-rose-200 text-rose-900'
                              : 'bg-emerald-200 text-emerald-900'
                            : 'bg-slate-200 text-slate-600'
                        }`}
                      >
                        {held ? (isExpired ? 'Expired' : 'Verified') : 'Not Uploaded'}
                      </span>
                    </div>
                    {held?.expiryDate && (
                      <p className="text-[11px] text-slate-600">
                        Expiry Date: <strong>{held.expiryDate}</strong>
                      </p>
                    )}
                  </div>

                  <div className="mt-3 pt-2 border-t border-slate-200/60 flex items-center justify-between">
                    <span className="text-[10px] text-slate-500 font-mono">{dt.id}</span>
                    <button
                      onClick={() => {
                        setUploadDocType(dt.id);
                        setShowUploadModal(true);
                      }}
                      className="text-[11px] font-semibold text-indigo-600 hover:underline"
                    >
                      {held ? 'Upload New PDF' : 'Upload'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* VIEW 3: APPLIED DETAILS & EDIT APPLICATION */}
      {activeTab === 'applied' && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 animate-fadeIn space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-4">
            <div>
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <FileText className="w-5 h-5 text-emerald-600" />
                <span>My Submitted Scheme Applications</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Permanently locked to the historical policy version active when submitted. You can edit in-review applications.
              </p>
            </div>
            <span className="text-xs font-bold px-3 py-1 rounded-full bg-slate-100 text-slate-700 self-start sm:self-auto">
              Total Applications: {applications.length}
            </span>
          </div>

          {applications.length === 0 ? (
            <div className="text-center py-12 space-y-3">
              <div className="w-12 h-12 bg-slate-100 text-slate-400 rounded-2xl flex items-center justify-center mx-auto">
                <FileText className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-bold text-slate-700">No Applications Submitted Yet</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Browse through the Available Schemes tab, check your eligibility, and click "Apply Now".
              </p>
              <button
                onClick={() => setActiveTab('schemes')}
                className="mt-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-4 py-2 rounded-xl transition shadow-sm"
              >
                Go to Available Schemes
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 uppercase tracking-wider text-[11px]">
                    <th className="py-3 pr-3 font-semibold">Application ID</th>
                    <th className="py-3 pr-3 font-semibold">Scheme Name</th>
                    <th className="py-3 pr-3 font-semibold">Locked Version</th>
                    <th className="py-3 pr-3 font-semibold">Status</th>
                    <th className="py-3 pr-3 font-semibold">Remarks</th>
                    <th className="py-3 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {applications.map((app) => (
                    <tr key={app.id} className="hover:bg-slate-50/70 transition">
                      <td className="py-3 pr-3 font-mono font-bold text-slate-900">{app.id}</td>
                      <td className="py-3 pr-3">
                        <div className="font-bold text-slate-900">{app.schemeName}</div>
                        <div className="text-[11px] text-slate-500">{app.citizenName}</div>
                      </td>
                      <td className="py-3 pr-3">
                        <span className="inline-flex items-center gap-1 font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200/60 px-2 py-0.5 rounded-md text-[11px]">
                          <ShieldCheck className="w-3 h-3 text-indigo-600" />
                          Version {app.appliedVersion}
                        </span>
                      </td>
                      <td className="py-3 pr-3">
                        <span
                          className={`px-2.5 py-1 rounded-full font-bold text-[11px] inline-block ${
                            app.status === 'APPROVED'
                              ? 'bg-emerald-100 text-emerald-800'
                              : app.status === 'REJECTED'
                              ? 'bg-rose-100 text-rose-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {app.status}
                        </span>
                      </td>
                      <td className="py-3 text-slate-700 pr-3">{app.officerRemarks}</td>
                      <td className="py-3 text-right">
                        {app.status !== 'APPROVED' ? (
                          <button
                            onClick={() => handleOpenEdit(app)}
                            className="bg-slate-100 hover:bg-indigo-50 text-indigo-700 px-3 py-1 rounded-lg font-bold text-xs inline-flex items-center gap-1 transition"
                          >
                            <Edit className="w-3 h-3" /> Edit
                          </button>
                        ) : (
                          <span className="text-slate-400 text-[11px] italic">Locked</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* PDF UPLOAD MODAL */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                <FileUp className="w-5 h-5 text-indigo-600" />
                <span>Upload PDF Document</span>
              </h3>
              <button
                onClick={() => setShowUploadModal(false)}
                className="text-slate-400 hover:text-slate-600 font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleUploadSubmit} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Document Type</label>
                <select
                  value={uploadDocType}
                  onChange={(e) => setUploadDocType(e.target.value)}
                  className="w-full text-xs rounded-xl border border-slate-200 bg-slate-50 p-2.5 outline-none"
                >
                  {ALL_DOC_TYPES.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.id} - {d.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">PDF File (.pdf)</label>
                <input
                  type="file"
                  accept=".pdf,application/pdf"
                  onChange={(e) => setUploadFile(e.target.files[0])}
                  className="w-full text-xs text-slate-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
                />
                <p className="text-[10px] text-slate-400 mt-1">If no file selected, a verified sample PDF will be generated.</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Issue Date</label>
                  <input
                    type="date"
                    value={uploadIssueDate}
                    onChange={(e) => setUploadIssueDate(e.target.value)}
                    className="w-full text-xs rounded-xl border border-slate-200 bg-slate-50 p-2 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Expiry Date</label>
                  <input
                    type="date"
                    value={uploadExpiryDate}
                    onChange={(e) => setUploadExpiryDate(e.target.value)}
                    className="w-full text-xs rounded-xl border border-slate-200 bg-slate-50 p-2 outline-none"
                  />
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowUploadModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-sm transition"
                >
                  Upload & Register
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* APPLICATION EDIT MODAL */}
      {editingApp && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                  <Edit className="w-5 h-5 text-indigo-600" />
                  <span>Edit Application {editingApp.id}</span>
                </h3>
                <p className="text-[11px] text-slate-500">
                  Locked Rule Version {editingApp.appliedVersion} of {editingApp.schemeName}
                </p>
              </div>
              <button
                onClick={() => setEditingApp(null)}
                className="text-slate-400 hover:text-slate-600 font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveEditApplication} className="space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Age</label>
                  <input
                    type="number"
                    value={editProfileAge}
                    onChange={(e) => setEditProfileAge(e.target.value)}
                    className="w-full text-xs rounded-xl border border-slate-200 bg-slate-50 p-2 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Annual Income (₹)</label>
                  <input
                    type="number"
                    value={editProfileIncome}
                    onChange={(e) => setEditProfileIncome(e.target.value)}
                    className="w-full text-xs rounded-xl border border-slate-200 bg-slate-50 p-2 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Occupation</label>
                <select
                  value={editProfileOccupation}
                  onChange={(e) => setEditProfileOccupation(e.target.value)}
                  className="w-full text-xs rounded-xl border border-slate-200 bg-slate-50 p-2 outline-none"
                >
                  <option value="Unemployed">Unemployed</option>
                  <option value="Student">Student</option>
                  <option value="Farmer">Farmer</option>
                  <option value="Self-Employed">Self-Employed</option>
                  <option value="Salaried">Salaried</option>
                </select>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingApp(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-sm transition"
                >
                  Verify & Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
