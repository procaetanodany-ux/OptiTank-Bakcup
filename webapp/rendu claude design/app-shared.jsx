
// OptiTank — Design Tokens, Icons & Shared Components
// Exports to window: DARK, LIGHT, C, Icon, BottomNav, GlassCard,
//                    Btn, PriceChip, SectionLabel, FueloMascot, Toast, Skeleton

// ─── TOKENS ──────────────────────────────────────────────────────────────────
const DARK = {
  bg: '#0A0A0F', bgElevated: '#0F0F18',
  surface: 'rgba(255,255,255,0.05)', surface2: 'rgba(255,255,255,0.08)',
  surface3: 'rgba(255,255,255,0.12)',
  border: 'rgba(108,99,255,0.22)', borderSubtle: 'rgba(255,255,255,0.06)',
  text1: '#FFFFFF', text2: 'rgba(255,255,255,0.65)', text3: 'rgba(255,255,255,0.35)',
  isDark: true,
};
const LIGHT = {
  bg: '#F5F5F7', bgElevated: '#FFFFFF',
  surface: '#FFFFFF', surface2: 'rgba(0,0,0,0.03)',
  surface3: 'rgba(0,0,0,0.05)',
  border: 'rgba(108,99,255,0.15)', borderSubtle: 'rgba(0,0,0,0.07)',
  text1: '#1C1C1E', text2: '#3A3A3C', text3: '#8E8E93',
  isDark: false,
};
const C = {
  primary: '#6C63FF', primaryLight: '#8B84FF', primaryDark: '#5248E8',
  accent: '#00D4AA', accentLight: '#33DFBE',
  success: '#22C55E', warning: '#F59E0B', danger: '#EF4444',
  gold: '#F59E0B', silver: '#9CA3AF',
};

// ─── SVG ICONS ────────────────────────────────────────────────────────────────
const Ico = ({ d, d2, size = 24, color = 'currentColor', fill = 'none', strokeW = 2, children }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke={color}
    strokeWidth={strokeW} strokeLinecap="round" strokeLinejoin="round">
    {d && <path d={d}/>}
    {d2 && <path d={d2}/>}
    {children}
  </svg>
);

