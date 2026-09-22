import React, { useEffect, useState } from 'react';
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

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="p-5 rounded-2xl bg-zinc-900/80 border border-zinc-800 backdrop-blur-xl flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="text-xs uppercase font-bold tracking-wider text-amber-500">
            DGMS Statutory Compliance / Regulatory Registry
          </div>
          <h1 className="text-2xl font-black text-white mt-1">Compliance Regulations Catalogue</h1>
          <p className="text-xs text-zinc-400 mt-0.5">
            Directorate General of Mines Safety (DGMS) statutory standards and enforcement rules
          </p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs shadow-lg shadow-amber-500/20 transition-all cursor-pointer self-start sm:self-auto"
        >
          + Add Regulation
        </button>
      </div>

      {feedback && (
        <div
          className={`p-4 rounded-xl text-xs font-medium border flex items-center justify-between ${
            feedback.type === 'success'
              ? 'bg-emerald-950/40 border-emerald-800 text-emerald-300'
              : 'bg-rose-950/40 border-rose-800 text-rose-300'
          }`}
        >
          <span>{feedback.message}</span>
          <button
            onClick={() => setFeedback(null)}
            className="text-zinc-400 hover:text-white ml-3 font-bold"
          >
            ✕
          </button>
        </div>
      )}

      {/* Filters & Search */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1 relative">
          <input
            type="text"
            placeholder="Search regulations by code, keyword, or CMR reference…"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2.5 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-amber-500"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-3 top-2.5 text-xs text-zinc-400 hover:text-white"
            >
              Clear
            </button>
          )}
        </div>

        <div className="flex gap-1.5 p-1 bg-zinc-900 border border-zinc-800 rounded-xl overflow-x-auto text-xs">
          {['all', 'safety', 'environment', 'labour', 'production'].map((cat) => (
            <button
              key={cat}
              onClick={() => setCategoryFilter(cat)}
              className={`px-3 py-1.5 rounded-lg font-bold capitalize transition-colors cursor-pointer ${
                categoryFilter === cat
                  ? 'bg-amber-500 text-black'
                  : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Rules Table */}
      <div className="rounded-2xl bg-zinc-900/80 border border-zinc-800 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-zinc-400 text-xs">
            <span className="animate-spin mr-2">⟳</span> Loading statutory regulations…
          </div>
        ) : filteredRules.length === 0 ? (
          <div className="p-12 text-center text-zinc-500 text-xs">
            No compliance regulations matching filter criteria.
          </div>
        ) : (
          <div className="divide-y divide-zinc-800/80">
            {filteredRules.map((rule) => {
              const catColors: Record<string, string> = {
                safety: 'bg-rose-950 text-rose-400 border-rose-800',
                environment: 'bg-emerald-950 text-emerald-400 border-emerald-800',
                labour: 'bg-blue-950 text-blue-400 border-blue-800',
                production: 'bg-purple-950 text-purple-400 border-purple-800',
              };

              return (
                <div
                  key={rule.id}
                  className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-zinc-950/40 transition-colors"
                >
                  <div className="space-y-1.5 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs font-bold text-white">{rule.code}</span>
                      <span
                        className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded border ${
                          catColors[rule.category] || 'bg-zinc-800 text-zinc-400 border-zinc-700'
                        }`}
                      >
                        {rule.category}
                      </span>
                      {rule.statutory_ref && (
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-800 text-zinc-300">
                          {rule.statutory_ref}
                        </span>
                      )}
                      <span className="text-[10px] text-zinc-400 capitalize">
                        Severity: {rule.default_severity}
                      </span>
                    </div>

                    <p className="text-xs text-zinc-300">{rule.description}</p>
                  </div>

                  <div className="flex items-center gap-3 self-end sm:self-auto">
                    <span
                      className={`text-[11px] font-semibold ${
                        rule.is_active ? 'text-emerald-400' : 'text-zinc-500'
                      }`}
                    >
                      {rule.is_active ? 'Active' : 'Inactive'}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleToggleActive(rule)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${
                        rule.is_active ? 'bg-amber-500' : 'bg-zinc-800'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-black transition-transform ${
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-white">Register Statutory Regulation</h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-zinc-400 hover:text-white font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateRule} className="space-y-4 text-xs">
              <div>
                <label className="block text-zinc-400 font-bold mb-1">Regulation Code</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. DGMS-CMR-2017-133"
                  value={newCode}
                  onChange={(e) => setNewCode(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-zinc-100 font-mono focus:border-amber-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-zinc-400 font-bold mb-1">Category</label>
                  <select
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-zinc-100 focus:border-amber-500 focus:outline-none"
                  >
                    <option value="safety">Safety</option>
                    <option value="environment">Environment</option>
                    <option value="labour">Labour</option>
                    <option value="production">Production</option>
                  </select>
                </div>

                <div>
                  <label className="block text-zinc-400 font-bold mb-1">Default Severity</label>
                  <select
                    value={newSeverity}
                    onChange={(e) => setNewSeverity(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-zinc-100 focus:border-amber-500 focus:outline-none"
                  >
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-zinc-400 font-bold mb-1">Statutory Reference</label>
                <input
                  type="text"
                  placeholder="e.g. Coal Mines Regulations 2017, Regulation 133(1)"
                  value={newStatutoryRef}
                  onChange={(e) => setNewStatutoryRef(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-zinc-100 focus:border-amber-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-zinc-400 font-bold mb-1">Regulation Description</label>
                <textarea
                  required
                  rows={3}
                  placeholder="Describe the compliance requirement and inspection criteria…"
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-zinc-100 focus:border-amber-500 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold"
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
