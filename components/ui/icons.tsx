import type { ReactNode, SVGProps } from "react";

function Icon({ children, ...props }: SVGProps<SVGSVGElement> & { children: ReactNode }) {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false" {...props}>{children}</svg>;
}

export const SunIcon = () => <Icon><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></Icon>;
export const MoonIcon = () => <Icon><path d="M21 12.8A8.5 8.5 0 1 1 11.2 3 6.7 6.7 0 0 0 21 12.8Z" /></Icon>;
export const MonitorIcon = () => <Icon><rect x="3" y="4" width="18" height="12" rx="2" /><path d="M8 20h8M12 16v4" /></Icon>;
export const PoseIcon = () => <Icon><circle cx="12" cy="5" r="2" /><path d="M12 8v6M6 10l6-2 6 2M9 21l3-7 3 7" /></Icon>;
export const FaceIcon = () => <Icon><circle cx="12" cy="12" r="9" /><path d="M8.5 14.5a4.5 4.5 0 0 0 7 0M9 9.5h.01M15 9.5h.01" /></Icon>;
export const ActivityIcon = () => <Icon><path d="M3 12h4l3-8 4 16 3-8h4" /></Icon>;
export const LayersIcon = () => <Icon><path d="m12 3 9 5-9 5-9-5 9-5ZM3 13l9 5 9-5M3 17.5l9 5 9-5" /></Icon>;
export const ResetIcon = () => <Icon><path d="M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5" /></Icon>;
export const ArrowRightIcon = () => <Icon><path d="M5 12h14M13 6l6 6-6 6" /></Icon>;
export const LightIcon = () => <Icon><path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2V16h5v-.1c0-.8.4-1.5 1-2A6 6 0 0 0 12 3Z" /></Icon>;
export const SaveIcon = () => <Icon><path d="M5 3h11l4 4v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1ZM8 3v5h7V3M8 21v-7h8v7" /></Icon>;
export const CheckIcon = () => <Icon><path d="m5 12 5 5 9-10" /></Icon>;
