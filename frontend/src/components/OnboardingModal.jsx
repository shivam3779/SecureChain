import { useState, useEffect } from 'react';
import { api } from '../lib/api';

const TEAM_CATEGORIES = [
  'FinTech & Banking',
  'Cybersecurity & Defense',
  'E-Commerce & SaaS',
  'Open Source Initiative',
  'Cloud Infrastructure',
  'HealthTech & Data',
];

const SECURITY_POLICIES = [
  { id: 'Strict Zero-Trust (Block P0/P1)', label: 'Strict Zero-Trust', desc: 'Block High & Critical threats' },
  { id: 'Standard OWASP Compliance', label: 'Standard OWASP', desc: 'Warn on High, block Critical' },
  { id: 'Audit & Advisory Only', label: 'Audit Only', desc: 'Non-blocking reports' },
];

export default function OnboardingModal({ onComplete }) {
  // Navigation steps: 'choose' | 'solo-form' | 'team-choose' | 'team-search' | 'team-create' | 'request-sent'
  const [step, setStep] = useState('choose');

  // Solo state
  const [projectTitle, setProjectTitle] = useState('');
  const [projectIntro, setProjectIntro] = useState('');

  // Team Create state
  const [teamName, setTeamName] = useState('');
  const [projectName, setProjectName] = useState('');
  const [projectDescription, setProjectDescription] = useState('');
  const [category, setCategory] = useState('FinTech & Banking');
  const [securityPolicy, setSecurityPolicy] = useState('Strict Zero-Trust (Block P0/P1)');

  // Team Search / Join state
  const [searchQuery, setSearchQuery] = useState('');
  const [availableTeams, setAvailableTeams] = useState([]);
  const [searching, setSearching] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [requestNote, setRequestNote] = useState('');
  const [inviteToken, setInviteToken] = useState('');
  const [useTokenMode, setUseTokenMode] = useState(false);
  const [sentOrgName, setSentOrgName] = useState('');

  // UI state
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  // Fetch directory of teams when entering team-search step
  useEffect(() => {
    if (step === 'team-search') {
      loadTeams('');
    }
  }, [step]);

  async function loadTeams(q) {
    setSearching(true);
    try {
      const teams = await api.searchTeams(q);
      setAvailableTeams(teams || []);
    } catch {
      setAvailableTeams([]);
    } finally {
      setSearching(false);
    }
  }

  // Handle Solo submission
  async function submitSolo() {
    if (!projectTitle.trim()) {
      return setErr('Please enter a project title');
    }
    setLoading(true);
    setErr('');
    try {
      const res = await api.completeOnboarding({
        mode: 'solo',
        projectTitle: projectTitle.trim(),
        projectIntro: projectIntro.trim(),
        primaryStack: 'Node.js (npm)',
        scanFrequency: 'realtime',
      });
      onComplete({ mode: 'solo', soloProject: res.soloProject });
    } catch (e) {
      setErr(e.message || 'Failed to complete solo setup');
    } finally {
      setLoading(false);
    }
  }

  // Handle Create Team submission
  async function submitCreateTeam() {
    if (!teamName.trim()) return setErr('Please enter a team workspace name');
    if (!projectName.trim()) return setErr('Please enter your primary project name');

    setLoading(true);
    setErr('');
    try {
      const res = await api.completeOnboarding({
        mode: 'team_create',
        teamName: teamName.trim(),
        projectName: projectName.trim(),
        projectDescription: projectDescription.trim(),
        category,
        securityPolicy,
      });
      onComplete({ mode: 'team', org: res.org });
    } catch (e) {
      setErr(e.message || 'Failed to create team workspace');
    } finally {
      setLoading(false);
    }
  }

  // Handle Join Team Request
  async function submitJoinRequest() {
    if (useTokenMode) {
      const token = inviteToken.trim().split('/').pop();
      if (!token) return setErr('Please enter a valid invite token or link');
      setLoading(true);
      setErr('');
      try {
        const result = await api.acceptInvite(token);
        onComplete({ mode: 'team', org: result.org });
      } catch (e) {
        setErr(e.message || 'Invalid or expired invite token');
      } finally {
        setLoading(false);
      }
      return;
    }

    if (!selectedTeam) return setErr('Please select a team from the list to join');

    setLoading(true);
    setErr('');
    try {
      await api.requestJoinTeam(selectedTeam.id, requestNote.trim());
      setSentOrgName(selectedTeam.name);
      setStep('request-sent');
    } catch (e) {
      setErr(e.message || 'Failed to transmit join request');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-xl bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden text-slate-900">

        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <img src="/logo.png" alt="SecureChain Logo" className="w-12 h-12 object-contain" />
            <div>
              <h2 className="text-sm font-bold text-slate-900 font-['Space_Grotesk'] flex items-center gap-2">
                SecureChain Setup
              </h2>
            </div>
          </div>

          {step !== 'choose' && step !== 'request-sent' && (
            <button
              onClick={() => {
                setErr('');
                if (step === 'solo-form' || step === 'team-choose') setStep('choose');
                else if (step === 'team-search' || step === 'team-create') setStep('team-choose');
              }}
              className="text-xs text-slate-400 hover:text-slate-900 transition-colors flex items-center gap-1 font-medium cursor-pointer"
            >
              ← Back
            </button>
          )}
        </div>

        {/* Content Body */}
        <div className="p-6">

          {/* ════════════════ Step 1: Mode Selection (Solo vs Team) ════════════════ */}
          {step === 'choose' && (
            <div className="space-y-5">
              <div className="text-center max-w-sm mx-auto">
                <h3 className="text-lg font-bold text-slate-900 font-['Space_Grotesk']">Choose Workspace</h3>
                <p className="text-xs text-slate-500 mt-1">Select how you want to manage your project</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Solo Developer Option */}
                <button
                  onClick={() => { setStep('solo-form'); setErr(''); }}
                  className="text-left p-5 rounded-xl border border-slate-200 bg-white hover:border-slate-400 hover:shadow-sm transition-all group flex flex-col justify-between cursor-pointer"
                >
                  <div>
                    <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center text-lg mb-3 group-hover:bg-slate-200 transition-colors">
                      👤
                    </div>
                    <h4 className="text-sm font-bold text-slate-900 font-['Space_Grotesk']">Solo Developer</h4>
                    <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                      Personal project scans.
                    </p>
                  </div>
                  <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-semibold text-slate-900">
                    <span>Continue</span>
                    <span>→</span>
                  </div>
                </button>

                {/* Team Workspace Option */}
                <button
                  onClick={() => { setStep('team-choose'); setErr(''); }}
                  className="text-left p-5 rounded-xl border border-slate-200 bg-white hover:border-slate-400 hover:shadow-sm transition-all group flex flex-col justify-between cursor-pointer"
                >
                  <div>
                    <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center text-lg mb-3 group-hover:bg-slate-200 transition-colors">
                      👥
                    </div>
                    <h4 className="text-sm font-bold text-slate-900 font-['Space_Grotesk']">Team Workspace</h4>
                    <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                      Collaborative scanning.
                    </p>
                  </div>
                  <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-semibold text-slate-900">
                    <span>Continue</span>
                    <span>→</span>
                  </div>
                </button>
              </div>

              {err && (
                <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-700 font-medium">
                  {err}
                </div>
              )}
            </div>
          )}

          {/* ════════════════ Step 2A: Solo Developer Configuration ════════════════ */}
          {step === 'solo-form' && (
            <div className="space-y-4">
              <div>
                <h3 className="text-base font-bold text-slate-900 font-['Space_Grotesk']">Project Setup</h3>
                <p className="text-xs text-slate-500">Configure your primary audited application</p>
              </div>

              <div>
                <label className="text-xs font-medium text-slate-700 block mb-1">Project Title</label>
                <input
                  type="text"
                  value={projectTitle}
                  onChange={(e) => { setProjectTitle(e.target.value); setErr(''); }}
                  placeholder="e.g. auth-service"
                  className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-slate-800 transition-colors shadow-xs"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-slate-700 block mb-1">Project Description</label>
                <textarea
                  rows={3}
                  value={projectIntro}
                  onChange={(e) => setProjectIntro(e.target.value)}
                  placeholder="Brief application description"
                  className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-slate-800 transition-colors resize-none shadow-xs"
                />
              </div>

              {err && (
                <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-700 font-medium">
                  {err}
                </div>
              )}

              <div className="pt-2">
                <button
                  onClick={submitSolo}
                  disabled={loading || !projectTitle.trim()}
                  className="w-full py-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold text-xs shadow-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  {loading ? 'Initializing...' : 'Launch Dashboard →'}
                </button>
              </div>
            </div>
          )}

          {/* ════════════════ Step 2B: Team Option Choice ════════════════ */}
          {step === 'team-choose' && (
            <div className="space-y-5">
              <div className="text-center max-w-sm mx-auto">
                <h3 className="text-lg font-bold text-slate-900 font-['Space_Grotesk']">Team Workspace</h3>
                <p className="text-xs text-slate-500 mt-1">Join an existing organization or start a new workspace</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Path 1: Join Existing Team */}
                <button
                  onClick={() => { setStep('team-search'); setErr(''); }}
                  className="text-left p-5 rounded-xl border border-slate-200 bg-white hover:border-slate-400 hover:shadow-sm transition-all group flex flex-col justify-between cursor-pointer"
                >
                  <div>
                    <div className="w-10 h-10 rounded-lg bg-slate-100 text-slate-800 flex items-center justify-center text-lg mb-3">
                      🔍
                    </div>
                    <h4 className="text-sm font-bold text-slate-900 font-['Space_Grotesk']">Join Existing Team</h4>
                    <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                      Find your organization directory and request access.
                    </p>
                  </div>
                  <div className="mt-5 pt-3 border-t border-slate-100 font-semibold text-xs text-slate-900 flex items-center justify-between">
                    <span>Find Team</span>
                    <span>→</span>
                  </div>
                </button>

                {/* Path 2: Create New Team */}
                <button
                  onClick={() => { setStep('team-create'); setErr(''); }}
                  className="text-left p-5 rounded-xl border border-slate-200 bg-white hover:border-slate-400 hover:shadow-sm transition-all group flex flex-col justify-between cursor-pointer"
                >
                  <div>
                    <div className="w-10 h-10 rounded-lg bg-slate-100 text-slate-800 flex items-center justify-center text-lg mb-3">
                      ⚡
                    </div>
                    <h4 className="text-sm font-bold text-slate-900 font-['Space_Grotesk']">Create New Team</h4>
                    <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                      Set up policies, projects, and manage team access.
                    </p>
                  </div>
                  <div className="mt-5 pt-3 border-t border-slate-100 font-semibold text-xs text-slate-900 flex items-center justify-between">
                    <span>Create Team</span>
                    <span>→</span>
                  </div>
                </button>
              </div>
            </div>
          )}

          {/* ════════════════ Step 3B-Join: Search & Join Team ════════════════ */}
          {step === 'team-search' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-slate-900 font-['Space_Grotesk']">Find Team</h3>
                  <p className="text-xs text-slate-500">Search directory or enter an invite token</p>
                </div>

                <button
                  onClick={() => setUseTokenMode(!useTokenMode)}
                  className="text-xs text-slate-600 underline hover:text-slate-900 transition-opacity font-medium cursor-pointer"
                >
                  {useTokenMode ? 'Directory' : 'Use Token'}
                </button>
              </div>

              {/* Mode A: Directory Search */}
              {!useTokenMode ? (
                <div className="space-y-3">
                  <div className="relative">
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => {
                        setSearchQuery(e.target.value);
                        loadTeams(e.target.value);
                      }}
                      placeholder="Search organizations..."
                      className="w-full bg-white border border-slate-200 rounded-lg pl-9 pr-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-slate-800 shadow-xs"
                    />
                    <span className="absolute left-3 top-2 text-slate-400 text-xs">🔍</span>
                  </div>

                  <div className="max-h-44 overflow-y-auto space-y-1.5 pr-1">
                    {searching ? (
                      <div className="text-center py-6 text-xs text-slate-400">Searching...</div>
                    ) : availableTeams.length === 0 ? (
                      <div className="text-center py-6 text-xs text-slate-400 border border-dashed border-slate-200 rounded-lg">
                        No teams found.
                      </div>
                    ) : (
                      availableTeams.map((t) => (
                        <div
                          key={t.id}
                          onClick={() => { setSelectedTeam(t); setErr(''); }}
                          className={`p-3 rounded-lg border text-left cursor-pointer transition-all ${selectedTeam?.id === t.id
                            ? 'border-slate-900 bg-slate-50'
                            : 'border-slate-200 bg-white hover:border-slate-300'
                            }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2.5">
                              <div className="w-7 h-7 rounded bg-slate-900 text-white flex items-center justify-center font-bold text-xs">
                                {t.name.slice(0, 2).toUpperCase()}
                              </div>
                              <div>
                                <p className="text-xs font-bold text-slate-900 font-['Space_Grotesk']">{t.name}</p>
                                <p className="text-[10px] text-slate-400">{t.category}</p>
                              </div>
                            </div>
                            <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-medium">
                              {t.memberCount} member{t.memberCount !== 1 ? 's' : ''}
                            </span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  {selectedTeam && (
                    <input
                      type="text"
                      value={requestNote}
                      onChange={(e) => setRequestNote(e.target.value)}
                      placeholder={`Optional note to ${selectedTeam.name} Admin...`}
                      className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-slate-800 shadow-xs"
                    />
                  )}

                  {err && (
                    <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-700 font-medium">
                      {err}
                    </div>
                  )}

                  <button
                    onClick={submitJoinRequest}
                    disabled={loading || !selectedTeam}
                    className="w-full py-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold text-xs transition-all shadow-xs cursor-pointer"
                  >
                    {loading ? 'Submitting...' : `Request to Join ${selectedTeam ? selectedTeam.name : 'Team'} →`}
                  </button>
                </div>
              ) : (
                /* Mode B: Direct Invite Token */
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-medium text-slate-700 mb-1 block">Invite Token</label>
                    <input
                      type="text"
                      value={inviteToken}
                      onChange={(e) => { setInviteToken(e.target.value); setErr(''); }}
                      placeholder="Paste token or link"
                      className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-900 font-mono focus:outline-none focus:border-slate-800 shadow-xs"
                    />
                  </div>

                  {err && (
                    <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-700 font-medium">
                      {err}
                    </div>
                  )}

                  <button
                    onClick={submitJoinRequest}
                    disabled={loading || !inviteToken.trim()}
                    className="w-full py-2.5 rounded-lg bg-slate-900 text-white font-semibold text-xs hover:bg-slate-800 transition-all shadow-xs cursor-pointer disabled:opacity-40"
                  >
                    {loading ? 'Verifying...' : 'Join Workspace →'}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ════════════════ Step 3B-Create: Create New Team ════════════════ */}
          {step === 'team-create' && (
            <div className="space-y-4">
              <div>
                <h3 className="text-base font-bold text-slate-900 font-['Space_Grotesk']">Create Workspace</h3>
                <p className="text-xs text-slate-500">Configure team name and default security policies</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-slate-700 block mb-1">Organization Name *</label>
                  <input
                    type="text"
                    value={teamName}
                    onChange={(e) => { setTeamName(e.target.value); setErr(''); }}
                    placeholder="e.g. Acme Corp"
                    className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-slate-800 shadow-xs"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-slate-700 block mb-1">Industry</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-slate-800 shadow-xs cursor-pointer font-medium"
                  >
                    {TEAM_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-slate-700 block mb-1">Initial Project *</label>
                  <input
                    type="text"
                    value={projectName}
                    onChange={(e) => { setProjectName(e.target.value); setErr(''); }}
                    placeholder="e.g. payment-service"
                    className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-slate-800 shadow-xs"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-slate-700 block mb-1">Security Standard</label>
                  <select
                    value={securityPolicy}
                    onChange={(e) => setSecurityPolicy(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-slate-800 shadow-xs cursor-pointer font-medium"
                  >
                    {SECURITY_POLICIES.map((sp) => (
                      <option key={sp.id} value={sp.id}>{sp.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-slate-700 block mb-1">Description (optional)</label>
                <input
                  type="text"
                  value={projectDescription}
                  onChange={(e) => setProjectDescription(e.target.value)}
                  placeholder="Short workspace description"
                  className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-slate-800 shadow-xs"
                />
              </div>

              {err && (
                <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-700 font-medium">
                  {err}
                </div>
              )}

              <div className="pt-2">
                <button
                  onClick={submitCreateTeam}
                  disabled={loading || !teamName.trim() || !projectName.trim()}
                  className="w-full py-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs disabled:opacity-40 disabled:cursor-not-allowed shadow-xs transition-all cursor-pointer"
                >
                  {loading ? 'Creating...' : 'Create Workspace →'}
                </button>
              </div>
            </div>
          )}

          {/* ════════════════ Step 4: Request Sent Confirmation ════════════════ */}
          {step === 'request-sent' && (
            <div className="text-center py-5 space-y-3">
              <div className="w-12 h-12 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center justify-center text-2xl mx-auto">
                ✓
              </div>
              <h3 className="text-base font-bold text-slate-900 font-['Space_Grotesk']">Request Sent</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto leading-relaxed">
                Your request to join <strong className="text-slate-800 font-semibold">{sentOrgName}</strong> is pending admin approval.
              </p>

              <div className="pt-2 flex justify-center">
                <button
                  onClick={() => onComplete({ mode: 'pending_request' })}
                  className="px-5 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs transition-colors shadow-xs cursor-pointer"
                >
                  Open Dashboard (Read-Only)
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
