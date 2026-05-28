
// OptiTank — Statistiques Screen
// Exports: StatsScreen

function StatsScreen({ theme }) {
  const [period, setPeriod] = React.useState('30j');
  const [activeStations, setActiveStations] = React.useState(['Avia Cheseaux', 'Migrol Cossonay']);
  const chartRef = React.useRef(null);

  const STATIONS_LIST = [
    { name: 'Avia Cheseaux', color: '#6C63FF' },
    { name: 'Migrol Cossonay', color: '#00D4AA' },
    { name: 'Shell Lausanne', color: '#F59E0B' },
    { name: 'Garage Emery', color: '#EF4444' },
    { name: 'BP Echallens', color: '#EC4899' },
  ];

  const KPI = [
    { label: 'Moy. 30 jours', value: '1.850', unit: 'CHF/L', icon: '📊', color: C.primaryLight },
    { label: 'Meilleur prix', value: '1.720', unit: 'CHF/L', icon: '🏆', color: C.success },
    { label: 'Économies totales', value: '32.40', unit: 'CHF', icon: '💰', color: C.accent },
    { label: 'Pleins enregistrés', value: '14', unit: 'pleins', icon: '⛽', color: C.warning },
  ];

  // Generate fake price data
  function genData(base, variance, days) {
    const arr = [];
    let v = base;
    for (let i = 0; i < days; i++) {
      v += (Math.random() - 0.5) * variance;
      v = Math.max(base - 0.12, Math.min(base + 0.12, v));
      arr.push(parseFloat(v.toFixed(3)));
    }
    return arr;
  }

  const DAYS = period === '7j' ? 7 : period === '30j' ? 30 : 90;
  const DATA = {
    'Avia Cheseaux': genData(1.78, 0.02, DAYS),
    'Migrol Cossonay': genData(1.84, 0.025, DAYS),
    'Shell Lausanne': genData(1.89, 0.018, DAYS),
    'Garage Emery': genData(1.95, 0.015, DAYS),
    'BP Echallens': genData(1.91, 0.022, DAYS),
  };

  // Draw chart
  React.useEffect(() => {
    const canvas = chartRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    const pad = { top: 16, right: 12, bottom: 32, left: 44 };
    const w = W - pad.left - pad.right;
    const h = H - pad.top - pad.bottom;

    ctx.clearRect(0, 0, W, H);

    const allVals = activeStations.flatMap(n => DATA[n] || []);
    if (!allVals.length) return;
    const min = Math.min(...allVals) - 0.04;
    const max = Math.max(...allVals) + 0.04;

    const xPos = i => pad.left + (i / (DAYS - 1)) * w;
    const yPos = v => pad.top + h - ((v - min) / (max - min)) * h;

    // Grid lines
    const gridCount = 4;
    for (let i = 0; i <= gridCount; i++) {
      const y = pad.top + (h / gridCount) * i;
      const val = max - (i / gridCount) * (max - min);
      ctx.beginPath();
      ctx.moveTo(pad.left, y);
      ctx.lineTo(W - pad.right, y);
      ctx.strokeStyle = theme.isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = theme.text3;
      ctx.font = '10px Inter, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(val.toFixed(2), pad.left - 4, y + 3);
    }

    // X-axis labels
    ctx.textAlign = 'center';
    ctx.fillStyle = theme.text3;
    ctx.font = '10px Inter, sans-serif';
    const labelCount = DAYS <= 7 ? DAYS : DAYS <= 30 ? 6 : 6;
    for (let i = 0; i <= labelCount; i++) {
      const idx = Math.round((i / labelCount) * (DAYS - 1));
      const daysAgo = DAYS - 1 - idx;
      const label = daysAgo === 0 ? 'Auj.' : `-${daysAgo}j`;
      ctx.fillText(label, xPos(idx), H - 8);
    }

    // Draw each station line with area fill
    activeStations.forEach(name => {
      const data = DATA[name];
      const stDef = STATIONS_LIST.find(s => s.name === name);
      if (!data || !stDef) return;
      const col = stDef.color;

      // Area fill
      const grad = ctx.createLinearGradient(0, pad.top, 0, H - pad.bottom);
      grad.addColorStop(0, col + '50');
      grad.addColorStop(1, col + '00');
      ctx.beginPath();
      ctx.moveTo(xPos(0), yPos(data[0]));
      for (let i = 1; i < data.length; i++) {
        const cpx = (xPos(i - 1) + xPos(i)) / 2;
        ctx.bezierCurveTo(cpx, yPos(data[i - 1]), cpx, yPos(data[i]), xPos(i), yPos(data[i]));
      }
      ctx.lineTo(xPos(data.length - 1), H - pad.bottom);
      ctx.lineTo(xPos(0), H - pad.bottom);
      ctx.closePath();
      ctx.fillStyle = grad;
      ctx.fill();

      // Line
      ctx.beginPath();
      ctx.moveTo(xPos(0), yPos(data[0]));
      for (let i = 1; i < data.length; i++) {
        const cpx = (xPos(i - 1) + xPos(i)) / 2;
        ctx.bezierCurveTo(cpx, yPos(data[i - 1]), cpx, yPos(data[i]), xPos(i), yPos(data[i]));
      }
      ctx.strokeStyle = col;
      ctx.lineWidth = 2;
      ctx.shadowColor = col;
      ctx.shadowBlur = 4;
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Last dot
      const lastX = xPos(data.length - 1), lastY = yPos(data[data.length - 1]);
      ctx.beginPath();
      ctx.arc(lastX, lastY, 4, 0, Math.PI * 2);
      ctx.fillStyle = col;
      ctx.fill();
      ctx.beginPath();
      ctx.arc(lastX, lastY, 4, 0, Math.PI * 2);
      ctx.strokeStyle = theme.isDark ? '#0A0A0F' : '#fff';
      ctx.lineWidth = 2;
      ctx.stroke();
    });
  }, [period, activeStations, theme]);

  function toggleStation(name) {
    setActiveStations(prev =>
      prev.includes(name)
        ? prev.length > 1 ? prev.filter(n => n !== name) : prev
        : prev.length < 5 ? [...prev, name] : prev
    );
  }

  return (
    <div style={{
      flex: 1, overflow: 'auto', background: theme.bg,
      color: theme.text1, fontFamily: 'Inter, sans-serif',
    }}>
      {/* Header */}
      <div style={{ padding: '16px 20px 12px' }}>
        <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.5px' }}>Statistiques</div>
        <div style={{ fontSize: 13, color: theme.text3, marginTop: 2 }}>Évolution de vos prix</div>
      </div>

      {/* KPI cards — horizontal scroll */}
      <div style={{ overflowX: 'auto', paddingBottom: 4 }}>
        <div style={{ display: 'flex', gap: 10, padding: '0 20px', width: 'max-content' }}>
          {KPI.map(k => (
            <div key={k.label} style={{
              background: theme.isDark ? theme.surface : '#fff',
              border: `1px solid ${theme.border}`, borderRadius: 18,
              padding: '14px 16px', minWidth: 130,
              boxShadow: theme.isDark ? '0 4px 16px rgba(0,0,0,0.3)' : '0 2px 10px rgba(0,0,0,0.07)',
            }}>
              <div style={{ fontSize: 22, marginBottom: 8 }}>{k.icon}</div>
              <div style={{ fontSize: 22, fontWeight: 900, color: k.color, lineHeight: 1, letterSpacing: '-0.5px' }}>
                {k.value}
              </div>
              <div style={{ fontSize: 11, color: theme.text3, fontWeight: 600, marginTop: 2 }}>{k.unit}</div>
              <div style={{ fontSize: 11, color: theme.text3, marginTop: 4, textWrap: 'pretty' }}>{k.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Chart area */}
      <div style={{ padding: '16px 16px 0' }}>
        {/* Period tabs */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: theme.text1 }}>Évolution des prix</div>
          <div style={{
            display: 'flex', background: theme.surface2, border: `1px solid ${theme.border}`,
            borderRadius: 999, padding: 3, gap: 2,
          }}>
            {['7j', '30j', '90j'].map(p => (
              <button key={p} onClick={() => setPeriod(p)} style={{
                padding: '5px 14px', borderRadius: 999, border: 'none', cursor: 'pointer',
                background: period === p ? C.primary : 'transparent',
                color: period === p ? 'white' : theme.text3,
                fontSize: 13, fontWeight: 700,
                boxShadow: period === p ? '0 2px 8px rgba(108,99,255,0.4)' : 'none',
                transition: 'all 0.2s',
              }}>{p}</button>
            ))}
          </div>
        </div>

        {/* Station chips */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginBottom: 12 }}>
          {STATIONS_LIST.map(s => {
            const on = activeStations.includes(s.name);
            return (
              <button key={s.name} onClick={() => toggleStation(s.name)} style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '5px 12px 5px 8px', borderRadius: 999,
                background: on ? `${s.color}20` : 'transparent',
                border: `1.5px solid ${on ? s.color : theme.border}`,
                cursor: 'pointer', transition: 'all 0.18s',
              }}>
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: on ? s.color : theme.text3 }}/>
                <span style={{ fontSize: 12, fontWeight: 600, color: on ? s.color : theme.text3, whiteSpace: 'nowrap' }}>
                  {s.name.split(' ')[0]} {s.name.split(' ')[1] || ''}
                </span>
                {on && (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={s.color} strokeWidth="2.5">
                    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                )}
              </button>
            );
          })}
        </div>

        {/* Chart canvas */}
        <div style={{
          background: theme.isDark ? theme.surface : '#fff',
          border: `1px solid ${theme.border}`, borderRadius: 20,
          padding: '16px 12px 12px', marginBottom: 16,
          boxShadow: theme.isDark ? '0 4px 20px rgba(0,0,0,0.3)' : '0 2px 12px rgba(0,0,0,0.06)',
        }}>
          <canvas ref={chartRef} width={320} height={180}
            style={{ width: '100%', height: 'auto', display: 'block' }}/>
        </div>

        {/* Monthly summary */}
        <div style={{ marginBottom: 16 }}>
          <SectionLabel theme={theme}>Résumé du mois</SectionLabel>
          {[
            { label: 'Volume total', value: '182 L', icon: '⛽' },
            { label: 'Dépense carburant', value: 'CHF 336.70', icon: '💳' },
            { label: 'Prix moyen payé', value: '1.850 CHF/L', icon: '📊' },
            { label: 'Vs. prix moyen marché', value: '−0.030 CHF/L', icon: '📉', positive: true },
          ].map(item => (
            <div key={item.label} style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '12px 14px', borderBottom: `1px solid ${theme.borderSubtle}`,
            }}>
              <span style={{ fontSize: 20 }}>{item.icon}</span>
              <span style={{ flex: 1, fontSize: 14, color: theme.text2 }}>{item.label}</span>
              <span style={{
                fontSize: 14, fontWeight: 700,
                color: item.positive ? C.success : theme.text1,
              }}>{item.value}</span>
            </div>
          ))}
        </div>
        <div style={{ height: 100 }}/>
      </div>
    </div>
  );
}

Object.assign(window, { StatsScreen });
