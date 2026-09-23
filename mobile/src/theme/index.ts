/**
 * theme/index.ts
 * Executive Light Theme design tokens for Intellifusion Mobile.
 */

export const colors = {
  // Canvas & Surfaces
  background: "#F8FAFC", // slate-50
  surface: "#FFFFFF",
  surfaceMuted: "#F1F5F9", // slate-100
  surfaceSubtle: "#F8FAFC",

  // Borders
  border: "#E2E8F0", // slate-200
  borderStrong: "#CBD5E1", // slate-300
  borderSubtle: "#F1F5F9",

  // Typography
  text: "#0F172A", // slate-900
  textSecondary: "#475569", // slate-600
  textMuted: "#64748B", // slate-500
  textLight: "#94A3B8", // slate-400
  subtext: "#64748B", // alias for slate-500

  // Brand / Royal Blue
  primary: "#1E40AF", // blue-800
  primaryHover: "#1D4ED8", // blue-700
  primaryLight: "#EFF6FF", // blue-50
  primaryBorder: "#BFDBFE", // blue-200

  // Status & Alerts
  success: "#16A34A", // emerald-600
  successLight: "#F0FDF4", // emerald-50
  successBorder: "#BBF7D0", // emerald-200
  successText: "#15803D", // emerald-700

  warning: "#D97706", // amber-600
  warningLight: "#FFFBEB", // amber-50
  warningBorder: "#FDE68A", // amber-200
  warningText: "#B45309", // amber-700

  danger: "#DC2626", // rose-600
  dangerLight: "#FEF2F2", // rose-50
  dangerBorder: "#FECACA", // rose-200
  dangerText: "#B91C1C", // rose-700

  info: "#0284C7", // sky-600
  infoLight: "#F0F9FF", // sky-50
  infoBorder: "#BAE6FD", // sky-200
  infoText: "#0369A1", // sky-700
};

export const shadows = {
  sm: {
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  md: {
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 6,
    elevation: 3,
  },
  lg: {
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 6,
  },
};
