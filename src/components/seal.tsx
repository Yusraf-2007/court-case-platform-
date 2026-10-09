import { cn } from "@/lib/utils";

// The platform's seal: an original design (balance scales inside a beaded
// ring). It deliberately does not use the State Emblem of India, the Ashoka
// Chakra or any court's official seal, whose use is restricted by law.
export function Seal({ className, animated = false }: { className?: string; animated?: boolean }) {
  return (
    <svg
      viewBox="0 0 120 120"
      role="img"
      aria-label="Court Case Platform seal"
      className={cn("text-maroon", animated && "seal-settle", className)}
    >
      <defs>
        <path id="seal-ring" d="M60,60 m-41,0 a41,41 0 1,1 82,0 a41,41 0 1,1 -82,0" />
      </defs>
      <circle cx="60" cy="60" r="57" fill="var(--card)" stroke="currentColor" strokeWidth="2.5" />
      <circle cx="60" cy="60" r="51" fill="none" stroke="var(--brass)" strokeWidth="1" />
      <circle cx="60" cy="60" r="33" fill="none" stroke="currentColor" strokeWidth="1.5" />
      {Array.from({ length: 36 }, (_, i) => {
        const a = (i / 36) * Math.PI * 2;
        return (
          <circle key={i} cx={60 + Math.cos(a) * 54} cy={60 + Math.sin(a) * 54} r="0.9" fill="var(--brass)" />
        );
      })}
      <text
        fill="currentColor"
        style={{ fontFamily: "var(--font-cinzel)", fontSize: "7.4px", letterSpacing: "1.6px", fontWeight: 600 }}
      >
        <textPath href="#seal-ring" startOffset="50%" textAnchor="middle">
          CRIMINAL CASE REGISTRY · NYAYA ·
        </textPath>
      </text>
      {/* Balance scales */}
      <g fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M60 38 V80" />
        <path d="M50 81 H70" />
        <path d="M44 45 H76" />
        <circle cx="60" cy="37" r="2" fill="currentColor" />
        <path d="M46 45 L40 60 M46 45 L52 60" />
        <path d="M74 45 L68 60 M74 45 L80 60" />
        <path d="M39 60 Q46 67 53 60 Z" fill="var(--brass)" fillOpacity="0.35" />
        <path d="M67 60 Q74 67 81 60 Z" fill="var(--brass)" fillOpacity="0.35" />
      </g>
    </svg>
  );
}
