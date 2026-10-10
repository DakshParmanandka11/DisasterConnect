/* Inline SVG icon helpers — 16×16 default, use width/height props to override */

export function HomeIcon({ size = 16, ...props }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <path d="M2 6.5L8 2l6 4.5V14a.5.5 0 01-.5.5H10v-4H6v4H2.5A.5.5 0 012 14V6.5z"/>
    </svg>
  );
}

export function MapPinIcon({ size = 16, ...props }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <path d="M8 1.5A4.5 4.5 0 018 10.5c-2 0-4.5-3.5-4.5-5a4.5 4.5 0 019 0z"/>
      <circle cx="8" cy="5.5" r="1.25"/>
    </svg>
  );
}

export function AlertTriangleIcon({ size = 16, ...props }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <path d="M8 2L1.5 13.5h13L8 2z"/>
      <path d="M8 6.5v3"/>
      <circle cx="8" cy="11.5" r=".5" fill="currentColor" stroke="none"/>
    </svg>
  );
}

export function ShieldIcon({ size = 16, ...props }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <path d="M8 1.5L2 4v5c0 3 2.5 5 6 5.5C14 14 14 9 14 9V4L8 1.5z"/>
    </svg>
  );
}

export function UsersIcon({ size = 16, ...props }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <circle cx="6" cy="5" r="2.5"/>
      <path d="M1 14c0-2.5 2-4 5-4s5 1.5 5 4"/>
      <path d="M11 2.5a2.5 2.5 0 010 5M15 14c0-2-1.5-3.5-4-3.5"/>
    </svg>
  );
}

export function ClipboardIcon({ size = 16, ...props }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <rect x="3" y="3" width="10" height="12" rx="1.5"/>
      <path d="M6 3V2a2 2 0 014 0v1"/>
    </svg>
  );
}

export function CheckIcon({ size = 16, ...props }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <path d="M2.5 8.5l4 4 7-8"/>
    </svg>
  );
}

export function CheckCircleIcon({ size = 16, ...props }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <circle cx="8" cy="8" r="6"/>
      <path d="M5.5 8l2 2 3-3.5"/>
    </svg>
  );
}

export function ChevronLeftIcon({ size = 16, ...props }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <path d="M10 12L6 8l4-4"/>
    </svg>
  );
}

export function ChevronRightIcon({ size = 16, ...props }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <path d="M6 4l4 4-4 4"/>
    </svg>
  );
}

export function SunIcon({ size = 16, ...props }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <circle cx="8" cy="8" r="3"/>
      <path d="M8 1v2M8 13v2M1 8h2M13 8h2M3.1 3.1l1.4 1.4M11.5 11.5l1.4 1.4M3.1 12.9l1.4-1.4M11.5 4.5l1.4-1.4"/>
    </svg>
  );
}

export function MoonIcon({ size = 16, ...props }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <path d="M13.5 10A6 6 0 016 2.5 6 6 0 1013.5 10z"/>
    </svg>
  );
}

export function LogOutIcon({ size = 16, ...props }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <path d="M6 2H3a1 1 0 00-1 1v10a1 1 0 001 1h3M10.5 11.5L14 8l-3.5-3.5M14 8H6"/>
    </svg>
  );
}

export function BellIcon({ size = 16, ...props }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <path d="M8 1.5a4.5 4.5 0 014.5 4.5c0 3 1 4 1 4H2.5s1-1 1-4A4.5 4.5 0 018 1.5z"/>
      <path d="M6.5 12.5a1.5 1.5 0 003 0"/>
    </svg>
  );
}

export function MenuIcon({ size = 16, ...props }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true" {...props}>
      <path d="M2 4h12M2 8h12M2 12h12"/>
    </svg>
  );
}

export function XIcon({ size = 16, ...props }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" aria-hidden="true" {...props}>
      <path d="M3 3l10 10M13 3L3 13"/>
    </svg>
  );
}

export function ChevronDownIcon({ size = 12, ...props }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <path d="M4 6l4 4 4-4"/>
    </svg>
  );
}

export function SearchIcon({ size = 14, ...props }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <circle cx="7" cy="7" r="4.5"/>
      <path d="M11 11l3 3"/>
    </svg>
  );
}

export function PlusIcon({ size = 16, ...props }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <path d="M8 3.5v9M3.5 8h9"/>
    </svg>
  );
}

export function FilterIcon({ size = 16, ...props }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <path d="M1.5 3h13M3.5 8h9M6 13h4"/>
    </svg>
  );
}

export function ThumbsUpIcon({ size = 16, ...props }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <path d="M5 7v7H2.5A.5.5 0 012 13.5v-6a.5.5 0 01.5-.5H5zm0 0l3-4.5a1 1 0 011.5.5v3h4.2a1 1 0 01.98 1.2l-1 5a1 1 0 01-.98.8H5"/>
    </svg>
  );
}

export function KeyIcon({ size = 16, ...props }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <circle cx="6" cy="7" r="3.5"/>
      <path d="M9 8.5l5.5 5.5M12 12l1.5 1.5M11.5 11.5l-1 1"/>
    </svg>
  );
}

export function LayersIcon({ size = 16, ...props }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <path d="M1 5l7-3 7 3-7 3-7-3z"/>
      <path d="M1 9l7 3 7-3"/>
      <path d="M1 13l7 3 7-3"/>
    </svg>
  );
}
