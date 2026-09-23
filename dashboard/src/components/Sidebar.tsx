/**
 * Dynamic Collapsible Sidebar (Design Checkpoint + SHOULD #8)
 * - Desktop: 240px expanded / 64px icon-only rail (VS Code style)
 * - Auto-collapse below 1024px, overlay drawer below 768px
 * - Persists expanded/collapsed preference in localStorage
 * - Tooltips on collapsed rail, full keyboard navigation & ARIA labels
 * - MUST #4: Demo persona switcher isolated under isDemoMode() flag
 * - MUST #5: Filters items dynamically using getNavItemsForRole(role, can)
 */
import React, { useState, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  AlertTriangle,
  MapPin,
  FileText,
  ClipboardCheck,
  CheckSquare,
  TrendingUp,
  BarChart2,
  FileCheck,
  ShieldCheck,
  Lock,
  FileWarning,
  Smartphone,
  Eye,
  Briefcase,
  Award,
  Sliders,
  Users,
  Settings,
  ChevronLeft,
  ChevronRight,
  LogOut,
  User as UserIcon,
  Sparkles,
} from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { usePermissions } from './providers/PermissionProvider';
import { getNavItemsForRole, NavItem } from '../config/navRegistry';
import { isDemoMode, DEMO_CREDENTIALS } from '../config/demoCredentials';
import { AuthRole } from '../api/auth';
import { ROLE_LABELS, ROLE_HOME_PATHS } from '../types/permissions';
import { KPISummary } from '../api/kpi';

// Icon map for registry keys
const ICON_MAP: Record<string, React.ElementType> = {
  LayoutDashboard,
  AlertTriangle,
  MapPin,
  FileText,
  ClipboardCheck,
  CheckSquare,
  TrendingUp,
  BarChart2,
  FileCheck,
  ShieldCheck,
  Lock,
  FileWarning,
  Smartphone,
  Eye,
  Briefcase,
  Award,
  Sliders,
  Users,
  Settings,
};

