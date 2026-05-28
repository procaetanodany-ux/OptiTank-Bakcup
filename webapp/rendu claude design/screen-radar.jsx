
// OptiTank — Radar IA Screen
// States: idle → scanning → results
// Exports to window: RadarScreen

function RadarScreen({ theme, navigate }) {
  const [state, setState] = React.useState('idle'); // idle | scanning | results
  const [radius, setRadius] = React.useState(40);
  const [showRadiusMenu, setShowRadiusMenu] = React.useState(false);
  const [savingsVal, setSavingsVal] = React.useState(0);
  const canvasRef = React.useRef(null);
  const animRef = React.useRef(null);
  const sweepRef = React.useRef(0);
  const blipsRef = React.useRef([]);
  const stateRef = React.useRef('idle');
  const prevAngleRef = React.useRef(0);

  // Pre-defined station blips (angle in radians, r=0..1 normalized)
  const BLIP_DEFS = [
    { angle: 0.9, r: 0.38, price: 1.72, color: '#22C55E', name: 'Avia Cheseaux' },
    { angle: 2.3, r: 0.58, price: 1.85, color: '#F59E0B', name: 'Shell Lausanne' },
    { angle: 3.8, r: 0.42, price: 1.79, color: '#22C55E', name: 'Migrol Cossonay' },
    { angle: 4.7, r: 0.67, price: 1.97, color: '#EF4444', name: 'Garage Emery' },
    { angle: 5.6, r: 0.52, price: 1.88, color: '#F59E0B', name: 'BP Echallens' },
  ];

  const RESULTS = [
    { rank: 1, name: 'Avia Cheseaux', dist: '2.3 km', detour: '+0 km', price: 1.72, saving: 4.20, color: '#22C55E', fuel: 'SP95' },
    { rank: 2, name: 'Migrol Cossonay', dist: '4.8 km', detour: '+1.2 km', price: 1.79, saving: 2.80, color: '#22C55E', fuel: 'SP95' },
    { rank: 3, name: 'BP Echallens', dist: '7.1 km', detour: '+2.4 km', price: 1.88, saving: 0.80, color: '#F59E0B', fuel: 'SP95' },
  ];

  // Canvas animation
  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const SIZE = canvas.width;
    const cx = SIZE / 2, cy = SIZE / 2;
    const R = SIZE * 0.46;

    function draw() {
      const currentState = stateRef.current;
      if (currentState === 'results') return;

      const speed = currentState === 'scanning' ? 0.032 : 0.012;
      sweepRef.current += speed;
      const angle = sweepRef.current;
      const normAngle = angle % (Math.PI * 2);
      const prevNorm = prevAngleRef.current % (Math.PI * 2);

      ctx.clearRect(0, 0, SIZE, SIZE);

      // Clip to circle
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.clip();

      // Background
      const bgGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, R);
      bgGrad.addColorStop(0, '#0D0D20');
      bgGrad.addColorStop(1, '#07070F');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, SIZE, SIZE);

      // Concentric rings
      [0.25, 0.5, 0.75, 1].forEach((f, i) => {
        ctx.beginPath();
        ctx.arc(cx, cy, R * f, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(108,99,255,${0.12 + i * 0.04})`;
        ctx.lineWidth = 1;
        ctx.stroke();
      });

      // Crosshair lines (4 axes)
      for (let a = 0; a < Math.PI; a += Math.PI / 4) {
        ctx.beginPath();
        ctx.moveTo(cx + R * Math.cos(a), cy + R * Math.sin(a));
        ctx.lineTo(cx + R * Math.cos(a + Math.PI), cy + R * Math.sin(a + Math.PI));
        ctx.strokeStyle = 'rgba(108,99,255,0.12)';
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      // Sweep trail (gradient wedge behind beam)
      const trailLen = currentState === 'scanning' ? Math.PI * 0.85 : Math.PI * 0.5;
      const STEPS = 80;
      for (let i = STEPS; i >= 0; i--) {
        const a0 = angle - (i / STEPS) * trailLen;
        const a1 = angle - ((i - 1) / STEPS) * trailLen;
        const alpha = (STEPS - i) / STEPS;
        const opacity = alpha * alpha * (currentState === 'scanning' ? 0.45 : 0.22);
        ctx.fillStyle = `rgba(108,99,255,${opacity})`;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.arc(cx, cy, R, a0, a1);
        ctx.closePath();
        ctx.fill();
      }

      // Leading edge (bright line)
      ctx.save();
      ctx.shadowColor = '#8B84FF';
      ctx.shadowBlur = currentState === 'scanning' ? 10 : 5;
      ctx.strokeStyle = `rgba(139,132,255,${currentState === 'scanning' ? 0.95 : 0.6})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + R * Math.cos(angle), cy + R * Math.sin(angle));
      ctx.stroke();
      ctx.restore();

      // Blip detection: add blip when beam sweeps over station angle
      if (currentState === 'scanning') {
        BLIP_DEFS.forEach(def => {
          const already = blipsRef.current.find(b => b.name === def.name);
          if (!already) {
            const da = def.angle % (Math.PI * 2);
            // Detect crossing
            const crossed = prevNorm < da && normAngle >= da;
            if (crossed || (sweepRef.current > Math.PI * 2 && blipsRef.current.length < BLIP_DEFS.indexOf(def) + 1)) {
              blipsRef.current = [...blipsRef.current, { ...def, born: Date.now() }];
            }
          }
        });
      }

      // Draw blips
      blipsRef.current.forEach(blip => {
        const age = (Date.now() - blip.born) / 1000;
        const flash = Math.max(0.4, 1 - age * 0.12);
        const bx = cx + blip.r * R * Math.cos(blip.angle);
        const by = cy + blip.r * R * Math.sin(blip.angle);

        // Outer glow ring
        ctx.save();
        ctx.globalAlpha = flash * 0.4;
        ctx.beginPath();
        ctx.arc(bx, by, 10 + age * 2, 0, Math.PI * 2);
        ctx.strokeStyle = blip.color;
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.restore();

        // Core dot
        ctx.save();
        ctx.shadowColor = blip.color;
        ctx.shadowBlur = 12;
        ctx.fillStyle = blip.color;
        ctx.globalAlpha = flash;
        ctx.beginPath();
        ctx.arc(bx, by, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // Price label (only for first few)
        if (age < 4 && blipsRef.current.indexOf(blip) < 3) {
          ctx.save();
          ctx.globalAlpha = Math.min(1, age * 0.5) * flash;
          ctx.fillStyle = blip.color;
          ctx.font = 'bold 11px Inter, sans-serif';
          ctx.fillText(blip.price.toFixed(2), bx + 8, by - 4);
          ctx.restore();
        }
      });

      ctx.restore(); // unclip

      // Center dot
      ctx.save();
      ctx.shadowColor = '#6C63FF';
      ctx.shadowBlur = 8;
      ctx.fillStyle = '#8B84FF';
      ctx.beginPath();
      ctx.arc(cx, cy, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      prevAngleRef.current = sweepRef.current;

      // Auto-transition to results after ~3.5 revs
      if (currentState === 'scanning' && sweepRef.current > Math.PI * 2 * 3.5) {
        stateRef.current = 'results';
        setState('results');
        // Animate savings count-up
        const target = 4.20;
        const start = Date.now();
        const dur = 1400;
        function tick() {
          const t = Math.min((Date.now() - start) / dur, 1);
          const ease = 1 - Math.pow(1 - t, 3);
          setSavingsVal(ease * target);
          if (t < 1) requestAnimationFrame(tick);
        }
        requestAnimationFrame(tick);
        return;
      }

      animRef.current = requestAnimationFrame(draw);
    }

    animRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animRef.current);
  }, []);

  function startScan() {
    blipsRef.current = [];
    sweepRef.current = 0;
    prevAngleRef.current = 0;
    stateRef.current = 'scanning';
    setState('scanning');
    // restart animation
    cancelAnimationFrame(animRef.current);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const SIZE = canvas.width;
    const cx = SIZE / 2, cy = SIZE / 2, R = SIZE * 0.46;
    const speed = 0.032;
    function draw() {
      if (stateRef.current === 'results') return;
      sweepRef.current += speed;
      const angle = sweepRef.current;
      const normAngle = angle % (Math.PI * 2);
      const prevNorm = prevAngleRef.current % (Math.PI * 2);
      ctx.clearRect(0, 0, SIZE, SIZE);
      ctx.save();
      ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.clip();
      const bgGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, R);
      bgGrad.addColorStop(0, '#0D0D20'); bgGrad.addColorStop(1, '#07070F');
      ctx.fillStyle = bgGrad; ctx.fillRect(0, 0, SIZE, SIZE);
      [0.25, 0.5, 0.75, 1].forEach((f, i) => {
        ctx.beginPath(); ctx.arc(cx, cy, R * f, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(108,99,255,${0.12 + i * 0.04})`; ctx.lineWidth = 1; ctx.stroke();
      });
      for (let a = 0; a < Math.PI; a += Math.PI / 4) {
        ctx.beginPath();
        ctx.moveTo(cx + R * Math.cos(a), cy + R * Math.sin(a));
        ctx.lineTo(cx + R * Math.cos(a + Math.PI), cy + R * Math.sin(a + Math.PI));
        ctx.strokeStyle = 'rgba(108,99,255,0.12)'; ctx.lineWidth = 1; ctx.stroke();
      }
      const STEPS = 80;
      for (let i = STEPS; i >= 0; i--) {
        const a0 = angle - (i / STEPS) * Math.PI * 0.85;
        const a1 = angle - ((i - 1) / STEPS) * Math.PI * 0.85;
        const alpha = (STEPS - i) / STEPS;
        ctx.fillStyle = `rgba(108,99,255,${alpha * alpha * 0.45})`;
        ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, R, a0, a1); ctx.closePath(); ctx.fill();
      }
      ctx.save(); ctx.shadowColor = '#8B84FF'; ctx.shadowBlur = 10;
      ctx.strokeStyle = 'rgba(139,132,255,0.95)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(cx, cy);
      ctx.lineTo(cx + R * Math.cos(angle), cy + R * Math.sin(angle)); ctx.stroke(); ctx.restore();
      BLIP_DEFS.forEach(def => {
        const already = blipsRef.current.find(b => b.name === def.name);
        if (!already) {
          const da = def.angle % (Math.PI * 2);
          if (prevNorm < da && normAngle >= da) {
            blipsRef.current = [...blipsRef.current, { ...def, born: Date.now() }];
          }
        }
      });
      blipsRef.current.forEach(blip => {
        const age = (Date.now() - blip.born) / 1000;
        const flash = Math.max(0.4, 1 - age * 0.12);
        const bx = cx + blip.r * R * Math.cos(blip.angle);
        const by = cy + blip.r * R * Math.sin(blip.angle);
        ctx.save(); ctx.globalAlpha = flash * 0.4;
        ctx.beginPath(); ctx.arc(bx, by, 10 + age * 2, 0, Math.PI * 2);
        ctx.strokeStyle = blip.color; ctx.lineWidth = 1; ctx.stroke(); ctx.restore();
        ctx.save(); ctx.shadowColor = blip.color; ctx.shadowBlur = 12; ctx.fillStyle = blip.color;
        ctx.globalAlpha = flash; ctx.beginPath(); ctx.arc(bx, by, 5, 0, Math.PI * 2); ctx.fill(); ctx.restore();
        if (age < 4) {
          ctx.save(); ctx.globalAlpha = Math.min(1, age * 0.5) * flash; ctx.fillStyle = blip.color;
          ctx.font = 'bold 11px Inter, sans-serif'; ctx.fillText(blip.price.toFixed(2), bx + 8, by - 4); ctx.restore();
        }
      });
      ctx.restore();
      ctx.save(); ctx.shadowColor = '#6C63FF'; ctx.shadowBlur = 8; ctx.fillStyle = '#8B84FF';
      ctx.beginPath(); ctx.arc(cx, cy, 4, 0, Math.PI * 2); ctx.fill(); ctx.restore();
      prevAngleRef.current = sweepRef.current;
      if (sweepRef.current > Math.PI * 2 * 3.5) {
        stateRef.current = 'results'; setState('results');
        const target = 4.20, start = Date.now(), dur = 1400;
        function tick() {
          const t = Math.min((Date.now() - start) / dur, 1);
          setSavingsVal((1 - Math.pow(1 - t, 3)) * target);
          if (t < 1) requestAnimationFrame(tick);
        }
        requestAnimationFrame(tick); return;
      }
      animRef.current = requestAnimationFrame(draw);
    }
    animRef.current = requestAnimationFrame(draw);
  }

  function reset() {
    blipsRef.current = [];
    sweepRef.current = 0;
    prevAngleRef.current = 0;
    setSavingsVal(0);
    stateRef.current = 'idle';
    setState('idle');
  }

  // ── RENDER ──────────────────────────────────────────────────────────────────
  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden',
      background: theme.bg, color: theme.text1, fontFamily: 'Inter, sans-serif',
    }}>
      {/* Header */}
      <div style={{ padding: '16px 20px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.5px', color: theme.text1 }}>
            Radar IA
          </div>
          <div style={{ fontSize: 13, color: theme.text3, marginTop: 2 }}>
            Prix pompe + coût du détour
          </div>
        </div>
        {state === 'results' && (
          <button onClick={reset} style={{
            background: theme.surface2, border: `1px solid ${theme.border}`, borderRadius: 999,
            padding: '6px 14px', fontSize: 13, fontWeight: 600, color: theme.text2, cursor: 'pointer',
          }}>
            Nouveau scan
          </button>
        )}
      </div>

      {/* Canvas radar (always mounted for idle animation) */}
      <div style={{
        display: 'flex', justifyContent: 'center', alignItems: 'center',
        padding: state === 'results' ? '12px 0 4px' : '24px 0 16px',
        position: 'relative',
        opacity: state === 'results' ? 0 : 1,
        height: state === 'results' ? 0 : 'auto',
        overflow: 'hidden',
        transition: 'all 0.4s ease',
      }}>
        <div style={{ position: 'relative' }}>
          <canvas ref={canvasRef} width={240} height={240} style={{ display: 'block', borderRadius: '50%' }}/>
          {/* Scanning ring */}
          {state === 'scanning' && (
            <div style={{
              position: 'absolute', inset: -6, borderRadius: '50%',
              border: '2px solid rgba(108,99,255,0.3)',
              animation: 'glowPulse 1.5s ease-in-out infinite',
            }}/>
          )}
          {/* Status label inside canvas area */}
          {state === 'scanning' && (
            <div style={{
              position: 'absolute', bottom: -32, left: 0, right: 0,
              textAlign: 'center', fontSize: 13, color: C.primaryLight, fontWeight: 600,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: C.accent, display: 'inline-block', animation: 'pulseDot 0.8s ease-in-out infinite' }}/>
              Analyse en cours…
            </div>
          )}
        </div>
      </div>

      {/* RESULTS VIEW */}
      {state === 'results' && (
        <div style={{
          flex: 1, overflow: 'auto', padding: '0 16px',
          animation: 'fadeSlideUp 0.4s ease',
        }}>
          {/* Savings banner */}
          <div style={{
            background: `linear-gradient(135deg, rgba(0,212,170,0.15), rgba(34,197,94,0.1))`,
            border: '1px solid rgba(0,212,170,0.3)',
            borderRadius: 20, padding: '16px 20px', marginBottom: 16,
            textAlign: 'center',
          }}>
            <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.08em', color: C.accent, textTransform: 'uppercase', marginBottom: 4 }}>
              Vous économisez
            </div>
            <div style={{ fontSize: 42, fontWeight: 900, color: C.accent, letterSpacing: '-1px', lineHeight: 1, animation: 'countUp 0.3s ease' }}>
              CHF {savingsVal.toFixed(2)}
            </div>
            <div style={{ fontSize: 12, color: theme.text3, marginTop: 4 }}>vs. prix moyen autour de vous</div>
          </div>

          {/* #1 card — large, prominent */}
          <div style={{
            background: `linear-gradient(135deg, rgba(34,197,94,0.18), rgba(34,197,94,0.06))`,
            border: '1.5px solid rgba(34,197,94,0.4)',
            borderRadius: 24, padding: '18px 18px 14px', marginBottom: 10,
            position: 'relative', overflow: 'hidden',
          }}>
            <div style={{
              position: 'absolute', top: -20, right: -20,
              width: 80, height: 80, borderRadius: '50%',
              background: 'rgba(34,197,94,0.1)',
            }}/>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 12 }}>
              <div style={{
                width: 40, height: 40, borderRadius: 12, flexShrink: 0,
                background: 'linear-gradient(135deg, #22C55E, #16A34A)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 18, fontWeight: 900, color: 'white', boxShadow: '0 4px 12px rgba(34,197,94,0.4)',
              }}>1</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 17, fontWeight: 800, color: theme.text1, marginBottom: 2 }}>
                  {RESULTS[0].name}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 13, color: theme.text3 }}>{RESULTS[0].dist}</span>
                  <span style={{
                    fontSize: 11, fontWeight: 700, padding: '2px 7px', borderRadius: 999,
                    background: 'rgba(34,197,94,0.2)', color: C.success,
                  }}>Sur votre trajet</span>
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 26, fontWeight: 900, color: C.success, lineHeight: 1 }}>
                  {RESULTS[0].price.toFixed(3)}
                </div>
                <div style={{ fontSize: 11, color: theme.text3 }}>CHF/L</div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <Btn variant="accent" size="sm" fullWidth onClick={() => navigate && navigate('carte')}
                style={{ fontSize: 14, fontWeight: 700 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
                  <polygon points="3 11 22 2 13 21 11 13 3 11"/>
                </svg>
                Aller
              </Btn>
              <button style={{
                width: 40, height: 40, borderRadius: 12, background: theme.surface2,
                border: `1px solid ${theme.border}`, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={theme.text2} strokeWidth="2">
                  <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
                </svg>
              </button>
            </div>
          </div>

          {/* #2 and #3 */}
          {RESULTS.slice(1).map((r, i) => (
            <div key={r.rank} style={{
              display: 'flex', alignItems: 'center', gap: 12,
              background: theme.surface, border: `1px solid ${theme.border}`,
              borderRadius: 18, padding: '14px 16px', marginBottom: 8,
            }}>
              <div style={{
                width: 32, height: 32, borderRadius: 10, flexShrink: 0,
                background: i === 0 ? 'linear-gradient(135deg, #22C55E80,#16A34A80)' : 'linear-gradient(135deg, #F59E0B80,#D97706 80)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 14, fontWeight: 900, color: 'white',
              }}>{r.rank}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: theme.text1 }}>{r.name}</div>
                <div style={{ display: 'flex', gap: 8, marginTop: 2 }}>
                  <span style={{ fontSize: 12, color: theme.text3 }}>{r.dist}</span>
                  <span style={{ fontSize: 12, color: theme.text3 }}>Détour {r.detour}</span>
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 20, fontWeight: 800, color: i === 0 ? C.success : C.warning }}>{r.price.toFixed(3)}</div>
                <div style={{ fontSize: 11, color: theme.text3 }}>CHF/L</div>
              </div>
            </div>
          ))}
          <div style={{ height: 100 }}/>
        </div>
      )}

      {/* IDLE/SCANNING BOTTOM */}
      {state !== 'results' && (
        <div style={{ padding: '0 20px 100px', marginTop: 'auto' }}>
          {/* Radius selector */}
          <div style={{ marginBottom: 12, position: 'relative' }}>
            <button onClick={() => setShowRadiusMenu(v => !v)} style={{
              width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              background: theme.surface2, border: `1px solid ${theme.border}`, borderRadius: 16,
              padding: '12px 16px', cursor: 'pointer', color: theme.text1, fontSize: 14, fontWeight: 600,
            }}>
              <span style={{ color: theme.text3 }}>Rayon de recherche</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ color: C.primaryLight }}>{radius} km</span>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={theme.text3} strokeWidth="2">
                  <polyline points="6 9 12 15 18 9"/>
                </svg>
              </div>
            </button>
            {showRadiusMenu && (
              <div style={{
                position: 'absolute', bottom: '110%', left: 0, right: 0, zIndex: 50,
                background: theme.isDark ? '#14141F' : '#fff',
                border: `1px solid ${theme.border}`, borderRadius: 16,
                overflow: 'hidden', boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
              }}>
                {[10, 20, 40, 60, 100].map(r => (
                  <button key={r} onClick={() => { setRadius(r); setShowRadiusMenu(false); }} style={{
                    width: '100%', padding: '12px 16px', background: radius === r ? 'rgba(108,99,255,0.15)' : 'transparent',
                    border: 'none', cursor: 'pointer', textAlign: 'left',
                    color: radius === r ? C.primaryLight : theme.text1, fontSize: 14, fontWeight: radius === r ? 700 : 400,
                  }}>{r} km</button>
                ))}
              </div>
            )}
          </div>
          {/* Analyser button */}
          <Btn variant="primary" size="lg" fullWidth onClick={startScan} disabled={state === 'scanning'}
            style={{ fontSize: 16, fontWeight: 800, padding: '16px' }}>
            {state === 'scanning' ? (
              <>
                <span style={{ width: 16, height: 16, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.4)', borderTopColor: 'white', display: 'inline-block', animation: 'spin 0.7s linear infinite' }}/>
                Analyse en cours…
              </>
            ) : (
              <>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
                  <circle cx="12" cy="12" r="2"/><path d="M12 2a10 10 0 0 1 7.38 16.87M4.62 18.87A10 10 0 0 1 12 2"/>
                  <path d="M12 6a6 6 0 0 1 4.47 10.12M7.53 16.12A6 6 0 0 1 12 6"/>
                </svg>
                Analyser
              </>
            )}
          </Btn>
        </div>
      )}
    </div>
  );
}

const radarStyle = document.createElement('style');
radarStyle.textContent = `@keyframes spin { to { transform: rotate(360deg); } }`;
document.head.appendChild(radarStyle);

Object.assign(window, { RadarScreen });
