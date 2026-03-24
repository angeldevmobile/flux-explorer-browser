// Logo SVG de Flux — constelación estilizada

interface OrionLogoProps {
  size?: number;
  className?: string;
}

export const OrionLogo = ({ size = 32, className = "" }: OrionLogoProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 32 32"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    {/* Fondo degradado */}
    <defs>
      <radialGradient id="orion-bg" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stopColor="#0e7490" />
        <stop offset="100%" stopColor="#1e3a5f" />
      </radialGradient>
      <radialGradient id="orion-glow" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.4" />
        <stop offset="100%" stopColor="#22d3ee" stopOpacity="0" />
      </radialGradient>
    </defs>

    {/* Círculo base */}
    <circle cx="16" cy="16" r="15" fill="url(#orion-bg)" />
    <circle cx="16" cy="16" r="15" fill="url(#orion-glow)" />

    {/* Líneas de constelación Flux */}
    {/* Hombros → cinturón */}
    <line x1="8"  y1="10" x2="13" y2="16" stroke="#67e8f9" strokeWidth="0.8" strokeOpacity="0.5" />
    <line x1="24" y1="10" x2="19" y2="16" stroke="#67e8f9" strokeWidth="0.8" strokeOpacity="0.5" />
    {/* Cinturón */}
    <line x1="11" y1="16" x2="16" y2="17" stroke="#67e8f9" strokeWidth="0.8" strokeOpacity="0.5" />
    <line x1="16" y1="17" x2="21" y2="16" stroke="#67e8f9" strokeWidth="0.8" strokeOpacity="0.5" />
    {/* Cinturón → pies */}
    <line x1="13" y1="16" x2="10" y2="23" stroke="#67e8f9" strokeWidth="0.8" strokeOpacity="0.5" />
    <line x1="19" y1="16" x2="22" y2="23" stroke="#67e8f9" strokeWidth="0.8" strokeOpacity="0.5" />

    {/* Estrellas — hombros (más brillantes) */}
    <circle cx="8"  cy="10" r="2"   fill="#22d3ee" />
    <circle cx="24" cy="10" r="1.8" fill="#38bdf8" />

    {/* Estrellas — cinturón (las 3 de Flux) */}
    <circle cx="11" cy="16.5" r="1.5" fill="#7dd3fc" />
    <circle cx="16" cy="17"   r="1.5" fill="#7dd3fc" />
    <circle cx="21" cy="16.5" r="1.5" fill="#7dd3fc" />

    {/* Estrellas — pies */}
    <circle cx="10" cy="23" r="1.8" fill="#38bdf8" />
    <circle cx="22" cy="23" r="2"   fill="#22d3ee" />

    {/* Estrella central pequeña — cabeza */}
    <circle cx="16" cy="7" r="1.2" fill="#e0f2fe" opacity="0.8" />

    {/* Brillo exterior del círculo */}
    <circle cx="16" cy="16" r="15" stroke="#22d3ee" strokeWidth="0.5" strokeOpacity="0.3" fill="none" />
  </svg>
);