interface SidebarProps {
  kpis?: KPISummary | null;
  isOpenMobile?: boolean;
  onCloseMobile?: () => void;
  isCollapsed?: boolean;
  onToggleCollapsed?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  kpis = null,
  isOpenMobile = false,
  onCloseMobile,
  isCollapsed: controlledCollapsed,
  onToggleCollapsed,
}) => {
  const navigate = useNavigate();
  const { user, logout, switchRole } = useAuthStore();
  const { can } = usePermissions();

  const [internalCollapsed, setInternalCollapsed] = useState<boolean>(() => {
    const saved = localStorage.getItem('sidebar_collapsed');
    if (saved !== null) return saved === 'true';
    return window.innerWidth < 1024;
  });

  const isCollapsed = controlledCollapsed !== undefined ? controlledCollapsed : internalCollapsed;

  const [showPersonaMenu, setShowPersonaMenu] = useState(false);

  // Auto-collapse responsive listener (SHOULD #8)
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 1024 && !isCollapsed) {
        if (onToggleCollapsed) {
          onToggleCollapsed();
        } else {
          setInternalCollapsed(true);
        }
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isCollapsed, onToggleCollapsed]);

  const toggleCollapsed = () => {
    if (onToggleCollapsed) {
      onToggleCollapsed();
    } else {
      const next = !internalCollapsed;
      setInternalCollapsed(next);
      localStorage.setItem('sidebar_collapsed', String(next));
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const handleSwitchPersona = async (newRole: AuthRole) => {
    setShowPersonaMenu(false);
    await switchRole(newRole);
    navigate(ROLE_HOME_PATHS[newRole]);
  };

  const currentRole = user?.role || 'mine_official';
  const navItems: NavItem[] = getNavItemsForRole(currentRole, can);

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpenMobile && (
        <div
          onClick={onCloseMobile}
          className="fixed inset-0 bg-black/40 z-40 md:hidden backdrop-blur-xs transition-opacity"
          aria-hidden="true"
        />
      )}

      {/* Sidebar Container */}
      <aside
        aria-label="Main Navigation"
        className={`fixed top-0 bottom-0 left-0 z-50 bg-zinc-950 text-zinc-200 border-r border-zinc-800/80 flex flex-col transition-all duration-200 ease-in-out
          ${isCollapsed ? 'w-16' : 'w-60'}
          ${isOpenMobile ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        `}
      >
        {/* Brand Header */}
        <div className="h-16 flex items-center justify-between px-3.5 border-b border-zinc-800/80">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="w-8 h-8 rounded-lg bg-zinc-100 flex items-center justify-center shrink-0 text-zinc-950 font-bold tracking-wider text-sm shadow-sm">
              IF
            </div>
            {!isCollapsed && (
              <div className="flex flex-col min-w-0">
                <span className="text-sm font-semibold text-white tracking-tight leading-none truncate">
                  INTELLIFUSION
                </span>
                <span className="text-[10px] text-zinc-400 font-mono tracking-wider uppercase mt-1">
                  Mine Safety OS
                </span>
              </div>
            )}
          </div>

          <button
            onClick={toggleCollapsed}
            className="hidden md:flex items-center justify-center w-7 h-7 rounded-md text-zinc-400 hover:text-white hover:bg-zinc-800/60 transition-colors"
            aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            title={isCollapsed ? 'Expand (VS Code style)' : 'Collapse'}
          >
            {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>

        {/* Role Badge */}
        {!isCollapsed ? (
          <div className="px-4 py-3 border-b border-zinc-800/40 bg-zinc-900/30">
            <div className="text-[10px] text-zinc-400 uppercase tracking-widest font-semibold mb-1">
              Active Persona
            </div>
            <div className="text-xs font-medium text-zinc-200 flex items-center gap-1.5 truncate">
              <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
              <span className="truncate">{ROLE_LABELS[currentRole]}</span>
            </div>
          </div>
        ) : (
          <div className="py-2.5 flex justify-center border-b border-zinc-800/40">
            <span
              className="w-2 h-2 rounded-full bg-emerald-500"
              title={`Role: ${ROLE_LABELS[currentRole]}`}
            />
          </div>
        )}

        {/* Navigation Items */}
        <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-1">
          {navItems.map((item) => {
            const Icon = ICON_MAP[item.icon] || LayoutDashboard;
            const badgeCount = item.badge ? item.badge(kpis) : undefined;

            return (
              <NavLink
                key={item.id}
                to={item.path}
                onClick={onCloseMobile}
                title={isCollapsed ? `${item.label}${item.isStubbed ? ` (Phase ${item.stubTargetPhase})` : ''}` : undefined}
                className={({ isActive }) => `
                  group relative flex items-center gap-3 px-2.5 py-2 rounded-lg text-xs font-medium transition-all duration-150 outline-hidden
                  ${
                    isActive
                      ? 'bg-zinc-100 text-zinc-950 font-semibold shadow-xs'
                      : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900/70'
                  }
                  ${isCollapsed ? 'justify-center' : ''}
                `}
              >
                {({ isActive }) => (
                  <>
                    <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-zinc-950' : 'text-zinc-400 group-hover:text-zinc-100'}`} />

                    {!isCollapsed && (
                      <span className="flex-1 truncate tracking-tight">
                        {item.label}
                      </span>
                    )}

                    {!isCollapsed && item.isStubbed && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded font-mono uppercase bg-zinc-800 text-zinc-400 tracking-wider">
                        P{item.stubTargetPhase}
                      </span>
                    )}

                    {badgeCount !== undefined && badgeCount > 0 && (
                      <span
                        className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold
                          ${isActive ? 'bg-zinc-900 text-white' : 'bg-red-500/20 text-red-400 border border-red-500/30'}
                          ${isCollapsed ? 'absolute -top-1 -right-1' : ''}
                        `}
                      >
                        {badgeCount}
                      </span>
                    )}

                    {/* Tooltip for collapsed rail */}
                    {isCollapsed && (
                      <span className="absolute left-full ml-2 px-2.5 py-1 bg-zinc-900 text-zinc-100 text-xs rounded-md shadow-lg border border-zinc-800 whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50">
                        {item.label}
                        {item.isStubbed && ` (Phase ${item.stubTargetPhase})`}
                      </span>
                    )}
                  </>
                )}
              </NavLink>
            );
          })}
        </nav>

        {/* Footer Actions / Persona Switcher / Logout */}
        <div className="p-2 border-t border-zinc-800/80 space-y-1 relative">
          {/* Demo Persona Switcher (MUST #4: only when isDemoMode() is true) */}
          {isDemoMode() && (
            <div>
              <button
                type="button"
                onClick={() => setShowPersonaMenu((prev) => !prev)}
                title={isCollapsed ? 'Demo Switcher (SIH Evaluation)' : undefined}
                className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-zinc-400 hover:text-white hover:bg-zinc-900 transition-colors
                  ${isCollapsed ? 'justify-center' : ''}
                `}
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                {!isCollapsed && (
                  <span className="flex-1 text-left truncate text-[11px]">
                    Demo Switcher
                  </span>
                )}
              </button>

              {showPersonaMenu && (
                <div
                  className={`absolute bottom-full mb-2 bg-zinc-900 border border-zinc-800 rounded-xl p-1.5 shadow-2xl z-50 w-56
                    ${isCollapsed ? 'left-14' : 'left-2 right-2 w-auto'}
                  `}
                >
                  <div className="px-2 py-1 text-[10px] text-zinc-400 uppercase font-semibold border-b border-zinc-800 mb-1">
                    Select Demo Persona
                  </div>
                  <div className="space-y-0.5 max-h-56 overflow-y-auto">
                    {(Object.keys(DEMO_CREDENTIALS) as AuthRole[]).map((r) => (
                      <button
                        key={r}
                        type="button"
                        onClick={() => handleSwitchPersona(r)}
                        className={`w-full text-left px-2 py-1.5 rounded-md text-xs transition-colors flex items-center justify-between
                          ${r === currentRole ? 'bg-zinc-100 text-zinc-900 font-semibold' : 'text-zinc-300 hover:bg-zinc-800'}
                        `}
                      >
                        <span className="truncate">{ROLE_LABELS[r]}</span>
                        {r === currentRole && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* User Profile / Logout */}
          <div className="pt-1">
            {!isCollapsed && user && (
              <div className="px-2.5 py-1.5 mb-1 text-[11px] text-zinc-400 truncate flex items-center gap-2">
                <UserIcon className="w-3 h-3 text-zinc-500 shrink-0" />
                <span className="truncate">{user.full_name}</span>
              </div>
            )}

            <button
              onClick={handleLogout}
              title={isCollapsed ? 'Sign Out' : undefined}
              className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-zinc-400 hover:text-red-400 hover:bg-red-500/10 transition-colors
                ${isCollapsed ? 'justify-center' : ''}
              `}
            >
              <LogOut className="w-3.5 h-3.5 shrink-0" />
              {!isCollapsed && <span>Sign Out</span>}
            </button>
          </div>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
