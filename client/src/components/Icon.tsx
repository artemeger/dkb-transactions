/**
 * Material Icons wrapper component for consistent icon usage across the app.
 * Uses Google Material Icons font loaded via CDN in index.html.
 * 
 * Usage:
 *   <Icon name="delete" size={16} />
 *   <Icon name="add" className="text-primary" />
 *   <Icon name="close" size={20} />
 */

export interface IconProps {
  /** Material icon name (e.g., 'delete', 'add', 'close') */
  name: string;
  /** Icon size in pixels. Uses Tailwind defaults if not specified. */
  size?: number | string;
  /** Additional CSS classes */
  className?: string;
}

const SIZE_MAP: Record<string, string> = {
  xs: 'text-xs',
  sm: 'text-sm',
  md: 'text-md',
  lg: 'text-lg',
  xl: 'text-xl',
};

export default function Icon({ name, size, className }: IconProps) {
  // If size is a string like "xs", "sm", etc., use Tailwind class
  if (size && typeof size === 'string' && SIZE_MAP[size]) {
    return <span className={`material-icons ${SIZE_MAP[size]} ${className || ''}`}>{name}</span>;
  }
  
  // If size is a number, apply inline style for pixel-perfect sizing
  const style = size ? { fontSize: `${size}px` } : undefined;
  return (
    <span 
      className={`material-icons ${className || ''}`}
      style={style}
    >
      {name}
    </span>
  );
}

/**
 * Spinner component for loading states.
 * Replaces inline SVG spinners with a CSS-animated Material Icons approach.
 */
export function Spinner({ size = 16 }: { size?: number }) {
  const style = { 
    width: size, 
    height: size, 
    border: `2px solid currentColor`,
    borderTopColor: 'transparent',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite'
  };
  
  return <div style={style} className="inline-block" />;
}

// Register the spinner animation globally
if (typeof document !== 'undefined') {
  const styleId = 'material-spinner-style';
  if (!document.getElementById(styleId)) {
    const styleEl = document.createElement('style');
    styleEl.id = styleId;
    styleEl.textContent = `@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`;
    document.head.appendChild(styleEl);
  }
}
