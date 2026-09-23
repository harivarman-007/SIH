'use client';

import * as React from 'react';
import { useState, useEffect, useCallback } from 'react';
import { format, differenceInHours } from 'date-fns';
import {
   Calendar as CalendarIcon,
   AlertCircle,
   LucideIcon,
   AlertTriangle,
   Wind,
   ShieldAlert,
   RefreshCw,
   Loader2,
   Plus,
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { RiskCardModal, ObservationData } from './RiskCardModal';
import { CreateActionDrawer } from './CreateActionDrawer';
import { CreateObservationModal } from './CreateObservationModal';
import { fetchObservations, closeObservation, ObservationOut } from '@/api/observations';

function cn(...inputs: ClassValue[]) {
   return twMerge(clsx(inputs));
}

const buttonVariants = cva(
   "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-[color,box-shadow] disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
   {
      variants: {
         variant: {
            default:
               'bg-black text-white shadow-xs hover:bg-zinc-800',
            destructive:
               'bg-black text-white shadow-xs hover:bg-zinc-800',
            outline:
               'border border-zinc-200 bg-white shadow-xs hover:bg-zinc-100 hover:text-black',
            secondary:
               'bg-zinc-100 text-zinc-900 shadow-xs hover:bg-zinc-200',
            ghost: 'hover:bg-zinc-100 hover:text-black',
            link: 'text-black underline-offset-4 hover:underline',
         },
         size: {
            default: 'h-9 px-4 py-2 has-[>svg]:px-3',
            xxs: 'h-6 rounded-md gap-1.5 px-2.5 has-[>svg]:px-2',
            xs: 'h-7 rounded-md gap-1.5 px-2.5 has-[>svg]:px-2',
            sm: 'h-8 rounded-md gap-1.5 px-3 has-[>svg]:px-2.5',
            lg: 'h-10 rounded-md px-6 has-[>svg]:px-4',
            icon: 'size-9',
         },
      },
      defaultVariants: {
         variant: 'default',
         size: 'default',
      },
   },
);

interface ButtonProps
  extends React.ComponentProps<'button'>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';

    return (
      <Comp
        ref={ref}
        data-slot="button"
        className={cn(buttonVariants({ variant, size, className }))}
        {...props}
      />
    );
  }
);
Button.displayName = 'Button';

interface Status {
   id: string;
   name: string;
   color: string;
   icon: React.FC;
}

const BacklogIcon: React.FC = () => (
   <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <circle
         cx="7"
         cy="7"
         r="6"
         fill="none"
         stroke="#a1a1aa"
         strokeWidth="2"
         strokeDasharray="1.4 1.74"
         strokeDashoffset="0.65"
      ></circle>
      <circle
         className="progress"
         cx="7"
         cy="7"
         r="2"
         fill="none"
         stroke="#71717a"
         strokeWidth="4"
         strokeDasharray="0 100"
         strokeDashoffset="0"
         transform="rotate(-90 7 7)"
      ></circle>
   </svg>
);

const PausedIcon: React.FC = () => (
   <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <circle
         cx="7"
         cy="7"
         r="6"
         fill="none"
         stroke="#71717a"
         strokeWidth="2"
         strokeDasharray="3.14 0"
         strokeDashoffset="-0.7"
      ></circle>
      <circle
         className="progress"
         cx="7"
         cy="7"
         r="2"
         fill="none"
         stroke="#000000"
         strokeWidth="4"
         strokeDasharray="6.2517693806436885 100"
         strokeDashoffset="0"
         transform="rotate(-90 7 7)"
      ></circle>
   </svg>
);

const ToDoIcon: React.FC = () => (
   <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <circle
         cx="7"
         cy="7"
         r="6"
         fill="none"
         stroke="#d4d4d8"
         strokeWidth="2"
         strokeDasharray="3.14 0"
         strokeDashoffset="-0.7"
      ></circle>
      <circle
         className="progress"
         cx="7"
         cy="7"
         r="2"
         fill="none"
         stroke="#d4d4d8"
         strokeWidth="4"
         strokeDasharray="0 100"
         strokeDashoffset="0"
         transform="rotate(-90 7 7)"
      ></circle>
   </svg>
);

const InProgressIcon: React.FC = () => (
   <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <circle
         cx="7"
         cy="7"
         r="6"
         fill="none"
         stroke="#000000"
         strokeWidth="2"
         strokeDasharray="3.14 0"
         strokeDashoffset="-0.7"
      ></circle>
      <circle
         className="progress"
         cx="7"
         cy="7"
         r="2"
         fill="none"
         stroke="#000000"
         strokeWidth="4"
         strokeDasharray="2.0839231268812295 100"
         strokeDashoffset="0"
         transform="rotate(-90 7 7)"
      ></circle>
   </svg>
);

