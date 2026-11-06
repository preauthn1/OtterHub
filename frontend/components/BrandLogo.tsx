import { cn } from "@/lib/utils";

interface BrandLogoProps {
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
}

const sizeMap = {
  sm: "h-8 w-8 rounded-[6px]",
  md: "h-9 w-9 rounded-[8px]",
  lg: "h-11 w-11 rounded-[10px]",
  xl: "h-12 w-12 rounded-[10px]",
};

const svgSizeMap = {
  sm: "h-4 w-4",
  md: "h-5 w-5",
  lg: "h-6 w-6",
  xl: "h-7 w-7",
};

/**
 * OtterHub geometric emblem — flat architectural mark, no artificial glow.
 */
export function BrandLogo({ size = "md", className }: BrandLogoProps) {
  return (
    <div
      className={cn(
        "relative inline-flex items-center justify-center shrink-0 select-none overflow-hidden",
        "bg-primary text-primary-foreground border border-border/30",
        sizeMap[size],
        className,
      )}
    >
      <svg
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={cn("relative z-10", svgSizeMap[size])}
        aria-hidden="true"
      >
        <path
          d="M7.5 22.5H23.5C26.2614 22.5 28.5 20.2614 28.5 17.5C28.5 14.956 26.6001 12.8551 24.1396 12.541C23.3563 8.8044 20.0445 6 16.0833 6C11.7972 6 8.27386 9.27751 7.89023 13.4596C5.41063 13.9888 3.5 16.1912 3.5 18.8333C3.5 20.8584 5.29086 22.5 7.5 22.5Z"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M12.5 15.5C12.5 14.6716 13.1716 14 14 14H18C18.8284 14 19.5 14.6716 19.5 15.5C19.5 16.8807 18.3807 18 17 18H15C13.6193 18 12.5 16.8807 12.5 15.5Z"
          fill="currentColor"
          fillOpacity="0.92"
        />
        <circle cx="11.5" cy="12" r="1.2" fill="currentColor" />
        <circle cx="20.5" cy="12" r="1.2" fill="currentColor" />
        <path
          d="M10.5 26H21.5"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeOpacity="0.7"
        />
      </svg>
    </div>
  );
}
