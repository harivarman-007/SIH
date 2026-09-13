import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Lock,
  Mail,
  ArrowRight,
  Eye,
  EyeOff,
  AlertCircle,
  Loader2,
  Users,
  KeyRound,
  Building2,
  HardHat,
  Scale,
  Briefcase,
  Settings,
  BarChart3,
} from 'lucide-react';
import { useAuthStore, DEMO_CREDENTIALS, DemoCredential } from '../store/authStore';

const ROLE_ICONS: Record<string, React.ElementType> = {
  super_admin: Settings,
  corporate_management: BarChart3,
  mine_official: Building2,
  inspector: HardHat,
  contractor: Briefcase,
  regulator: Scale,
};

export const LoginForm: React.FC = () => {
  const { loginWithCredentials, isLoading, error, clearError } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    clearError();

    if (!email.trim() || !password.trim()) {
      setLocalError('Please enter both email and password.');
      return;
    }

    try {
      await loginWithCredentials(email.trim(), password.trim());
    } catch (err: any) {
      // Error message is stored in authStore, but keep local fallback
      setLocalError(err?.message || 'Authentication failed');
    }
  };

  const handleSelectDemoPersona = async (cred: DemoCredential) => {
    setEmail(cred.email);
    setPassword(cred.password);
    setLocalError(null);
    clearError();
    try {
      await loginWithCredentials(cred.email, cred.password);
    } catch (err: any) {
      setLocalError(err?.message || 'Authentication failed');
    }
  };

  const displayError = localError || error;

  return (
    <div className="min-h-screen bg-zinc-50 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 selection:bg-black selection:text-white">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        {/* Team & System Branding (No Government Emblem) */}
        <div className="flex justify-center mb-4">
          <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-black text-white shadow-md font-mono font-bold text-lg tracking-wider">
            IF
          </div>
        </div>
        <h1 className="text-center text-2xl font-bold tracking-tight text-zinc-900">
          INTELLIFUSION
        </h1>
        <p className="mt-1 text-center text-xs text-zinc-500 font-mono tracking-wide">
          Smart Governance & Compliance Monitoring System • SIH26024
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-6 shadow-sm border border-zinc-200 rounded-3xl sm:px-8">
          
          {/* Main Credential Login Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-zinc-700 mb-1.5">
                Work Email
              </label>
              <div className="relative rounded-xl shadow-sm">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-zinc-400">
                  <Mail className="h-4 w-4" />
                </div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (displayError) {
                      setLocalError(null);
                      clearError();
                    }
                  }}
                  placeholder="name@mine.in"
                  disabled={isLoading}
                  autoComplete="email"
                  className="block w-full rounded-xl border border-zinc-200 pl-10 pr-3 py-2.5 text-xs text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-black focus:border-black transition-all bg-zinc-50/50"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-700 mb-1.5">
                Password
              </label>
              <div className="relative rounded-xl shadow-sm">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-zinc-400">
                  <Lock className="h-4 w-4" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (displayError) {
                      setLocalError(null);
                      clearError();
                    }
                  }}
                  placeholder="••••••••••••"
                  disabled={isLoading}
                  autoComplete="current-password"
                  className="block w-full rounded-xl border border-zinc-200 pl-10 pr-10 py-2.5 text-xs text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-black focus:border-black transition-all bg-zinc-50/50"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-zinc-400 hover:text-zinc-600 transition-colors"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Error Message Banner */}
            {displayError && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 flex items-start gap-2.5 text-xs"
              >
                <AlertCircle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <span className="font-semibold block">Authentication Error</span>
                  <span className="text-[11px] text-rose-700 break-words">{displayError}</span>
                </div>
              </motion.div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-semibold text-white bg-black hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-black transition-all shadow-sm disabled:opacity-60 disabled:cursor-not-allowed mt-2 cursor-pointer"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Authenticating…</span>
                </>
              ) : (
                <>
                  <span>Sign In</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </>
              )}
            </button>
          </form>

          {/* Separately Labeled Demo Persona Switcher (For Evaluation Only) */}
          <div className="mt-8 pt-6 border-t border-zinc-200">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-1.5 text-zinc-800">
                <Users className="h-3.5 w-3.5 text-zinc-500" />
                <span className="text-xs font-bold uppercase tracking-wider text-zinc-700">
                  Demo Persona Switcher
                </span>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200/60 font-medium">
                SIH Jury / Evaluation Only
              </span>
            </div>
            <p className="text-[11px] text-zinc-500 leading-relaxed mb-3">
              Select a seeded evaluation persona below to auto-authenticate with that role's real scope and permissions:
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {Object.entries(DEMO_CREDENTIALS).map(([key, cred]) => {
                const IconComponent = ROLE_ICONS[cred.role] || KeyRound;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => handleSelectDemoPersona(cred)}
                    disabled={isLoading}
                    className="flex items-start gap-2 p-2.5 rounded-xl border border-zinc-200 hover:border-black hover:bg-zinc-50/70 text-left transition-all group disabled:opacity-50"
                  >
                    <div className="p-1.5 rounded-lg bg-zinc-100 group-hover:bg-black group-hover:text-white text-zinc-600 transition-colors shrink-0 mt-0.5">
                      <IconComponent className="h-3.5 w-3.5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-semibold text-zinc-900 group-hover:text-black truncate">
                        {cred.title}
                      </div>
                      <div className="text-[10px] text-zinc-500 truncate font-mono">
                        {cred.email}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-6 text-center">
            <p className="text-[10px] text-zinc-400 font-mono">
              Intellifusion RBAC • Fail-Closed Scope Verification Enabled
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