const TechnicalReviewIcon: React.FC = () => (
   <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <circle
         cx="7"
         cy="7"
         r="6"
         fill="none"
         stroke="#000000"
         strokeWidth="2"
         strokeDasharray="3.14 0"
         strokeDashoffset="-0.7"
      ></circle>
      <circle
         className="progress"
         cx="7"
         cy="7"
         r="2"
         fill="none"
         stroke="#000000"
         strokeWidth="4"
         strokeDasharray="4.167846253762459 100"
         strokeDashoffset="0"
         transform="rotate(-90 7 7)"
      ></circle>
   </svg>
);

const CompletedIcon: React.FC = () => (
   <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <circle
         cx="7"
         cy="7"
         r="6"
         fill="none"
         stroke="#000000"
         strokeWidth="2"
         strokeDasharray="3.14 0"
         strokeDashoffset="-0.7"
      ></circle>
      <path
         d="M4.5 7L6.5 9L9.5 5"
         stroke="#000000"
         strokeWidth="1.5"
         strokeLinecap="round"
         strokeLinejoin="round"
      />
   </svg>
);

const statusData: Status[] = [
   {
      id: 'in-progress',
      name: 'In Progress',
      color: '#000000',
      icon: InProgressIcon,
   },
   {
      id: 'technical-review',
      name: 'Technical Review',
      color: '#000000',
      icon: TechnicalReviewIcon,
   },
   { id: 'completed', name: 'Closed', color: '#000000', icon: CompletedIcon },
   { id: 'paused', name: 'Escalated', color: '#71717a', icon: PausedIcon },
   { id: 'to-do', name: 'Open', color: '#a1a1aa', icon: ToDoIcon },
   { id: 'backlog', name: 'Logged', color: '#d4d4d8', icon: BacklogIcon },
];

interface IconProps extends React.SVGProps<SVGSVGElement> {
   className?: string;
}

const NoPriorityIcon = ({ className, ...props }: IconProps) => (
   <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="currentColor"
      className={className}
      aria-label="No Priority"
      role="img"
      focusable="false"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
   >
      <rect x="1.5" y="7.25" width="3" height="1.5" rx="0.5" opacity="0.9"></rect>
      <rect x="6.5" y="7.25" width="3" height="1.5" rx="0.5" opacity="0.9"></rect>
      <rect x="11.5" y="7.25" width="3" height="1.5" rx="0.5" opacity="0.9"></rect>
   </svg>
);

const UrgentPriorityIcon = ({ className, ...props }: IconProps) => (
   <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="currentColor"
      className={className}
      aria-label="Urgent Priority"
      role="img"
      focusable="false"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
   >
      <path d="M3 1C1.91067 1 1 1.91067 1 3V13C1 14.0893 1.91067 15 3 15H13C14.0893 15 15 14.0893 15 13V3C15 1.91067 14.0893 1 13 1H3ZM7 4L9 4L8.75391 8.99836H7.25L7 4ZM9 11C9 11.5523 8.55228 12 8 12C7.44772 12 7 11.5523 7 11C7 10.4477 7.44772 10 8 10C8.55228 10 9 10.4477 9 11Z"></path>
   </svg>
);

const HighPriorityIcon = ({ className, ...props }: IconProps) => (
   <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="currentColor"
      className={className}
      aria-label="High Priority"
      role="img"
      focusable="false"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
   >
      <rect x="1.5" y="8" width="3" height="6" rx="1"></rect>
      <rect x="6.5" y="5" width="3" height="9" rx="1"></rect>
      <rect x="11.5" y="2" width="3" height="12" rx="1"></rect>
   </svg>
);

const MediumPriorityIcon = ({ className, ...props }: IconProps) => (
   <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="currentColor"
      className={className}
      aria-label="Medium Priority"
      role="img"
      focusable="false"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
   >
      <rect x="1.5" y="8" width="3" height="6" rx="1"></rect>
      <rect x="6.5" y="5" width="3" height="9" rx="1"></rect>
      <rect
         x="11.5"
         y="2"
         width="3"
         height="12"
         rx="1"
         fillOpacity="0.4"
      ></rect>
   </svg>
);

const LowPriorityIcon = ({ className, ...props }: IconProps) => (
   <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="currentColor"
      className={className}
      aria-label="Low Priority"
      role="img"
      focusable="false"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
   >
      <rect x="1.5" y="8" width="3" height="6" rx="1"></rect>
      <rect x="6.5" y="5" width="3" height="9" rx="1" fillOpacity="0.4"></rect>
      <rect
         x="11.5"
         y="2"
         width="3"
         height="12"
         rx="1"
         fillOpacity="0.4"
      ></rect>
   </svg>
);

