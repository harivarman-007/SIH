/// <reference types="vite/client" />
/**
 * Demo credentials module (MUST #4)
 * Only loaded / rendered when VITE_DEMO_MODE is enabled.
 */
import { AuthRole } from '../api/auth';

export interface DemoCredential {
  role: AuthRole;
  title: string;
  subtitle: string;
  email: string;
  password: string;
}

export const DEMO_CREDENTIALS: Record<AuthRole, DemoCredential> = {
  super_admin: {
    role: 'super_admin',
    title: 'Super Admin',
    subtitle: 'Platform oversight & user administration',
    email: 'superadmin@intellifusion.gov.in',
    password: 'password123',
  },
  corporate_management: {
    role: 'corporate_management',
    title: 'Corporate Management',
    subtitle: 'Multi-mine compliance & fleet analytics',
    email: 'corporate@coalindia.in',
    password: 'password123',
  },
  mine_official: {
    role: 'mine_official',
    title: 'Mine Official',
    subtitle: 'Site operations & hazard verification',
    email: 'official1@mine.in',
    password: 'password123',
  },
  inspector: {
    role: 'inspector',
    title: 'Field Safety Inspector',
    subtitle: 'Hazard logging & underground mobile sync',
    email: 'inspector1@mine.in',
    password: 'password123',
  },
  contractor: {
    role: 'contractor',
    title: 'Contractor',
    subtitle: 'Assigned remediation & evidence submission',
    email: 'contractor1@contractor.in',
    password: 'password123',
  },
  regulator: {
    role: 'regulator',
    title: 'Statutory Regulator (DGMS)',
    subtitle: 'Audit log verification & statutory review',
    email: 'regulator@dgms.gov.in',
    password: 'password123',
  },
};

/**
 * Check if demo mode is active
 */
export function isDemoMode(): boolean {
  return import.meta.env.VITE_DEMO_MODE === 'true' || import.meta.env.DEV;
}
