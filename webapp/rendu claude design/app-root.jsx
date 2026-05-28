
// OptiTank — App Root + Navigation + Tweaks (fixed API)
// Exports: App

function App() {
  const [screen, setScreen] = React.useState('radar');
  const [prevScreen, setPrevScreen] = React.useState(null);
  const [transitioning, setTransitioning] = React.useState(false);
  const [toast, setToast] = React.useState({ visible: false, message: '', type: 'success' });

  const [t, setTweak] = useTweaks(/*EDITMODE-BEGIN*/{
    "darkMode": true,
    "primaryColor": "#6C63FF",
    "accentColor": "#00D4AA",
    "showFuelo": true,
    "animSpeed": 1
  }/*EDITMODE-END*/);

  const theme = t.darkMode ? DARK : LIGHT;

  function navigate(to) {
    if (to === screen || transitioning) return;
    setTransitioning(true);
    setPrevScreen(screen);
    setTimeout(() => { setScreen(to); setTransitioning(false); }, 180);
  }

  function showToast(message, type = 'success') {
    setToast({ visible: true, message, type });
    setTimeout(() => setToast(prev => ({ ...prev, visible: false })), 3000);
  }

  const SCREENS = { radar: RadarScreen, carte: MapScreen, trajet: TrajetScreen, stats: StatsScreen, profil: ProfileScreen };
  const TAB_ORDER = ['radar', 'trajet', 'carte', 'stats', 'profil'];
  const prevIdx = TAB_ORDER.indexOf(prevScreen);
  const currIdx = TAB_ORDER.indexOf(screen);
  const slideDir = currIdx > prevIdx ? 1 : -1;
  const CurrentScreen = SCREENS[screen];

  const headerless = screen === 'profil' || screen === 'trajet' || screen === 'carte';

  return (
    <div style={{
      width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
      background: theme.bg, fontFamily: 'Inter, sans-serif',
      position: 'relative', overflow: 'hidden',
    }}>
      {/* App header (radar & stats only) */}
      {!headerless && (
        <div style={{
          padding: '14px 20px 0', display: 'flex', alignItems: 'center',
          justifyContent: 'space-between', background: theme.bg, zIndex: 10, flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <svg width="28" height="28" viewBox="0 0 32 32" fill="none">
              <rect width="32" height="32" rx="8" fill={t.primaryColor}/>
              <path d="M16 7 C12 7, 9 10, 9 14 C9 19, 12 24, 16 24 C20 24, 23 19, 23 14 C23 10, 20 7, 16 7Z"
                fill="rgba(255,255,255,0.18)"/>
              <path d="M16 10 C13.5 10, 12 12, 12 14.5 C12 17.5, 14 21, 16 21 C18 21, 20 17.5, 20 14.5 C20 12, 18.5 10, 16 10Z"
                fill="white" opacity="0.85"/>
              <circle cx="16" cy="14.5" r="3" fill={t.primaryColor}/>
            </svg>
            <span style={{ fontSize: 19, fontWeight: 800, color: theme.text1, letterSpacing: '-0.4px' }}>
              OptiTank<span style={{ color: t.primaryColor }}>.</span>
            </span>
          </div>
          {t.showFuelo && (
            <div style={{ animation: 'fueloDance 2.5s ease-in-out infinite' }}>
              <FueloMascot size={34}/>
            </div>
          )}
        </div>
      )}

      {/* Screen container */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', position: 'relative' }}>
        <div key={screen} style={{
          flex: 1, display: 'flex', flexDirection: 'column',
          transform: transitioning ? `translateX(${-slideDir * 28}px)` : 'translateX(0)',
          opacity: transitioning ? 0 : 1,
          transition: 'transform 0.18s cubic-bezier(0.4,0,0.2,1), opacity 0.15s ease',
        }}>
          <CurrentScreen theme={theme} navigate={navigate} showToast={showToast}/>
        </div>
      </div>

      <BottomNav active={screen} onChange={navigate} theme={theme}/>
      <Toast visible={toast.visible} message={toast.message} type={toast.type}/>

      {/* Tweaks panel */}
      <TweaksPanel>
        <TweakSection label="Apparence"/>
        <TweakToggle label="Mode sombre" value={t.darkMode} onChange={v => setTweak('darkMode', v)}/>
        <TweakColor label="Couleur principale" value={t.primaryColor}
          options={['#6C63FF', '#3B82F6', '#EC4899', '#F59E0B', '#10B981']}
          onChange={v => setTweak('primaryColor', v)}/>
        <TweakColor label="Couleur accent" value={t.accentColor}
          options={['#00D4AA', '#22C55E', '#06B6D4', '#8B5CF6']}
          onChange={v => setTweak('accentColor', v)}/>
        <TweakSection label="Interface"/>
        <TweakToggle label="Afficher Fuelo" value={t.showFuelo} onChange={v => setTweak('showFuelo', v)}/>
        <TweakSlider label="Vitesse animations" value={t.animSpeed} min={0.5} max={2} step={0.5}
          onChange={v => setTweak('animSpeed', v)}/>
        <TweakSection label="Navigation rapide"/>
        <TweakRadio label="Écran actif" value={screen}
          options={['radar', 'carte', 'trajet', 'stats', 'profil']}
          onChange={v => navigate(v)}/>
      </TweaksPanel>
    </div>
  );
}

Object.assign(window, { App });
