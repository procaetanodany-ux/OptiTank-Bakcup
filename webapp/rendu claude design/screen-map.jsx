
// OptiTank — Carte Interactive Screen
// Exports: MapScreen

function MapScreen({ theme }) {
  const [selectedStation, setSelectedStation] = React.useState(null);
  const [filterOpen, setFilterOpen] = React.useState(false);
  const [fuelType, setFuelType] = React.useState('SP95');
  const [sortBy, setSortBy] = React.useState('prix');
  const [favorited, setFavorited] = React.useState(false);
  const [sheetState, setSheetState] = React.useState('peek'); // peek | open
  const [detailView, setDetailView] = React.useState(false);

  const AVG_PRICE = 1.88;

  const STATIONS = [
    { id: 1, name: 'Avia Cheseaux', addr: 'Route de Cheseaux 12, 1033 Cheseaux', dist: '1.2 km', price: 1.72, diesel: 1.95, sp98: 1.82, x: 32, y: 38, brand: 'AVIA' },
    { id: 2, name: 'Shell Lausanne Nord', addr: 'Av. des Boveresses 42, 1010 Lausanne', dist: '3.4 km', price: 1.86, diesel: 2.08, sp98: 1.96, x: 68, y: 55, brand: 'Shell' },
    { id: 3, name: 'Garage Emery Sàrl', addr: 'Route de Sullens 9, 1303 Penthaz', dist: '4.8 km', price: 1.97, diesel: 2.18, sp98: 2.07, x: 22, y: 63, brand: 'Indép.' },
    { id: 4, name: 'Migrol Cossonay', addr: 'Grand-Rue 18, 1304 Cossonay', dist: '6.1 km', price: 1.79, diesel: 2.02, sp98: 1.89, x: 54, y: 28, brand: 'Migrol' },
    { id: 5, name: 'BP Echallens', addr: 'Route de Lausanne 5, 1040 Echallens', dist: '8.3 km', price: 1.91, diesel: 2.14, sp98: 2.01, x: 78, y: 74, brand: 'BP' },
  ];

  const selected = selectedStation !== null ? STATIONS.find(s => s.id === selectedStation) : null;

  function priceColor(price) {
    const d = price - AVG_PRICE;
    if (d < -0.07) return '#22C55E';
    if (d > 0.07) return '#EF4444';
    return '#F59E0B';
  }

  // ── MAP SVG ──────────────────────────────────────────────────────────────
  function MockMap() {
    return (
      <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice"
        style={{ position: 'absolute', inset: 0 }}>
        {/* Base land */}
        <rect width="100" height="100" fill={theme.isDark ? '#1A2015' : '#2E3D1F'}/>
        {/* Fields */}
        <polygon points="0,0 50,0 60,20 40,30 10,25 0,15" fill={theme.isDark ? '#1E2E16' : '#2A3A14'}/>
        <polygon points="50,0 100,0 100,40 80,35 65,15 55,5" fill={theme.isDark ? '#1C2A14' : '#283817'}/>
        <polygon points="0,60 25,55 50,65 60,80 30,90 0,85" fill={theme.isDark ? '#1E2E16' : '#2A3A14'}/>
        <polygon points="60,70 100,65 100,100 55,100 50,80" fill={theme.isDark ? '#1C2A14' : '#283817'}/>
        {/* Lighter fields */}
        <polygon points="15,30 40,28 45,50 20,55 10,40" fill={theme.isDark ? '#263520' : '#344A22'}/>
        <polygon points="55,30 80,25 85,50 70,58 50,48" fill={theme.isDark ? '#243320' : '#304520'}/>
        {/* Village area */}
        <rect x="28" y="42" width="20" height="16" rx="2" fill={theme.isDark ? '#2A2A3A' : '#3A3A50'} opacity="0.8"/>
        <rect x="32" y="44" width="4" height="4" fill={theme.isDark ? '#3A3A4A' : '#4A4A60'} opacity="0.6"/>
        <rect x="38" y="44" width="4" height="4" fill={theme.isDark ? '#3A3A4A' : '#4A4A60'} opacity="0.6"/>
        <rect x="32" y="50" width="4" height="4" fill={theme.isDark ? '#3A3A4A' : '#4A4A60'} opacity="0.6"/>
        {/* Small village 2 */}
        <rect x="60" y="55" width="14" height="10" rx="2" fill={theme.isDark ? '#2A2A3A' : '#3A3A50'} opacity="0.7"/>
        {/* Main road (horizontal) */}
        <path d="M0 52 Q30 48 50 51 Q70 54 100 50" stroke={theme.isDark ? '#3A3A48' : '#5A5A70'} strokeWidth="4" fill="none"/>
        <path d="M0 52 Q30 48 50 51 Q70 54 100 50" stroke={theme.isDark ? '#4A4A5A' : '#6A6A80'} strokeWidth="2.5" fill="none"/>
        <path d="M0 52 Q30 48 50 51 Q70 54 100 50" stroke="rgba(255,255,255,0.12)" strokeWidth="0.8" strokeDasharray="3,3" fill="none"/>
        {/* Vertical road */}
        <path d="M48 0 Q50 25 49 52 Q48 70 50 100" stroke={theme.isDark ? '#383848' : '#585868'} strokeWidth="3" fill="none"/>
        <path d="M48 0 Q50 25 49 52 Q48 70 50 100" stroke={theme.isDark ? '#484858' : '#686878'} strokeWidth="1.8" fill="none"/>
        {/* Small road */}
        <path d="M0 72 Q20 70 35 65 Q50 60 65 63" stroke={theme.isDark ? '#383848' : '#585868'} strokeWidth="2" fill="none"/>
        {/* Stream / river */}
        <path d="M100 20 Q80 35 70 50 Q60 65 55 85 Q52 92 50 100" stroke={theme.isDark ? '#1A3550' : '#2A4560'} strokeWidth="3" fill="none" opacity="0.8"/>
        {/* GPS dot (user position) */}
        <circle cx="49" cy="51" r="2.5" fill="#4488FF" opacity="0.95"/>
        <circle cx="49" cy="51" r="5" fill="#4488FF" opacity="0.25"/>
      </svg>
    );
  }

  return (
    <div style={{ flex: 1, position: 'relative', overflow: 'hidden', background: theme.isDark ? '#1A2015' : '#2E3D1F' }}>
      {/* Map background */}
      <MockMap/>

      {/* Filter toolbar */}
      <div style={{
        position: 'absolute', top: 12, left: 12, right: 12, zIndex: 20,
        display: 'flex', flexDirection: 'column', gap: 8,
      }}>
        {/* Search bar */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          background: theme.isDark ? 'rgba(10,10,18,0.92)' : 'rgba(255,255,255,0.95)',
          backdropFilter: 'blur(20px)', borderRadius: 999,
          border: `1px solid ${theme.border}`,
          padding: '10px 14px', boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
        }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={theme.text3} strokeWidth="2">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
          <span style={{ fontSize: 14, color: theme.text3, flex: 1 }}>Rechercher une station…</span>
          <button onClick={() => setFilterOpen(v => !v)} style={{
            width: 32, height: 32, borderRadius: 999, border: 'none', cursor: 'pointer',
            background: filterOpen ? C.primary : theme.surface2,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={filterOpen ? 'white' : theme.text2} strokeWidth="2">
              <line x1="4" y1="6" x2="20" y2="6"/><line x1="8" y1="12" x2="16" y2="12"/><line x1="10" y1="18" x2="14" y2="18"/>
            </svg>
          </button>
        </div>

        {/* Filter pills */}
        {filterOpen && (
          <div style={{
            background: theme.isDark ? 'rgba(10,10,18,0.95)' : 'rgba(255,255,255,0.97)',
            backdropFilter: 'blur(20px)', borderRadius: 16,
            border: `1px solid ${theme.border}`, padding: '12px 14px',
            display: 'flex', flexWrap: 'wrap', gap: 8,
            boxShadow: '0 4px 24px rgba(0,0,0,0.35)',
            animation: 'fadeSlideUp 0.2s ease',
          }}>
            {['SP95', 'SP98', 'Diesel', 'E10'].map(f => (
              <button key={f} onClick={() => setFuelType(f)} style={{
                padding: '6px 14px', borderRadius: 999, border: `1px solid ${fuelType === f ? C.primary : theme.border}`,
                background: fuelType === f ? C.primary : 'transparent',
                color: fuelType === f ? 'white' : theme.text2,
                fontSize: 13, fontWeight: 600, cursor: 'pointer',
              }}>{f}</button>
            ))}
            <div style={{ width: '100%', height: 1, background: theme.borderSubtle, margin: '4px 0' }}/>
            {['Prix croissant', 'Distance', 'Note'].map(s => (
              <button key={s} onClick={() => setSortBy(s)} style={{
                padding: '6px 14px', borderRadius: 999, border: `1px solid ${sortBy === s ? C.accent : theme.border}`,
                background: sortBy === s ? `${C.accent}20` : 'transparent',
                color: sortBy === s ? C.accent : theme.text2,
                fontSize: 13, fontWeight: 600, cursor: 'pointer',
              }}>{s}</button>
            ))}
          </div>
        )}

        {/* Best price badge */}
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6,
            background: 'rgba(34,197,94,0.9)', borderRadius: 999,
            padding: '6px 12px', fontSize: 13, fontWeight: 700, color: 'white',
            boxShadow: '0 2px 12px rgba(34,197,94,0.4)',
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="white" stroke="none">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
            </svg>
            Meilleur: CHF 1.72
          </div>
        </div>
      </div>

      {/* Station markers */}
      {STATIONS.map(s => (
        <div key={s.id} onClick={() => { setSelectedStation(s.id); setSheetState('peek'); setDetailView(false); }}
          style={{
            position: 'absolute',
            left: `${s.x}%`, top: `${s.y}%`,
            transform: 'translate(-50%, -50%)',
            zIndex: selectedStation === s.id ? 15 : 10,
            cursor: 'pointer',
            transition: 'transform 0.2s',
          }}>
          <PriceChip price={s.price} avg={AVG_PRICE} selected={selectedStation === s.id}
            size={selectedStation === s.id ? 'md' : 'sm'}/>
        </div>
      ))}

      {/* FAB GPS */}
      <button style={{
        position: 'absolute', right: 16,
        bottom: selected ? 220 : 88,
        width: 48, height: 48, borderRadius: '50%',
        background: theme.isDark ? 'rgba(14,14,22,0.95)' : 'rgba(255,255,255,0.95)',
        backdropFilter: 'blur(16px)', border: `1px solid ${theme.border}`,
        boxShadow: '0 4px 16px rgba(0,0,0,0.35)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
        zIndex: 20, transition: 'bottom 0.3s ease',
      }}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={C.primary} strokeWidth="2.5">
          <circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>
          <line x1="12" y1="2" x2="12" y2="5"/><line x1="12" y1="19" x2="12" y2="22"/>
        </svg>
      </button>

      {/* Bottom sheet */}
      {selected && (
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 30,
          background: theme.isDark ? 'rgba(10,10,18,0.97)' : 'rgba(255,255,255,0.98)',
          backdropFilter: 'blur(32px)',
          borderRadius: '24px 24px 0 0',
          border: `1px solid ${theme.border}`,
          borderBottom: 'none',
          boxShadow: '0 -8px 40px rgba(0,0,0,0.5)',
          transition: 'transform 0.35s cubic-bezier(0.34,1.3,0.64,1)',
          paddingBottom: 100,
          animation: 'slideInBottom 0.35s cubic-bezier(0.34,1.1,0.64,1)',
        }}>
          {/* Handle */}
          <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 4px' }}>
            <div style={{ width: 40, height: 4, borderRadius: 999, background: theme.borderSubtle }}/>
          </div>

          {!detailView ? (
            <div style={{ padding: '8px 16px 0' }}>
              {/* Station header */}
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 16 }}>
                <div style={{
                  width: 48, height: 48, borderRadius: 14, flexShrink: 0,
                  background: `linear-gradient(135deg, ${priceColor(selected.price)}30, ${priceColor(selected.price)}15)`,
                  border: `1px solid ${priceColor(selected.price)}40`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 11, fontWeight: 800, color: priceColor(selected.price),
                }}>
                  {selected.brand}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 17, fontWeight: 800, color: theme.text1, marginBottom: 2 }}>{selected.name}</div>
                  <div style={{ fontSize: 13, color: theme.text3 }}>{selected.addr}</div>
                  <div style={{ fontSize: 13, color: C.primaryLight, fontWeight: 600, marginTop: 2 }}>{selected.dist}</div>
                </div>
                <button onClick={() => { setFavorited(v => !v); }} style={{
                  width: 40, height: 40, borderRadius: 12, background: favorited ? 'rgba(239,68,68,0.15)' : theme.surface2,
                  border: `1px solid ${favorited ? 'rgba(239,68,68,0.3)' : theme.border}`,
                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'all 0.2s',
                }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill={favorited ? '#EF4444' : 'none'} stroke={favorited ? '#EF4444' : theme.text2} strokeWidth="2">
                    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
                  </svg>
                </button>
              </div>

              {/* Prices */}
              <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
                {[['SP95', selected.price], ['Diesel', selected.diesel], ['SP98', selected.sp98]].map(([label, price]) => (
                  <div key={label} style={{
                    flex: 1, background: theme.surface2, border: `1px solid ${theme.border}`,
                    borderRadius: 14, padding: '10px 12px',
                  }}>
                    <div style={{ fontSize: 11, color: theme.text3, marginBottom: 4, fontWeight: 600 }}>{label}</div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: label === 'SP95' ? priceColor(price) : theme.text1 }}>
                      {price.toFixed(3)}
                    </div>
                    <div style={{ fontSize: 11, color: theme.text3 }}>CHF/L</div>
                  </div>
                ))}
              </div>

              {/* Action buttons */}
              <div style={{ display: 'flex', gap: 10 }}>
                <Btn variant="primary" fullWidth onClick={() => setDetailView(true)}
                  style={{ fontSize: 14, fontWeight: 700 }}>
                  Voir détails
                </Btn>
                <Btn variant="secondary" style={{ fontSize: 14, fontWeight: 700, padding: '12px 18px' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <polygon points="3 11 22 2 13 21 11 13 3 11"/>
                  </svg>
                  Aller
                </Btn>
              </div>
            </div>
          ) : (
            /* Detail view */
            <div style={{ padding: '0 16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                <button onClick={() => setDetailView(false)} style={{
                  background: theme.surface2, border: `1px solid ${theme.border}`, borderRadius: 10,
                  padding: '6px 10px', cursor: 'pointer', fontSize: 13, color: theme.text2, display: 'flex', alignItems: 'center', gap: 4,
                }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="15 18 9 12 15 6"/>
                  </svg>
                  Retour
                </button>
                <span style={{ fontSize: 15, fontWeight: 700, color: theme.text1 }}>{selected.name}</span>
                <Btn variant="accent" size="sm" style={{ marginLeft: 'auto' }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><polygon points="3 11 22 2 13 21 11 13 3 11"/></svg>
                  Aller
                </Btn>
              </div>
              <div style={{
                borderRadius: 14, overflow: 'hidden', marginBottom: 14,
                height: 120, background: 'rgba(30,50,25,0.8)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 12, color: theme.text3,
              }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 28, marginBottom: 4 }}>🛰️</div>
                  <div>Vue satellite</div>
                </div>
              </div>
              <SectionLabel theme={theme}>Prix du carburant</SectionLabel>
              <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
                {[['SP95', selected.price, priceColor(selected.price)], ['Diesel', selected.diesel, theme.text1]].map(([l, p, col]) => (
                  <div key={l} style={{ flex: 1, background: theme.surface2, border: `1px solid ${theme.border}`, borderRadius: 14, padding: '10px 12px' }}>
                    <div style={{ fontSize: 12, color: theme.text3 }}>{l}</div>
                    <div style={{ fontSize: 22, fontWeight: 800, color: col }}>{p.toFixed(3)}</div>
                    <div style={{ fontSize: 11, color: theme.text3 }}>CHF/L</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tap backdrop to close sheet */}
      {selected && (
        <div onClick={() => setSelectedStation(null)}
          style={{ position: 'absolute', inset: 0, zIndex: 5 }}/>
      )}
    </div>
  );
}

Object.assign(window, { MapScreen });