const Icons = {
  radar: ({ size, color }) => <Ico size={size} color={color} d="M12 12m-2 0a2 2 0 1 0 4 0a2 2 0 1 0-4 0">
    <path d="M12 2a10 10 0 0 1 7.38 16.87M4.62 18.87A10 10 0 0 1 12 2"/>
    <path d="M12 6a6 6 0 0 1 4.47 10.12M7.53 16.12A6 6 0 0 1 12 6"/>
  </Ico>,
  map: ({ size, color }) => <Ico size={size} color={color}>
    <polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21"/>
    <line x1="9" y1="3" x2="9" y2="18"/><line x1="15" y1="6" x2="15" y2="21"/>
  </Ico>,
  pin: ({ size, color }) => <Ico size={size} color={color} d="M12 22s-8-4.5-8-11.8A8 8 0 0 1 12 2a8 8 0 0 1 8 8.2c0 7.3-8 11.8-8 11.8z">
    <circle cx="12" cy="10" r="3" fill="none"/>
  </Ico>,
  chart: ({ size, color }) => <Ico size={size} color={color}>
    <line x1="18" y1="20" x2="18" y2="10"/>
    <line x1="12" y1="20" x2="12" y2="4"/>
    <line x1="6" y1="20" x2="6" y2="14"/>
  </Ico>,
  user: ({ size, color }) => <Ico size={size} color={color} d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2">
    <circle cx="12" cy="7" r="4" stroke={color} fill="none"/>
  </Ico>,
  heart: ({ size, color, filled }) => <Ico size={size} color={color} fill={filled ? color : 'none'}
    d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>,
  nav: ({ size, color }) => <Ico size={size} color={color} d="M3 12h18M3 6l9-3 9 3M3 18l9 3 9-3"/>,
  fuel: ({ size, color }) => <Ico size={size} color={color}>
    <path d="M3 22V8l5-5h8l5 5v14H3z"/><path d="M10 22V16h4v6"/><path d="M3 12h18"/>
  </Ico>,
  share: ({ size, color }) => <Ico size={size} color={color} d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8">
    <polyline points="16 6 12 2 8 6" stroke={color} fill="none"/><line x1="12" y1="2" x2="12" y2="15"/>
  </Ico>,
  bell: ({ size, color }) => <Ico size={size} color={color} d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9">
    <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
  </Ico>,
  lock: ({ size, color }) => <Ico size={size} color={color} d="M19 11H5a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2z">
    <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
  </Ico>,
  check: ({ size, color }) => <Ico size={size} color={color} d="M20 6L9 17l-5-5"/>,
  x: ({ size, color }) => <Ico size={size} color={color} d="M18 6L6 18M6 6l12 12"/>,
  arrow: ({ size, color }) => <Ico size={size} color={color} d="M5 12h14M12 5l7 7-7 7"/>,
  home: ({ size, color }) => <Ico size={size} color={color} d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z">
    <polyline points="9 22 9 12 15 12 15 22"/>
  </Ico>,
  settings: ({ size, color }) => <Ico size={size} color={color}>
    <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
  </Ico>,
  trophy: ({ size, color }) => <Ico size={size} color={color} d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6">
    <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/>
    <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/>
    <path d="M18 2H6v7a6 6 0 0 0 12 0V2z"/>
  </Ico>,
  car: ({ size, color }) => <Ico size={size} color={color}>
    <path d="M14 16H9m10 0h3v-3.15a2 2 0 0 0-1.588-1.95l-2.855-.645a2 2 0 0 1-1.152-.67l-2.069-2.39a2 2 0 0 0-1.512-.69h-3.4a2 2 0 0 0-1.53.71L5.83 9.69a2 2 0 0 1-1.152.67l-2.855.645A2 2 0 0 0 0 12.85V16h3"/>
    <circle cx="6.5" cy="16.5" r="2.5"/><circle cx="16.5" cy="16.5" r="2.5"/>
  </Ico>,
  sparkle: ({ size, color }) => <Ico size={size} color={color} d="M12 3l2.5 5.5L20 11l-5.5 2.5L12 19l-2.5-5.5L4 11l5.5-2.5L12 3z"/>,
  trend: ({ size, color }) => <Ico size={size} color={color} d="M23 6l-9.5 9.5-5-5L1 18">
    <polyline points="17 6 23 6 23 12"/>
  </Ico>,
};

// ─── FUELO MASCOT ────────────────────────────────────────────────────────────
function FueloMascot({ size = 80, happy = true, style = {} }) {
  const s = size;
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', ...style }}>
      <svg width={s} height={s * 1.3} viewBox="0 0 80 104" fill="none">
        <defs>
          <linearGradient id="fuelBody" x1="40" y1="4" x2="40" y2="96" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#8B84FF"/>
            <stop offset="100%" stopColor="#4338CA"/>
          </linearGradient>
          <radialGradient id="fuelGlow" cx="50%" cy="40%" r="60%">
            <stop offset="0%" stopColor="rgba(139,132,255,0.4)"/>
            <stop offset="100%" stopColor="rgba(108,99,255,0)"/>
          </radialGradient>
        </defs>
        {/* Glow */}
        <ellipse cx="40" cy="55" rx="34" ry="44" fill="url(#fuelGlow)"/>
        {/* Body - teardrop */}
        <path d="M40 6 C24 6, 8 30, 8 52 C8 74, 22 96, 40 96 C58 96, 72 74, 72 52 C72 30, 56 6, 40 6Z"
          fill="url(#fuelBody)"/>
        {/* Highlight */}
        <ellipse cx="28" cy="36" rx="9" ry="14" fill="rgba(255,255,255,0.15)" transform="rotate(-20 28 36)"/>
        {/* Eyes */}
        <circle cx="29" cy="54" r="7" fill="#0A0A0F"/>
        <circle cx="51" cy="54" r="7" fill="#0A0A0F"/>
        {/* Iris - teal */}
        <circle cx="31" cy="52" r="3" fill="#00D4AA"/>
        <circle cx="53" cy="52" r="3" fill="#00D4AA"/>
        {/* Eye shine */}
        <circle cx="32.5" cy="50.5" r="1.2" fill="white" opacity="0.9"/>
        <circle cx="54.5" cy="50.5" r="1.2" fill="white" opacity="0.9"/>
        {/* Mouth */}
        {happy
          ? <path d="M31 67 Q40 76 49 67" stroke="#0A0A0F" strokeWidth="3.5" strokeLinecap="round" fill="none"/>
          : <path d="M31 72 Q40 65 49 72" stroke="#0A0A0F" strokeWidth="3.5" strokeLinecap="round" fill="none"/>
        }
        {/* Antenna */}
        <line x1="40" y1="6" x2="40" y2="-1" stroke="#8B84FF" strokeWidth="3" strokeLinecap="round"/>
        <circle cx="40" cy="-2" r="5" fill="#00D4AA"/>
        <circle cx="40" cy="-2" r="2.5" fill="white" opacity="0.6"/>
      </svg>
    </div>
  );
}

