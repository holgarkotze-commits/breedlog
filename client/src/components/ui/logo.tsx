import logoSrc from "@/assets/breedlog-logo-official.png";
import { cn } from "@/lib/utils";

interface LogoProps {
  size?: "sm" | "md" | "lg";
  className?: string;
  showTagline?: boolean;
}

const sizeMap = {
  sm: "w-40",
  md: "w-52",
  lg: "w-full max-w-[360px]",
};

export function Logo({ size = "lg", className, showTagline = false }: LogoProps) {
  return (
    <div className={cn("flex w-full flex-col items-center", className)}>
      <div className="logo-shell w-full rounded-xl border border-white/20 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 px-3 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_8px_20px_rgba(0,0,0,0.35)]">
        <img
          src={logoSrc}
          alt="BreedLog"
          className={cn(sizeMap[size], "mx-auto h-auto object-contain")}
          data-testid="logo-breedlog"
        />
      </div>
      {showTagline && (
        <p
          className="mt-3 text-center text-[11px] font-medium tracking-wide text-slate-100/90"
          data-testid="text-tagline"
        >
          Breed Smart, Farm Better
        </p>
      )}
    </div>
  );
}
