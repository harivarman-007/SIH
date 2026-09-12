import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard,
  AlertTriangle,
  Map as MapIcon,
  FileScan,
  ShieldCheck,
  ChevronDown,
  LogOut,
  CheckCircle2,
  HardHat,
  Building2,
  Scale,
  Briefcase,
  BarChart3,
  Settings
} from 'lucide-react';

export type NavTab = 'overview' | 'observations' | 'map' | 'ocr' | 'audit';
export type UserRole = 'inspector' | 'mine_official' | 'regulator' | 'super_admin' | 'corporate_management' | 'contractor';

export interface PillNavProps {
  activeTab: NavTab;
  onTabChange: (tab: NavTab) => void;
  currentRole: UserRole;
  onRoleChange: (role: UserRole) => void;
  pendingOcrCount?: number;
  openHazardCount?: number;
  userName?: string;
  onLogout?: () => void;
}

const NAV_ITEMS: { id: NavTab; label: string; icon: React.ElementType }[] = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'observations', label: 'Hazards', icon: AlertTriangle },
  { id: 'map', label: 'Mine Map', icon: MapIcon },
  { id: 'ocr', label: 'OCR Queue', icon: FileScan },
  { id: 'audit', label: 'Audit Trail', icon: ShieldCheck },
];

const ROLES: { id: UserRole; title: string; subtitle: string; icon: React.ElementType }[] = [
  { id: 'super_admin', title: 'Super Admin', subtitle: 'Platform-wide management', icon: Settings },
  { id: 'corporate_management', title: 'Corporate Management', subtitle: 'Multi-mine monitoring', icon: BarChart3 },
  { id: 'mine_official', title: 'Mine Official', subtitle: 'Site management & closure', icon: Building2 },
  { id: 'inspector', title: 'Inspector', subtitle: 'Field logging & sync', icon: HardHat },
  { id: 'contractor', title: 'Contractor', subtitle: 'Assigned work only', icon: Briefcase },
  { id: 'regulator', title: 'Regulator (DGMS)', subtitle: 'Statutory compliance & audit', icon: Scale },
];

export const PillNav: React.FC<PillNavProps> = ({
  activeTab,
  onTabChange,
  currentRole,
  onRoleChange,
  pendingOcrCount = 1,
  openHazardCount = 3,
  userName = 'Rajesh Kumar',
  onLogout,
}) => {
  const [roleDropdownOpen, setRoleDropdownOpen] = useState(false);

  const activeRoleData = ROLES.find((r) => r.id === currentRole) || ROLES[1];
  const ActiveRoleIcon = activeRoleData.icon;

  return (
    <header className="fixed top-4 left-0 right-0 z-50 flex justify-center px-4 pointer-events-none">
      <nav className="pointer-events-auto flex items-center gap-2 p-1.5 rounded-full bg-white/95 backdrop-blur-xl border border-zinc-200 shadow-lg">
        
        {/* Brand Pill */}
        <div className="flex items-center gap-2 px-3 py-1.5 text-xs tracking-wider uppercase font-semibold text-black border-r border-zinc-200 mr-1">
          <div className="flex items-center justify-center w-5 h-5 rounded-full bg-black text-white text-[10px] font-bold">
            IF
          </div>
          <span className="hidden md:inline tracking-wider font-bold">INTELLIFUSION</span>
        </div>

        {/* Navigation Tabs (Pills with sliding indicator) */}
        <div className="flex items-center gap-1">
          {NAV_ITEMS.map((item) => {
            const isActive = activeTab === item.id;
            const Icon = item.icon;
            const badgeCount =
              item.id === 'ocr' ? pendingOcrCount : item.id === 'observations' ? openHazardCount : 0;

            return (
              <button
                key={item.id}
                onClick={() => onTabChange(item.id)}
                className={`relative px-3.5 py-1.5 rounded-full text-xs font-medium transition-colors flex items-center gap-1.5 z-10 ${
                  isActive ? 'text-white' : 'text-zinc-600 hover:text-black'
                }`}
              >
                {isActive && (
                  <motion.div
                    layoutId="active-nav-pill"
                    className="absolute inset-0 rounded-full bg-black shadow-sm z-[-1]"
                    transition={{ type: 'spring', stiffness: 450, damping: 35 }}
                  />
                )}
                <Icon className="w-3.5 h-3.5" />
                <span>{item.label}</span>

                {badgeCount > 0 && (
                  <span
                    className={`ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold ${
                      isActive
                        ? 'bg-white text-black'
                        : 'bg-zinc-100 text-zinc-700 border border-zinc-200'
                    }`}
                  >
                    {badgeCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Role Switcher Pill Dropdown */}
        <div className="relative border-l border-zinc-200 pl-1 ml-1">
          <button
            onClick={() => setRoleDropdownOpen(!roleDropdownOpen)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-zinc-50 hover:bg-zinc-100 border border-zinc-200 text-xs text-zinc-800 transition-all"
          >
            <ActiveRoleIcon className="w-3.5 h-3.5 text-zinc-500" />
            <span className="font-medium hidden sm:inline">{activeRoleData.title}</span>
            <ChevronDown className={`w-3 h-3 text-zinc-400 transition-transform ${roleDropdownOpen ? 'rotate-180' : ''}`} />
          </button>

          <AnimatePresence>
            {roleDropdownOpen && (
              <motion.div
                initial={{ opacity: 0, y: 8, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.96 }}
                transition={{ duration: 0.15 }}
                className="absolute right-0 mt-2 w-60 rounded-2xl bg-white border border-zinc-200 shadow-xl p-1.5 z-50"
              >
                <div className="px-3 py-1.5 text-[10px] uppercase font-mono tracking-wider text-zinc-400 border-b border-zinc-100 mb-1">
                  Switch Persona (Demo)
                </div>
                {ROLES.map((r) => {
                  const isSelected = r.id === currentRole;
                  const RIcon = r.icon;
                  return (
                    <button
                      key={r.id}
                      onClick={() => {
                        onRoleChange(r.id);
                        setRoleDropdownOpen(false);
                      }}
                      className={`w-full flex items-start gap-2.5 px-2.5 py-2 rounded-xl text-left text-xs transition-colors ${
                        isSelected
                          ? 'bg-black text-white font-semibold'
                          : 'text-zinc-700 hover:bg-zinc-100'
                      }`}
                    >
                      <RIcon className={`w-4 h-4 mt-0.5 ${isSelected ? 'text-white' : 'text-zinc-500'}`} />
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <span>{r.title}</span>
                          {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-white" />}
                        </div>
                        <p className={`text-[10px] ${isSelected ? 'text-zinc-300' : 'text-zinc-500'}`}>
                          {r.subtitle}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* User / Logout Pill */}
        <div className="flex items-center gap-1.5 pl-1">
          {userName && (
            <span className="text-[11px] font-medium text-zinc-600 hidden md:inline">
              {userName}
            </span>
          )}
          {onLogout && (
            <button
              onClick={onLogout}
              title="Logout session"
              className="p-1.5 rounded-full text-zinc-400 hover:text-black hover:bg-zinc-100 transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

      </nav>
    </header>
  );
};