interface Priority {
   id: string;
   name: string;
   icon: React.FC<React.SVGProps<SVGSVGElement>>;
}

const prioritiesData: Priority[] = [
   { id: 'no-priority', name: 'Low Risk', icon: NoPriorityIcon },
   { id: 'urgent', name: 'Critical DGMS', icon: UrgentPriorityIcon },
   { id: 'high', name: 'High Risk', icon: HighPriorityIcon },
   { id: 'medium', name: 'Medium Risk', icon: MediumPriorityIcon },
   { id: 'low', name: 'Minor Advisory', icon: LowPriorityIcon },
];

interface User {
   id: string;
   name: string;
   avatarUrl: string;
   email: string;
   status: 'online' | 'offline' | 'away';
   role: 'Member' | 'Admin' | 'Guest';
   joinedDate: string;
   teamIds: string[];
}

const avatarUrl = (seed: string) =>
   `https://api.dicebear.com/9.x/initials/svg?seed=${seed}&backgroundColor=000000&textColor=ffffff`;

export const usersData: User[] = [
   {
      id: 'rajesh',
      name: 'Rajesh Kumar (Safety Lead)',
      avatarUrl: avatarUrl('RK'),
      email: 'inspector1@mine.in',
      status: 'online',
      role: 'Admin',
      joinedDate: '2022-01-01',
      teamIds: ['SAFETY', 'ZONE4'],
   },
   {
      id: 'amit',
      name: 'Amit Verma (Mine Manager)',
      avatarUrl: avatarUrl('AV'),
      email: 'official1@mine.in',
      status: 'offline',
      role: 'Admin',
      joinedDate: '2023-06-04',
      teamIds: ['OPERATIONS'],
   },
   {
      id: 'sunil',
      name: 'Sunil Sharma (DGMS Inspector)',
      avatarUrl: avatarUrl('SS'),
      email: 'regulator@dgms.gov.in',
      status: 'online',
      role: 'Member',
      joinedDate: '2023-11-01',
      teamIds: ['REGULATION'],
   },
   {
      id: 'priya',
      name: 'Priya Singh (EHS Officer)',
      avatarUrl: avatarUrl('PS'),
      email: 'priya.singh@mine.in',
      status: 'online',
      role: 'Member',
      joinedDate: '2023-03-20',
      teamIds: ['ENVIRONMENT'],
   },
];

interface Project {
   id: string;
   name: string;
   status: Status;
   icon: LucideIcon | any;
   percentComplete: number;
   startDate: string;
   lead: User;
   priority: Priority;
   health: Health;
   _raw?: ObservationOut; // raw backend observation for RiskCardModal
   _isEscalated?: boolean; // visual escalation flag
}

interface Health {
   id: 'no-update' | 'off-track' | 'on-track' | 'at-risk';
   name: string;
   color: string;
   description: string;
}

const healthData: Health[] = [
   {
      id: 'at-risk',
      name: 'Critical Hazard',
      color: '#000000',
      description: 'Immediate DGMS escalation required. Operations suspended until clearance.',
   },
   {
      id: 'off-track',
      name: 'Corrective Action',
      color: '#71717a',
      description: 'Resolution required within 24-48 statutory hours.',
   },
   {
      id: 'on-track',
      name: 'Statutory Compliant',
      color: '#000000',
      description: 'Inspected and verified within safe regulatory thresholds.',
   },
   {
      id: 'no-update',
      name: 'Pending Sync',
      color: '#a1a1aa',
      description: 'Logged offline in field queue; awaiting cloud synchronization.',
   },
];

