import { isImageIcon } from "../services/imageUtils";

interface IconDisplayProps {
  icon: string;
  /** Tailwind classes for size, e.g. "w-10 h-10" */
  size?: string;
  className?: string;
}

/** Renders an emoji icon or an <img> depending on the icon string. */
export function IconDisplay({ icon, size = "w-10 h-10", className = "" }: IconDisplayProps) {
  if (isImageIcon(icon)) {
    return (
      <img
        src={icon}
        alt=""
        className={`${size} object-cover rounded-lg ${className}`}
        onError={(e) => {
          // Fallback to a broken-image emoji if load fails
          (e.target as HTMLImageElement).style.display = "none";
        }}
      />
    );
  }
  return (
    <span className={`flex items-center justify-center select-none ${size} text-2xl ${className}`}>
      {icon}
    </span>
  );
}
