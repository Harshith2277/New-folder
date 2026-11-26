import React, { useState } from 'react';
import { UserCheck, ShieldCheck, Scale, ArrowRight, UserPlus, LogIn, AlertCircle, Eye, EyeOff } from 'lucide-react';
import { api } from '../api';

export default function LoginPage({ onLogin }) {
  const [mode, setMode] = useState('login'); // 'login' or 'register'
  const [role, setRole] = useState('citizen'); // 'citizen' or 'officer'

  // Auth fields
  const [username, setUsername] = useState('rohan');
  const [password, setPassword] = useState('pass123');
  const [fullName, setFullName] = useState('Rohan Kulkarni');
  const [showPassword, setShowPassword] = useState(false);

  // Citizen Profile Parameters
  const [age, setAge] = useState(26);
  const [annualIncome, setAnnualIncome] = useState(240000);
  const [category, setCategory] = useState('OBC');
  const [location, setLocation] = useState('Urban');
  const [occupation, setOccupation] = useState('Unemployed');
  const [state, setState] = useState('Karnataka');
  const [syntheticId, setSyntheticId] = useState('SYN-KA-2026-8841');

  // Officer fields
  const [officerBadge, setOfficerBadge] = useState('OFF-DESH-409');

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg(null);
    setLoading(true);

    try {
      if (mode === 'register') {
        const payload = {
          username,
          password,
          role,
          fullName,
          syntheticId: role === 'citizen' ? syntheticId : officerBadge,
          age: Number(age),
          annualIncome: Number(annualIncome),
          category,
          location,
          occupation,
          state,
        };
        const res = await api.register(payload);
        if (res.token) {
          localStorage.setItem('schemesaathi_token', res.token);
        }
        onLogin({
          role: res.user.role.toLowerCase(),
          user: res.user,
          token: res.token,
        });
      } else {
        const res = await api.login({ username, password });
        if (res.token) {
          localStorage.setItem('schemesaathi_token', res.token);
        }
        onLogin({
          role: res.user.role.toLowerCase(),
          user: res.user,
          token: res.token,
        });
      }
    } catch (err) {
      setErrorMsg(err.message || 'Authentication error.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 flex flex-col justify-center items-center px-4 py-8">
      {/* Brand Logo & Intro */}
      <div className="text-center max-w-md mb-6">
        <div className="inline-flex items-center justify-center bg-indigo-600 text-white p-3 rounded-2xl shadow-lg mb-3">
          <Scale className="w-8 h-8" />
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
          SchemeSaathi
        </h1>
        <p className="text-slate-300 text-xs sm:text-sm mt-1">
          Indian Government Welfare Eligibility & Governance Platform
        </p>
      </div>

      {/* Main Login/Register Card */}
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-100 max-w-lg w-full p-6 sm:p-8 transition-all">
        {/* Toggle Login vs Register */}
        <div className="flex bg-slate-100 p-1.5 rounded-2xl mb-4">
          <button
            type="button"
            onClick={() => {
              setMode('login');
              setErrorMsg(null);
            }}
            className={`flex-1 py-2 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 transition ${
              mode === 'login' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-600'
            }`}
          >
            <LogIn className="w-3.5 h-3.5" />
            <span>Login</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('register');
              setErrorMsg(null);
            }}
            className={`flex-1 py-2 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 transition ${
              mode === 'register' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-600'
            }`}
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>Register Account</span>
          </button>
        </div>

        {/* Role Toggle Selector */}
        <div className="flex bg-slate-100/70 p-1 rounded-xl mb-4">
          <button
            type="button"
            onClick={() => setRole('citizen')}
            className={`flex-1 py-2 rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 transition ${
              role === 'citizen' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600'
            }`}
          >
            <UserCheck className="w-3.5 h-3.5" />
            Citizen Portal
          </button>
          <button
            type="button"
            onClick={() => setRole('officer')}
            className={`flex-1 py-2 rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 transition ${
              role === 'officer' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-600'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            Officer Admin
          </button>
        </div>

        {errorMsg && (
          <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5">
          {/* Common Account Credentials */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Username</label>
            <input
              type="text"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="e.g. rohan or officer_deshmukh"
              className="w-full text-xs sm:text-sm rounded-xl border border-slate-200 bg-slate-50/60 p-2.5 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500 transition"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Password</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 4 characters"
                className="w-full text-xs sm:text-sm rounded-xl border border-slate-200 bg-slate-50/60 p-2.5 pr-20 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500 transition"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1 text-[11px] font-bold text-slate-500 hover:text-indigo-600 bg-white/80 border border-slate-200 px-2 py-1 rounded-lg transition"
              >
                {showPassword ? (
                  <>
                    <EyeOff className="w-3.5 h-3.5" />
                    <span>Hide</span>
                  </>
                ) : (
                  <>
                    <Eye className="w-3.5 h-3.5" />
                    <span>Show</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {mode === 'register' && (
            <>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Full Legal Name</label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="e.g. Rohan Kulkarni"
                  className="w-full text-xs sm:text-sm rounded-xl border border-slate-200 bg-slate-50/60 p-2.5 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500 transition"
                />
              </div>

              {role === 'citizen' ? (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Age</label>
                      <input
                        type="number"
                        required
                        value={age}
                        onChange={(e) => setAge(e.target.value)}
                        className="w-full text-xs sm:text-sm rounded-xl border border-slate-200 bg-slate-50/60 p-2.5 outline-none focus:bg-white transition"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Annual Income (₹)</label>
                      <input
                        type="number"
                        required
                        value={annualIncome}
                        onChange={(e) => setAnnualIncome(e.target.value)}
                        className="w-full text-xs sm:text-sm rounded-xl border border-slate-200 bg-slate-50/60 p-2.5 outline-none focus:bg-white transition"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Category</label>
                      <select
                        value={category}
                        onChange={(e) => setCategory(e.target.value)}
                        className="w-full text-xs rounded-xl border border-slate-200 bg-slate-50/60 p-2.5 outline-none focus:bg-white transition"
                      >
                        <option value="General">General</option>
                        <option value="OBC">OBC</option>
                        <option value="SC">SC</option>
                        <option value="ST">ST</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Location</label>
                      <select
                        value={location}
                        onChange={(e) => setLocation(e.target.value)}
                        className="w-full text-xs rounded-xl border border-slate-200 bg-slate-50/60 p-2.5 outline-none focus:bg-white transition"
                      >
                        <option value="Urban">Urban</option>
                        <option value="Rural">Rural</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">State</label>
                      <select
                        value={state}
                        onChange={(e) => setState(e.target.value)}
                        className="w-full text-xs rounded-xl border border-slate-200 bg-slate-50/60 p-2.5 outline-none focus:bg-white transition"
                      >
                        <option value="Karnataka">Karnataka</option>
                        <option value="Maharashtra">Maharashtra</option>
                        <option value="Tamil Nadu">Tamil Nadu</option>
                        <option value="Delhi">Delhi</option>
                        <option value="Uttar Pradesh">Uttar Pradesh</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Occupation</label>
                    <select
                      value={occupation}
                      onChange={(e) => setOccupation(e.target.value)}
                      className="w-full text-xs rounded-xl border border-slate-200 bg-slate-50/60 p-2.5 outline-none focus:bg-white transition"
                    >
                      <option value="Unemployed">Unemployed</option>
                      <option value="Student">Student</option>
                      <option value="Farmer">Farmer</option>
                      <option value="Self-Employed">Self-Employed</option>
                      <option value="Salaried">Salaried</option>
                    </select>
                  </div>
                </>
              ) : (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Officer Badge / ID</label>
                  <input
                    type="text"
                    value={officerBadge}
                    onChange={(e) => setOfficerBadge(e.target.value)}
                    className="w-full text-xs sm:text-sm rounded-xl border border-slate-200 bg-slate-50/60 p-2.5 outline-none focus:bg-white font-mono transition"
                  />
                </div>
              )}
            </>
          )}

          <button
            type="submit"
            disabled={loading}
            className={`w-full mt-4 text-white font-bold py-3 px-4 rounded-xl text-sm flex items-center justify-center gap-2 shadow-md transition ${
              role === 'citizen' ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-emerald-600 hover:bg-emerald-700'
            }`}
          >
            <span>{loading ? 'Authenticating...' : mode === 'register' ? 'Create Account & Enter' : 'Sign In'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>
      </div>

      <p className="text-slate-400 text-xs mt-6 text-center">
        SchemeSaathi &bull; Database-Backed Authentication & Verified Indian Government Feeds
      </p>
    </div>
  );
}