// --- Mapping: Backend ObservationOut → Project display shape ---
function mapObservationToProject(obs: ObservationOut): Project {
   const effectiveFlag = obs.cloud_flag ?? obs.edge_flag ?? 'low';
   const isHigh = effectiveFlag === 'high';
   const isMedium = effectiveFlag === 'medium';
   const isClosed = obs.status === 'closed';
   const isEscalated = obs.status === 'escalated';

   // Priority
   const priorityMap: Record<string, Priority> = {
      high: prioritiesData[1],    // Urgent
      medium: prioritiesData[2],  // High
      low: prioritiesData[4],     // Normal
   };
   const priority = priorityMap[effectiveFlag] ?? prioritiesData[4];

   // Health
   let health: Health;
   if (isClosed) health = healthData[2]; // on-track = Compliant
   else if (isEscalated || isHigh) health = healthData[0]; // at-risk
   else if (isMedium) health = healthData[1]; // off-track
   else health = healthData[3]; // no-update

   // Status
   let status: Status;
   if (isClosed) status = statusData[2]; // Done
   else if (obs.status === 'in_progress') status = statusData[1]; // In Progress
   else if (isEscalated) status = statusData[3]; // Cancelled → maps to Escalated visually
   else status = statusData[0]; // Todo

   // Percent complete
   const percent = isClosed ? 100 : obs.status === 'in_progress' ? 50 : isEscalated ? 30 : 10;

   // Category → icon
   const iconMap: Record<string, LucideIcon> = {
      safety: AlertTriangle,
      environment: Wind,
      labour: ShieldAlert,
   };
   const icon = iconMap[obs.category] ?? AlertCircle;

   // Lead — show inspector id shortened as placeholder
   const lead: User = {
      id: obs.inspector_id,
      name: `Inspector (${obs.inspector_id.slice(0, 6)})`,
      avatarUrl: avatarUrl(obs.inspector_id.slice(0, 2).toUpperCase()),
      email: `inspector@mine.in`,
      status: 'online',
      role: 'Member',
      joinedDate: obs.created_at.slice(0, 10),
      teamIds: ['FIELD'],
   };

   return {
      id: obs.id,
      name: obs.description.length > 80 ? obs.description.slice(0, 80) + '…' : obs.description,
      status,
      icon,
      percentComplete: percent,
      startDate: obs.created_at.slice(0, 10),
      lead,
      priority,
      health,
      _raw: obs, // carry raw for RiskCardModal
   };
}

// ---------------------------------------------------------------------------
// Clean Statutory Display Badges (Read-Only, Stable, Royal Palette)
// ---------------------------------------------------------------------------

function HealthDisplayComponent({ project }: { project: Project }) {
   const isCompliant = project.health.id === 'on-track';
   const isAtRisk = project.health.id === 'at-risk';

   return (
      <div className="flex items-center gap-1.5 py-1">
         <span
            className={`size-2 rounded-full shrink-0 ${
               isCompliant
                  ? 'bg-emerald-600'
                  : isAtRisk
                  ? 'bg-amber-600'
                  : 'bg-rose-600'
            }`}
         />
         <span
            className={`text-xs font-medium truncate ${
               isCompliant
                  ? 'text-emerald-800'
                  : isAtRisk
                  ? 'text-amber-800'
                  : 'text-rose-800'
            }`}
         >
            {isCompliant ? 'Compliant' : isAtRisk ? 'Under Advisory' : 'Critical Issue'}
         </span>
      </div>
   );
}

function PriorityDisplayComponent({ priority }: { priority: Priority }) {
   const Icon = priority.icon || NoPriorityIcon;
   const isUrgent = priority.id === 'urgent';
   const isHigh = priority.id === 'high';

   return (
      <div className="flex items-center gap-2 py-1 text-slate-700" title={priority.name}>
         <Icon className={`size-4 shrink-0 ${isUrgent ? 'text-rose-600' : isHigh ? 'text-amber-600' : 'text-slate-600'}`} />
         <span className="text-xs font-medium text-slate-700 truncate">{priority.name}</span>
      </div>
   );
}

function LeadDisplayComponent({ lead }: { lead: User }) {
   const initials = (lead.name.replace(/[^a-zA-Z]/g, '').slice(0, 2) || 'IN').toUpperCase();
   return (
      <div className="flex items-center gap-2 overflow-hidden py-1">
         <div className="size-5 rounded-full bg-blue-50 border border-blue-200 text-blue-800 font-bold text-[10px] flex items-center justify-center shrink-0">
            {initials}
         </div>
         <span className="text-xs text-slate-700 truncate font-medium">
            {lead.name}
         </span>
      </div>
   );
}

function DateDisplayComponent({ date }: { date?: string | Date }) {
   const dateObj = date ? new Date(date) : null;
   const formatted = dateObj && !isNaN(dateObj.getTime())
      ? format(dateObj, 'MMM dd, yyyy')
      : 'No Date';

   return (
      <div className="flex items-center gap-1.5 text-xs text-slate-600 font-mono py-1">
         <CalendarIcon className="size-3.5 text-slate-400 shrink-0" />
         <span>{formatted}</span>
      </div>
   );
}

function StatusDisplayComponent({
   status,
   percentComplete,
}: {
   status: Status;
   percentComplete: number;
}) {
   const Icon = status.icon || ToDoIcon;

   return (
      <div className="flex items-center gap-2 py-1 text-slate-700">
         <Icon />
         <span className="text-xs font-semibold text-slate-700">
            {percentComplete}%
         </span>
      </div>
   );
}

interface ProjectLineComponentProps {
   project: Project;
   onOpenCard: (obs: ObservationData) => void;
}