// ─── GLASS CARD ──────────────────────────────────────────────────────────────
function GlassCard({ children, theme, style = {}, onClick, active = false }) {
  const [pressed, setPressed] = React.useState(false);
  return (
    <div onClick={onClick}
      onPointerDown={() => onClick && setPressed(true)}
      onPointerUp={() => setPressed(false)}
      onPointerLeave={() => setPressed(false)}
      style={{
        background: theme.isDark
          ? active ? 'rgba(108,99,255,0.15)' : theme.surface
          : active ? 'rgba(108,99,255,0.08)' : theme.surface,
        backdropFilter: theme.isDark ? 'blur(20px)' : 'none',
        WebkitBackdropFilter: theme.isDark ? 'blur(20px)' : 'none',
        border: `1px solid ${active ? 'rgba(108,99,255,0.45)' : theme.border}`,
        borderRadius: 20,
        padding: 16,
        boxShadow: active ? `0 0 0 1px rgba(108,99,255,0.3), ${theme.isDark ? '0 8px 32px rgba(0,0,0,0.4)' : '0 4px 16px rgba(0,0,0,0.1)'}` : (theme.isDark ? '0 4px 20px rgba(0,0,0,0.3)' : '0 2px 12px rgba(0,0,0,0.06)'),
        cursor: onClick ? 'pointer' : 'default',
        transform: pressed ? 'scale(0.97)' : 'scale(1)',
        transition: 'transform 0.12s ease, box-shadow 0.2s ease, background 0.2s ease',
        ...style,
      }}>
      {children}
    </div>
  );
}

// ─── BUTTON ──────────────────────────────────────────────────────────────────
function Btn({ children, variant = 'primary', size = 'md', onClick, disabled, fullWidth, style = {} }) {
  const [pressed, setPressed] = React.useState(false);
  const bg = {
    primary: `linear-gradient(135deg, ${C.primaryLight}, ${C.primaryDark})`,
    accent: `linear-gradient(135deg, ${C.accentLight}, ${C.accent})`,
    secondary: 'rgba(255,255,255,0.08)',
    ghost: 'transparent',
    danger: `linear-gradient(135deg, #F87171, ${C.danger})`,
  }[variant];
  const color = variant === 'secondary' || variant === 'ghost' ? C.primaryLight : '#fff';
  const pad = size === 'sm' ? '8px 16px' : size === 'lg' ? '16px 28px' : '12px 20px';
  const fontSize = size === 'sm' ? 13 : size === 'lg' ? 16 : 14;
  return (
    <button onClick={onClick} disabled={disabled}
      onPointerDown={() => setPressed(true)} onPointerUp={() => setPressed(false)} onPointerLeave={() => setPressed(false)}
      style={{
        background: bg, color, padding: pad, fontSize, fontWeight: 600, fontFamily: 'Inter, sans-serif',
        border: variant === 'secondary' ? `1px solid ${C.primary}` : variant === 'ghost' ? `1px solid rgba(255,255,255,0.1)` : 'none',
        borderRadius: 999, cursor: disabled ? 'not-allowed' : 'pointer',
        width: fullWidth ? '100%' : 'auto',
        opacity: disabled ? 0.45 : 1,
        transform: pressed ? 'scale(0.96)' : 'scale(1)',
        transition: 'transform 0.1s ease, opacity 0.2s',
        boxShadow: variant === 'primary' ? '0 4px 16px rgba(108,99,255,0.4)' : variant === 'accent' ? '0 4px 16px rgba(0,212,170,0.35)' : 'none',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
        letterSpacing: '0.01em',
        ...style,
      }}>
      {children}
    </button>
  );
}

