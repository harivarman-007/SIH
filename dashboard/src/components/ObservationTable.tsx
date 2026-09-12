'use client';

import * as React from 'react';
import { useId, useState } from 'react';
import { format } from 'date-fns';
import {
   Calendar as CalendarIcon,
   CheckIcon,
   CircleCheck,
   CircleX,
   AlertCircle,
   HelpCircle,
   Bell,
   LucideIcon,
   ChevronLeft,
   ChevronRight,
   XIcon,
   SearchIcon,
   AlertTriangle,
   Flame,
   Wind,
   ShieldAlert,
   Layers,
   Truck,
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { RemixiconComponentType } from '@remixicon/react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { DayPicker } from 'react-day-picker';
import * as PopoverPrimitive from '@radix-ui/react-popover';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { Command as CommandPrimitive } from 'cmdk';
import * as AvatarPrimitive from '@radix-ui/react-avatar';
import { RiskCardModal, ObservationData } from './RiskCardModal';

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

function Button({
   className,
   variant,
   size,
   asChild = false,
   ...props
}: React.ComponentProps<'button'> &
   VariantProps<typeof buttonVariants> & {
      asChild?: boolean;
   }) {
   const Comp = asChild ? Slot : 'button';

   return (
      <Comp
         data-slot="button"
         className={cn(buttonVariants({ variant, size, className }))}
         {...props}
      />
   );
}

function Calendar({
   className,
   classNames,
   showOutsideDays = true,
   ...props
}: React.ComponentProps<typeof DayPicker>) {
   return (
      <DayPicker
         showOutsideDays={showOutsideDays}
         className={cn('p-3', className)}
         classNames={{
            months: 'flex flex-col sm:flex-row gap-2',
            month: 'flex flex-col gap-4',
            caption: 'flex justify-center pt-1 relative items-center w-full',
            caption_label: 'text-sm font-medium',
            nav: 'flex items-center gap-1',
            nav_button: cn(
               buttonVariants({ variant: 'outline' }),
               'size-7 bg-transparent p-0 opacity-50 hover:opacity-100',
            ),
            nav_button_previous: 'absolute left-1',
            nav_button_next: 'absolute right-1',
            table: 'w-full border-collapse space-x-1',
            head_row: 'flex',
            head_cell:
               'text-muted-foreground rounded-md w-8 font-normal text-[0.8rem]',
            row: 'flex w-full mt-2',
            cell: cn(
               'relative p-0 text-center text-sm focus-within:relative focus-within:z-20 [&:has([aria-selected])]:bg-accent [&:has([aria-selected].day-range-end)]:rounded-r-md',
               props.mode === 'range'
                  ? '[&:has(>.day-range-end)]:rounded-r-md [&:has(>.day-range-start)]:rounded-l-md first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md'
                  : '[&:has([aria-selected])]:rounded-md',
            ),
            day: cn(
               buttonVariants({ variant: 'ghost' }),
               'size-8 p-0 font-normal aria-selected:opacity-100',
            ),
            day_range_start:
               'day-range-start aria-selected:bg-primary aria-selected:text-primary-foreground',
            day_range_end:
               'day-range-end aria-selected:bg-primary aria-selected:text-primary-foreground',
            day_selected:
               'bg-black text-white hover:bg-zinc-800 hover:text-white focus:bg-black focus:text-white',
            day_today: 'bg-zinc-100 text-zinc-900',
            day_outside:
               'day-outside text-zinc-400 aria-selected:text-zinc-500',
            day_disabled: 'text-zinc-300 opacity-50',
            day_range_middle:
               'aria-selected:bg-zinc-100 aria-selected:text-zinc-900',
            day_hidden: 'invisible',
            ...classNames,
         }}
         components={{
            IconLeft: ({ className, ...props }) => (
               <ChevronLeft className={cn('size-4', className)} {...props} />
            ),
            IconRight: ({ className, ...props }) => (
               <ChevronRight className={cn('size-4', className)} {...props} />
            ),
         }}
         {...props}
      />
   );
}

function Popover({ ...props }: React.ComponentProps<typeof PopoverPrimitive.Root>) {
   return <PopoverPrimitive.Root data-slot="popover" {...props} />;
}

function PopoverTrigger({
   ...props
}: React.ComponentProps<typeof PopoverPrimitive.Trigger>) {
   return <PopoverPrimitive.Trigger data-slot="popover-trigger" {...props} />;
}

function PopoverContent({
   className,
   align = 'center',
   sideOffset = 4,
   ...props
}: React.ComponentProps<typeof PopoverPrimitive.Content>) {
   return (
      <PopoverPrimitive.Portal>
         <PopoverPrimitive.Content
            data-slot="popover-content"
            align={align}
            sideOffset={sideOffset}
            className={cn(
               'bg-white text-zinc-900 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 z-50 w-72 rounded-md border border-zinc-200 p-4 shadow-xl outline-hidden',
               className,
            )}
            {...props}
         />
      </PopoverPrimitive.Portal>
   );
}

function Dialog({ ...props }: React.ComponentProps<typeof DialogPrimitive.Root>) {
   return <DialogPrimitive.Root data-slot="dialog" {...props} />;
}

function DialogTrigger({
   ...props
}: React.ComponentProps<typeof DialogPrimitive.Trigger>) {
   return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />;
}

function DialogPortal({
   ...props
}: React.ComponentProps<typeof DialogPrimitive.Portal>) {
   return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />;
}

function DialogContent({
   className,
   children,
   ...props
}: React.ComponentProps<typeof DialogPrimitive.Content>) {
   return (
      <DialogPortal data-slot="dialog-portal">
         <DialogPrimitive.Overlay
            data-slot="dialog-overlay"
            className={cn(
               'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-50 bg-black/60 backdrop-blur-xs',
               className,
            )}
         />
         <DialogPrimitive.Content
            data-slot="dialog-content"
            className={cn(
               'bg-white text-zinc-900 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 fixed top-[50%] left-[50%] z-50 grid w-full max-w-[calc(100%-2rem)] translate-x-[-50%] translate-y-[-50%] gap-4 rounded-lg border border-zinc-200 p-6 shadow-2xl duration-200 sm:max-w-lg',
               className,
            )}
            {...props}
         >
            {children}
            <DialogPrimitive.Close className="ring-offset-background focus:ring-ring absolute top-4 right-4 rounded-xs opacity-70 transition-opacity hover:opacity-100 focus:ring-2 focus:ring-offset-2 focus:outline-hidden disabled:pointer-events-none [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4">
               <XIcon />
               <span className="sr-only">Close</span>
            </DialogPrimitive.Close>
         </DialogPrimitive.Content>
      </DialogPortal>
   );
}

function DialogHeader({ className, ...props }: React.ComponentProps<'div'>) {
   return (
      <div
         data-slot="dialog-header"
         className={cn('flex flex-col gap-2 text-center sm:text-left', className)}
         {...props}
      />
   );
}

function DialogTitle({
   className,
   ...props
}: React.ComponentProps<typeof DialogPrimitive.Title>) {
   return (
      <DialogPrimitive.Title
         data-slot="dialog-title"
         className={cn('text-lg leading-none font-semibold text-black', className)}
         {...props}
      />
   );
}

function DialogDescription({
   className,
   ...props
}: React.ComponentProps<typeof DialogPrimitive.Description>) {
   return (
      <DialogPrimitive.Description
         data-slot="dialog-description"
         className={cn('text-zinc-500 text-sm', className)}
         {...props}
      />
   );
}

function Command({
   className,
   ...props
}: React.ComponentProps<typeof CommandPrimitive>) {
   return (
      <CommandPrimitive
         data-slot="command"
         className={cn(
            'bg-white text-zinc-900 flex h-full w-full flex-col overflow-hidden rounded-md',
            className,
         )}
         {...props}
      />
   );
}

function CommandInput({
   className,
   ...props
}: React.ComponentProps<typeof CommandPrimitive.Input>) {
   return (
      <div
         data-slot="command-input-wrapper"
         className="flex h-9 items-center gap-2 border-b border-zinc-100 px-3"
      >
         <SearchIcon className="size-4 shrink-0 text-zinc-400" />
         <CommandPrimitive.Input
            data-slot="command-input"
            className={cn(
               'placeholder:text-zinc-400 flex h-10 w-full rounded-md bg-transparent py-3 text-sm outline-hidden disabled:cursor-not-allowed disabled:opacity-50',
               className,
            )}
            {...props}
         />
      </div>
   );
}

function CommandList({
   className,
   ...props
}: React.ComponentProps<typeof CommandPrimitive.List>) {
   return (
      <CommandPrimitive.List
         data-slot="command-list"
         className={cn(
            'max-h-[300px] scroll-py-1 overflow-x-hidden overflow-y-auto',
            className,
         )}
         {...props}
      />
   );
}

function CommandEmpty({
   ...props
}: React.ComponentProps<typeof CommandPrimitive.Empty>) {
   return (
      <CommandPrimitive.Empty
         data-slot="command-empty"
         className="py-6 text-center text-sm text-zinc-500"
         {...props}
      />
   );
}

function CommandGroup({
   className,
   ...props
}: React.ComponentProps<typeof CommandPrimitive.Group>) {
   return (
      <CommandPrimitive.Group
         data-slot="command-group"
         className={cn(
            'text-zinc-900 [&_[cmdk-group-heading]]:text-zinc-400 overflow-hidden p-1 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium',
            className,
         )}
         {...props}
      />
   );
}

function CommandItem({
   className,
   ...props
}: React.ComponentProps<typeof CommandPrimitive.Item>) {
   return (
      <CommandPrimitive.Item
         data-slot="command-item"
         className={cn(
            "data-[selected=true]:bg-zinc-100 data-[selected=true]:text-black [&_svg:not([class*='text-'])]:text-zinc-400 relative flex cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-hidden select-none data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
            className,
         )}
         {...props}
      />
   );
}

function Avatar({
   className,
   ...props
}: React.ComponentProps<typeof AvatarPrimitive.Root>) {
   return (
      <AvatarPrimitive.Root
         data-slot="avatar"
         className={cn(
            'relative flex size-8 shrink-0 overflow-hidden rounded-full',
            className,
         )}
         {...props}
      />
   );
}

function AvatarImage({
   className,
   ...props
}: React.ComponentProps<typeof AvatarPrimitive.Image>) {
   return (
      <AvatarPrimitive.Image
         data-slot="avatar-image"
         className={cn('aspect-square size-full', className)}
         {...props}
      />
   );
}

function AvatarFallback({
   className,
   ...props
}: React.ComponentProps<typeof AvatarPrimitive.Fallback>) {
   return (
      <AvatarPrimitive.Fallback
         data-slot="avatar-fallback"
         className={cn(
            'bg-zinc-100 text-zinc-800 flex size-full items-center justify-center rounded-full text-xs font-semibold',
            className,
         )}
         {...props}
      />
   );
}

const MOBILE_BREAKPOINT = 1024;

function useIsMobile() {
   const [isMobile, setIsMobile] = React.useState<boolean | undefined>(
      undefined,
   );

   React.useEffect(() => {
      const mql = window.matchMedia(
         `(max-width: ${MOBILE_BREAKPOINT - 1}px)`,
      );
      const onChange = () => {
         setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
      };
      mql.addEventListener('change', onChange);
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
      return () => mql.removeEventListener('change', onChange);
   }, []);

   return !!isMobile;
}

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

const usersData: User[] = [
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
   icon: LucideIcon | RemixiconComponentType;
   percentComplete: number;
   startDate: string;
   lead: User;
   priority: Priority;
   health: Health;
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

const projectsData: Project[] = [
   {
      id: '1',
      name: 'Gallery 4: Roof Fall & Support Prop Failure',
      status: statusData[0],
      icon: AlertTriangle,
      percentComplete: 20,
      startDate: '2026-09-11',
      lead: usersData[0],
      priority: prioritiesData[1],
      health: healthData[0],
   },
   {
      id: '2',
      name: 'Return Airway: Methane Gas Concentration 2.1%',
      status: statusData[1],
      icon: Flame,
      percentComplete: 60,
      startDate: '2026-09-11',
      lead: usersData[1],
      priority: prioritiesData[1],
      health: healthData[0],
   },
   {
      id: '3',
      name: 'Crushing Plant: Particulate Dust Plume Discharge',
      status: statusData[2],
      icon: Wind,
      percentComplete: 100,
      startDate: '2026-09-10',
      lead: usersData[3],
      priority: prioritiesData[2],
      health: healthData[2],
   },
   {
      id: '4',
      name: 'Underground Dip: Inundation Breakthrough Hazard',
      status: statusData[3],
      icon: AlertCircle,
      percentComplete: 40,
      startDate: '2026-09-10',
      lead: usersData[2],
      priority: prioritiesData[1],
      health: healthData[0],
   },
   {
      id: '5',
      name: 'Haulage Road Bend: Boulder Fall Clearance',
      status: statusData[2],
      icon: Truck,
      percentComplete: 100,
      startDate: '2026-09-09',
      lead: usersData[0],
      priority: prioritiesData[3],
      health: healthData[2],
   },
   {
      id: '6',
      name: 'Shift Crew Dump Yard: PPE Non-Compliance Warning',
      status: statusData[2],
      icon: ShieldAlert,
      percentComplete: 100,
      startDate: '2026-09-08',
      lead: usersData[1],
      priority: prioritiesData[4],
      health: healthData[2],
   },
   {
      id: '7',
      name: 'Settling Pond 2: Acid Effluent Overflow Risk',
      status: statusData[0],
      icon: Layers,
      percentComplete: 50,
      startDate: '2026-09-08',
      lead: usersData[3],
      priority: prioritiesData[2],
      health: healthData[1],
   },
];

interface DatePickerComponentProps {
   date: Date | undefined;
   onDateChange?: (date: Date | undefined) => void;
}

function DatePickerComponent({ date, onDateChange }: DatePickerComponentProps) {
   const [selectedDate, setSelectedDate] = React.useState<Date | undefined>(
      date,
   );
   const [open, setOpen] = React.useState<boolean>(false);

   const handleDateSelect = (date: Date | undefined) => {
      setSelectedDate(date);
      if (onDateChange) {
         onDateChange(date);
      }
      setOpen(false);
   };

   return (
      <Popover open={open} onOpenChange={setOpen}>
         <PopoverTrigger asChild>
            <Button
               variant="ghost"
               className="h-7 px-2 justify-start text-left font-normal"
               size="sm"
            >
               <CalendarIcon className="h-4 w-4 md:mr-0.5" />
               {selectedDate ? (
                  <span className="text-xs hidden xl:inline mt-[1px]">
                     {format(selectedDate, 'MMM dd, yyyy')}
                  </span>
               ) : (
                  <span className="text-xs text-muted-foreground hidden xl:inline mt-[1px]">
                     No date
                  </span>
               )}
            </Button>
         </PopoverTrigger>
         <PopoverContent className="w-auto p-0" align="start">
            <Calendar
               mode="single"
               selected={selectedDate}
               onSelect={handleDateSelect}
               initialFocus
            />
         </PopoverContent>
      </Popover>
   );
}

interface StatusWithPercentComponentProps {
   status: Status;
   percentComplete: number;
   onStatusChange?: (statusId: string) => void;
}

function StatusWithPercentComponent({
   status,
   percentComplete,
   onStatusChange,
}: StatusWithPercentComponentProps) {
   const id = useId();
   const [open, setOpen] = useState<boolean>(false);
   const [value, setValue] = useState<string>(status.id);

   const handleStatusChange = (statusId: string) => {
      setValue(statusId);
      setOpen(false);

      if (onStatusChange) {
         onStatusChange(statusId);
      }
   };

   return (
      <Popover open={open} onOpenChange={setOpen}>
         <PopoverTrigger asChild>
            <Button
               id={id}
               className="flex items-center justify-center gap-1.5"
               size="sm"
               variant="ghost"
               role="combobox"
               aria-expanded={open}
            >
               {(() => {
                  const selectedItem = statusData.find((item) => item.id === value);
                  if (selectedItem) {
                     const Icon = selectedItem.icon;
                     return <Icon />;
                  }
                  return null;
               })()}
               <span className="text-xs font-medium mt-[1px]">
                  {percentComplete}%
               </span>
            </Button>
         </PopoverTrigger>
         <PopoverContent className="border-zinc-200 w-48 p-0" align="start">
            <Command>
               <CommandInput placeholder="Set status..." />
               <CommandList>
                  <CommandEmpty>No status found.</CommandEmpty>
                  <CommandGroup>
                     {statusData.map((item) => {
                        const Icon = item.icon;
                        return (
                           <CommandItem
                              key={item.id}
                              value={item.id}
                              onSelect={handleStatusChange}
                              className="flex items-center justify-between"
                           >
                              <div className="flex items-center gap-2">
                                 <Icon />
                                 <span className="text-xs">{item.name}</span>
                              </div>
                              {value === item.id && (
                                 <CheckIcon size={14} className="ml-auto" />
                              )}
                           </CommandItem>
                        );
                     })}
                  </CommandGroup>
               </CommandList>
            </Command>
         </PopoverContent>
      </Popover>
   );
}

interface LeadSelectorComponentProps {
   lead: User;
   onLeadChange?: (userId: string) => void;
}

function LeadSelectorComponent({
   lead,
   onLeadChange,
}: LeadSelectorComponentProps) {
   const id = useId();
   const [open, setOpen] = useState<boolean>(false);
   const [value, setValue] = useState<string>(lead.id);

   const handleLeadChange = (userId: string) => {
      setValue(userId);
      setOpen(false);

      if (onLeadChange) {
         onLeadChange(userId);
      }
   };

   return (
      <div>
         <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
               <Button
                  id={id}
                  className="flex items-center justify-center gap-1 h-7 px-2"
                  size="sm"
                  variant="ghost"
                  role="combobox"
                  aria-expanded={open}
               >
                  {(() => {
                     const selectedUser = usersData.find(
                        (user) => user.id === value,
                     );
                     if (selectedUser) {
                        return (
                           <>
                              <Avatar className="size-5 mr-1">
                                 <AvatarImage
                                    src={selectedUser.avatarUrl}
                                    alt={selectedUser.name}
                                 />
                                 <AvatarFallback>
                                    {selectedUser.name.charAt(0)}
                                 </AvatarFallback>
                              </Avatar>
                              <span className="text-xs hidden md:inline truncate max-w-[90px]">
                                 {selectedUser.name.split(' ')[0]}
                              </span>
                           </>
                        );
                     }
                     return null;
                  })()}
               </Button>
            </PopoverTrigger>
            <PopoverContent className="border-zinc-200 w-52 p-0" align="start">
               <Command>
                  <CommandInput placeholder="Assign official..." />
                  <CommandList>
                     <CommandEmpty>No official found.</CommandEmpty>
                     <CommandGroup>
                        {usersData.map((user) => (
                           <CommandItem
                              key={user.id}
                              value={user.id}
                              onSelect={handleLeadChange}
                              className="flex items-center justify-between"
                           >
                              <div className="flex items-center gap-2">
                                 <Avatar className="size-5">
                                    <AvatarImage
                                       src={user.avatarUrl}
                                       alt={user.name}
                                    />
                                    <AvatarFallback>
                                       {user.name.charAt(0)}
                                    </AvatarFallback>
                                 </Avatar>
                                 <span className="text-xs">{user.name}</span>
                              </div>
                              {value === user.id && (
                                 <CheckIcon size={14} className="ml-auto" />
                              )}
                           </CommandItem>
                        ))}
                     </CommandGroup>
                  </CommandList>
               </Command>
            </PopoverContent>
         </Popover>
      </div>
   );
}

interface PrioritySelectorComponentProps {
   priority: Priority;
   onPriorityChange?: (priorityId: string) => void;
}

function PrioritySelectorComponent({
   priority,
   onPriorityChange,
}: PrioritySelectorComponentProps) {
   const id = useId();
   const [open, setOpen] = useState<boolean>(false);
   const [value, setValue] = useState<string>(priority.id);

   const handlePriorityChange = (priorityId: string) => {
      setValue(priorityId);
      setOpen(false);

      if (onPriorityChange) {
         onPriorityChange(priorityId);
      }
   };

   return (
      <div>
         <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
               <Button
                  id={id}
                  className="flex items-center justify-center"
                  size="icon"
                  variant="ghost"
                  role="combobox"
                  aria-expanded={open}
               >
                  {(() => {
                     const selectedItem = prioritiesData.find(
                        (item) => item.id === value,
                     );
                     if (selectedItem) {
                        const Icon = selectedItem.icon;
                        return <Icon className="text-zinc-700 size-4" />;
                     }
                     return null;
                  })()}
               </Button>
            </PopoverTrigger>
            <PopoverContent className="border-zinc-200 w-48 p-0" align="start">
               <Command>
                  <CommandInput placeholder="Set risk priority..." />
                  <CommandList>
                     <CommandEmpty>No priority found.</CommandEmpty>
                     <CommandGroup>
                        {prioritiesData.map((item) => (
                           <CommandItem
                              key={item.id}
                              value={item.id}
                              onSelect={handlePriorityChange}
                              className="flex items-center justify-between"
                           >
                              <div className="flex items-center gap-2">
                                 <item.icon className="text-zinc-700 size-4" />
                                 <span className="text-xs">{item.name}</span>
                              </div>
                              {value === item.id && (
                                 <CheckIcon size={14} className="ml-auto" />
                              )}
                           </CommandItem>
                        ))}
                     </CommandGroup>
                  </CommandList>
               </Command>
            </PopoverContent>
         </Popover>
      </div>
   );
}

interface HealthPopoverComponentProps {
   project: Project;
}

function HealthPopoverComponent({ project }: HealthPopoverComponentProps) {
   const getHealthIcon = (healthId: string) => {
      switch (healthId) {
         case 'at-risk':
            return <AlertCircle className="size-4 text-black font-bold" />;
         case 'off-track':
            return <CircleX className="size-4 text-zinc-600" />;
         case 'on-track':
            return <CircleCheck className="size-4 text-black" />;
         case 'no-update':
         default:
            return <HelpCircle className="size-4 text-zinc-400" />;
      }
   };

   const isMobile = useIsMobile();

   return (
      <Popover>
         <PopoverTrigger asChild>
            <Button
               className="flex items-center justify-center gap-1 h-7 px-2 text-zinc-900"
               size="sm"
               variant="ghost"
            >
               {getHealthIcon(project.health.id)}
               <span className="text-xs mt-[1px] ml-0.5 hidden xl:inline font-medium">
                  {project.health.name}
               </span>
            </Button>
         </PopoverTrigger>
         <PopoverContent
            side={isMobile ? 'bottom' : 'left'}
            className={cn('p-0 w-[420px] bg-white border border-zinc-200 shadow-xl', isMobile ? 'w-full' : '')}
         >
            <div className="flex items-center justify-between border-b border-zinc-100 p-3">
               <div className="flex items-center gap-2">
                  {project.icon && (
                     <project.icon className="size-4 shrink-0 text-zinc-700" />
                  )}
                  <h4 className="font-semibold text-sm text-black">{project.name}</h4>
               </div>
               <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" className="h-7 px-2 text-xs flex items-center gap-1">
                     <Bell className="size-3" />
                     Alert DGMS
                  </Button>
               </div>
            </div>
            <div className="p-3 space-y-3">
               <div className="flex items-center justify-start gap-3">
                  <div className="flex items-center gap-2">
                     {getHealthIcon(project.health.id)}
                     <span className="text-xs font-semibold text-black">{project.health.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                     <Avatar className="size-5">
                        <AvatarImage
                           src={project.lead.avatarUrl}
                           alt={project.lead.name}
                        />
                        <AvatarFallback>
                           {project.lead.name.charAt(0)}
                        </AvatarFallback>
                     </Avatar>
                     <span className="text-xs text-zinc-500">
                        {project.lead.name}
                     </span>
                     <span className="text-xs text-zinc-400">&bull;</span>
                     <span className="text-xs text-zinc-500">
                        {new Date(project.startDate).toLocaleDateString()}
                     </span>
                  </div>
               </div>

               <div>
                  <p className="text-xs text-zinc-600 leading-relaxed">
                     {project.health.description}
                  </p>
               </div>
            </div>
         </PopoverContent>
      </Popover>
   );
}

interface ProjectLineComponentProps {
   project: Project;
   onOpenCard: (obs: ObservationData) => void;
}

function ProjectLineComponent({ project, onOpenCard }: ProjectLineComponentProps) {
   const handleOpen = () => {
      onOpenCard({
         id: project.id,
         name: project.name,
         category: project.name.toLowerCase().includes('dust') || project.name.toLowerCase().includes('acid') ? 'environment' : project.name.toLowerCase().includes('ppe') ? 'labour' : 'safety',
         severity: project.priority.id === 'urgent' ? 'high' : project.priority.id === 'high' ? 'high' : project.priority.id === 'medium' ? 'medium' : 'low',
         score: project.priority.id === 'urgent' ? 0.94 : project.priority.id === 'high' ? 0.78 : 0.42,
         description: `Field inspection in working face detected critical condition: ${project.name}. Immediate mitigation mandated under DGMS standard compliance circulars.`,
         location: 'Mine Sector 4, Gallery 4 East Dip',
         beaconId: 'BCN-JHR-402',
         photoUrl: 'https://images.unsplash.com/photo-1578328819058-b69f3a3b0f6b?q=80&w=800&auto=format&fit=crop',
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
      <div className="flex items-center py-3 px-6 border-b hover:bg-zinc-50 border-zinc-200 text-sm transition-colors duration-200">
         <div
            onClick={handleOpen}
            className="flex-grow flex items-center gap-2 overflow-hidden min-w-[220px] cursor-pointer group"
         >
            <div className="relative">
               <div className="inline-flex size-6 bg-zinc-100 group-hover:bg-black group-hover:text-white items-center justify-center rounded shrink-0 text-black transition-colors">
                  <project.icon className="size-4" />
               </div>
            </div>
            <div className="flex flex-col items-start overflow-hidden">
               <span className="font-medium text-black group-hover:underline truncate w-full flex items-center gap-1.5">
                  <span>{project.name}</span>
                  <span className="text-[10px] font-mono font-bold text-zinc-400 group-hover:text-black">
                     &rarr;
                  </span>
               </span>
            </div>
         </div>

         <div className="w-[140px] shrink-0">
            <HealthPopoverComponent project={project} />
         </div>

         <div className="w-[80px] shrink-0">
            <PrioritySelectorComponent priority={project.priority} />
         </div>
         <div className="w-[150px] shrink-0">
            <LeadSelectorComponent lead={project.lead} />
         </div>

         <div className="w-[150px] shrink-0">
            <DatePickerComponent
               date={project.startDate ? new Date(project.startDate) : undefined}
            />
         </div>

         <div className="w-[100px] shrink-0">
            <StatusWithPercentComponent
               status={project.status}
               percentComplete={project.percentComplete}
            />
         </div>
      </div>
   );
}

export default function ObservationTable() {
   const [selectedHazard, setSelectedHazard] = useState<ObservationData | null>(null);

   return (
      <div className="w-full bg-white text-zinc-950 border border-zinc-200 rounded-2xl overflow-hidden shadow-xs">
         {/* Table Top Controls Bar */}
         <div className="p-4 border-b border-zinc-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-zinc-50/60">
            <div className="flex items-center gap-2">
               <span className="text-xs font-bold uppercase tracking-wider text-zinc-500">
                  Statutory Mine Hazards & Inspections
               </span>
               <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-black text-white">
                  {projectsData.length} Records
               </span>
            </div>
            <div className="flex items-center gap-2 text-xs text-zinc-500">
               <span>Click any hazard title to view the AI Risk Card popup</span>
            </div>
         </div>

         <div className="overflow-x-auto">
            <div className="min-w-[880px]">
               <div className="bg-zinc-50 px-6 py-2 text-xs font-semibold uppercase tracking-wider flex items-center text-zinc-500 border-b border-zinc-200 sticky top-0 z-10">
                  <div className="flex-grow">Hazard / Observation (Click to open)</div>
                  <div className="w-[140px] shrink-0 pl-2.5">Severity Status</div>
                  <div className="w-[80px] shrink-0 pl-2">Risk Level</div>
                  <div className="w-[150px] shrink-0 pl-2">Assigned Lead</div>
                  <div className="w-[150px] shrink-0 pl-2.5">Target Date</div>
                  <div className="w-[100px] shrink-0 pl-2">Resolution</div>
               </div>

               <div className="divide-y divide-zinc-100">
                  {projectsData.map((project) => (
                     <ProjectLineComponent
                        key={project.id}
                        project={project}
                        onOpenCard={(obs) => setSelectedHazard(obs)}
                     />
                  ))}
               </div>
            </div>
         </div>

         {/* Risk Card Popup Modal */}
         <RiskCardModal
            observation={selectedHazard}
            isOpen={!!selectedHazard}
            onClose={() => setSelectedHazard(null)}
            onResolve={(id, note) => {
               console.log(`Resolved hazard ${id} with note: ${note}`);
            }}
         />
      </div>
   );
}
