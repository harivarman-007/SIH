import React, { useEffect, useState } from 'react';
import {
  Plus,
  Search,
  X,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import {
  fetchComplianceRules,
  createComplianceRule,
  updateComplianceRule,
  ComplianceRule,
} from '../api/admin';

export const ComplianceRulesView: React.FC = () => {
  const [rules, setRules] = useState<ComplianceRule[]>([]);
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Form state for new rule modal
  const [newCategory, setNewCategory] = useState<string>('safety');
  const [newCode, setNewCode] = useState<string>('');
  const [newDescription, setNewDescription] = useState<string>('');
  const [newSeverity, setNewSeverity] = useState<string>('high');
  const [newStatutoryRef, setNewStatutoryRef] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);

  const loadRules = async () => {
    try {
      setLoading(true);
      const data = await fetchComplianceRules();
      setRules(data);
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err?.response?.data?.detail?.message || 'Failed to load statutory compliance rules.',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRules();
  }, []);

  const handleToggleActive = async (rule: ComplianceRule) => {
    try {
      const updated = await updateComplianceRule(rule.id, { is_active: !rule.is_active });
      setRules((prev) => prev.map((r) => (r.id === rule.id ? updated : r)));
      setFeedback({
        type: 'success',
        message: `Regulation '${rule.code}' is now ${updated.is_active ? 'ACTIVE' : 'INACTIVE'}.`,
      });
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err?.response?.data?.detail?.message || 'Failed to update rule status.',
      });
    }
  };

  const handleCreateRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCode.trim() || !newDescription.trim()) return;

    try {
      setSubmitting(true);
      const created = await createComplianceRule({
        category: newCategory,
        code: newCode.trim().toUpperCase(),
        description: newDescription.trim(),
        default_severity: newSeverity,
        statutory_ref: newStatutoryRef.trim() || undefined,
      });
      setRules((prev) => [created, ...prev]);
      setIsModalOpen(false);
      setNewCode('');
      setNewDescription('');
      setNewStatutoryRef('');
      setFeedback({
        type: 'success',
        message: `Statutory regulation '${created.code}' registered successfully.`,
      });
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err?.response?.data?.detail?.message || 'Failed to register statutory rule.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const filteredRules = rules.filter((r) => {
    const matchesCat = categoryFilter === 'all' || r.category === categoryFilter;
    const matchesSearch =
      r.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (r.statutory_ref && r.statutory_ref.toLowerCase().includes(searchTerm.toLowerCase()));
    return matchesCat && matchesSearch;
  });

  const catColors: Record<string, string> = {
    safety: 'bg-rose-50 text-rose-700 border-rose-200',
    environment: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    labour: 'bg-blue-50 text-blue-700 border-blue-200',
    production: 'bg-purple-50 text-purple-700 border-purple-200',
  };

  return (
    <div className="w-full space-y-6 text-slate-900">
      {/* Header */}
      <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
            DGMS Statutory Compliance / Regulatory Registry
          </div>
          <h1 className="text-xl font-bold text-slate-900 mt-1">Compliance Regulations Catalogue</h1>
          <p className="text-xs text-slate-500 mt-1">
            Directorate General of Mines Safety (DGMS) statutory standards and enforcement rules
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsModalOpen(true)}
          className="px-4 py-2.5 rounded-xl bg-blue-800 hover:bg-blue-700 text-white font-semibold text-xs shadow-xs transition-colors flex items-center gap-2 cursor-pointer self-start sm:self-auto shrink-0"
        >
          <Plus className="size-4" />
          <span>Add Regulation</span>
        </button>
      </div>

      {feedback && (
        <div
          className={`p-4 rounded-xl text-xs font-medium border flex items-center justify-between ${
            feedback.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
              : 'bg-rose-50 border-rose-200 text-rose-700'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === 'success' ? (
              <CheckCircle2 className="size-4 shrink-0 text-emerald-600" />
            ) : (
              <AlertCircle className="size-4 shrink-0 text-rose-600" />
            )}
            <span>{feedback.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="text-slate-400 hover:text-slate-700 cursor-pointer ml-3"
          >
            <X className="size-3.5" />
          </button>
        </div>
      )}

      {/* Filters & Search */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch">
        <div className="flex-1 relative">
          <Search className="size-4 text-slate-400 absolute left-4 top-3 pointer-events-none" />
          <input
            type="text"
            placeholder="Search regulations by code, keyword, or CMR reference…"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-white border border-slate-200 rounded-xl pl-11 pr-10 py-2.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-700 shadow-2xs transition-colors"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm('')}
              className="absolute right-3.5 top-2.5 text-xs text-slate-400 hover:text-slate-700 cursor-pointer"
            >
              Clear
            </button>
          )}
        </div>

        <div className="flex gap-1.5 p-1 bg-slate-100 border border-slate-200 rounded-xl overflow-x-auto text-xs shrink-0 items-center">
          {['all', 'safety', 'environment', 'labour', 'production'].map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setCategoryFilter(cat)}
              className={`px-3.5 py-1.5 rounded-lg font-semibold capitalize text-xs transition-colors cursor-pointer ${
                categoryFilter === cat
                  ? 'bg-blue-800 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Rules Table */}
      <div className="rounded-2xl bg-white border border-slate-200 shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-16 text-center text-slate-400 text-xs flex items-center justify-center gap-2">
            <RefreshCw className="size-4 animate-spin text-blue-700" />
            <span>Loading statutory regulations...</span>
          </div>
        ) : filteredRules.length === 0 ? (
          <div className="p-16 text-center text-slate-400 text-xs">
            No compliance regulations matching filter criteria.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredRules.map((rule) => {
              return (
                <div
                  key={rule.id}
                  className="p-5 px-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50/70 transition-colors"
                >
                  <div className="space-y-2 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs font-bold text-blue-900 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-md">
                        {rule.code}
                      </span>
                      <span
                        className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded border ${
                          catColors[rule.category] || 'bg-slate-100 text-slate-700 border-slate-200'
                        }`}
                      >
                        {rule.category}
                      </span>
                      {rule.statutory_ref && (
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                          {rule.statutory_ref}
                        </span>
                      )}
                      <span className="text-xs text-slate-400 capitalize">
                        Severity: <strong className="text-slate-700 font-semibold">{rule.default_severity}</strong>
                      </span>
                    </div>

                    <p className="text-xs text-slate-700 leading-relaxed font-normal">{rule.description}</p>
                  </div>

                  <div className="flex items-center gap-3 self-end sm:self-center shrink-0">
                    <span
                      className={`text-xs font-semibold ${
                        rule.is_active ? 'text-emerald-700' : 'text-slate-400'
                      }`}
                    >
                      {rule.is_active ? 'Active' : 'Inactive'}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleToggleActive(rule)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${
                        rule.is_active ? 'bg-emerald-600' : 'bg-slate-300'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-xs transition-transform ${
                          rule.is_active ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Add Regulation Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-white border border-slate-200 rounded-2xl p-6 space-y-4 shadow-2xl text-slate-900">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700">CMR 2017 Framework</span>
                <h2 className="text-base font-bold text-slate-900 mt-0.5">Register Statutory Regulation</h2>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 cursor-pointer p-1 rounded-lg hover:bg-slate-100"
              >
                <X className="size-4" />
              </button>
            </div>

            <form onSubmit={handleCreateRule} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Regulation Code</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. DGMS-CMR-2017-133"
                  value={newCode}
                  onChange={(e) => setNewCode(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 font-mono focus:border-blue-700 focus:bg-white focus:outline-none transition-colors"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Category</label>
                  <select
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 focus:border-blue-700 focus:bg-white focus:outline-none transition-colors"
                  >
                    <option value="safety">Safety</option>
                    <option value="environment">Environment</option>
                    <option value="labour">Labour</option>
                    <option value="production">Production</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Default Severity</label>
                  <select
                    value={newSeverity}
                    onChange={(e) => setNewSeverity(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 focus:border-blue-700 focus:bg-white focus:outline-none transition-colors"
                  >
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Statutory Reference</label>
                <input
                  type="text"
                  placeholder="e.g. Coal Mines Regulations 2017, Regulation 133(1)"
                  value={newStatutoryRef}
                  onChange={(e) => setNewStatutoryRef(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 focus:border-blue-700 focus:bg-white focus:outline-none transition-colors"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Regulation Description</label>
                <textarea
                  required
                  rows={3}
                  placeholder="Describe the compliance requirement and inspection criteria…"
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 focus:border-blue-700 focus:bg-white focus:outline-none transition-colors"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-xl bg-blue-800 hover:bg-blue-700 text-white font-semibold shadow-xs cursor-pointer disabled:opacity-50"
                >
                  {submitting ? 'Registering…' : 'Save Regulation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
