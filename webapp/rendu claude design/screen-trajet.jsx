
// OptiTank — Trajet Intelligent Screen
// Exports: TrajetScreen

function TrajetScreen({ theme }) {
  const [depart, setDepart] = React.useState('');
  const [arrivee, setArrivee] = React.useState('');
  const [state, setState] = React.useState('idle'); // idle | loading | results
  const [activeInput, setActiveInput] = React.useState(null);

  const ROUTE_STATIONS = [
    { name: 'Avia Cheseaux', km: '1.2 km sur la route', price: 1.72, fuel: 'SP95', detour: '+0 min', saving: 4.20, color: '#22C55E', recommended: true },
    { name: 'Migrol Cossonay', km: '4.8 km sur la route', price: 1.79, fuel: 'SP95', detour: '+3 min', saving: 2.80, color: '#22C55E', recommended: false },
    { name: 'BP Echallens', km: '7.1 km sur la route', price: 1.88, fuel: 'SP95', detour: '+5 min', saving: 0.60, color: '#F59E0B', recommended: false },
  ];

  const SUGGESTIONS = ['Genève', 'Lausanne', 'Berne', 'Zurich', 'Fribourg', 'Nyon', 'Morges'];

  function handleCalculate() {
    if (!depart.trim() || !arrivee.trim()) return;
    setState('loading');
    setTimeout(() => setState('results'), 2200);
  }

  function EmptyIllustration() {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '40px 32px', textAlign: 'center', gap: 16 }}>
        {/* SVG road illustration */}
        <svg width="180" height="120" viewBox="0 0 180 120" fill="none">
          <defs>
            <linearGradient id="roadGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="rgba(108,99,255,0)"/>
              <stop offset="50%" stopColor="rgba(108,99,255,0.25)"/>
              <stop offset="100%" stopColor="rgba(108,99,255,0)"/>
            </linearGradient>
          </defs>
          {/* Road */}
          <path d="M20 100 Q90 40 160 100" stroke={theme.isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)'} strokeWidth="18" fill="none" strokeLinecap="round"/>
          <path d="M20 100 Q90 40 160 100" stroke="url(#roadGrad)" strokeWidth="18" fill="none" strokeLinecap="round"/>
          {/* Road markings */}
          <path d="M20 100 Q90 40 160 100" stroke="rgba(255,255,255,0.15)" strokeWidth="2" fill="none" strokeDasharray="8,8" strokeLinecap="round"/>
          {/* Car (simple) */}
          <g transform="translate(75, 62) rotate(-15)">
            <rect x="-14" y="-8" width="28" height="16" rx="4" fill={C.primary}/>
            <rect x="-9" y="-14" width="18" height="10" rx="2" fill={C.primaryLight}/>
            <circle cx="-8" cy="8" r="4" fill={theme.isDark ? '#1a1a28' : '#e8e8f0'}/>
            <circle cx="8" cy="8" r="4" fill={theme.isDark ? '#1a1a28' : '#e8e8f0'}/>
            <circle cx="-8" cy="8" r="2" fill={theme.isDark ? '#333' : '#ccc'}/>
            <circle cx="8" cy="8" r="2" fill={theme.isDark ? '#333' : '#ccc'}/>
          </g>
          {/* Start pin */}
          <circle cx="20" cy="100" r="7" fill={C.primary} opacity="0.8"/>
          <circle cx="20" cy="100" r="3.5" fill="white"/>
          {/* End pin */}
          <path d="M160 100 C160 100, 153 88, 153 82 C153 74, 160 68, 167 68 C174 68, 181 74, 181 82 C181 88, 174 100, 160 100Z" fill={C.danger} opacity="0.8"/>
          <circle cx="167" cy="81" r="4" fill="white" opacity="0.8"/>
          {/* Distance arc */}
          <path d="M30 88 Q90 30 150 88" stroke={C.primary} strokeWidth="1.5" fill="none" strokeDasharray="4,4" opacity="0.4"/>
        </svg>
        <FueloMascot size={52}/>
        <div style={{ fontSize: 17, fontWeight: 700, color: theme.text1 }}>Planifiez votre trajet</div>
        <div style={{ fontSize: 14, color: theme.text3, lineHeight: 1.6, maxWidth: 260 }}>
          Entrez votre destination pour trouver les meilleures stations <strong style={{ color: theme.text2 }}>sur votre route</strong>, sans détour inutile.
        </div>
      </div>
    );
  }

  function LoadingState() {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '32px', gap: 16 }}>
        <div style={{ position: 'relative', width: 72, height: 72 }}>
          <div style={{
            width: 72, height: 72, borderRadius: '50%',
            border: `3px solid ${theme.surface2}`,
            borderTop: `3px solid ${C.primary}`,
            animation: 'spin 0.8s linear infinite',
          }}/>
          <div style={{
            position: 'absolute', inset: 12, borderRadius: '50%',
            background: `${C.primary}15`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={C.primary} strokeWidth="2">
              <circle cx="12" cy="12" r="2"/><path d="M12 2a10 10 0 0 1 7.38 16.87M4.62 18.87A10 10 0 0 1 12 2"/>
              <path d="M12 6a6 6 0 0 1 4.47 10.12M7.53 16.12A6 6 0 0 1 12 6"/>
            </svg>
          </div>
        </div>
        <div style={{ fontSize: 16, fontWeight: 600, color: theme.text1 }}>Analyse du trajet…</div>
        <div style={{ fontSize: 13, color: theme.text3 }}>Recherche des meilleures stations sur votre route</div>
        {['Calcul de l\'itinéraire optimal', 'Scan des prix en temps réel', 'Analyse des détours', 'Calcul des économies'].map((step, i) => (
          <div key={step} style={{
            display: 'flex', alignItems: 'center', gap: 8,
            fontSize: 13, color: theme.text3,
            animation: `fadeSlideUp 0.4s ease ${i * 0.4}s both`,
          }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: C.accent, animation: 'pulseDot 1s ease-in-out infinite', animationDelay: `${i * 0.2}s` }}/>
            {step}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden',
      background: theme.bg, color: theme.text1, fontFamily: 'Inter, sans-serif',
    }}>
      {/* Header */}
      <div style={{ padding: '16px 20px 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: `${C.primary}20`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={C.primaryLight} strokeWidth="2">
              <polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21"/>
              <line x1="9" y1="3" x2="9" y2="18"/><line x1="15" y1="6" x2="15" y2="21"/>
            </svg>
          </div>
          <div>
            <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: '-0.4px' }}>Trajets Intelligents</div>
            <div style={{ fontSize: 12, color: theme.text3 }}>Stations sur votre route, sans détour</div>
          </div>
        </div>
      </div>

      {/* Route form */}
      <div style={{ padding: '16px 16px 0' }}>
        <div style={{
          background: theme.isDark ? theme.surface : '#fff',
          border: `1px solid ${theme.border}`, borderRadius: 20,
          overflow: 'hidden', boxShadow: theme.isDark ? '0 4px 16px rgba(0,0,0,0.25)' : '0 2px 10px rgba(0,0,0,0.08)',
        }}>
          {/* Depart */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', position: 'relative' }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: C.primary, flexShrink: 0, boxShadow: `0 0 8px ${C.primary}` }}/>
            <input value={depart} onChange={e => setDepart(e.target.value)}
              onFocus={() => setActiveInput('depart')} onBlur={() => setTimeout(() => setActiveInput(null), 150)}
              placeholder="Départ (ex: Sullens)"
              style={{
                flex: 1, background: 'none', border: 'none', outline: 'none',
                fontSize: 14, color: theme.text1, fontFamily: 'Inter, sans-serif',
              }}/>
            {depart && (
              <button onClick={() => setDepart('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: theme.text3, padding: 4 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            )}
          </div>
          {/* Connector line */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '0 14px' }}>
            <div style={{ width: 10, display: 'flex', justifyContent: 'center' }}>
              <div style={{ width: 1, height: 16, background: theme.borderSubtle }}/>
            </div>
          </div>
          {/* Arrivee */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px' }}>
            <div style={{ flexShrink: 0 }}>
              <svg width="10" height="13" viewBox="0 0 10 13" fill={C.danger}>
                <path d="M5 0C2.24 0 0 2.24 0 5c0 3.75 5 8 5 8s5-4.25 5-8c0-2.76-2.24-5-5-5zm0 6.5c-.83 0-1.5-.67-1.5-1.5S4.17 3.5 5 3.5 6.5 4.17 6.5 5 5.83 6.5 5 6.5z"/>
              </svg>
            </div>
            <input value={arrivee} onChange={e => setArrivee(e.target.value)}
              onFocus={() => setActiveInput('arrivee')} onBlur={() => setTimeout(() => setActiveInput(null), 150)}
              placeholder="Arrivée (ex: Lausanne)"
              style={{
                flex: 1, background: 'none', border: 'none', outline: 'none',
                fontSize: 14, color: theme.text1, fontFamily: 'Inter, sans-serif',
              }}/>
            {arrivee && (
              <button onClick={() => setArrivee('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: theme.text3, padding: 4 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            )}
          </div>
          {/* Quick suggestions */}
          {activeInput && (
            <div style={{ borderTop: `1px solid ${theme.borderSubtle}`, padding: '8px 12px 10px' }}>
              <div style={{ fontSize: 11, color: theme.text3, marginBottom: 6, fontWeight: 600 }}>Suggestions rapides</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {SUGGESTIONS.map(s => (
                  <button key={s} onClick={() => {
                    if (activeInput === 'depart') setDepart(s);
                    else setArrivee(s);
                    setActiveInput(null);
                  }} style={{
                    padding: '5px 12px', borderRadius: 999, fontSize: 13, fontWeight: 500,
                    background: theme.surface2, border: `1px solid ${theme.border}`,
                    color: theme.text2, cursor: 'pointer',
                  }}>{s}</button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Calculate button */}
        <div style={{ marginTop: 12 }}>
          <Btn variant="primary" size="lg" fullWidth onClick={handleCalculate}
            disabled={!depart.trim() || !arrivee.trim() || state === 'loading'}
            style={{ fontSize: 15, fontWeight: 800 }}>
            {state === 'loading'
              ? <><span style={{ width: 16, height: 16, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.4)', borderTop: '2px solid white', display: 'inline-block', animation: 'spin 0.7s linear infinite' }}/> Analyse…</>
              : <><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><circle cx="12" cy="12" r="2"/><path d="M12 2a10 10 0 0 1 7.38 16.87"/><path d="M12 6a6 6 0 0 1 4.47 10.12"/></svg> Calculer l'itinéraire IA</>
            }
          </Btn>
        </div>
      </div>

      {/* Content area */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        {state === 'idle' && <EmptyIllustration/>}
        {state === 'loading' && <LoadingState/>}
        {state === 'results' && (
          <div style={{ padding: '16px 16px 0', animation: 'fadeSlideUp 0.4s ease' }}>
            {/* Route summary */}
            <div style={{
              display: 'flex', gap: 8, marginBottom: 14,
            }}>
              {[
                { icon: '📍', label: depart, sub: 'Départ' },
                { icon: '→', label: null, sub: null },
                { icon: '🏁', label: arrivee, sub: 'Arrivée' },
              ].map((item, i) => item.label !== null ? (
                <div key={i} style={{
                  flex: 1, background: theme.surface, border: `1px solid ${theme.border}`,
                  borderRadius: 14, padding: '10px 12px',
                }}>
                  <div style={{ fontSize: 13, color: theme.text3, marginBottom: 2 }}>{item.sub}</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: theme.text1 }}>{item.label}</div>
                </div>
              ) : (
                <div key={i} style={{ display: 'flex', alignItems: 'center', fontSize: 18, color: theme.text3 }}>→</div>
              ))}
            </div>

            {/* Route info bar */}
            <div style={{
              background: `${C.primary}12`, border: `1px solid ${C.primary}25`,
              borderRadius: 14, padding: '10px 14px', marginBottom: 14,
              display: 'flex', gap: 16,
            }}>
              {[['45 min', 'Durée'], ['38 km', 'Distance'], ['3 stations', 'Sur la route']].map(([v, l]) => (
                <div key={l}>
                  <div style={{ fontSize: 15, fontWeight: 800, color: C.primaryLight }}>{v}</div>
                  <div style={{ fontSize: 11, color: theme.text3 }}>{l}</div>
                </div>
              ))}
            </div>

            <SectionLabel theme={theme}>Stations sur votre route</SectionLabel>
            {ROUTE_STATIONS.map((s, i) => (
              <div key={i} style={{
                background: s.recommended
                  ? 'linear-gradient(135deg, rgba(34,197,94,0.12), rgba(34,197,94,0.04))'
                  : theme.surface,
                border: `1px solid ${s.recommended ? 'rgba(34,197,94,0.35)' : theme.border}`,
                borderRadius: 18, padding: '14px 16px', marginBottom: 10,
                display: 'flex', alignItems: 'center', gap: 12,
              }}>
                <div style={{
                  width: 40, height: 40, borderRadius: 12, flexShrink: 0,
                  background: `${s.color}20`, border: `1px solid ${s.color}30`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={s.color} strokeWidth="2">
                    <path d="M3 22V8l5-5h8l5 5v14H3z"/><path d="M10 22V16h4v6"/>
                  </svg>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 15, fontWeight: 700, color: theme.text1 }}>{s.name}</span>
                    {s.recommended && (
                      <span style={{
                        fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 999,
                        background: 'rgba(34,197,94,0.2)', color: C.success,
                      }}>RECOMMANDÉ</span>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 10, marginTop: 3 }}>
                    <span style={{ fontSize: 12, color: theme.text3 }}>{s.km}</span>
                    <span style={{ fontSize: 12, color: theme.text3 }}>{s.detour}</span>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 20, fontWeight: 900, color: s.color }}>{s.price.toFixed(3)}</div>
                  <div style={{ fontSize: 11, color: theme.text3 }}>CHF/L</div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: C.success, marginTop: 2 }}>−{s.saving.toFixed(2)} CHF</div>
                </div>
              </div>
            ))}
            <div style={{ height: 100 }}/>
          </div>
        )}
      </div>
    </div>
  );
}

Object.assign(window, { TrajetScreen });
