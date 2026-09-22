import React, { useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
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
  Clock,
} from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { isDemoMode, DEMO_CREDENTIALS, DemoCredential } from '../config/demoCredentials';
import { sanitizeReturnTo } from '../lib/security';

const ROLE_ICONS: Record<string, React.ElementType> = {
  super_admin: Settings,
  corporate_management: BarChart3,
  mine_official: Building2,
  inspector: HardHat,
  contractor: Briefcase,
  regulator: Scale,
};

export const LoginForm: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { loginWithCredentials, isLoading, error, clearError, sessionExpired, clearSessionExpired } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const returnToParam = searchParams.get('returnTo');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    clearError();
    clearSessionExpired();

    if (!email.trim() || !password.trim()) {
      setLocalError('Please enter both email and password.');
      return;
    }

    try {
      const user = await loginWithCredentials(email.trim(), password.trim());
      // MUST #2: Sanitize returnTo URL against user role
      const target = sanitizeReturnTo(returnToParam, user.role);
      navigate(target);
    } catch (err: any) {
      setLocalError(err?.message || 'Authentication failed');
    }
  };

  const handleSelectDemoPersona = async (cred: DemoCredential) => {
    setEmail(cred.email);
    setPassword(cred.password);
    setLocalError(null);
    clearError();
    clearSessionExpired();

    try {
      const user = await loginWithCredentials(cred.email, cred.password);
      const target = sanitizeReturnTo(returnToParam, user.role);
      navigate(target);
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
          
          {/* MUST #1: Amber Session Expired Banner */}
          {sessionExpired && (
            <div className="mb-5 p-3.5 bg-amber-50 border border-amber-200/80 rounded-2xl flex items-start gap-3 text-amber-900 text-xs">
              <Clock className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-amber-900">Session Expired</p>
                <p className="text-amber-700 mt-0.5 leading-relaxed">
                  Your session has expired. Please sign in again to continue.
                </p>
              </div>
            </div>
          )}

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
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@mine.in"
                  required
                  className="block w-full rounded-xl border border-zinc-300 pl-10 pr-3 py-2.5 text-xs text-zinc-900 placeholder-zinc-400 focus:border-black focus:outline-none focus:ring-1 focus:ring-black"
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
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="block w-full rounded-xl border border-zinc-300 pl-10 pr-10 py-2.5 text-xs text-zinc-900 placeholder-zinc-400 focus:border-black focus:outline-none focus:ring-1 focus:ring-black"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-zinc-400 hover:text-zinc-600"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {displayError && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-xl bg-red-50 p-3 border border-red-200 flex items-start gap-2.5"
              >
                <AlertCircle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
                <span className="text-xs text-red-700 font-medium leading-relaxed">
                  {displayError}
                </span>
              </motion.div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex justify-center items-center gap-2 py-2.5 px-4 border border-transparent rounded-xl shadow-xs text-xs font-semibold text-white bg-black hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-black disabled:opacity-50 transition-colors"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Verifying Credentials…
                </>
              ) : (
                <>
                  Sign In
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>

          {/* MUST #4: Demo Persona Switcher (Conditional on isDemoMode()) */}
          {isDemoMode() && (
            <div className="mt-8 pt-6 border-t border-zinc-200">
              <div className="flex items-center gap-2 mb-3">
                <Users className="w-4 h-4 text-zinc-500" />
                <span className="text-xs font-bold text-zinc-800 uppercase tracking-wider">
                  Demo Switcher (SIH Evaluation Only)
                </span>
              </div>
              <p className="text-[11px] text-zinc-500 mb-4 leading-relaxed">
                Click any role to test authentication and role-based permissions immediately:
              </p>

              <div className="grid grid-cols-1 gap-2">
                {Object.entries(DEMO_CREDENTIALS).map(([key, cred]) => {
                  const RoleIcon = ROLE_ICONS[key] || KeyRound;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => handleSelectDemoPersona(cred)}
                      disabled={isLoading}
                      className="w-full flex items-center justify-between p-2.5 rounded-xl border border-zinc-200 hover:border-zinc-400 hover:bg-zinc-50/60 transition-all text-left group"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="p-1.5 rounded-lg bg-zinc-100 text-zinc-700 group-hover:bg-zinc-900 group-hover:text-white transition-colors">
                          <RoleIcon className="w-3.5 h-3.5 shrink-0" />
                        </div>
                        <div className="truncate">
                          <div className="text-xs font-semibold text-zinc-900 truncate">
                            {cred.title}
                          </div>
                          <div className="text-[10px] text-zinc-500 truncate">
                            {cred.subtitle}
                          </div>
                        </div>
                      </div>
                      <div className="text-[10px] text-zinc-400 font-mono tracking-tight shrink-0 pl-2">
                        {cred.email.split('@')[0]}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};

export default LoginForm;