// ─── SECTION LABEL ────────────────────────────────────────────────────────────
function SectionLabel({ children, theme }) {
  return (
    <div style={{
      fontSize: 11, fontWeight: 700, letterSpacing: '0.1em',
      color: theme.text3, textTransform: 'uppercase', marginBottom: 10,
    }}>
      {children}
    </div>
  );
}

// ─── PRICE CHIP (map marker style) ───────────────────────────────────────────
function PriceChip({ price, avg, selected, size = 'md' }) {
  const diff = price - avg;
  const color = diff < -0.08 ? C.success : diff > 0.08 ? C.danger : C.warning;
  const bgAlpha = selected ? 1 : 0.92;
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 5, padding: size === 'sm' ? '4px 8px' : '6px 10px',
      background: color, borderRadius: 999, boxShadow: `0 2px 8px ${color}60`,
      border: selected ? '2px solid white' : '1.5px solid rgba(255,255,255,0.35)',
      fontSize: size === 'sm' ? 12 : 13, fontWeight: 700, color: 'white',
      transform: selected ? 'scale(1.1)' : 'scale(1)',
      transition: 'transform 0.2s',
    }}>
      <svg width="12" height="12" viewBox="0 0 24 24" fill="white" stroke="none">
        <path d="M3 22V8l5-5h8l5 5v14H3z"/><rect x="8" y="16" width="8" height="6" fill="rgba(0,0,0,0.3)"/>
      </svg>
      {price.toFixed(3)}
    </div>
  );
}

// ─── SKELETON LOADER ──────────────────────────────────────────────────────────
function Skeleton({ w = '100%', h = 16, radius = 8, theme, style = {} }) {
  return (
    <div style={{
      width: w, height: h, borderRadius: radius,
      background: theme.isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)',
      animation: 'skeletonPulse 1.5s ease-in-out infinite',
      ...style,
    }}/>
  );
}

// ─── TOAST ───────────────────────────────────────────────────────────────────
function Toast({ message, type = 'success', visible }) {
  const colors = { success: C.success, warning: C.warning, error: C.danger, info: C.primary };
  const icons = { success: '✓', warning: '⚠', error: '✕', info: 'i' };
  return (
    <div style={{
      position: 'absolute', top: 60, left: 16, right: 16, zIndex: 999,
      background: 'rgba(15,15,25,0.95)', backdropFilter: 'blur(20px)',
      border: `1px solid ${colors[type]}40`,
      borderRadius: 16, padding: '12px 16px',
      display: 'flex', alignItems: 'center', gap: 10,
      transform: visible ? 'translateY(0)' : 'translateY(-80px)',
      opacity: visible ? 1 : 0,
      transition: 'transform 0.3s cubic-bezier(0.34,1.56,0.64,1), opacity 0.2s',
      boxShadow: `0 4px 20px rgba(0,0,0,0.4), 0 0 0 1px ${colors[type]}20`,
    }}>
      <div style={{
        width: 28, height: 28, borderRadius: 999, background: colors[type],
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 12, fontWeight: 700, color: 'white', flexShrink: 0,
      }}>{icons[type]}</div>
      <span style={{ color: 'white', fontSize: 14, fontWeight: 500 }}>{message}</span>
    </div>
  );
}

