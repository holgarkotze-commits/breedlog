import logoSrc from "@assets/BREEDLOG_LOGO_1768730745128.png";
import { cn } from "@/lib/utils";

interface LogoProps {
  size?: "sm" | "md" | "lg";
  className?: string;
  showTagline?: boolean;
}

const sizeMap = {
  sm: "w-16 h-16",
  md: "w-28 h-28",
  lg: "w-40 h-40",
};

export function Logo({ size = "lg", className, showTagline = false }: LogoProps) {
  return (
    <div className={cn("flex flex-col items-center", className)}>
      <img
        src={logoSrc}
        alt="BreedLog"
        className={cn(
          sizeMap[size],
          "object-contain drop-shadow-[0_0_20px_rgba(255,195,0,0.4)]"
        )}
        data-testid="logo-breedlog"
      />
      {showTagline && (
        <p
          className="text-xs mt-3 uppercase tracking-widest font-semibold text-muted-foreground"
          data-testid="text-tagline"
        >
          Breed Smart. Farm Better.
        </p>
      )}
    </div>
  );
}
