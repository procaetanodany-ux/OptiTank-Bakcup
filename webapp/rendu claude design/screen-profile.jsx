
// OptiTank — Profil Screen (hero + badges + history)
// Exports: ProfileScreen

const BADGES_DATA = [
  { id: 'first', name: 'Premier Plein', desc: '1er plein enregistré', colors: ['#FFD700', '#FF8C00'], unlocked: true, new: true,
    icon: (c) => <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2z"/></svg> },
  { id: 'economical', name: 'Économe', desc: 'Économiser 10 CHF', colors: ['#22C55E', '#16A34A'], unlocked: true, new: false,
    icon: (c) => <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg> },
  { id: 'explorer', name: 'Grand Explorateur', desc: '10 stations visitées', colors: ['#3B82F6', '#1D4ED8'], unlocked: true, new: false,
    icon: (c) => <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2"><polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21"/><line x1="9" y1="3" x2="9" y2="18"/><line x1="15" y1="6" x2="15" y2="21"/></svg> },
  { id: 'hunter', name: 'Chasseur de Prix', desc: '-0.20 CHF vs moyenne', colors: ['#EF4444', '#DC2626'], unlocked: true, new: false,
    icon: (c) => <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="4"/><line x1="12" y1="2" x2="12" y2="8"/><line x1="12" y1="16" x2="12" y2="22"/><line x1="2" y1="12" x2="8" y2="12"/><line x1="16" y1="12" x2="22" y2="12"/></svg> },
  { id: 'express', name: 'Plein Express', desc: 'Plein en < 2 min', colors: ['#06B6D4', '#0891B2'], unlocked: true, new: false,
    icon: (c) => <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg> },
  { id: 'radar', name: 'Radar Addict', desc: '50 scans Radar IA', colors: ['#6C63FF', '#4338CA'], unlocked: false, new: false,
    icon: (c) => <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2"><circle cx="12" cy="12" r="2"/><path d="M12 2a10 10 0 0 1 7.38 16.87M4.62 18.87A10 10 0 0 1 12 2"/><path d="M12 6a6 6 0 0 1 4.47 10.12M7.53 16.12A6 6 0 0 1 12 6"/></svg> },
  { id: 'loyal', name: 'Fidèle', desc: '7 jours consécutifs', colors: ['#F59E0B', '#D97706'], unlocked: false, new: false,
    icon: (c) => <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/></svg> },
  { id: 'traveler', name: 'Routard', desc: '5 trajets planifiés', colors: ['#00D4AA', '#0097A7'], unlocked: false, new: false,
    icon: (c) => <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2"><path d="M3 17l4-8 4 4 4-4 4 8"/><path d="M3 21h18"/></svg> },
  { id: 'scanner', name: 'Scanner', desc: '5 tickets scannés', colors: ['#EAB308', '#CA8A04'], unlocked: false, new: false,
    icon: (c) => <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18"/></svg> },
  { id: 'community', name: 'Communauté', desc: '3 prix signalés', colors: ['#EC4899', '#BE185D'], unlocked: false, new: false,
    icon: (c) => <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg> },
  { id: 'veteran', name: 'Vétéran', desc: '3 mois d\'utilisation', colors: ['#9CA3AF', '#6B7280'], unlocked: false, new: false,
    icon: (c) => <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg> },
  { id: 'night', name: 'Nuit Blanche', desc: 'Plein après minuit', colors: ['#4F46E5', '#1E1B4B'], unlocked: false, new: false,
    icon: (c) => <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg> },
];

const HISTORY = [
  { date: '19 mai 2026', station: 'Avia Cheseaux', liters: 42.3, cost: 72.68, price: 1.718, fuel: 'SP95' },
  { date: '12 mai 2026', station: 'Migrol Cossonay', liters: 38.7, cost: 69.20, price: 1.788, fuel: 'SP95' },
  { date: '5 mai 2026', station: 'Avia Cheseaux', liters: 45.1, cost: 77.55, price: 1.720, fuel: 'SP95' },
  { date: '28 avr. 2026', station: 'Shell Lausanne', liters: 40.0, cost: 74.40, price: 1.860, fuel: 'SP95' },
  { date: '20 avr. 2026', station: 'Migrol Cossonay', liters: 41.5, cost: 74.27, price: 1.789, fuel: 'SP95' },
];

function BadgeTile({ badge, theme }) {
  const [showTooltip, setShowTooltip] = React.useState(false);
  const [justUnlocked] = React.useState(badge.new);

  return (
    <div onClick={() => setShowTooltip(v => !v)}
      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
      {/* Badge circle */}
      <div style={{
        width: 68, height: 68, borderRadius: '50%', position: 'relative',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: badge.unlocked
          ? `linear-gradient(135deg, ${badge.colors[0]}, ${badge.colors[1]})`
          : theme.isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
        boxShadow: badge.unlocked
          ? `0 4px 16px ${badge.colors[0]}50, inset 0 1px 0 rgba(255,255,255,0.2)`
          : 'none',
        border: badge.unlocked
          ? `1px solid ${badge.colors[0]}60`
          : `1px solid ${theme.border}`,
        filter: badge.unlocked ? 'none' : 'grayscale(1)',
        animation: justUnlocked ? 'badgeUnlock 0.6s cubic-bezier(0.34,1.56,0.64,1)' : 'none',
        transition: 'transform 0.15s',
      }}>
        {/* Glow ring for unlocked */}
        {badge.unlocked && (
          <div style={{
            position: 'absolute', inset: -3, borderRadius: '50%',
            border: `1.5px solid ${badge.colors[0]}40`,
            animation: 'glowPulse 3s ease-in-out infinite',
          }}/>
        )}
        {/* Icon */}
        <div style={{ opacity: badge.unlocked ? 1 : 0.35 }}>
          {badge.icon(badge.unlocked ? 'white' : '#888')}
        </div>
        {/* Lock overlay */}
        {!badge.unlocked && (
          <div style={{
            position: 'absolute', bottom: 2, right: 2,
            width: 20, height: 20, borderRadius: '50%',
            background: theme.isDark ? '#1a1a28' : '#e0e0e8',
            border: `1px solid ${theme.border}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={theme.text3} strokeWidth="3">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
          </div>
        )}
        {/* NEW badge */}
        {badge.new && badge.unlocked && (
          <div style={{
            position: 'absolute', top: -4, right: -4,
            background: C.danger, borderRadius: 999, padding: '2px 6px',
            fontSize: 9, fontWeight: 800, color: 'white',
          }}>NEW</div>
        )}
      </div>
      <div style={{
        fontSize: 11, fontWeight: 600, textAlign: 'center', lineHeight: 1.3,
        color: badge.unlocked ? theme.text1 : theme.text3,
        maxWidth: 72,
      }}>{badge.name}</div>
      {/* Tooltip */}
      {showTooltip && (
        <div style={{
          position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
          zIndex: 200, background: theme.isDark ? '#14141F' : '#fff',
          border: `1px solid ${theme.border}`, borderRadius: 16, padding: '14px 18px',
          maxWidth: 200, textAlign: 'center',
          boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
          animation: 'scaleIn 0.2s ease',
        }}>
          <div style={{ marginBottom: 8 }}>{badge.icon(badge.unlocked ? badge.colors[0] : '#888')}</div>
          <div style={{ fontSize: 15, fontWeight: 800, color: theme.text1, marginBottom: 4 }}>{badge.name}</div>
          <div style={{ fontSize: 13, color: theme.text3 }}>{badge.desc}</div>
          {!badge.unlocked && (
            <div style={{
              marginTop: 10, fontSize: 12, fontWeight: 600, color: theme.text3,
              padding: '4px 10px', background: theme.surface2, borderRadius: 999,
              display: 'inline-block',
            }}>🔒 Non débloqué</div>
          )}
        </div>
      )}
    </div>
  );
}

// Mini sparkline
function Sparkline({ data, color, width = 80, height = 32 }) {
  const canvasRef = React.useRef(null);
  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    const min = Math.min(...data), max = Math.max(...data);
    const x = i => (i / (data.length - 1)) * W;
    const y = v => H - ((v - min) / (max - min + 0.01)) * H * 0.8 - H * 0.1;
    ctx.clearRect(0, 0, W, H);
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, color + '60');
    grad.addColorStop(1, color + '00');
    ctx.beginPath();
    ctx.moveTo(x(0), y(data[0]));
    data.forEach((v, i) => { if (i > 0) ctx.lineTo(x(i), y(v)); });
    ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.closePath();
    ctx.fillStyle = grad; ctx.fill();
    ctx.beginPath();
    ctx.moveTo(x(0), y(data[0]));
    data.forEach((v, i) => { if (i > 0) ctx.lineTo(x(i), y(v)); });
    ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.stroke();
  }, [data, color]);
  return <canvas ref={canvasRef} width={width} height={height} style={{ width, height }}/>;
}

function ProfileScreen({ theme }) {
  const [showBadgeTooltip, setShowBadgeTooltip] = React.useState(null);
  const unlockedCount = BADGES_DATA.filter(b => b.unlocked).length;
  const totalBadges = BADGES_DATA.length;
  const progress = (unlockedCount / totalBadges) * 100;
  const savingsData = [12, 18, 22, 15, 28, 32, 30, 35, 47];

  // SVG progress ring
  const ringR = 44, ringStroke = 4;
  const circumference = ringR * 2 * Math.PI;
  const offset = circumference - (progress / 100) * circumference;

  return (
    <div style={{
      flex: 1, overflow: 'auto', background: theme.bg,
      color: theme.text1, fontFamily: 'Inter, sans-serif',
    }}>
      {/* HERO */}
      <div style={{
        position: 'relative', padding: '28px 20px 24px',
        background: theme.isDark
          ? 'linear-gradient(160deg, #1A1530 0%, #0D0D1A 60%, #0A0A0F 100%)'
          : 'linear-gradient(160deg, #E8E4FF 0%, #F5F4FF 60%, #F5F5F7 100%)',
        borderBottom: `1px solid ${theme.border}`,
        overflow: 'hidden',
      }}>
        {/* BG particles */}
        {[...Array(8)].map((_, i) => (
          <div key={i} style={{
            position: 'absolute',
            width: 3 + (i % 3) * 2, height: 3 + (i % 3) * 2,
            borderRadius: '50%', background: C.primary,
            opacity: 0.15 + (i % 4) * 0.08,
            top: `${10 + i * 11}%`, left: `${5 + i * 13}%`,
            animation: `sparkle ${2 + i * 0.4}s ease-in-out infinite`,
            animationDelay: `${i * 0.3}s`,
          }}/>
        ))}

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
          {/* Avatar + progress ring */}
          <div style={{ position: 'relative', width: 96 + ringStroke * 4, height: 96 + ringStroke * 4 }}>
            <svg width={96 + ringStroke * 4} height={96 + ringStroke * 4}
              style={{ position: 'absolute', top: 0, left: 0, transform: 'rotate(-90deg)' }}>
              <circle cx={(96 + ringStroke * 4) / 2} cy={(96 + ringStroke * 4) / 2}
                r={ringR} fill="none" stroke={theme.isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'}
                strokeWidth={ringStroke}/>
              <circle cx={(96 + ringStroke * 4) / 2} cy={(96 + ringStroke * 4) / 2}
                r={ringR} fill="none"
                stroke={`url(#ringGrad)`}
                strokeWidth={ringStroke}
                strokeLinecap="round"
                strokeDasharray={`${circumference} ${circumference}`}
                strokeDashoffset={offset}
                style={{ transition: 'stroke-dashoffset 1s ease' }}/>
              <defs>
                <linearGradient id="ringGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor={C.primary}/>
                  <stop offset="100%" stopColor={C.accent}/>
                </linearGradient>
              </defs>
            </svg>
            {/* Avatar circle */}
            <div style={{
              position: 'absolute', top: ringStroke * 2, left: ringStroke * 2,
              width: 96, height: 96, borderRadius: '50%',
              background: theme.isDark
                ? 'linear-gradient(135deg, #2A2A45, #1A1A30)'
                : 'linear-gradient(135deg, #D4D0FF, #B8B4FF)',
              border: `2px solid ${theme.isDark ? 'rgba(108,99,255,0.3)' : 'rgba(108,99,255,0.2)'}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              overflow: 'hidden',
            }}>
              <svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke={C.primaryLight} strokeWidth="1.5">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                <circle cx="12" cy="7" r="4"/>
              </svg>
              {/* Camera badge */}
              <div style={{
                position: 'absolute', bottom: 4, right: 4,
                width: 24, height: 24, borderRadius: '50%',
                background: C.primary, border: '2px solid #0A0A0F',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                  <circle cx="12" cy="13" r="4"/>
                </svg>
              </div>
            </div>
            {/* Badge count */}
            <div style={{
              position: 'absolute', bottom: -2, right: -2,
              background: C.primary, borderRadius: 999,
              padding: '2px 7px', fontSize: 11, fontWeight: 800, color: 'white',
              border: `2px solid ${theme.bg}`,
            }}>{unlockedCount}/{totalBadges}</div>
          </div>

          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: theme.text1 }}>Dany Caetano</div>
            <div style={{ fontSize: 13, color: theme.text3, marginTop: 2 }}>prof2mlg@gmail.com</div>
            <div style={{ fontSize: 12, color: theme.text3, marginTop: 4 }}>
              {Math.round(progress)}% des badges débloqués
            </div>
          </div>
        </div>
      </div>

      {/* Savings card */}
      <div style={{ padding: '14px 16px 0' }}>
        <div style={{
          background: theme.isDark
            ? 'linear-gradient(135deg, rgba(0,212,170,0.18), rgba(34,197,94,0.08))'
            : 'linear-gradient(135deg, rgba(0,212,170,0.15), rgba(34,197,94,0.07))',
          border: '1px solid rgba(0,212,170,0.35)', borderRadius: 20,
          padding: '14px 16px',
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.accent, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 4 }}>
              Économies ce mois
            </div>
            <div style={{ fontSize: 32, fontWeight: 900, color: C.accent, letterSpacing: '-1px', lineHeight: 1 }}>
              CHF 47.30
            </div>
            <div style={{ fontSize: 12, color: theme.text3, marginTop: 4 }}>vs. prix moyen du marché</div>
          </div>
          <Sparkline data={savingsData} color={C.accent} width={80} height={40}/>
        </div>
      </div>

      {/* Vehicle card */}
      <div style={{ padding: '14px 16px 0' }}>
        <SectionLabel theme={theme}>Mon véhicule</SectionLabel>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12,
          background: theme.surface, border: `1px solid ${theme.border}`,
          borderRadius: 16, padding: '12px 14px',
        }}>
          <div style={{ width: 40, height: 40, borderRadius: 12, background: `${C.primary}20`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={C.primaryLight} strokeWidth="2">
              <path d="M5 17H3v-5l3.5-6h9L19 12v5h-2"/><circle cx="7.5" cy="17.5" r="2.5"/><circle cx="16.5" cy="17.5" r="2.5"/>
            </svg>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: theme.text1 }}>VW Golf 8 (2024)</div>
            <div style={{ fontSize: 12, color: theme.text3 }}>SP95 · Réservoir 50L</div>
          </div>
          <button style={{
            padding: '6px 14px', borderRadius: 999, background: theme.surface2,
            border: `1px solid ${theme.border}`, fontSize: 12, fontWeight: 600,
            color: theme.text2, cursor: 'pointer',
          }}>Modifier</button>
        </div>
      </div>

      {/* Badges grid */}
      <div style={{ padding: '16px 16px 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <SectionLabel theme={theme}>Badges & réussites</SectionLabel>
          <span style={{ fontSize: 12, color: theme.text3 }}>{unlockedCount} / {totalBadges} débloqués</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
          {BADGES_DATA.map(badge => (
            <BadgeTile key={badge.id} badge={badge} theme={theme}/>
          ))}
        </div>
      </div>

      {/* History */}
      <div style={{ padding: '16px 16px 0' }}>
        <SectionLabel theme={theme}>Historique des pleins</SectionLabel>
        <div style={{
          background: theme.isDark ? theme.surface : '#fff',
          border: `1px solid ${theme.border}`, borderRadius: 18,
          overflow: 'hidden',
          boxShadow: theme.isDark ? '0 4px 16px rgba(0,0,0,0.25)' : '0 2px 10px rgba(0,0,0,0.06)',
        }}>
          {HISTORY.map((item, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '13px 14px',
              borderBottom: i < HISTORY.length - 1 ? `1px solid ${theme.borderSubtle}` : 'none',
            }}>
              <div style={{
                width: 38, height: 38, borderRadius: 12, flexShrink: 0,
                background: `${C.primary}18`, border: `1px solid ${C.primary}30`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={C.primaryLight} strokeWidth="2">
                  <path d="M3 22V8l5-5h8l5 5v14H3z"/><path d="M10 22V16h4v6"/>
                </svg>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: theme.text1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {item.station}
                </div>
                <div style={{ fontSize: 12, color: theme.text3, marginTop: 1 }}>{item.date} · {item.liters}L</div>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: theme.text1 }}>
                  CHF {item.cost.toFixed(2)}
                </div>
                <div style={{ fontSize: 11, color: theme.text3 }}>{item.price.toFixed(3)} CHF/L</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Settings */}
      <div style={{ padding: '16px 16px 0' }}>
        <SectionLabel theme={theme}>Préférences</SectionLabel>
        {[
          ['Carburant préféré', 'SP95'],
          ['Rayon de recherche', '40 km'],
          ['Notifications prix', 'Activées'],
        ].map(([label, value]) => (
          <div key={label} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '13px 14px',
            borderBottom: `1px solid ${theme.borderSubtle}`,
            background: theme.isDark ? theme.surface : '#fff',
          }}>
            <span style={{ fontSize: 14, color: theme.text1 }}>{label}</span>
            <span style={{ fontSize: 14, fontWeight: 600, color: C.primaryLight }}>{value}</span>
          </div>
        ))}
      </div>

      <div style={{ height: 100 }}/>
    </div>
  );
}

Object.assign(window, { ProfileScreen, BADGES_DATA });