// ─── BOTTOM NAV ──────────────────────────────────────────────────────────────
function BottomNav({ active, onChange, theme }) {
  const tabs = [
    { id: 'radar', label: 'Radar IA', Icon: Icons.radar },
    { id: 'trajet', label: 'Trajet', Icon: Icons.map },
    { id: 'carte', label: 'Carte', Icon: Icons.pin },
    { id: 'stats', label: 'Stats', Icon: Icons.chart },
    { id: 'profil', label: 'Profil', Icon: Icons.user },
  ];
  return (
    <div style={{
      position: 'absolute', bottom: 0, left: 0, right: 0, padding: '8px 12px 28px',
      background: theme.isDark ? 'linear-gradient(transparent, rgba(10,10,15,0.98) 40%)' : 'linear-gradient(transparent, rgba(245,245,247,0.98) 40%)',
      zIndex: 100, pointerEvents: 'none',
    }}>
      <div style={{
        display: 'flex', pointerEvents: 'all',
        background: theme.isDark ? 'rgba(14,14,22,0.95)' : 'rgba(255,255,255,0.95)',
        backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)',
        borderRadius: 999, padding: '6px',
        border: `1px solid ${theme.border}`,
        boxShadow: '0 4px 24px rgba(0,0,0,0.35)',
        gap: 4,
      }}>
        {tabs.map(tab => {
          const isActive = active === tab.id;
          return (
            <button key={tab.id} onClick={() => onChange(tab.id)}
              style={{
                flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
                justifyContent: 'center', gap: 2,
                background: isActive ? C.primary : 'transparent',
                borderRadius: 999, border: 'none', cursor: 'pointer',
                padding: isActive ? '7px 12px' : '7px 4px',
                transition: 'all 0.22s cubic-bezier(0.34,1.56,0.64,1)',
                transform: isActive ? 'scale(1.02)' : 'scale(1)',
                boxShadow: isActive ? `0 2px 12px rgba(108,99,255,0.5)` : 'none',
                minWidth: 0,
              }}>
              <tab.Icon size={isActive ? 19 : 20}
                color={isActive ? 'white' : theme.text3}/>
              {isActive && (
                <span style={{ fontSize: 10, color: 'white', fontWeight: 700, whiteSpace: 'nowrap', letterSpacing: '0.02em' }}>
                  {tab.label}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── GLOBAL STYLES ────────────────────────────────────────────────────────────
const sharedStyleEl = document.createElement('style');
sharedStyleEl.textContent = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
  * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
  @keyframes skeletonPulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.4; }
  }
  @keyframes fadeSlideUp {
    from { opacity: 0; transform: translateY(16px); }
    to { opacity: 1; transform: translateY(0); }
  }
  @keyframes scaleIn {
    from { opacity: 0; transform: scale(0.85); }
    to { opacity: 1; transform: scale(1); }
  }
  @keyframes pulseDot {
    0%, 100% { transform: scale(1); opacity: 1; }
    50% { transform: scale(1.4); opacity: 0.7; }
  }
  @keyframes glowPulse {
    0%, 100% { box-shadow: 0 0 12px 3px rgba(108,99,255,0.4); }
    50% { box-shadow: 0 0 24px 6px rgba(108,99,255,0.7); }
  }
  @keyframes badgeUnlock {
    0% { transform: scale(0) rotate(-20deg); opacity: 0; }
    60% { transform: scale(1.2) rotate(5deg); }
    100% { transform: scale(1) rotate(0); opacity: 1; }
  }
  @keyframes confettiBurst {
    0% { transform: translate(0,0) scale(1); opacity: 1; }
    100% { transform: translate(var(--cx), var(--cy)) scale(0); opacity: 0; }
  }
  @keyframes countUp {
    from { transform: translateY(6px); opacity: 0; }
    to { transform: translateY(0); opacity: 1; }
  }
  @keyframes fueloDance {
    0%, 100% { transform: rotate(-8deg) translateY(0); }
    50% { transform: rotate(8deg) translateY(-4px); }
  }
  @keyframes sparkle {
    0%, 100% { opacity: 0; transform: scale(0); }
    50% { opacity: 1; transform: scale(1); }
  }
  @keyframes slideInBottom {
    from { transform: translateY(100%); }
    to { transform: translateY(0); }
  }
  ::-webkit-scrollbar { display: none; }
  scrollbar-width: none;
`;
document.head.appendChild(sharedStyleEl);

// Export everything
Object.assign(window, {
  DARK, LIGHT, C, Icons, FueloMascot, GlassCard, Btn, SectionLabel, PriceChip, Skeleton, Toast, BottomNav,
});