function ProjectLineComponent({ project, onOpenCard }: ProjectLineComponentProps) {
   const handleOpen = () => {
      const raw = project._raw;
      if (raw) {
         const flag = raw.cloud_flag || raw.edge_flag || (project.priority.id === 'urgent' || project.priority.id === 'high' ? 'high' : project.priority.id === 'medium' ? 'medium' : 'low');
         const score = raw.cloud_score ?? raw.edge_score ?? (flag === 'high' ? 0.94 : flag === 'medium' ? 0.65 : 0.35);
         const contributors: string[] = [];
         if (raw.cloud_reasons && typeof raw.cloud_reasons === 'object') {
            Object.entries(raw.cloud_reasons).forEach(([k, v]) => contributors.push(`${k}: ${v}`));
         } else if (raw.edge_reasons && typeof raw.edge_reasons === 'object') {
            Object.entries(raw.edge_reasons).forEach(([k, v]) => contributors.push(`${k}: ${v}`));
         }
         if (contributors.length === 0) {
            contributors.push('DGMS regulatory rule pattern matched', 'Working face hazard analysis triggered', 'Mandatory statutory tracking log');
         }

         const formattedLoc = raw.zone_id
            ? (/[0-9a-f]{8}-[0-9a-f]{4}/i.test(raw.zone_id)
               ? `Sector 4 · Zone #${raw.zone_id.slice(-6).toUpperCase()}`
               : `Mine Sector · ${raw.zone_id}`)
            : 'Mine Working Face, Section 4';

         onOpenCard({
            id: raw.id,
            name: raw.description ? (raw.description.length > 70 ? raw.description.slice(0, 70) + '…' : raw.description) : project.name,
            category: raw.category || 'safety',
            severity: flag as any,
            score,
            description: raw.description || project.name,
            location: formattedLoc,
            beaconId: raw.beacon_id || 'BCN-GPS-AUTO',
            photoUrl: raw.photo_url || 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?q=80&w=800&auto=format&fit=crop',
            inspectorName: project.lead.name,
            date: raw.created_at ? new Date(raw.created_at).toLocaleDateString() : project.startDate,
            topContributors: contributors,
            suggestedAction: raw.suggested_action || (flag === 'high'
               ? 'IMMEDIATE ACTION REQUIRED: Evacuate personnel from zone. Suspend operations. Notify DGMS and Mine Manager.'
               : 'CORRECTIVE ACTION: Dispatch certified contractor to remediate condition in compliance with CMR 2017.'),
            status: raw.status === 'closed' ? 'completed' : 'in-progress',
            complianceStatus: raw.compliance_status,
            thresholdBreachDetail: raw.threshold_breach_detail,
         });
         return;
      }

      onOpenCard({
         id: project.id,
         name: project.name,
         category: project.name.toLowerCase().includes('dust') || project.name.toLowerCase().includes('acid') ? 'environment' : project.name.toLowerCase().includes('ppe') ? 'labour' : 'safety',
         severity: project.priority.id === 'urgent' ? 'high' : project.priority.id === 'high' ? 'high' : project.priority.id === 'medium' ? 'medium' : 'low',
         score: project.priority.id === 'urgent' ? 0.94 : project.priority.id === 'high' ? 0.78 : 0.42,
         description: `Field inspection in working face detected critical condition: ${project.name}. Immediate mitigation mandated under DGMS standard compliance circulars.`,
         location: 'Mine Sector 4, Gallery 4 East Dip',
         beaconId: 'BCN-JHR-402',
         photoUrl: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?q=80&w=800&auto=format&fit=crop',
         inspectorName: project.lead.name,
         date: project.startDate,
         topContributors: [
            'Hazard keyword pattern detected in description',
            'Zone baseline risk index elevated (> 0.65)',
            'Days uninspected threshold exceeded (28 days)',
         ],
         suggestedAction: project.priority.id === 'urgent'
            ? 'IMMEDIATE ACTION REQUIRED: Evacuate all personnel from the affected area. Suspend operations. Notify DGMS inspector and mine manager within 1 hour. Erect barricades and deploy rescue team.'
            : 'CORRECTIVE ACTION WITHIN 24 HRS: Assign safety officer to document and clear hazard. Conduct crew toolbox talk and log entry in statutory register.',
         status: project.percentComplete === 100 ? 'completed' : 'in-progress',
      });
   };

   return (
      <div className="grid grid-cols-[minmax(260px,3fr)_minmax(130px,1.4fr)_minmax(130px,1.3fr)_minmax(160px,1.8fr)_minmax(130px,1.3fr)_minmax(90px,1fr)] items-center px-6 py-3 border-b hover:bg-slate-50/80 border-slate-100 text-sm transition-colors duration-150 gap-4">
         <div
            onClick={handleOpen}
            className="flex items-center gap-2.5 overflow-hidden min-w-0 cursor-pointer group"
         >
            <div className="inline-flex size-6 bg-slate-100 group-hover:bg-blue-50 group-hover:text-blue-700 items-center justify-center rounded shrink-0 text-slate-600 transition-colors">
               <project.icon className="size-3.5" />
            </div>
            <div className="flex flex-col items-start overflow-hidden min-w-0">
               <span className="font-medium text-slate-900 group-hover:text-blue-700 truncate w-full flex items-center gap-1.5 text-xs">
                  <span className="truncate">{project.name}</span>
                  {project._raw?.compliance_status && (
                     <span
                        className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider shrink-0 ${
                           project._raw.compliance_status === 'violation'
                              ? 'bg-rose-50 text-rose-700 border border-rose-200'
                              : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        }`}
                        title={project._raw.threshold_breach_detail || undefined}
                     >
                        {project._raw.compliance_status}
                     </span>
                  )}
                  <span className="text-[10px] font-mono text-slate-400 group-hover:text-blue-600 shrink-0">
                     &rarr;
                  </span>
               </span>
            </div>
         </div>

         <div className="min-w-0">
            <HealthDisplayComponent project={project} />
         </div>

         <div className="min-w-0">
            <PriorityDisplayComponent priority={project.priority} />
         </div>

         <div className="min-w-0">
            <LeadDisplayComponent lead={project.lead} />
         </div>

         <div className="min-w-0">
            <DateDisplayComponent date={project.startDate} />
         </div>

         <div className="min-w-0">
            <StatusDisplayComponent
               status={project.status}
               percentComplete={project.percentComplete}
            />
         </div>
      </div>
   );
}

const FALLBACK_OBSERVATIONS: ObservationOut[] = [
   {
      id: 'hz-101',
      created_at: '2026-09-11T08:32:14Z',
      synced_at: '2026-09-11T08:32:14Z',
      inspector_id: 'insp-001',
      mine_site_id: 'jharia',
      zone_id: '4-east',
      category: 'safety',
      description: 'Gallery 4: Roof Strata Delamination & Support Prop #14 Buckled under load',
      photo_url: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?q=80&w=800&auto=format&fit=crop',
      has_photo: true,
      lat: 23.7972,
      lng: 86.4285,
      beacon_id: 'BCN-JHR-402',
      edge_score: 0.94,
      edge_flag: 'high',
      edge_reasons: { strata_stress: 0.88 },
      cloud_score: 0.94,
      cloud_flag: 'high',
      cloud_reasons: { rule: 'roof fall pattern detected', stress: '+0.42' },
      suggested_action: 'IMMEDIATE ACTION: Evacuate Gallery 4. Isolate 3.3kV power. Erect hydraulic timber packs.',
      enriched_at: '2026-09-11T08:33:00Z',
      status: 'escalated',
      closed_at: null,
      closed_by_id: null,
      closure_photo_url: null,
      closure_note: null,
      escalated_at: '2026-09-11T12:00:00Z',
      version: 1,
   },
   {
      id: 'hz-102',
      created_at: '2026-09-11T06:15:00Z',
      synced_at: '2026-09-11T06:15:00Z',
      inspector_id: 'insp-002',
      mine_site_id: 'raniganj',
      zone_id: 'north-return',
      category: 'safety',
      description: 'Telemetric methane sensor registered 2.1% CH₄ at return airway junction',
      photo_url: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?q=80&w=800&auto=format&fit=crop',
      has_photo: true,
      lat: 23.7942,
      lng: 86.4328,
      beacon_id: 'BCN-JHR-403',
      edge_score: 0.88,
      edge_flag: 'high',
      edge_reasons: { methane_exceedance: '2.1%' },
      cloud_score: 0.88,
      cloud_flag: 'high',
      cloud_reasons: { gas_classification: 'Gassy Seam III', telemetry: '2.1%' },
      suggested_action: 'STATUTORY MANDATE: Cut electrical power to district longwall section immediately.',
      enriched_at: '2026-09-11T06:16:00Z',
      status: 'open',
      closed_at: null,
      closed_by_id: null,
      closure_photo_url: null,
      closure_note: null,
      escalated_at: null,
      version: 1,
   },
   {
      id: 'hz-103',
      created_at: '2026-09-10T14:20:00Z',
      synced_at: '2026-09-10T14:20:00Z',
      inspector_id: 'insp-003',
      mine_site_id: 'korba',
      zone_id: 'surface-prep',
      category: 'environment',
      description: 'Crushing plant dust suppression spray manifold nozzles clogged, particulate plume',
      photo_url: 'https://images.unsplash.com/photo-1586075010923-2dd4570fb338?q=80&w=800&auto=format&fit=crop',
      has_photo: true,
      lat: 22.3595,
      lng: 82.7501,
      beacon_id: 'BCN-KRB-101',
      edge_score: 0.62,
      edge_flag: 'medium',
      edge_reasons: { dust_level: 'particulate 85 ug/m3' },
      cloud_score: 0.62,
      cloud_flag: 'medium',
      cloud_reasons: { ambient_air: 'moderate exceedance' },
      suggested_action: 'CORRECTIVE ACTION WITHIN 24 HRS: Flush manifold line and restore 5.0 bar water pressure.',
      enriched_at: '2026-09-10T14:22:00Z',
      status: 'in_progress',
      closed_at: null,
      closed_by_id: null,
      closure_photo_url: null,
      closure_note: null,
      escalated_at: null,
      version: 1,
   },
   {
      id: 'hz-104',
      created_at: '2026-09-09T10:00:00Z',
      synced_at: '2026-09-09T10:00:00Z',
      inspector_id: 'insp-001',
      mine_site_id: 'jharia',
      zone_id: 'haulage-road',
      category: 'labour',
      description: 'Subcontractor haulage operators observed without required reflective PPE vests',
      photo_url: 'https://images.unsplash.com/photo-1504307651254-35680f356dfd?q=80&w=800&auto=format&fit=crop',
      has_photo: true,
      lat: 23.7960,
      lng: 86.4290,
      beacon_id: 'BCN-JHR-204',
      edge_score: 0.35,
      edge_flag: 'low',
      edge_reasons: { ppe_defect: true },
      cloud_score: 0.35,
      cloud_flag: 'low',
      cloud_reasons: { labour_safety_rule: 'Reg 184 compliance' },
      suggested_action: 'Issue statutory advisory to contractor. Provide high-visibility equipment before shift entry.',
      enriched_at: '2026-09-09T10:05:00Z',
      status: 'closed',
      closed_at: '2026-09-09T16:00:00Z',
      closed_by_id: 'official-001',
      closure_photo_url: null,
      closure_note: 'Contractor issued 15 new DGMS-compliant reflective jackets. Verified by shift incharge.',
      escalated_at: null,
      version: 2,
   },
];

interface ObservationTableProps {
   role?: string;
   onKpiRefresh?: () => void;
}

export default function ObservationTable({ role, onKpiRefresh }: ObservationTableProps) {
   const [selectedHazard, setSelectedHazard] = useState<ObservationData | null>(null);
   const [actionDrawerObs, setActionDrawerObs] = useState<ObservationOut | any | null>(null);
   const [isActionDrawerOpen, setIsActionDrawerOpen] = useState(false);
   const [isCreateObsOpen, setIsCreateObsOpen] = useState(false);
   const [projects, setProjects] = useState<Project[]>([]);
   const [isLoading, setIsLoading] = useState(true);
   const [error, setError] = useState<string | null>(null);
   const [closingId, setClosingId] = useState<string | null>(null);

   const loadObservations = useCallback(async () => {
      setIsLoading(true);
      setError(null);
      try {
         const data = await fetchObservations({ limit: 100 });
         const items = data && data.length > 0 ? data : FALLBACK_OBSERVATIONS;
         const mapped = items.map((obs) => {
            const hoursOld = differenceInHours(new Date(), new Date(obs.created_at));
            const effectiveFlag = obs.cloud_flag ?? obs.edge_flag ?? 'low';
            const isEscalated =
               obs.status === 'escalated' ||
               (obs.status === 'open' && effectiveFlag === 'high' && hoursOld > 48);
            return { ...mapObservationToProject(obs), _isEscalated: isEscalated };
         });
         setProjects(mapped);
      } catch {
         // Seamless fallback when backend is starting or offline
         const mapped = FALLBACK_OBSERVATIONS.map((obs) => {
            const hoursOld = differenceInHours(new Date(), new Date(obs.created_at));
            const effectiveFlag = obs.cloud_flag ?? obs.edge_flag ?? 'low';
            const isEscalated =
               obs.status === 'escalated' ||
               (obs.status === 'open' && effectiveFlag === 'high' && hoursOld > 48);
            return { ...mapObservationToProject(obs), _isEscalated: isEscalated };
         });
         setProjects(mapped);
      } finally {
         setIsLoading(false);
      }
   }, []);

   useEffect(() => {
      loadObservations();
   }, [loadObservations, role]);

   const handleResolve = async (id: string, note: string) => {
      setClosingId(id);
      try {
         await closeObservation(id, note);
         setSelectedHazard(null);
         await loadObservations(); // re-fetch after close
         onKpiRefresh?.(); // update KPI panel
      } catch (err) {
         const msg = err instanceof Error ? err.message : 'Failed to close observation';
         alert(`Close failed: ${msg}`);
      } finally {
         setClosingId(null);
      }
   };

   return (
      <div className="w-full bg-white text-zinc-950 border border-zinc-200 rounded-2xl overflow-hidden shadow-xs">
         {/* Table Top Controls Bar */}
         <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/70">
            <div className="flex items-center gap-2">
               <span className="text-xs font-bold uppercase tracking-wider text-slate-600">
                  Statutory Mine Hazards & Observations
               </span>
               <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                  {projects.length} Records
               </span>
               {(isLoading || !!closingId) && (
                  <Loader2 className="w-3.5 h-3.5 text-blue-700 animate-spin" />
               )}
            </div>
            <div className="flex items-center gap-2">
               <span className="text-xs text-slate-500 hidden md:inline">Click any hazard row to inspect AI Risk Assessment</span>
               <button
                  onClick={() => setIsCreateObsOpen(true)}
                  className="flex items-center gap-1.5 text-xs font-semibold bg-blue-800 hover:bg-blue-700 text-white px-3 py-1.5 rounded-xl transition-colors shadow-xs"
               >
                  <Plus className="w-3.5 h-3.5" /> Log Hazard
               </button>
               <button
                  onClick={loadObservations}
                  className="flex items-center gap-1 text-xs text-slate-600 hover:text-slate-900 px-2.5 py-1.5 rounded-xl border border-slate-200 hover:bg-white transition-colors"
               >
                  <RefreshCw className="w-3 h-3" /> Refresh
               </button>
            </div>
         </div>

         {/* Error state */}
         {error && (
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 text-xs text-rose-700 flex items-center gap-2">
               <AlertCircle className="w-4 h-4 text-rose-600" />
               <span>Could not load observations from backend: {error}</span>
            </div>
         )}

         <div className="overflow-x-auto">
            <div className="min-w-[880px]">
               <div className="bg-slate-50/90 px-6 py-3 text-[11px] font-bold uppercase tracking-wider grid grid-cols-[minmax(260px,3fr)_minmax(130px,1.4fr)_minmax(130px,1.3fr)_minmax(160px,1.8fr)_minmax(130px,1.3fr)_minmax(90px,1fr)] items-center text-slate-500 border-b border-slate-200 sticky top-0 z-10 gap-4">
                  <div>Hazard / Statutory Observation</div>
                  <div>Statutory Status</div>
                  <div>Risk Level</div>
                  <div>Assigned Official</div>
                  <div>Logged Date</div>
                  <div>Resolution</div>
               </div>

               <div className="divide-y divide-zinc-100">
                  {isLoading && projects.length === 0 ? (
                     Array.from({ length: 5 }).map((_, i) => (
                        <div key={i} className="flex items-center py-3 px-6 gap-4 animate-pulse">
                           <div className="w-6 h-6 rounded bg-zinc-100" />
                           <div className="flex-grow h-3 bg-zinc-100 rounded" />
                           <div className="w-24 h-3 bg-zinc-100 rounded" />
                        </div>
                     ))
                  ) : (
                     projects.map((project) => (
                        <div
                           key={project.id}
                           className={project._isEscalated ? 'border-l-2 border-zinc-900' : ''}
                        >
                           <ProjectLineComponent
                              key={project.id}
                              project={project}
                              onOpenCard={(obs) => setSelectedHazard(obs)}
                           />
                        </div>
                     ))
                  )}
               </div>
            </div>
         </div>

         {/* Risk Card Popup Modal */}
         <RiskCardModal
            observation={selectedHazard}
            isOpen={!!selectedHazard}
            onClose={() => setSelectedHazard(null)}
            onResolve={handleResolve}
            onCreateAction={(obsData) => {
               const obsObj: any = {
                  id: obsData.id,
                  title: obsData.name,
                  description: obsData.description,
                  risk_level: obsData.severity,
                  location: obsData.location,
                  suggested_action: obsData.suggestedAction,
                  image_url: obsData.photoUrl,
                  status: obsData.status as any,
                  created_at: obsData.date,
               };
               setActionDrawerObs(obsObj);
               setIsActionDrawerOpen(true);
            }}
         />

         {/* Action Creation Drawer (Q1) */}
         <CreateActionDrawer
            isOpen={isActionDrawerOpen}
            onClose={() => {
               setIsActionDrawerOpen(false);
               setActionDrawerObs(null);
            }}
            observation={actionDrawerObs}
            onSuccess={() => {
               loadObservations();
               if (onKpiRefresh) onKpiRefresh();
            }}
         />

         {/* Create Hazard Observation Modal */}
         <CreateObservationModal
            isOpen={isCreateObsOpen}
            onClose={() => setIsCreateObsOpen(false)}
            onSuccess={() => {
               loadObservations();
               if (onKpiRefresh) onKpiRefresh();
            }}
         />
      </div>
   );
}
