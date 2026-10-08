import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import L from 'leaflet';
import 'leaflet.markercluster';
import { fetchAllStations, fetchStationHistory, cacheGet, cacheSet, clearStationCache } from './api.js';
import { FUEL_CONSUMPTION } from './vehicles.js';
import { auth, db, storage } from './firebase.js';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, signOut, OAuthProvider, GoogleAuthProvider, signInWithCredential, reauthenticateWithCredential, reauthenticateWithPopup, signInWithPopup, signInWithRedirect, getRedirectResult, deleteUser, sendPasswordResetEmail, updateProfile } from "firebase/auth";
import { doc, getDoc, setDoc, addDoc, collection, getDocs, deleteDoc, onSnapshot } from "firebase/firestore";
import { ref, uploadString, getDownloadURL } from "firebase/storage";
import Chart from 'chart.js/auto';
import { getBrands, getModels, getYearRange } from './vehicleAPI.js';
import '@phosphor-icons/web/regular';
import '@phosphor-icons/web/bold';
import '@phosphor-icons/web/fill';

// ── Pays supportés (pilote l'admin, les devises et les toggles) ──
// CH toujours actif. enabled:false = visible mais pas encore branché (Allemagne).
const COUNTRIES = [
  { code: 'CH', label: 'Suisse',    flag: '🇨🇭', currency: 'CHF', enableKey: null,                  cfg: null,             always: true },
  { code: 'FR', label: 'France',    flag: '🇫🇷', currency: '€',   enableKey: 'fillz_enable_france',   cfg: 'enableFrance' },
  { code: 'ES', label: 'Espagne',   flag: '🇪🇸', currency: '€',   enableKey: 'fillz_enable_spain',    cfg: 'enableSpain' },
  { code: 'PT', label: 'Portugal',  flag: '🇵🇹', currency: '€',   enableKey: 'fillz_enable_portugal', cfg: 'enablePortugal' },
  { code: 'DE', label: 'Allemagne', flag: '🇩🇪', currency: '€',   enableKey: 'fillz_enable_germany',  cfg: 'enableGermany', disabled: true },
];
const currencyFor = code => (COUNTRIES.find(c => c.code === code)?.currency) || 'CHF';

// ── Admin access ──
const ADMIN_EMAIL = 'pro.caetanodany@gmail.com';
const _ADMIN_ROUTE = new URLSearchParams(window.location.search).get('_admin') === '1'
                  || window.location.hash === '#admin';
if (_ADMIN_ROUTE) window.history.replaceState(null, '', '/');


// ── Native Bridge Location ────────────────────────────────
window.getAppLocation = function(successCallback, errorCallback) {
  if (window.isOptiTankApp && window.OptiTankBridge) {
    const callbackId = 'loc_' + Date.now();
    window[callbackId] = function(lat, lng) {
      delete window[callbackId];
      if (lat && lng) {
        successCallback({ coords: { latitude: lat, longitude: lng } });
      } else {
        if (errorCallback) errorCallback({ code: 1, message: "Location denied" });
      }
    };
    window.OptiTankBridge.post({ type: 'requestLocation', callbackId: callbackId });
  } else {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(successCallback, errorCallback, { enableHighAccuracy: true });
    } else {
      if (errorCallback) errorCallback({ code: 2, message: "Geolocation not supported" });
    }
  }
};

document.addEventListener('DOMContentLoaded', () => {
  // Splash screen handled natively by the iOS app launch screen — JS version removed.

  // ── PWA Gateway Logic ────────────────────────────────────
  let isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone || document.referrer.includes('android-app://') || new URLSearchParams(location.search).has('app');
  if (isStandalone) localStorage.setItem('optitank_is_app', '1');
  else if (localStorage.getItem('optitank_is_app') === '1') isStandalone = true;
  
  if (!isStandalone && !_ADMIN_ROUTE) {
    document.getElementById('landing-showcase').style.display = 'block';
    document.getElementById('app').style.display = 'none';
    
    // ── Landing Page Mobile Menu Logic ──────────────────────
    const menuToggle = document.getElementById('menu-toggle');
    const mobileMenu = document.getElementById('mobile-menu');
    if (menuToggle && mobileMenu) {
      menuToggle.addEventListener('click', (e) => {
        e.stopPropagation();
        mobileMenu.classList.toggle('active');
        // Animation de l'icône (facultatif mais pro)
        const icon = menuToggle.querySelector('i');
        if (mobileMenu.classList.contains('active')) {
          icon.classList.replace('ph-list', 'ph-x');
        } else {
          icon.classList.replace('ph-x', 'ph-list');
        }
      });
      // Fermer au clic sur un lien
      mobileMenu.querySelectorAll('a').forEach(link => {
        link.addEventListener('click', () => {
          mobileMenu.classList.remove('active');
          const icon = menuToggle.querySelector('i');
          icon.classList.replace('ph-x', 'ph-list');
        });
      });
      // Fermer au clic ailleurs
      document.addEventListener('click', () => {
        mobileMenu.classList.remove('active');
        const icon = menuToggle.querySelector('i');
        if (icon) icon.classList.replace('ph-x', 'ph-list');
      });
    }

    // ── Scroll Reveal (Vitrine) ──────────────────────────────
    const revealEls = document.querySelectorAll('.reveal');
    const revealObs = new IntersectionObserver(entries => {
      entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('visible'); });
    }, { threshold: 0.12 });
    revealEls.forEach(el => revealObs.observe(el));

    // ── Vitrine Radar Canvas ─────────────────────────────────
    (function() {
      const canvas = document.getElementById('vitrine-radar');
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      const SIZE = 280, cx = 140, cy = 140, R = 130;
      let angle = 0;
      const blips = [
        {a:0.9, r:.38, c:'#22C55E', born:Date.now()+800},
        {a:2.3, r:.58, c:'#F59E0B', born:Date.now()+1600},
        {a:3.8, r:.42, c:'#22C55E', born:Date.now()+2400},
        {a:4.7, r:.67, c:'#EF4444', born:Date.now()+3200},
        {a:5.6, r:.52, c:'#F59E0B', born:Date.now()+4000},
      ];
      function drawVitrine() {
        angle += 0.025;
        ctx.clearRect(0, 0, SIZE, SIZE);
        ctx.save();
        ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.clip();
        const bg = ctx.createRadialGradient(cx, cy, 0, cx, cy, R);
        bg.addColorStop(0, '#0D0D22'); bg.addColorStop(1, '#07070F');
        ctx.fillStyle = bg; ctx.fillRect(0, 0, SIZE, SIZE);
        [.25, .5, .75, 1].forEach((f, i) => {
          ctx.beginPath(); ctx.arc(cx, cy, R * f, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(108,99,255,${.1 + i * .04})`; ctx.lineWidth = 1; ctx.stroke();
        });
        for (let i = 80; i >= 0; i--) {
          const a0 = angle - (i / 80) * Math.PI * .9;
          const a1 = angle - ((i - 1) / 80) * Math.PI * .9;
          ctx.fillStyle = `rgba(108,99,255,${((80 - i) / 80) ** 2 * .4})`;
          ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, R, a0, a1); ctx.closePath(); ctx.fill();
        }
        ctx.save(); ctx.shadowColor = '#8B84FF'; ctx.shadowBlur = 10;
        ctx.strokeStyle = 'rgba(139,132,255,.9)'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + R * Math.cos(angle), cy + R * Math.sin(angle)); ctx.stroke();
        ctx.restore();
        const now = Date.now();
        blips.forEach(b => {
          if (now < b.born) return;
          const age = (now - b.born) / 1000; const op = Math.max(.4, 1 - age * .08);
          const bx = cx + b.r * R * Math.cos(b.a), by = cy + b.r * R * Math.sin(b.a);
          ctx.save(); ctx.globalAlpha = op * .35;
          ctx.beginPath(); ctx.arc(bx, by, 9 + age, 0, Math.PI * 2);
          ctx.strokeStyle = b.c; ctx.lineWidth = 1; ctx.stroke(); ctx.restore();
          ctx.save(); ctx.shadowColor = b.c; ctx.shadowBlur = 12; ctx.fillStyle = b.c; ctx.globalAlpha = op;
          ctx.beginPath(); ctx.arc(bx, by, 5, 0, Math.PI * 2); ctx.fill(); ctx.restore();
        });
        ctx.restore();
        ctx.save(); ctx.shadowColor = '#6C63FF'; ctx.shadowBlur = 8; ctx.fillStyle = '#8B84FF';
        ctx.beginPath(); ctx.arc(cx, cy, 4, 0, Math.PI * 2); ctx.fill(); ctx.restore();
        requestAnimationFrame(drawVitrine);
      }
      drawVitrine();
    })();

    return;
  }

  // Si on est en PWA Standalone
  document.getElementById('landing-showcase').style.display = 'none';
  document.getElementById('app').style.display = 'flex';

  const mainContent = document.getElementById('main-content');
  const navItems = document.querySelectorAll('.nav-item');

  // ── Background preload: fire the station fetch ASAP so it's ready when the user opens the map/radar ──
  // We kick it before any heavy DOM work; result is cached in `allStations` via the dataLoaded flag in loadMapData().
  window.enableFranceConfig = localStorage.getItem('fillz_enable_france') === 'true';
  let _stationPreload = fetchAllStations().catch(() => []);

  // Early geolocation preload (only if already granted)
  window.userPreloadLat = null;
  window.userPreloadLng = null;
  if (localStorage.getItem('fillz_location_granted') === '1' && navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      pos => { window.userPreloadLat = pos.coords.latitude; window.userPreloadLng = pos.coords.longitude; },
      () => {}, { enableHighAccuracy: true }
    );
  }

  // ── State ──────────────────────────────────────────────
  let allStations = [];
  let userProfile = JSON.parse(localStorage.getItem('fillz_profile') || 'null');
  let selectedFuel = userProfile?.fuelType || 'SP95';
  let selectedBrandFilter = 'Toutes';
  function normalizeFavorites(arr) {
    if (!Array.isArray(arr)) return [];
    return arr.map(f => {
      let val = typeof f === 'object' && f !== null ? (f.id || f.stationId) : f;
      if (typeof val === 'string' && val.startsWith('tcs-')) return val.replace('tcs-', '');
      return val ? String(val) : null;
    }).filter(Boolean);
  }

  let favorites = normalizeFavorites(JSON.parse(localStorage.getItem('fillz_favs') || '[]'));
  let widgetStationId = localStorage.getItem('fillz_widget_station') || null;
  if (widgetStationId && widgetStationId.startsWith('tcs-')) {
    widgetStationId = widgetStationId.replace('tcs-', '');
    localStorage.setItem('fillz_widget_station', widgetStationId);
  }
  let priceHistory = null;
  let dataLoaded = false;
  let isFirstVisit = !userProfile;
  let currentUser = null;
  let sortBy = 'price';
  let currentMapTheme = localStorage.getItem('fillz_map_theme') || 'satellite';
  let mapInstance = null, markersLayer = null, tileLayer = null, detailsMapInstance = null;
  let userLat = 46.52, userLng = 6.63;
  let currentView = 'radar', previousView = 'radar';
  let deferredPrompt = null;
  let commute = JSON.parse(localStorage.getItem('fillz_commute') || 'null');
  let priceAlerts = JSON.parse(localStorage.getItem('fillz_alerts') || '[]');
  let userBadges = JSON.parse(localStorage.getItem('fillz_badges') || '[]');
  let isOnline = navigator.onLine;

  window.addEventListener('online', () => { isOnline = true; document.getElementById('offline-banner')?.remove(); });
  window.addEventListener('offline', () => {
    isOnline = false;
    if (!document.getElementById('offline-banner')) {
      const banner = document.createElement('div');
      banner.id = 'offline-banner';
      banner.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:99999;background:#ef4444;color:white;text-align:center;padding:8px;font-size:13px;font-weight:600;';
      banner.textContent = '⚠️ Hors-ligne — données du cache';
      document.body.prepend(banner);
    }
  });


  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
  });

  // ── Firestore Sync ────────────────────────────────────
  let syncTimer = null;
  async function syncToFirestore() {
    if (!currentUser) return;
    try {
      const refuels = JSON.parse(localStorage.getItem('fillz_refuels') || '[]');
      const alerts = JSON.parse(localStorage.getItem('fillz_alerts') || '[]');
      const comm = JSON.parse(localStorage.getItem('fillz_commute') || 'null');
      // history est exclu — trop volumineux (> 1 Mo), dépasse la limite Firestore
      await setDoc(doc(db, "users", currentUser.uid), {
        profile: userProfile,
        favorites: favorites,
        widgetStationId: widgetStationId || null,
        refuels: refuels,
        alerts: alerts,
        commute: comm,
        location: (typeof userLat !== 'undefined' && typeof userLng !== 'undefined') ? { lat: userLat, lng: userLng } : null,
      }, { merge: true });
    } catch(err) {
      console.error('Erreur Sync Firestore', err);
      showToast('Erreur sauvegarde cloud: ' + err.code, 'error');
    }
  }

  function debouncedSyncToFirestore() {
    clearTimeout(syncTimer);
    syncTimer = setTimeout(() => syncToFirestore(), 1500);
  }

  async function loadFromFirestore(user) {
    try {
      const snap = await getDoc(doc(db, "users", user.uid));
      if (snap.exists()) {
        const data = snap.data();
        if (data.profile) {
          userProfile = data.profile;
          selectedFuel = userProfile.fuelType || 'SP95';
          localStorage.setItem('fillz_profile', JSON.stringify(userProfile));
        }
        if (data.favorites) {
          favorites = normalizeFavorites(data.favorites);
          localStorage.setItem('fillz_favs', JSON.stringify(favorites));
        }
        if (data.refuels) {
          localStorage.setItem('fillz_refuels', JSON.stringify(data.refuels));
        }
        if (data.alerts) {
          priceAlerts = data.alerts;
          localStorage.setItem('fillz_alerts', JSON.stringify(priceAlerts));
        }
        if (data.commute) {
          commute = data.commute;
          localStorage.setItem('fillz_commute', JSON.stringify(commute));
        }
        if (data.widgetStationId !== undefined) {
          widgetStationId = data.widgetStationId;
          if (widgetStationId) localStorage.setItem('fillz_widget_station', widgetStationId);
          else localStorage.removeItem('fillz_widget_station');
        }
        if (dataLoaded) sendWidgetUpdate();
        return true;
      }
    } catch(err) { console.error('Erreur Load Firestore', err); }
    return false;
  }

  onAuthStateChanged(auth, async user => {
    if (user) {
      await loadFromFirestore(user);
      currentUser = user; // Set it AFTER loading is done to prevent premature syncs
      if (userProfile) debouncedSyncToFirestore();
      if (_ADMIN_ROUTE && user.email === ADMIN_EMAIL) {
        sessionStorage.removeItem('_admin_auth');
        showAdminPanel();
      }
      // Push notifications iOS — demande permission + sauvegarde token APNS
      if (window.isOptiTankApp && window.OptiTankBridge) {
        // Demande la permission push si déjà accordée (ou si on le fait manuellement plus tard)
        if (localStorage.getItem('fillz_push_granted') === '1') {
          window.OptiTankBridge.post({ type: 'requestNotifications' });
        }

        const saveToken = async (token) => {
          if (!token || token.trim() === '') return;
          try {
            await setDoc(doc(db, 'push_tokens', user.uid + '_ios'), {
              token,
              apnsToken: token,
              platform: 'ios',
              uid: user.uid,
              email: user.email || '',
              updatedAt: new Date().toISOString(),
            }, { merge: true });
            // Aussi dans users/{uid} pour que la Cloud Function puisse le lire
            await setDoc(doc(db, 'users', user.uid), { apnsToken: token }, { merge: true });
            // Stop polling once we get a valid token
            window.__stopAPNSPolling = true;
          } catch(_) {}
        };

        // Écoute l'événement token
        window.addEventListener('apns-token', (e) => saveToken(e.detail));

        // Essaie de récupérer le token plusieurs fois au cas où l'utilisateur met du temps à accepter l'alerte Apple
        let apnsAttempts = 0;
        window.__stopAPNSPolling = false;
        const pollAPNS = setInterval(() => {
          if (window.__stopAPNSPolling || apnsAttempts > 15) { // Stop after 45 seconds or success
            clearInterval(pollAPNS);
            return;
          }
          apnsAttempts++;
          window.OptiTankBridge.post({ type: 'getAPNSToken' });
        }, 3000);
      }
    } else {
      currentUser = null;
    }
  });

  // ── Vehicle helpers ────────────────────────────────────
  function getDistKm(lat1, lon1, lat2, lon2) {
    const R = 6371; 
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon/2) * Math.sin(dLon/2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  }

  function getTankSize() {
    if (!userProfile?.vehicleMotorization) return 50;
    const match = userProfile.vehicleMotorization.match(/(\d+)L/);
    if (match) return parseInt(match[1], 10);
    return userProfile.vehicleMotorization.includes('Électrique') ? 0 : 50;
  }

  function getVehicleFuel() {
    return selectedFuel;
  }

  function vehicleSummary() {
    if (!userProfile?.vehicleBrand) return 'Véhicule non configuré';
    return userProfile.vehicleBrand + ' ' + userProfile.vehicleModel
      + (userProfile.vehicleYear ? ' (' + userProfile.vehicleYear + ')' : '')
      + (userProfile.vehicleMotorization && userProfile.vehicleMotorization !== '0' ? ' — ' + userProfile.vehicleMotorization : '');
  }

  // ── Geolocation ────────────────────────────────────────
  let hasGeoloc = false;
  if (localStorage.getItem('fillz_location_granted') === '1') {
    window.getAppLocation(
      p => { 
        userLat = p.coords.latitude; 
        userLng = p.coords.longitude; 
        hasGeoloc = true;
        if (mapInstance && currentView === 'map') {
          mapInstance.flyTo([userLat, userLng], 13, { duration: 1 });
        }
      },
      err => { console.log('background location init failed', err); }
    );
  }

  // ── HTML: Onboarding ───────────────────────────────────
  const obDisplay = isFirstVisit ? '' : 'display:none';

  // brandDomain + brandInitials imported from vehicleAPI.js

  const FUELO_SVG = `<svg width="110" height="143" viewBox="0 0 80 104" fill="none">
    <defs>
      <linearGradient id="fuelo-g" x1="40" y1="4" x2="40" y2="96" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stop-color="#B0ABFF"/><stop offset="45%" stop-color="#6C63FF"/><stop offset="100%" stop-color="#3328B8"/>
      </linearGradient>
      <radialGradient id="fuelo-t" cx="38%" cy="34%" r="66%">
        <stop offset="0%" stop-color="#5FF0D8"/><stop offset="100%" stop-color="#009E80"/>
      </radialGradient>
    </defs>
    <ellipse cx="40" cy="56" rx="33" ry="42" fill="rgba(108,99,255,.25)"/>
    <path d="M40 7C24 7 8 31 8 53 8 75 22 97 40 97 58 97 72 75 72 53 72 31 56 7 40 7Z" fill="url(#fuelo-g)"/>
    <ellipse cx="28" cy="37" rx="8" ry="13" fill="rgba(255,255,255,.18)" transform="rotate(-20 28 37)"/>
    <circle cx="29" cy="54" r="7" fill="#0A0A0F"/><circle cx="51" cy="54" r="7" fill="#0A0A0F"/>
    <circle cx="31" cy="52" r="3" fill="#F59E0B"/><circle cx="53" cy="52" r="3" fill="#F59E0B"/>
    <circle cx="32.5" cy="50.5" r="1.3" fill="white" opacity=".9"/><circle cx="54.5" cy="50.5" r="1.3" fill="white" opacity=".9"/>
    <path d="M28 64 Q40 78 52 64" stroke="#0A0A0F" stroke-width="3.5" stroke-linecap="round" fill="none"/>
    <line x1="40" y1="7" x2="40" y2="0" stroke="#8B84FF" stroke-width="3" stroke-linecap="round"/>
    <circle cx="40" cy="-3" r="6" fill="url(#fuelo-t)"/>
    <circle cx="37.5" cy="-5.5" r="2.2" fill="white" opacity=".5"/>
  </svg>`;

  const CHEVRON_SVG = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="9 18 15 12 9 6"/></svg>`;

  const onboardingHTML = `<div id="onboarding" style="${obDisplay}">
    <div id="ob-progress-bar"><div id="ob-progress-fill"></div></div>

    <div class="ob-step active" id="ob-step-0">
      <div class="ob-welcome-bg"></div>
      <div class="ob-step-inner" style="padding:28px 28px 40px;justify-content:space-between;align-items:center">
        <div></div>
        <div class="ob-center">
          <div class="ob-fuelo-dance">${FUELO_SVG}</div>
          <h1 class="ob-welcome-title">Bonjour, je<br/>m'appelle <span class="ob-grad">Fuelo</span> 👋</h1>
          <p class="ob-welcome-sub">Ton compagnon de route qui te fait économiser sur chaque plein en Suisse.</p>
        </div>
        <div></div>
        <div class="ob-actions">
          <button class="ob-btn-primary" id="ob-start-btn">Commencer l'aventure →</button>
          <div class="ob-link-row">Déjà un compte ? <span class="ob-link" id="ob-go-login">Se connecter</span></div>
        </div>
      </div>
    </div>

    <div class="ob-step" id="ob-step-login">
      <div class="ob-step-inner" style="padding:20px 24px 32px;overflow-y:auto">
        <button class="ob-back-btn" data-back="0"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="15 18 9 12 15 6"/></svg> Retour</button>
        <div class="ob-step-header">
          <div class="ob-step-icon" style="background:linear-gradient(135deg,#8B84FF,#4338CA)"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg></div>
          <h2 class="ob-h2">Bon retour !</h2>
          <p class="ob-sub-text">Content de te revoir.</p>
        </div>
        <div class="ob-float-field"><input type="email" id="lf-email" class="ob-float-input" placeholder=" " autocomplete="email"/><label for="lf-email">Adresse email</label><div class="ob-field-line"></div></div>
        <div class="ob-float-field"><input type="password" id="lf-pwd" class="ob-float-input ob-pwd-input" placeholder=" " autocomplete="current-password"/><label for="lf-pwd">Mot de passe</label><div class="ob-field-line"></div><button type="button" class="ob-pwd-eye" data-target="lf-pwd"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg></button></div>
        <div style="text-align:right;margin-top:-8px;margin-bottom:14px;"><span id="login-forgot-pwd" style="font-size:11px;color:#8B84FF;cursor:pointer;font-weight:600;">Mot de passe oublié ?</span></div>
        <div id="login-error" class="ob-error" style="display:none"></div>
        <button class="ob-btn-primary" id="ob-login-btn">Se connecter</button>
        <div class="ob-social-divider"><span>ou continuer avec</span></div>
        <div class="ob-social-row">
          <button class="ob-social-btn" id="login-apple-btn"><svg width="17" height="17" viewBox="0 0 24 24" fill="white"><path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/></svg> Apple</button>
          <button class="ob-social-btn" id="login-google-btn"><svg width="17" height="17" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg> Google</button>
        </div>
        <div class="ob-link-row" style="margin-top:14px">Pas de compte ? <span class="ob-link" id="login-go-register">Créer un compte</span></div>
      </div>
    </div>

    <div class="ob-step" id="ob-step-forgot">
      <div class="ob-step-inner" style="padding:20px 24px 32px;overflow-y:auto">
        <button class="ob-back-btn" data-back="login"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="15 18 9 12 15 6"/></svg> Retour</button>
        
        <div id="ob-forgot-form">
          <div class="ob-step-header">
            <div class="ob-step-icon" style="background:linear-gradient(135deg,#8B84FF,#4338CA)"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg></div>
            <h2 class="ob-h2">Mot de passe oublié ?</h2>
            <p class="ob-sub-text">Saisis ton email, nous t'enverrons un lien de réinitialisation.</p>
          </div>
          <div class="ob-float-field" style="margin-top:20px;">
            <input type="email" id="fp-email" class="ob-float-input" placeholder=" " autocomplete="email"/>
            <label for="fp-email">Adresse email</label>
            <div class="ob-field-line"></div>
          </div>
          <div id="fp-error" class="ob-error" style="display:none"></div>
          <button class="ob-btn-primary" id="ob-fp-btn" style="margin-top:24px;">Envoyer le lien</button>
        </div>

        <div id="ob-forgot-success" style="display:none; text-align:center; padding-top:40px;">
          <div style="width:72px; height:72px; margin:0 auto 24px; border-radius:50%; background:linear-gradient(135deg,#8B84FF,#4338CA); display:flex; align-items:center; justify-content:center; box-shadow:0 8px 16px rgba(139,132,255,0.3); animation: scaleUpBounce 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;">
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="stroke-dasharray:30; stroke-dashoffset:30; animation: dash 0.5s ease-out 0.3s forwards;"><polyline points="20 6 9 17 4 12"/></svg>
          </div>
          <h2 class="ob-h2" style="margin-bottom:12px;">Lien envoyé !</h2>
          <p class="ob-sub-text" style="font-size:15px; margin-bottom:32px;">Vérifie ta boîte mail (et tes spams). Clique sur le lien pour réinitialiser ton mot de passe.</p>
          <button class="ob-btn-primary" id="ob-fp-back-btn">Retour à la connexion</button>
        </div>
        
      </div>
    </div>

    <div class="ob-step" id="ob-step-1">
      <div class="ob-step-inner" style="padding:20px 24px 32px;overflow-y:auto">
        <button class="ob-back-btn" data-back="0"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="15 18 9 12 15 6"/></svg> Retour</button>
        <div class="ob-step-header">
          <div class="ob-step-icon" style="background:linear-gradient(135deg,#8B84FF,#4338CA)"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg></div>
          <h2 class="ob-h2">Créer ton compte</h2>
          <p class="ob-sub-text">C'est gratuit et prend 30 secondes.</p>
        </div>
        <div class="ob-float-field"><input type="text" id="reg-name" class="ob-float-input" placeholder=" " autocomplete="given-name"/><label for="reg-name">Ton prénom</label><div class="ob-field-line"></div></div>
        <div class="ob-float-field"><input type="email" id="reg-email" class="ob-float-input" placeholder=" " autocomplete="email"/><label for="reg-email">Adresse email</label><div class="ob-field-line"></div></div>
        <div class="ob-float-field"><input type="password" id="reg-pwd" class="ob-float-input ob-pwd-input" placeholder=" " autocomplete="new-password"/><label for="reg-pwd">Mot de passe</label><div class="ob-field-line"></div><button type="button" class="ob-pwd-eye" data-target="reg-pwd"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg></button></div>
        <div id="pwd-strength-bar" class="ob-strength"></div>
        <div class="ob-social-divider"><span>ou continuer avec</span></div>
        <div class="ob-social-row">
          <button class="ob-social-btn" id="ob-apple-btn"><svg width="17" height="17" viewBox="0 0 24 24" fill="white"><path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/></svg> Apple</button>
          <button class="ob-social-btn" id="ob-google-btn"><svg width="17" height="17" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg> Google</button>
        </div>
        <div id="reg-error" class="ob-error" style="display:none"></div>
        <div style="display:flex;align-items:flex-start;gap:10px;margin-top:14px;">
          <input type="checkbox" id="ob-cgu-check" style="width:16px;height:16px;margin-top:2px;accent-color:#8B84FF;flex-shrink:0;cursor:pointer;"/>
          <label for="ob-cgu-check" style="font-size:12px;color:rgba(255,255,255,.38);line-height:1.6;cursor:pointer;margin:0;">
            J'accepte les <a href="#" style="color:#8B84FF;text-decoration:none;" onclick="event.preventDefault(); showLegalModal('/terms.html', 'Conditions d\\'utilisation');">Conditions d'utilisation</a> et la <a href="#" style="color:#8B84FF;text-decoration:none;" onclick="event.preventDefault(); showLegalModal('/privacy.html', 'Politique de confidentialité');">Politique de confidentialité</a> d'OptiTank.
          </label>
        </div>
        <button class="ob-btn-primary" id="ob-register-btn" disabled style="margin-top:14px;opacity:0.4;transition:opacity .2s;">Continuer →</button>
      </div>
    </div>

    <!-- Step 2: Brand picker — colored grid cards -->
    <div class="ob-step" id="ob-step-2">
      <div style="display:flex;flex-direction:column;height:100%;overflow:hidden">
        <div style="padding:20px 24px 10px;flex-shrink:0">
          <button class="ob-back-btn" data-back="1"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="15 18 9 12 15 6"/></svg> Retour</button>
          <div class="ob-vehtype-row">
            <button class="ob-vehtype-btn active" data-vtype="car">🚗 Voiture</button>
            <button class="ob-vehtype-btn" data-vtype="motorcycle">🏍️ Moto</button>
          </div>
          <div style="font-size:22px;font-weight:900;color:white;letter-spacing:-.5px;margin-top:8px;margin-bottom:3px">Quelle marque ?</div>
          <div style="font-size:13px;color:rgba(255,255,255,.4);margin-bottom:12px" id="ob-brand-sub">Tap pour sélectionner</div>
        </div>
        <div style="flex:1;overflow-y:auto;padding:0 16px 8px">
          <div id="ob-brands-grid" class="ob-brand-grid"></div>
        </div>
        <div style="padding:0 16px 32px;flex-shrink:0">
          <button class="ob-btn-primary" id="ob-brand-continue" disabled>Choisir une marque</button>
          <div style="height:8px"></div>
          <button class="ob-btn-ghost" id="ob-brand-skip">Ma marque n'est pas dans la liste</button>
        </div>
      </div>
    </div>

    <!-- Step 2b: Model picker — brand header card + rich model rows -->
    <div class="ob-step" id="ob-step-2b">
      <div style="display:flex;flex-direction:column;height:100%;overflow:hidden">
        <div style="padding:20px 22px 12px;flex-shrink:0">
          <button class="ob-back-btn" data-back="2"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="15 18 9 12 15 6"/></svg> Retour</button>
          <div id="ob-2b-brand-header" style="display:flex;align-items:center;gap:12px;border-radius:16px;padding:12px 14px;margin:10px 0 14px">
            <div id="ob-2b-brand-icon" style="width:42px;height:42px;border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:900;color:white;flex-shrink:0"></div>
            <div>
              <div id="ob-2b-brand-name" style="font-size:16px;font-weight:800;color:white;margin-bottom:1px"></div>
              <div id="ob-2b-model-count" style="font-size:12px;color:rgba(255,255,255,.4)"></div>
            </div>
            <div id="ob-2b-vehicle-svg" style="margin-left:auto;opacity:.65;flex-shrink:0"></div>
          </div>
          <div style="font-size:20px;font-weight:900;color:white;letter-spacing:-.4px;margin-bottom:4px">Quel modèle ?</div>
          <div style="font-size:13px;color:rgba(255,255,255,.4)">Sélectionne ton modèle exact.</div>
        </div>
        <div style="flex:1;overflow-y:auto;padding:0 16px">
          <div id="ob-models-list"></div>
          <div style="height:8px"></div>
        </div>
        <div style="padding:0 16px 32px;flex-shrink:0">
          <button class="ob-btn-primary" id="ob-model-continue" disabled>Choisir un modèle</button>
          <div style="height:8px"></div>
          <button class="ob-btn-ghost" id="ob-model-autre">Mon modèle n'est pas dans la liste</button>
        </div>
      </div>
    </div>

    <!-- Step 2c: Year picker → auto-détecte la capacité du réservoir -->
    <div class="ob-step" id="ob-step-2c">
      <div style="display:flex;flex-direction:column;height:100%;overflow:hidden">
        <div style="padding:20px 24px 12px;flex-shrink:0">
          <button class="ob-back-btn" data-back="2b"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="15 18 9 12 15 6"/></svg> Retour</button>
          <h2 class="ob-h2" style="margin-top:8px">Année <span id="ob-2c-model-label" style="color:#8B84FF"></span></h2>
          <p class="ob-sub-text">La capacité du réservoir sera détectée automatiquement.</p>
        </div>
        <div style="flex:1;overflow-y:auto;padding:0 20px 8px">
          <div id="ob-years-grid" class="ob-year-grid"></div>
        </div>
        <div id="ob-tank-reveal" style="padding:0 24px 12px;display:none">
          <div style="background:linear-gradient(135deg,rgba(0,212,170,.12),rgba(108,99,255,.08));border:1px solid rgba(0,212,170,.25);border-radius:16px;padding:14px 18px;display:flex;align-items:center;gap:12px">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#00D4AA" stroke-width="2"><path d="M3 22V8l5-5h8l5 5v14H3z"/><path d="M10 22V16h4v6"/></svg>
            <div><div style="font-size:11px;color:rgba(255,255,255,.45);margin-bottom:2px">Réservoir détecté</div><div id="ob-tank-value" style="font-size:20px;font-weight:800;color:#00D4AA">— L</div></div>
          </div>
        </div>
        <div style="padding:0 24px 32px;flex-shrink:0">
          <button class="ob-btn-primary" id="ob-year-next" disabled>Continuer →</button>
        </div>
      </div>
    </div>

    <!-- Step 2d: Custom vehicle entry -->
    <div class="ob-step" id="ob-step-2d">
      <div style="display:flex;flex-direction:column;height:100%;overflow:hidden">
        <div style="padding:20px 24px 10px;flex-shrink:0">
          <button class="ob-back-btn" id="ob-2d-back"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="15 18 9 12 15 6"/></svg> Retour</button>
          <h2 class="ob-h2" style="margin-top:8px">Mon véhicule</h2>
          <p class="ob-sub-text">Renseigne les infos manuellement.</p>
        </div>
        <div style="flex:1;overflow-y:auto;padding:0 24px 16px">
          <div class="ob-float-field" style="margin-bottom:16px"><input type="text" id="custom-brand" class="ob-float-input" placeholder=" " autocomplete="off"/><label for="custom-brand">Marque</label><div class="ob-field-line"></div></div>
          <div class="ob-float-field" style="margin-bottom:16px"><input type="text" id="custom-model" class="ob-float-input" placeholder=" " autocomplete="off"/><label for="custom-model">Modèle</label><div class="ob-field-line"></div></div>
          <div class="ob-float-field" style="margin-bottom:16px"><input type="number" id="custom-year" class="ob-float-input" placeholder=" " min="1980" max="2026"/><label for="custom-year">Année</label><div class="ob-field-line"></div></div>
          <div style="margin-bottom:18px">
            <div style="font-size:11px;color:rgba(255,255,255,.38);font-weight:700;text-transform:uppercase;letter-spacing:.9px;margin-bottom:10px">Carburant</div>
            <div class="ob-custom-fuel-row">
              <button type="button" class="ob-custom-fuel-btn" data-fuel="SP95" style="--fc:#22C55E">SP 95</button>
              <button type="button" class="ob-custom-fuel-btn" data-fuel="SP98" style="--fc:#8B84FF">SP 98</button>
              <button type="button" class="ob-custom-fuel-btn" data-fuel="Diesel" style="--fc:#F59E0B">Diesel</button>
              <button type="button" class="ob-custom-fuel-btn" data-fuel="Electrique" style="--fc:#00D4AA">Élec.</button>
            </div>
          </div>
          <div class="ob-float-field" style="margin-bottom:4px"><input type="number" id="custom-tank" class="ob-float-input" placeholder=" " min="5" max="200" step="0.5"/><label for="custom-tank">Réservoir (litres)</label><div class="ob-field-line"></div></div>
        </div>
        <div style="padding:8px 24px 32px;flex-shrink:0">
          <div id="custom-error" class="ob-error" style="display:none;margin-bottom:10px"></div>
          <button class="ob-btn-primary" id="ob-custom-next">Continuer →</button>
        </div>
      </div>
    </div>

    <!-- Step 3: Fuel only -->
    <div class="ob-step" id="ob-step-3">
      <div style="display:flex;flex-direction:column;height:100%;overflow:hidden">
        <div style="padding:20px 24px 12px;flex-shrink:0">
          <button class="ob-back-btn" id="ob-step3-back"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="15 18 9 12 15 6"/></svg> Retour</button>
          <h2 class="ob-h2" style="margin-top:8px">Ton carburant ⛽</h2>
          <p class="ob-sub-text">Pour des prix toujours pertinents.</p>
        </div>
        <div style="flex:1;overflow-y:auto;padding:0 24px 8px">
          <div class="ob-fuel-card" data-fuel="SP95"><div class="ob-fuel-icon" style="--fuel-color:#22C55E;border-color:rgba(34,197,94,.3)"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#22C55E" stroke-width="2"><path d="M3 22V8l5-5h8l5 5v14H3z"/><path d="M10 22V16h4v6"/></svg></div><div><div class="ob-fuel-label">SP 95</div><div class="ob-fuel-sub">Essence sans plomb 95</div></div><div class="ob-fuel-radio" style="--fuel-color:#22C55E"></div></div>
          <div class="ob-fuel-card" data-fuel="SP98"><div class="ob-fuel-icon" style="--fuel-color:#8B84FF;border-color:rgba(139,132,255,.3)"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#8B84FF" stroke-width="2"><path d="M3 22V8l5-5h8l5 5v14H3z"/><path d="M10 22V16h4v6"/></svg></div><div><div class="ob-fuel-label">SP 98</div><div class="ob-fuel-sub">Essence sans plomb 98</div></div><div class="ob-fuel-radio" style="--fuel-color:#8B84FF"></div></div>
          <div class="ob-fuel-card" data-fuel="Diesel"><div class="ob-fuel-icon" style="--fuel-color:#F59E0B;border-color:rgba(245,158,11,.3)"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" stroke-width="2"><path d="M3 22V8l5-5h8l5 5v14H3z"/><path d="M10 22V16h4v6"/></svg></div><div><div class="ob-fuel-label">Diesel</div><div class="ob-fuel-sub">Gazole — moteur diesel</div></div><div class="ob-fuel-radio" style="--fuel-color:#F59E0B"></div></div>
          <div class="ob-fuel-card" data-fuel="Electrique"><div class="ob-fuel-icon" style="--fuel-color:#00D4AA;border-color:rgba(0,212,170,.3)"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#00D4AA" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg></div><div><div class="ob-fuel-label">Électrique</div><div class="ob-fuel-sub">Bornes de recharge</div></div><div class="ob-fuel-radio" style="--fuel-color:#00D4AA"></div></div>
        </div>
        <div style="padding:0 24px 32px;flex-shrink:0">
          <button class="ob-btn-primary" id="ob-fuel-next" disabled>Continuer →</button>
        </div>
      </div>
    </div>

    <div class="ob-step" id="ob-step-4">
      <div class="ob-step-inner" style="padding:28px 28px 40px;justify-content:space-between;align-items:center;background:radial-gradient(ellipse 70% 50% at 50% 40%,rgba(0,212,170,.12),transparent 65%)">
        <div></div>
        <div style="display:flex;flex-direction:column;align-items:center;gap:24px;text-align:center">
          <div class="ob-loc-radar">
            <div class="ob-loc-ring" style="--d:1.5s;--s:0.8"></div>
            <div class="ob-loc-ring" style="--d:1.9s;--s:0.55;--delay:0.3s"></div>
            <div class="ob-loc-ring" style="--d:2.3s;--s:0.35;--delay:0.6s"></div>
            <div class="ob-loc-center"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5"><path d="M12 22s-8-4.5-8-11.8A8 8 0 0 1 12 2a8 8 0 0 1 8 8.2c0 7.3-8 11.8-8 11.8z"/><circle cx="12" cy="10" r="3"/></svg></div>
            <div class="ob-loc-dot" style="left:20%;top:30%;--bc:#22C55E;--d:2s"></div>
            <div class="ob-loc-dot" style="left:75%;top:25%;--bc:#F59E0B;--d:2.3s;--delay:0.3s"></div>
            <div class="ob-loc-dot" style="left:65%;top:70%;--bc:#22C55E;--d:1.8s;--delay:0.6s"></div>
            <div class="ob-loc-dot" style="left:18%;top:68%;--bc:#EF4444;--d:2.1s;--delay:0.9s"></div>
            <div class="ob-loc-dot" style="left:82%;top:55%;--bc:#22C55E;--d:1.9s;--delay:1.2s"></div>
          </div>
          <div>
            <h2 class="ob-h2">Stations près de toi 📍</h2>
            <p class="ob-sub-text" style="max-width:280px;margin:8px auto 0">OptiTank a besoin de ta position pour trouver les meilleures stations autour de toi en temps réel.</p>
          </div>
          <div class="ob-loc-info"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#00D4AA" stroke-width="2"><path d="M12 22s-8-4.5-8-11.8A8 8 0 0 1 12 2a8 8 0 0 1 8 8.2c0 7.3-8 11.8-8 11.8z"/></svg><div><strong style="color:white">3 000+ stations</strong> en Suisse analysées via l'API TCS.</div></div>
        </div>
        <div style="width:100%;display:flex;flex-direction:column;gap:10px">
          <button class="ob-btn-accent" id="ob-loc-allow">📍 Continuer</button>
        </div>
      </div>
    </div>

    <div class="ob-step" id="ob-step-4b">
      <div class="ob-step-inner" style="padding:28px 28px 40px;justify-content:space-between;align-items:center;background:radial-gradient(ellipse 70% 50% at 50% 40%,rgba(139,92,246,.12),transparent 65%)">
        <div></div>
        <div style="display:flex;flex-direction:column;align-items:center;gap:24px;text-align:center">
          <div class="ob-loc-radar" style="border-color: rgba(139,92,246, 0.4)">
            <i class="ph-fill ph-bell-ringing" style="font-size:36px;color:#8B5CF6"></i>
          </div>
          <div>
            <h2 style="font-size:26px;font-weight:900;letter-spacing:-0.5px;line-height:1.1;margin-bottom:12px;color:white">Alertes de Prix</h2>
            <p style="font-size:15px;color:rgba(255,255,255,.5);line-height:1.45;margin-bottom:16px">Recevez une notification push dès que le prix du carburant baisse fortement près de vous.</p>
          </div>
          <div class="ob-loc-info" style="border:1px solid rgba(139,92,246,0.2); background:rgba(139,92,246,0.05)"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#8B5CF6" stroke-width="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg><div><strong style="color:white">Pas de spam.</strong> Uniquement de vraies alertes pour faire des économies.</div></div>
        </div>
        <div style="width:100%;display:flex;flex-direction:column;gap:10px">
          <button class="ob-btn-accent" id="ob-push-allow" style="background:linear-gradient(135deg,#8B5CF6,#6366f1);border-bottom-color:#4f46e5;color:white">🔔 Activer les alertes</button>
          <button class="ob-btn-ghost" id="ob-push-skip">Plus tard</button>
        </div>
      </div>
    </div>

    <div class="ob-step" id="ob-step-5">
      <div class="ob-step-inner" style="padding:28px 28px 48px;justify-content:space-between;align-items:center;background:radial-gradient(ellipse 80% 55% at 50% 30%,rgba(108,99,255,.22),transparent 65%);overflow:hidden">
        <div id="ob-confetti-container"></div>
        <div></div>
        <div style="display:flex;flex-direction:column;align-items:center;gap:18px;width:100%">
          <div class="ob-fuelo-bounce">${FUELO_SVG}</div>
          <div style="text-align:center">
            <h2 style="font-size:32px;font-weight:900;color:white;letter-spacing:-.8px;line-height:1.05;margin-bottom:6px">C'est parti ! 🎊</h2>
            <p style="font-size:15px;color:rgba(255,255,255,.5)">Bienvenue dans la famille OptiTank 🇨🇭</p>
          </div>
          <div class="ob-savings-card">
            <div class="ob-savings-label">Potentiel d'économies / mois</div>
            <div class="ob-savings-num" id="ob-savings-counter">CHF 0.00</div>
            <div class="ob-savings-sub">basé sur 14 pleins en Suisse</div>
          </div>
          <div class="ob-badge-unlock" id="ob-badge-card" style="opacity:0;transform:scale(0) rotate(-25deg)">
            <div class="ob-badge-icon"><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="1.8"><path d="M18 2H6v7a6 6 0 0 0 12 0V2z"/><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/></svg><div class="ob-badge-ring"></div></div>
            <div><div class="ob-badge-title">🏆 Badge débloqué !</div><div class="ob-badge-name">Pionnier</div><div class="ob-badge-desc">Compte créé avec succès</div></div>
          </div>
        </div>
        <div style="width:100%;margin-top:20px">
          <button class="ob-btn-primary" id="ob-finish">Explorer OptiTank →</button>
        </div>
      </div>
    </div>
  </div>`;

  // ── HTML: Profile info ─────────────────────────────────
  const profName = [userProfile?.name, userProfile?.surname].filter(Boolean).join(' ') || 'Utilisateur';
  const profEmail = userProfile?.email || 'email@exemple.com';

  // ── HTML: Views ────────────────────────────────────────
  const radarActive = isFirstVisit ? '' : 'active';
  const viewsHTML = `
    <div class="view view-radar ${radarActive}" id="view-radar">
      <div class="top-brand">
        <span style="font-size:24px;font-weight:800;letter-spacing:-0.5px;margin-left:6px;">OptiTank.</span>
      </div>
      <div class="radar-header">
        <h1><i class="ph-fill ph-brain" style="color:var(--accent-purple)"></i> Radar IA</h1>
        <p>Classement intelligent — prix du plein <strong>+</strong> coût du trajet aller-retour</p>
      </div>
      <div class="radar-container">
        <canvas id="radar-canvas" width="220" height="220" style="display:block;margin:0 auto;"></canvas>
      </div>
      <div id="radar-savings-banner" style="display:none;margin:0 16px 8px;padding:12px 16px;background:linear-gradient(135deg,rgba(0,212,170,0.12),rgba(108,99,255,0.08));border:1px solid rgba(0,212,170,0.25);border-radius:16px;text-align:center;">
        <span style="font-size:11px;color:rgba(255,255,255,0.5);text-transform:uppercase;letter-spacing:1px;">Meilleure offre vs prix local</span>
        <div id="radar-savings-amount" style="font-size:28px;font-weight:800;color:#00D4AA;line-height:1.2;">CHF 0.00</div>
        <span style="font-size:12px;color:rgba(255,255,255,0.5);">d'économie sur ce plein</span>
      </div>
      <div id="radar-results" class="radar-results"></div>
      <div class="radar-footer">
        <div style="margin-bottom: 12px; display: flex; justify-content: center;">
          <select id="radar-range" class="ob-input ob-select" style="max-width: 250px; margin: 0; padding: 12px 20px; font-size: 14px;">
            <option value="10">Rayon de recherche : 10 km</option>
            <option value="20">Rayon de recherche : 20 km</option>
            <option value="40" selected>Rayon de recherche : 40 km</option>
            <option value="80">Rayon de recherche : 80 km</option>
          </select>
        </div>
        <button class="btn-primary" id="btn-radar-scan"><i class="ph-bold ph-brain"></i> Analyser</button>
      </div>
    </div>

    <div class="view view-savings" id="view-savings">
      <div class="top-brand">
        <span style="font-size:24px;font-weight:800;letter-spacing:-0.5px;margin-left:6px;">OptiTank.</span>
        <div class="premium-badge"><i class="ph-fill ph-trend-up" style="color:var(--accent-green)"></i> Économies</div>
      </div>
      <div style="padding:0 16px 100px; overflow-y:auto; -webkit-overflow-scrolling:touch;">
        <div id="savings-hero" style="background:linear-gradient(135deg,rgba(74,222,128,0.12),rgba(192,132,252,0.08));border:1px solid rgba(74,222,128,0.2);border-radius:24px;padding:24px;margin-bottom:20px;text-align:center;">
          <div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">TOTAL ÉCONOMISÉ GRÂCE À OPTITANK</div>
          <div id="savings-total" style="font-size:48px;font-weight:900;color:var(--accent-green);line-height:1;">CHF 0.00</div>
          <div style="font-size:12px;color:var(--text-muted);margin-top:8px;">vs. prix moyen de vos stations enregistrées</div>
          <div id="savings-sub" style="margin-top:12px;font-size:13px;color:var(--text-muted);"></div>
        </div>

        <div class="section-title">Mode Commute — Trajet domicile-bureau</div>
        <div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-radius:16px;padding:14px;margin-bottom:16px;">
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;">
            <i class="ph-fill ph-house" style="color:#60a5fa;font-size:18px;flex-shrink:0;"></i>
            <input type="text" id="commute-start" class="ob-input" style="flex:1;margin:0;padding:8px 12px;font-size:13px;" placeholder="Domicile (ex: Lausanne)"/>
          </div>
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;">
            <i class="ph-fill ph-briefcase" style="color:#f87171;font-size:18px;flex-shrink:0;"></i>
            <input type="text" id="commute-end" class="ob-input" style="flex:1;margin:0;padding:8px 12px;font-size:13px;" placeholder="Bureau (ex: Genève)"/>
          </div>
          <button class="btn-primary" id="btn-save-commute" style="font-size:14px;padding:12px;"><i class="ph-bold ph-floppy-disk"></i> Enregistrer mon trajet</button>
          <div id="commute-status" style="font-size:12px;color:var(--text-muted);margin-top:8px;text-align:center;"></div>
          <div id="commute-stations" style="margin-top:12px;display:flex;flex-direction:column;gap:8px;"></div>
        </div>

        <div class="section-title">Alertes Prix</div>
        <div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-radius:16px;padding:14px;margin-bottom:12px;">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;flex-wrap:wrap;">
            <select id="alert-fuel" class="ob-input ob-select" style="flex:1;min-width:80px;margin:0;padding:8px 12px;font-size:13px;">
              <option value="SP95">SP95</option><option value="SP98">SP98</option>
              <option value="Diesel">Diesel</option><option value="GPL">GPL</option>
            </select>
            <span style="color:var(--text-muted);font-size:13px;white-space:nowrap;">si prix &lt; CHF</span>
            <input type="number" id="alert-price" class="ob-input" step="0.01" style="width:80px;margin:0;padding:8px 12px;font-size:13px;" placeholder="1.90"/>
          </div>
          <button class="btn-secondary" id="btn-add-alert" style="font-size:13px;padding:10px;"><i class="ph-bold ph-bell-ringing"></i> Ajouter une alerte</button>
        </div>
        <div id="alerts-list" style="display:flex;flex-direction:column;gap:8px;margin-bottom:20px;"></div>

        <div class="section-title">Vos Badges</div>
        <div id="badges-grid" style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:20px;"></div>
      </div>
    </div>

    <div class="view view-map" id="view-map">
      <div class="map-top-bar" style="flex-direction:column; align-items:stretch;">
        <div style="display:flex; gap:12px; align-items:center;">
          <div class="search-input" style="flex:1;"><i class="ph ph-magnifying-glass"></i><input type="text" id="search-field" placeholder="Rechercher une station..."/></div>
          <button class="icon-btn" id="btn-theme-toggle"><i class="ph ph-palette"></i></button>
        </div>
        <div id="search-suggestions" style="display:none; background:rgba(20,20,20,0.95); border:1px solid rgba(255,255,255,0.1); border-radius:12px; margin-top:8px; max-height:200px; overflow-y:auto;"></div>
      </div>
      <div class="map-filters">
        <button class="filter-chip active" id="chip-fuel"><i class="ph ph-gas-pump"></i> ${selectedFuel} <i class="ph ph-caret-down"></i></button>
        <button class="filter-chip" id="chip-brand"><i class="ph ph-storefront"></i> Toutes <i class="ph ph-caret-down"></i></button>
        <button class="filter-chip" id="chip-sort"><i class="ph ph-funnel"></i> Trier par prix <i class="ph ph-caret-down"></i></button>
        <button class="filter-chip" id="chip-count"><i class="ph ph-map-trifold"></i> 0 stations</button>
      </div>
      <div id="leaflet-map"></div>
      <button id="btn-gps-locate" class="btn-fab" aria-label="Recentrer"><i class="ph ph-crosshair"></i></button>
      
      <div class="map-loading-overlay" id="map-loader"><div class="spinner"></div><p>Chargement des stations...</p></div>
      
      <div class="bottom-sheet" id="station-bottom-sheet">
        <div class="sheet-handle"></div>
        <div class="sheet-content" id="sheet-content">
          <div class="sheet-title-row">
            <div class="station-icon bg-purple"><i class="ph-fill ph-gas-pump"></i></div>
            <div class="station-info">
              <h3 id="bs-title">Nom de la station</h3>
              <p id="bs-address">Adresse complète</p>
              <p id="bs-distance" style="color:var(--accent-purple); font-weight:600; margin-top:2px;">0.0 km</p>
            </div>
            <button class="btn-icon circle" id="bs-share" style="margin-right:8px;"><i class="ph ph-share-network"></i></button>
            <button class="btn-icon circle" id="bs-fav"><i class="ph ph-heart"></i></button>
          </div>
          <div id="bs-prices" style="margin-bottom: 20px;"></div>
          <div style="display:flex; gap:12px;">
            <button class="btn-primary" id="bs-view-details" style="flex:1;">Voir détails</button>
            <button class="btn-secondary" id="bs-go" style="width:auto; padding:0 20px;"><i class="ph-bold ph-navigation-arrow"></i> Aller</button>
          </div>
        </div>
      </div>

      <div class="filter-dropdown" id="fuel-dropdown">
        <div class="dropdown-item" data-fuel="SP95">SP95</div>
        <div class="dropdown-item" data-fuel="SP98">SP98</div>
        <div class="dropdown-item" data-fuel="Diesel">Diesel</div>
        <div class="dropdown-item" data-fuel="Diesel Premium">Diesel Premium</div>
        <div class="dropdown-item" data-fuel="GPL">GPL</div>
        <div class="dropdown-item" data-fuel="GNC">GNC</div>
        <div class="dropdown-item" data-fuel="Ethanol 85">E85</div>
      </div>
      <div class="filter-dropdown" id="brand-dropdown">
        <!-- Populated dynamically by JS -->
      </div>
      <div class="filter-dropdown" id="sort-dropdown">
        <div class="dropdown-item" data-sort="price"><i class="ph ph-sort-ascending"></i> Prix croissant</div>
        <div class="dropdown-item" data-sort="name"><i class="ph ph-sort-ascending"></i> Nom A-Z</div>
      </div>
      <div class="filter-dropdown" id="theme-dropdown">
        <div class="dropdown-item theme-opt" data-theme="dark"><i class="ph ph-moon"></i> Sombre</div>
        <div class="dropdown-item theme-opt" data-theme="light"><i class="ph ph-sun"></i> Clair</div>
        <div class="dropdown-item theme-opt" data-theme="satellite"><i class="ph ph-globe-hemisphere-west"></i> Satellite</div>
      </div>
    </div>

    <div class="view view-list" id="view-list">
      <div class="list-header">
        <button class="btn-icon circle" id="btn-list-back"><i class="ph-bold ph-arrow-left"></i></button>
        <h2>Choisir une station</h2>
      </div>
      <div id="station-list-container" class="station-cards-container">
        <!-- Injected by JS -->
      </div>
    </div>

    <div class="view view-details" id="view-details">
      <div class="details-header" style="justify-content:center; align-items:center; position:sticky; top:0; display:flex;">
        <button class="details-back-btn" id="btn-details-back" style="position:absolute; left:16px; top:50%; transform:translateY(-50%); background:transparent; border:none; color:var(--accent-purple); font-size:16px; font-weight:600; display:flex; align-items:center; gap:6px; padding:0; cursor:pointer;">
          <i class="ph-bold ph-caret-left" style="font-size:20px;"></i> Retour
        </button>
        <span style="font-weight:700; font-size:16px;">Détails</span>
      </div>
      <div class="details-content" style="padding-bottom:120px;">
        <div class="details-main-info">
          <div class="details-badges" id="det-badges">
            <span id="badge-distance" class="badge-proche" style="display:none;">Proche</span>
            <span id="badge-trend" style="display:none; padding:4px 10px; border-radius:8px; font-size:12px; font-weight:700;"></span>
            <span id="badge-cheapest" style="display:none; background:rgba(74,222,128,0.15); color:var(--accent-green); padding:4px 10px; border-radius:8px; font-size:12px; font-weight:700;">🏆 Moins chère</span>
          </div>
          <h1 id="det-name">Nom de la station</h1>
          <p class="text-muted" id="det-meta">1.6 km · Adresse complete</p>
        </div>
        
        <div class="details-map-container">
          <div id="details-preview-map"></div>
        </div>

        <div class="details-section-title"><i class="ph ph-tag"></i> Prix du carburant</div>
        <div class="details-prices-grid" id="det-prices">
          <!-- Injected by JS -->
        </div>

        <div id="det-history-section" style="display:none; margin-bottom:24px;">
          <div class="details-section-title"><i class="ph ph-chart-line-up" style="color:var(--accent-purple)"></i> Évolution des prix <span id="det-history-fuel" style="color:var(--accent-purple); font-size:12px;"></span></div>
          <div style="background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.06); border-radius:16px; padding:14px; position:relative; height:160px;">
            <canvas id="det-history-chart"></canvas>
          </div>
          <div id="det-history-empty" style="display:none; text-align:center; color:var(--text-muted); font-size:12px; margin-top:8px;">
            <i class="ph ph-clock"></i> Les données s'accumulent jour après jour
          </div>
        </div>

        <p id="det-updated"></p>

        <div class="details-section-title"><i class="ph ph-info"></i> À propos</div>
        <div class="info-list">
          <div class="info-item">
            <i class="ph ph-map-pin"></i>
            <div class="info-text" id="det-full-address">Adresse complète</div>
          </div>
        </div>

        <div class="details-section-title"><i class="ph ph-warning-circle"></i> Rapport de la communauté</div>
        <div class="reports-list">
          <div class="report-item" id="btn-report-price" style="cursor:pointer;">
            <div style="display:flex; align-items:center; gap:12px;">
              <i class="ph-bold ph-tag" style="color:var(--accent-purple)"></i> <span>Signaler un changement de prix</span>
            </div>
            <i class="ph ph-caret-right"></i>
          </div>
        </div>
      </div>

      <div class="details-bottom-actions" style="position:absolute; bottom:0; left:0; right:0; padding:20px 24px 34px; background:linear-gradient(to top, rgba(10,10,15,1) 60%, rgba(10,10,15,0)); display:flex; gap:12px; z-index:100; align-items:center;">
        <button class="btn-icon circle" id="det-fav" style="flex-shrink:0; width:52px; height:52px; background:rgba(255,255,255,0.08); border:1px solid rgba(255,255,255,0.1); color:white;"><i class="ph ph-heart" style="font-size:24px;"></i></button>
        <button class="btn-icon circle" style="flex-shrink:0; width:52px; height:52px; background:rgba(255,255,255,0.08); border:1px solid rgba(255,255,255,0.1); color:white;"><i class="ph ph-share-network" style="font-size:24px;"></i></button>
        <button class="btn-primary" id="det-go" style="flex:1; border-radius:16px; height:52px; font-size:16px; box-shadow:0 8px 16px rgba(139,132,255,0.3);">Aller à cette station <i class="ph ph-arrow-up-right"></i></button>
      </div>
    </div>

    <!-- Modale de Crowdsourcing -->
    <div class="modal-overlay" id="report-modal" style="display:none; z-index:99999;">
      <div class="modal-card">
        <h3><i class="ph-fill ph-warning-circle" style="color:var(--accent-purple)"></i> Signaler un Prix</h3>
        <p class="text-muted" style="margin-bottom:14px;font-size:12px;">Vous avez remarqué une erreur ou un prix différent à la pompe ? Aidez la communauté OptiTank !</p>
        
        <select id="rep-fuel" class="ob-input">
          <option value="SP95">SP95</option>
          <option value="SP98">SP98</option>
          <option value="Diesel">Diesel</option>
        </select>
        <input type="number" id="rep-price" class="ob-input" step="0.01" placeholder="Nouveau prix (ex: 1.85)"/>
        
        <div style="display:flex;gap:10px;margin-top:16px">
          <button class="btn-primary" id="rep-submit">Valider</button>
          <button class="btn-link" id="rep-cancel">Annuler</button>
        </div>
      </div>
    </div>

    <div class="view view-stats" id="view-stats">
      <div class="top-brand">
        <span style="font-size:24px;font-weight:800;letter-spacing:-0.5px;margin-left:6px;">OptiTank.</span>
      </div>
      <div class="radar-header" style="text-align:left; padding: 0 16px 10px;">
        <h1><i class="ph-fill ph-chart-line-up" style="color:var(--accent-purple)"></i> Statistiques</h1>
        <p>Évolution des prix par station — historique quotidien</p>
      </div>
      <div id="stats-kpi-row" style="padding:0 16px 12px;display:flex;gap:8px;overflow-x:auto;-webkit-overflow-scrolling:touch;scrollbar-width:none;">
        <div class="stats-kpi-card" style="flex-shrink:0;min-width:120px;background:rgba(108,99,255,0.1);border:1px solid rgba(108,99,255,0.2);border-radius:16px;padding:12px 14px;">
          <div style="font-size:10px;color:rgba(255,255,255,0.45);text-transform:uppercase;letter-spacing:.8px;margin-bottom:4px;">Moy. 30 jours</div>
          <div id="kpi-avg-price" style="font-size:20px;font-weight:800;color:#8B84FF;">—</div>
          <div style="font-size:10px;color:rgba(255,255,255,0.35);margin-top:1px;">CHF/L</div>
        </div>
        <div class="stats-kpi-card" style="flex-shrink:0;min-width:120px;background:rgba(0,212,170,0.08);border:1px solid rgba(0,212,170,0.2);border-radius:16px;padding:12px 14px;">
          <div style="font-size:10px;color:rgba(255,255,255,0.45);text-transform:uppercase;letter-spacing:.8px;margin-bottom:4px;">Meilleur prix</div>
          <div id="kpi-best-price" style="font-size:20px;font-weight:800;color:#00D4AA;">—</div>
          <div style="font-size:10px;color:rgba(255,255,255,0.35);margin-top:1px;">CHF/L</div>
        </div>
        <div class="stats-kpi-card" style="flex-shrink:0;min-width:120px;background:rgba(34,197,94,0.08);border:1px solid rgba(34,197,94,0.2);border-radius:16px;padding:12px 14px;">
          <div style="font-size:10px;color:rgba(255,255,255,0.45);text-transform:uppercase;letter-spacing:.8px;margin-bottom:4px;">Économies</div>
          <div id="kpi-savings" style="font-size:20px;font-weight:800;color:#22C55E;">CHF 0</div>
          <div style="font-size:10px;color:rgba(255,255,255,0.35);margin-top:1px;">total enregistré</div>
        </div>
        <div class="stats-kpi-card" style="flex-shrink:0;min-width:120px;background:rgba(245,158,11,0.08);border:1px solid rgba(245,158,11,0.2);border-radius:16px;padding:12px 14px;">
          <div style="font-size:10px;color:rgba(255,255,255,0.45);text-transform:uppercase;letter-spacing:.8px;margin-bottom:4px;">Pleins</div>
          <div id="kpi-refuels" style="font-size:20px;font-weight:800;color:#F59E0B;">0</div>
          <div style="font-size:10px;color:rgba(255,255,255,0.35);margin-top:1px;">enregistrés</div>
        </div>
      </div>
      <div style="padding: 0 16px; margin-bottom: 12px; display:flex; gap:8px; flex-wrap:wrap; align-items:center;">
        <select id="stats-fuel-sel" class="ob-input ob-select" style="max-width:160px; margin:0; padding:10px 36px 10px 14px; font-size:14px;">
          <option value="SP95">SP95</option>
          <option value="SP98">SP98</option>
          <option value="Diesel">Diesel</option>
          <option value="Diesel Premium">Diesel Premium</option>
          <option value="GPL">GPL</option>
        </select>
        <button class="btn-sm" id="stats-clear-btn" style="background:rgba(239,68,68,0.1);border-color:rgba(239,68,68,0.2);color:#ef4444;"><i class="ph ph-trash"></i> Effacer</button>
      </div>
      <div id="stats-station-list" style="padding: 0 16px 10px; display:flex; gap:8px; overflow-x:auto; padding-bottom:8px;"></div>
      <div style="flex:1; padding: 0 16px; min-height:0; position:relative;">
        <canvas id="stats-chart" style="width:100%; height:100%;"></canvas>
        <div id="stats-empty" style="display:none; position:absolute; top:50%; left:50%; transform:translate(-50%,-50%); text-align:center; color:var(--text-muted);">
          <i class="ph-bold ph-chart-line-up" style="font-size:48px; display:block; margin-bottom:12px; opacity:0.3;"></i>
          <p style="font-size:14px;">Les prix sont collectés automatiquement<br>chaque jour. Revenez demain !</p>
        </div>
      </div>
      <div style="padding:12px 16px 90px; display:flex; gap:10px; align-items:center; flex-wrap:wrap;" id="stats-legend"></div>
    </div>

    <div class="view view-route" id="view-route">
      <div class="top-brand">
        <span style="font-size:24px;font-weight:800;letter-spacing:-0.5px;margin-left:6px;">OptiTank.</span>
      </div>
      <div class="radar-header" style="text-align:left; padding: 0 16px 10px;">
        <h1><i class="ph-fill ph-map-trifold" style="color:var(--accent-purple)"></i> Trajets Intelligents</h1>
        <p>Indiquez votre trajet et votre autonomie : l'IA planifie <strong>où vous arrêter faire le plein</strong>, au moins cher, sans tomber en panne.</p>
      </div>
      <div style="padding: 0 16px;">
        <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06); border-radius: 16px; padding: 14px; display:flex; flex-direction:column; gap:10px;">
          <div style="display:flex; align-items:center; gap:10px;">
            <i class="ph-fill ph-record" style="color:#60a5fa"></i>
            <input type="text" id="route-start" class="ob-input" style="flex:1; margin:0; padding:10px;" placeholder="Départ (ex: Genève)"/>
          </div>
          <div style="width:2px; height:8px; background:rgba(255,255,255,0.1); margin-left:6px;"></div>
          <div style="display:flex; align-items:center; gap:10px;">
            <i class="ph-fill ph-map-pin" style="color:#ef4444"></i>
            <input type="text" id="route-end" class="ob-input" style="flex:1; margin:0; padding:10px;" placeholder="Arrivée (ex: Lausanne)"/>
          </div>
          <div style="width:2px; height:8px; background:rgba(255,255,255,0.1); margin-left:6px;"></div>
          <div style="display:flex; align-items:center; gap:10px;">
            <i class="ph-fill ph-gas-pump" style="color:var(--accent-green)"></i>
            <input type="number" inputmode="numeric" min="0" id="route-autonomy" class="ob-input" style="flex:1; margin:0; padding:10px;" placeholder="Autonomie restante (km)"/>
          </div>
          <button class="btn-primary" id="btn-plan-route" style="margin-top:4px; background:linear-gradient(135deg,#8b5cf6,#6366f1); box-shadow:0 6px 18px rgba(139,92,246,0.35);"><i class="ph-bold ph-brain"></i> Planifier mes arrêts (IA)</button>
          <button class="btn-secondary" id="btn-calc-route" style="margin-top:2px; background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.1); color:rgba(255,255,255,0.75);"><i class="ph-bold ph-list-magnifying-glass"></i> Juste les stations les moins chères</button>
        </div>
      </div>
      <div id="route-results" class="radar-results" style="padding-top:16px;">
        <div id="route-empty-state" style="text-align:center;padding:32px 24px;">
          <svg viewBox="0 0 200 120" width="180" height="108" style="display:block;margin:0 auto 16px;">
            <!-- sky bg -->
            <rect width="200" height="120" fill="none"/>
            <!-- road -->
            <path d="M0 100 Q100 80 200 100 L200 120 L0 120Z" fill="rgba(108,99,255,0.12)" stroke="rgba(108,99,255,0.25)" stroke-width="1"/>
            <path d="M0 108 Q100 90 200 108" stroke="rgba(255,255,255,0.08)" stroke-width="1" stroke-dasharray="12,8" fill="none"/>
            <!-- start pin -->
            <circle cx="30" cy="72" r="10" fill="#6C63FF" opacity=".9"/>
            <path d="M30 67 C26 67 22 71 22 75 C22 81 30 90 30 90 C30 90 38 81 38 75 C38 71 34 67 30 67Z" fill="#6C63FF"/>
            <circle cx="30" cy="75" r="3.5" fill="white"/>
            <!-- end pin -->
            <circle cx="170" cy="72" r="10" fill="#00D4AA" opacity=".9"/>
            <path d="M170 67 C166 67 162 71 162 75 C162 81 170 90 170 90 C170 90 178 81 178 75 C178 71 174 67 170 67Z" fill="#00D4AA"/>
            <circle cx="170" cy="75" r="3.5" fill="white"/>
            <!-- car -->
            <g transform="translate(85,78)">
              <rect x="-14" y="-8" width="28" height="14" rx="4" fill="#1a1a30" stroke="rgba(108,99,255,0.5)" stroke-width="1.5"/>
              <rect x="-9" y="-14" width="18" height="10" rx="3" fill="#0f0f22" stroke="rgba(108,99,255,0.4)" stroke-width="1"/>
              <circle cx="-9" cy="6" r="3.5" fill="#6C63FF" opacity=".8"/>
              <circle cx="9" cy="6" r="3.5" fill="#6C63FF" opacity=".8"/>
              <rect x="-7" y="-12" width="14" height="7" rx="2" fill="rgba(139,132,255,0.2)" stroke="rgba(139,132,255,0.3)" stroke-width=".5"/>
            </g>
            <!-- dashed route line -->
            <path d="M42 85 Q100 60 158 85" stroke="rgba(0,212,170,0.4)" stroke-width="2" stroke-dasharray="6,5" fill="none"/>
          </svg>
          <div style="font-size:15px;font-weight:700;color:rgba(255,255,255,0.8);margin-bottom:6px;">Entrez votre destination</div>
          <div style="font-size:13px;color:rgba(255,255,255,0.4);line-height:1.5;">L'IA trouve les meilleures stations<br>sur votre route, sans détour.</div>
        </div>
      </div>
    </div>

    <div class="view view-profile" id="view-profile">
      <div class="top-brand">
        <span style="font-size:24px;font-weight:800;letter-spacing:-0.5px;margin-left:6px;">OptiTank.</span>
      </div>
      <div class="profile-header">
        <div class="profile-avatar-container" id="avatar-container">
          <div class="avatar-main" id="avatar-img-wrapper">
            <i class="ph-fill ph-user"></i>
          </div>
          <div class="avatar-edit-badge">
            <i class="ph ph-camera"></i>
          </div>
          <input type="file" id="avatar-input" class="hidden-input" accept="image/*">
        </div>
        <div style="display:flex;align-items:center;gap:8px;justify-content:center;flex-wrap:wrap;">
          <h2 id="prof-name" style="margin:0;">${profName}</h2>
          <button id="btn-edit-profile" style="background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.12);border-radius:8px;padding:4px 10px;cursor:pointer;color:var(--text-muted);font-size:12px;display:flex;align-items:center;gap:4px;"><i class="ph ph-pencil-simple"></i> Modifier</button>
        </div>
        <p class="email" id="prof-email">${profEmail}</p>
      </div>
      <div class="profile-cards">
        <div class="section-title">Mon véhicule</div>
        <div class="vehicle-card" id="vehicle-card">
          <div class="vehicle-card-info">
            <i class="ph-fill ph-car" style="font-size:26px;color:var(--accent-purple)"></i>
            <div>
              <strong id="prof-vehicle">${vehicleSummary()}</strong>
              <span class="text-muted" id="prof-moto" style="font-size:12px;display:block">${userProfile?.vehicleMotorization || ''}</span>
            </div>
          </div>
          <button class="btn-sm" id="btn-change-vehicle">Modifier</button>
        </div>
        <div class="section-title">Préférences</div>
        <div class="list-item" style="padding-right: 12px;">
          <div class="item-left"><i class="ph-fill ph-gas-pump"></i> Carburant préféré</div>
          <select id="prof-fuel-sel" class="ob-input ob-select" style="width: auto; margin: 0; padding: 6px 30px 6px 12px; background: rgba(255,255,255,0.08); border: none; font-size: 14px; text-align: right;">
            <option value="SP95" ${selectedFuel === 'SP95' ? 'selected' : ''}>SP95</option>
            <option value="SP98" ${selectedFuel === 'SP98' ? 'selected' : ''}>SP98</option>
            <option value="Diesel" ${selectedFuel === 'Diesel' ? 'selected' : ''}>Diesel</option>
            <option value="Diesel Premium" ${selectedFuel === 'Diesel Premium' ? 'selected' : ''}>Diesel Premium</option>
            <option value="GPL" ${selectedFuel === 'GPL' ? 'selected' : ''}>GPL</option>
            <option value="GNC" ${selectedFuel === 'GNC' ? 'selected' : ''}>GNC</option>
            <option value="Ethanol 85" ${selectedFuel === 'Ethanol 85' ? 'selected' : ''}>E85</option>
          </select>
        </div>

        <div class="section-title">Badges & Réussites</div>
        <div id="badges-container" style="display:flex; gap:10px; overflow-x:auto; padding-bottom:10px;">
          <!-- Injected by JS -->
        </div>

        <div class="section-title">Dashboard Économies</div>
        <div style="background: linear-gradient(135deg, rgba(15, 23, 42, 0.6) 0%, rgba(15, 23, 42, 0.4) 100%); backdrop-filter: blur(20px); border: 1px solid rgba(139, 92, 246, 0.2); border-radius: 20px; padding: 16px; margin-bottom: 16px;">
          <canvas id="savings-chart" style="width: 100%; height: 200px;"></canvas>
        </div>
        <div class="section-title">Suivi Consommation</div>
        <div class="list-item" id="btn-add-refuel" style="cursor:pointer; background:rgba(74, 222, 128, 0.05); border:1px solid rgba(74, 222, 128, 0.1);">
          <div class="item-left"><i class="ph-fill ph-gas-pump" style="color:var(--accent-green)"></i> <b style="color:var(--accent-green)">Ajouter un plein manuellement</b></div>
          <i class="ph ph-plus-circle" style="color:var(--accent-green)"></i>
        </div>
        <div id="refuels-list" style="margin-top:6px; display:flex; flex-direction:column; gap:6px;"></div>

        <div class="section-title">Vos Favoris</div>
        <div id="profile-favorites-list" style="display:flex; flex-direction:column; gap:6px; margin-top:6px;"></div>

        <div class="section-title">Station du Widget</div>
        <div id="widget-station-picker" style="display:flex; flex-direction:column; gap:6px; margin-top:6px;"></div>

        <div class="section-title">Support & Légal</div>
        <div class="list-item" id="btn-request-notifications" style="cursor:pointer; background:rgba(255, 255, 255, 0.05); border:1px solid rgba(255, 255, 255, 0.1); margin-bottom:8px;">
          <div class="item-left"><i class="ph-fill ph-bell-ringing" style="color:#00D4AA"></i> <b>Activer les notifications push</b></div>
          <i class="ph ph-caret-right" style="color:var(--text-muted)"></i>
        </div>
        <div class="list-item" id="btn-support" style="cursor:pointer; background:rgba(255, 255, 255, 0.05); border:1px solid rgba(255, 255, 255, 0.1);">
          <div class="item-left"><i class="ph-fill ph-question" style="color:var(--text-light)"></i> <b>À propos & Support</b></div>
          <i class="ph ph-caret-right" style="color:var(--text-muted)"></i>
        </div>

        <div id="admin-btn-wrapper" style="display:none;margin-top:20px;padding:0 10px;">
          <button id="btn-open-admin" style="width:100%;padding:13px;background:linear-gradient(135deg,#8b5cf6,#6366f1);border:none;border-radius:13px;color:#fff;font-size:14px;font-weight:700;cursor:pointer;letter-spacing:0.1px;">⚙️ Panneau Administration</button>
        </div>
        <div style="margin-top:30px; padding:0 10px;">
          <button class="btn-danger-corp" id="btn-logout" style="display:none; margin-bottom:16px;">Se déconnecter</button>
          <details id="advanced-settings" style="margin-top:8px;">
            <summary style="font-size:11px;color:rgba(255,255,255,.32);cursor:pointer;letter-spacing:.3px;text-align:center;padding:6px 0;user-select:none;list-style:none;">Paramètres avancés</summary>
            <div style="margin-top:10px;padding:12px;border:1px solid rgba(239,68,68,.15);border-radius:10px;background:rgba(239,68,68,.04);">
              <div style="font-size:11px;color:rgba(255,255,255,.45);line-height:1.5;margin-bottom:8px;">La suppression du compte est <b style="color:#ef4444">irréversible</b>. Toutes vos données (profil, historique, favoris) seront définitivement effacées.</div>
              <button id="btn-delete-account" style="width:100%;padding:9px 10px;background:transparent;border:1px solid rgba(239,68,68,.35);border-radius:8px;color:#ef4444;font-size:11px;font-weight:600;cursor:pointer;letter-spacing:.2px;">Supprimer définitivement mon compte</button>
            </div>
          </details>
        </div>
        <p id="profile-app-version" style="text-align:center;font-size:11px;color:var(--text-muted);opacity:0.5;margin:18px 0 4px;letter-spacing:0.3px;"></p>
        <div style="text-align:center;margin-bottom:12px;">
          <a href="/privacy.html" style="font-size:11px;color:rgba(255,255,255,.2);text-decoration:none;margin:0 8px;">Confidentialité</a>
          <span style="color:rgba(255,255,255,.1);font-size:10px;">·</span>
          <a href="/terms.html" style="font-size:11px;color:rgba(255,255,255,.2);text-decoration:none;margin:0 8px;">CGU</a>
        </div>
      </div>
    </div>`;

  // Inject
  document.body.insertAdjacentHTML('afterbegin', onboardingHTML);
  mainContent.innerHTML = viewsHTML;
  initRadarCanvas();

  function initRadarCanvas() {
    const canvas = document.getElementById('radar-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const SIZE = 220, cx = 110, cy = 110, R = 100;
    let angle = 0;
    function drawRadar() {
      angle += 0.025;
      ctx.clearRect(0, 0, SIZE, SIZE);
      ctx.save();
      ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.clip();
      const bg = ctx.createRadialGradient(cx, cy, 0, cx, cy, R);
      bg.addColorStop(0, '#0D0D22'); bg.addColorStop(1, '#07070F');
      ctx.fillStyle = bg; ctx.fillRect(0, 0, SIZE, SIZE);
      [.25, .5, .75, 1].forEach((f, i) => {
        ctx.beginPath(); ctx.arc(cx, cy, R * f, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(108,99,255,${.08 + i * .04})`; ctx.lineWidth = 1; ctx.stroke();
      });
      ctx.strokeStyle = 'rgba(108,99,255,0.08)'; ctx.lineWidth = 1;
      [[cx, cy - R, cx, cy + R], [cx - R, cy, cx + R, cy]].forEach(([x1, y1, x2, y2]) => {
        ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
      });
      for (let i = 80; i >= 0; i--) {
        const a0 = angle - (i / 80) * Math.PI * .9;
        const a1 = angle - ((i - 1) / 80) * Math.PI * .9;
        ctx.fillStyle = `rgba(108,99,255,${((80 - i) / 80) ** 2 * .35})`;
        ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, R, a0, a1); ctx.closePath(); ctx.fill();
      }
      ctx.save(); ctx.shadowColor = '#8B84FF'; ctx.shadowBlur = 8;
      ctx.strokeStyle = 'rgba(139,132,255,.85)'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + R * Math.cos(angle), cy + R * Math.sin(angle)); ctx.stroke();
      ctx.restore();
      ctx.restore();
      ctx.save(); ctx.shadowColor = '#6C63FF'; ctx.shadowBlur = 6; ctx.fillStyle = '#8B84FF';
      ctx.beginPath(); ctx.arc(cx, cy, 3, 0, Math.PI * 2); ctx.fill(); ctx.restore();
      requestAnimationFrame(drawRadar);
    }
    drawRadar();
  }

  // ── Onboarding & Auth Logic ────────────────────────────
  const obContainer = document.getElementById('onboarding');
  const tempProfile = {};

  function updateObProgress(stepId) {
    const prog = {'ob-step-0':0,'ob-step-login':0,'ob-step-1':15,'ob-step-2':30,'ob-step-2b':45,'ob-step-2c':60,'ob-step-2d':60,'ob-step-3':75,'ob-step-4':85,'ob-step-4b':92,'ob-step-5':100};
    const fill = document.getElementById('ob-progress-fill');
    if (fill) fill.style.width = (prog[stepId] ?? 0) + '%';
  }

  function goToStep(targetId, direction = 'forward') {
    const current = document.querySelector('#onboarding .ob-step.active');
    const target  = document.getElementById(targetId);
    if (!current || !target || current === target) return;
    const outClass = direction === 'forward' ? 'ob-slide-out-left'  : 'ob-slide-out-right';
    const inClass  = direction === 'forward' ? 'ob-slide-in-right'  : 'ob-slide-in-left';
    current.classList.add(outClass);
    current.classList.remove('active');
    target.classList.add(inClass, 'active');
    setTimeout(() => { current.classList.remove(outClass); target.classList.remove(inClass); }, 400);
    updateObProgress(targetId);
  }

  // Back buttons
  document.querySelectorAll('#onboarding .ob-back-btn').forEach(btn => {
    btn.addEventListener('click', () => goToStep(`ob-step-${btn.dataset.back}`, 'backward'));
  });

  // Welcome screen
  document.getElementById('ob-start-btn')?.addEventListener('click', () => goToStep('ob-step-1', 'forward'));
  document.getElementById('ob-go-login')?.addEventListener('click',  () => goToStep('ob-step-login', 'forward'));

  // Floating labels
  document.querySelectorAll('#onboarding .ob-float-input').forEach(input => {
    const field = input.closest('.ob-float-field');
    if (!field) return;
    const upd = () => field.classList.toggle('has-val', input.value.length > 0);
    input.addEventListener('focus', () => field.classList.add('focused'));
    input.addEventListener('blur',  () => { field.classList.remove('focused'); upd(); });
    input.addEventListener('input', upd);
  });

  // Password eye toggles
  document.querySelectorAll('#onboarding .ob-pwd-eye').forEach(btn => {
    btn.addEventListener('click', () => {
      const input = document.getElementById(btn.dataset.target);
      if (!input) return;
      input.type = input.type === 'password' ? 'text' : 'password';
      btn.style.opacity = input.type === 'text' ? '1' : '0.5';
    });
  });

  // Password strength bar
  function updatePwdStrength(pwd) {
    const bar = document.getElementById('pwd-strength-bar');
    if (!bar) return;
    let s = 0;
    if (pwd.length >= 8) s++;
    if (/[A-Z]/.test(pwd)) s++;
    if (/[0-9]/.test(pwd)) s++;
    if (/[^A-Za-z0-9]/.test(pwd)) s++;
    const colors = ['#ef4444','#f97316','#eab308','#22c55e'];
    const labels = ['Faible','Moyen','Bon','Fort'];
    bar.innerHTML = s > 0 ? `<div style="display:flex;gap:6px;align-items:center"><div style="flex:1;height:3px;background:rgba(255,255,255,.1);border-radius:2px;overflow:hidden"><div style="width:${s*25}%;height:100%;background:${colors[s-1]};border-radius:2px;transition:width .3s,background .3s"></div></div><span style="font-size:10px;font-weight:700;color:${colors[s-1]}">${labels[s-1]}</span></div>` : '';
  }
  document.getElementById('reg-pwd')?.addEventListener('input', e => updatePwdStrength(e.target.value));

  // Login
  async function handleLogin() {
    const email = document.getElementById('lf-email')?.value.trim() || '';
    const pwd   = document.getElementById('lf-pwd')?.value || '';
    const errEl = document.getElementById('login-error');
    const btn   = document.getElementById('ob-login-btn');
    if (!email || !pwd) { errEl.textContent = 'Tous les champs sont requis'; errEl.style.display = 'block'; return; }
    btn.disabled = true; errEl.style.display = 'none';
    try {
      const cred = await signInWithEmailAndPassword(auth, email, pwd);
      currentUser = cred.user;
      const exists = await loadFromFirestore(cred.user);
      if (exists && userProfile) {
        obContainer.style.opacity = '0';
        setTimeout(() => { obContainer.style.display = 'none'; isFirstVisit = false; refreshProfile(); switchView('radar'); runRadarScan(); }, 400);
      } else {
        goToStep('ob-step-2', 'forward');
      }
    } catch(err) {
      errEl.textContent = err.code === 'auth/invalid-credential' ? 'Email ou mot de passe incorrect' : err.message;
      errEl.style.display = 'block'; btn.disabled = false;
    }
  }
  document.getElementById('ob-login-btn')?.addEventListener('click', handleLogin);
  document.getElementById('login-go-register')?.addEventListener('click', () => goToStep('ob-step-1', 'forward'));

  document.getElementById('login-forgot-pwd')?.addEventListener('click', () => {
    // Fill the email field if they already typed something
    const lfEmail = document.getElementById('lf-email')?.value.trim();
    if (lfEmail) document.getElementById('fp-email').value = lfEmail;
    
    // Reset forms
    document.getElementById('ob-forgot-form').style.display = 'block';
    document.getElementById('ob-forgot-success').style.display = 'none';
    const errEl = document.getElementById('fp-error');
    if (errEl) errEl.style.display = 'none';
    
    goToStep('ob-step-forgot', 'forward');
  });

  document.getElementById('ob-fp-btn')?.addEventListener('click', async () => {
    const email = document.getElementById('fp-email')?.value.trim();
    const errEl = document.getElementById('fp-error');
    const btn = document.getElementById('ob-fp-btn');
    
    if (!email) {
      errEl.textContent = "Saisis une adresse email valide.";
      errEl.style.display = 'block';
      return;
    }
    
    errEl.style.display = 'none';
    btn.disabled = true;
    btn.textContent = 'Envoi en cours...';

    try {
      await sendPasswordResetEmail(auth, email);
      document.getElementById('ob-forgot-form').style.display = 'none';
      document.getElementById('ob-forgot-success').style.display = 'block';
    } catch(err) {
      console.error(err);
      errEl.textContent = err.code === 'auth/invalid-email' ? "Adresse email invalide." : 
                          err.code === 'auth/user-not-found' ? "Aucun compte trouvé avec cet email." : 
                          err.message;
      errEl.style.display = 'block';
    } finally {
      btn.disabled = false;
      btn.textContent = 'Envoyer le lien';
    }
  });

  document.getElementById('ob-fp-back-btn')?.addEventListener('click', () => {
    goToStep('ob-step-login', 'backward');
  });

  // Suite commune après une connexion sociale réussie (popup, redirect ou native)
  async function finishSocialLogin(user) {
    currentUser = user;
    const exists = await loadFromFirestore(user);
    if (exists && userProfile?.vehicleBrand) {
      const obContainer = document.getElementById('onboarding');
      if (obContainer) {
        obContainer.style.opacity = '0';
        setTimeout(() => { obContainer.style.display = 'none'; isFirstVisit = false; refreshProfile(); switchView('map'); initMap(); initWidgetRefresh(); }, 400);
      } else {
        switchView('map'); initMap(); initWidgetRefresh();
      }
    } else {
      if (user.displayName) tempProfile.name = user.displayName.split(' ')[0];
      goToStep('ob-step-2', 'forward');
    }
  }

  function buildSocialProvider(providerId) {
    if (providerId === 'google') {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      return provider;
    }
    const provider = new OAuthProvider('apple.com');
    provider.addScope('email');
    provider.addScope('name');
    provider.setCustomParameters({ locale: 'fr' });
    return provider;
  }

  // L'app iOS récente obtient le jeton Apple/Google nativement (les popups OAuth ne
  // fonctionnent pas dans la WKWebView et Google y refuse toute connexion).
  const hasNativeAuth = providerId => !!(window.OptiTankBridge && window.OptiTankNativeAuth?.includes(providerId));

  // Résout avec un AuthCredential Firebase, ou null si l'utilisateur annule.
  function nativeSocialCredential(providerId) {
    return new Promise((resolve, reject) => {
      const callbackId = 'auth_' + Date.now();
      window[callbackId] = res => {
        delete window[callbackId];
        if (!res?.ok) return res?.cancelled ? resolve(null) : reject(new Error(res?.error || 'native-auth-failed'));
        const credential = providerId === 'google'
          ? GoogleAuthProvider.credential(res.idToken)
          : new OAuthProvider('apple.com').credential({ idToken: res.idToken, rawNonce: res.rawNonce });
        resolve({ credential, displayName: res.displayName || '' });
      };
      window.OptiTankBridge.post({ type: 'nativeSignIn', provider: providerId, callbackId });
    });
  }

  async function handleSocialAuth(providerId, errorElId) {
    const errEl = document.getElementById(errorElId);
    if (errEl) errEl.style.display = 'none';
    const showError = msg => {
      if (errEl) { errEl.textContent = msg; errEl.style.display = 'block'; }
      else showToast(msg, 'error');
    };
    try {
      let cred;
      if (hasNativeAuth(providerId)) {
        const native = await nativeSocialCredential(providerId);
        if (!native) return;
        cred = await signInWithCredential(auth, native.credential);
        // Apple ne transmet le nom qu'à la toute première connexion
        if (native.displayName && !cred.user.displayName) {
          try { await updateProfile(cred.user, { displayName: native.displayName }); } catch(_) {}
        }
      } else if (window.isOptiTankApp) {
        // Anciennes versions de l'app iOS : pas de pont natif, seul le redirect Apple est possible.
        if (providerId === 'google') {
          showError("Mets à jour OptiTank depuis l'App Store pour te connecter avec Google.");
          return;
        }
        sessionStorage.setItem('_pendingSocialAuth', '1');
        sessionStorage.setItem('_pendingSocialAuthErr', errorElId || '');
        await signInWithRedirect(auth, buildSocialProvider(providerId));
        return;
      } else {
        // Navigateurs (desktop, Safari iOS, Chrome Android, PWA) : popup est plus fiable que
        // redirect — redirect casse en PWA iOS à cause du storage-partitioning Safari.
        cred = await signInWithPopup(auth, buildSocialProvider(providerId));
      }
      await finishSocialLogin(cred.user);
    } catch(err) {
      if (err.code === 'auth/popup-closed-by-user' || err.code === 'auth/cancelled-popup-request') return;
      console.error('Social auth error:', err);
      showError(err.code === 'auth/account-exists-with-different-credential'
        ? 'Un compte existe déjà avec cet email.' : 'Connexion échouée. Réessaie.');
    }
  }

  // Récupère le résultat après un redirect (iOS app + mobile browsers)
  if (sessionStorage.getItem('_pendingSocialAuth') === '1' || sessionStorage.getItem('_pendingDeleteAccount') === '1') {
    const isDelete = sessionStorage.getItem('_pendingDeleteAccount') === '1';
    sessionStorage.removeItem('_pendingSocialAuth');
    sessionStorage.removeItem('_pendingDeleteAccount');
    const pendingErrId = sessionStorage.getItem('_pendingSocialAuthErr') || '';
    sessionStorage.removeItem('_pendingSocialAuthErr');
    
    getRedirectResult(auth).then(async (cred) => {
      if (!cred) return;
      
      if (isDelete) {
        try {
          if (cred.user) {
            try { await deleteDoc(doc(db, 'users', cred.user.uid)); } catch(_) {}
            try { await deleteDoc(doc(db, 'push_tokens', cred.user.uid + '_ios')); } catch(_) {}
            await deleteUser(cred.user);
          }
          localStorage.clear();
          location.reload();
        } catch (e) {
          showToast('Erreur suppression : ' + (e?.message || 'inconnue'), 'error');
        }
        return;
      }

      await finishSocialLogin(cred.user);
    }).catch((err) => {
      console.error('Redirect auth error:', err);
      const msg = err.code === 'auth/account-exists-with-different-credential'
        ? 'Un compte existe déjà avec cet email.' : 'Connexion échouée. Réessaie.';
      const errEl = pendingErrId ? document.getElementById(pendingErrId) : null;
      if (errEl) { errEl.textContent = msg; errEl.style.display = 'block'; }
      else showToast(msg, 'error');
    });
  }


  const cguAccepted = () => {
    const cguCheck = document.getElementById('ob-cgu-check');
    if (!cguCheck || cguCheck.checked) return true;
    const errEl = document.getElementById('reg-error');
    if (errEl) { errEl.textContent = "Tu dois accepter les conditions d'utilisation pour continuer."; errEl.style.display = 'block'; }
    return false;
  };
  document.getElementById('ob-apple-btn')?.addEventListener('click', () => { if (cguAccepted()) handleSocialAuth('apple', 'reg-error'); });
  document.getElementById('ob-google-btn')?.addEventListener('click', () => { if (cguAccepted()) handleSocialAuth('google', 'reg-error'); });
  document.getElementById('login-apple-btn')?.addEventListener('click', () => handleSocialAuth('apple', 'login-error'));
  document.getElementById('login-google-btn')?.addEventListener('click', () => handleSocialAuth('google', 'login-error'));

  // Register
  async function handleRegister() {
    const name  = document.getElementById('reg-name')?.value.trim() || '';
    const email = document.getElementById('reg-email')?.value.trim() || '';
    const pwd   = document.getElementById('reg-pwd')?.value || '';
    const errEl = document.getElementById('reg-error');
    const btn   = document.getElementById('ob-register-btn');
    if (!email || !pwd) { errEl.textContent = 'Email et mot de passe requis'; errEl.style.display = 'block'; return; }
    if (pwd.length < 6)  { errEl.textContent = 'Mot de passe trop court (6 car. min.)'; errEl.style.display = 'block'; return; }
    btn.disabled = true; errEl.style.display = 'none';
    tempProfile.name = name || 'Utilisateur';
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, pwd);
      currentUser = cred.user;
      if (name) {
        await updateProfile(currentUser, { displayName: name }).catch(() => {});
      }
      goToStep('ob-step-2', 'forward');
    } catch(err) {
      const msg = err.code === 'auth/email-already-in-use' ? 'Cet email est déjà utilisé.' : err.message;
      errEl.textContent = msg; errEl.style.display = 'block';
      const cgu = document.getElementById('ob-cgu-check');
      btn.disabled = !(cgu && cgu.checked);
      btn.style.opacity = (cgu && cgu.checked) ? '1' : '0.4';
    }
  }
  document.getElementById('ob-register-btn')?.addEventListener('click', handleRegister);

  // CGU checkbox — active le bouton seulement si accepté
  const cguCheck = document.getElementById('ob-cgu-check');
  const regBtn   = document.getElementById('ob-register-btn');
  if (cguCheck && regBtn) {
    cguCheck.addEventListener('change', () => {
      regBtn.disabled = !cguCheck.checked;
      regBtn.style.opacity = cguCheck.checked ? '1' : '0.4';
    });
  }

  // ── Vehicle picker: Brand → Model → Year (static curated DB) ──────

  let obVehicleType = 'car'; // 'car' | 'motorcycle'
  let obSelectedBrand = null; // current brand object {id, name, color, abbr}
  let obSelectedModel = null; // current model object {id, name, year, fuel, tank, hp}
  let obFuelBack = '2c';      // dynamic back target for fuel step
  let obCustomBack = '2';     // dynamic back target for custom form step

  const FUEL_COLORS = { SP95:'#22C55E', SP98:'#8B84FF', Diesel:'#F59E0B', Electrique:'#00D4AA' };

  const CAR_ICON_SVG = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M5 17H3v-5l3.5-6h9L19 12v5h-2"/><circle cx="7.5" cy="17.5" r="2.5"/><circle cx="16.5" cy="17.5" r="2.5"/></svg>`;
  const MOTO_ICON_SVG = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="5.5" cy="17.5" r="3.5"/><circle cx="18.5" cy="17.5" r="3.5"/><path d="M15 6h-4l-1.5 4H4l1 4h2.5M14 6l3 5h2.5"/><path d="M10.5 10H14l1 2"/></svg>`;

  function obMiniCarSVG(color) {
    return `<svg width="90" height="40" viewBox="0 0 240 100" fill="none">
      <path d="M28 56 L44 34 Q58 20 84 20 Q132 20 156 20 Q176 20 192 35 L207 56 L218 60 Q220 68 217 73 L205 74 L200 74 Q198 82 187 82 Q176 82 174 74 L78 74 Q76 82 65 82 Q54 82 52 74 L18 74 Q14 67 18 61 Z" fill="${color}" fill-opacity=".65"/>
      <circle cx="64" cy="74" r="12" fill="${color}" fill-opacity=".8"/>
      <circle cx="64" cy="74" r="5" fill="rgba(255,255,255,.3)"/>
      <circle cx="178" cy="74" r="12" fill="${color}" fill-opacity=".8"/>
      <circle cx="178" cy="74" r="5" fill="rgba(255,255,255,.3)"/>
    </svg>`;
  }
  function obMiniMotoSVG(color) {
    return `<svg width="80" height="44" viewBox="0 0 220 120" fill="none">
      <circle cx="50" cy="85" r="26" fill="none" stroke="${color}" stroke-width="3" stroke-opacity=".8"/>
      <circle cx="50" cy="85" r="14" fill="${color}" fill-opacity=".4"/>
      <circle cx="170" cy="85" r="22" fill="none" stroke="${color}" stroke-width="3" stroke-opacity=".8"/>
      <circle cx="170" cy="85" r="11" fill="${color}" fill-opacity=".4"/>
      <path d="M50 58 L62 45 L95 38 L130 36 L155 42 L170 60 L160 62 L140 50 L110 48 L85 52 L72 62 Z" fill="${color}" fill-opacity=".7"/>
    </svg>`;
  }

  function obRenderBrandGrid() {
    const gridEl = document.getElementById('ob-brands-grid');
    if (!gridEl) return;
    const brands = getBrands(obVehicleType);
    const continueBtn = document.getElementById('ob-brand-continue');
    gridEl.innerHTML = brands.map((b, i) => `
      <button class="ob-brand-card" data-brand-id="${b.id}" style="--bc:${b.color};animation:springIn .4s cubic-bezier(0.34,1.56,0.64,1) ${i * 0.03}s both">
        <div class="ob-brand-check"><svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3.5"><path d="M20 6L9 17l-5-5"/></svg></div>
        ${b.logo
          ? `<div class="ob-brand-icon has-logo" data-abbr="${b.abbr}"><img src="${b.logo}" width="26" height="26" loading="lazy" onerror="this.parentElement.classList.remove('has-logo');this.parentElement.textContent=this.parentElement.dataset.abbr;"></div>`
          : `<div class="ob-brand-icon">${b.abbr}</div>`}
        <div class="ob-brand-name">${b.name}</div>
      </button>`).join('');
    gridEl.querySelectorAll('.ob-brand-card').forEach(card => {
      card.addEventListener('click', () => {
        const brand = getBrands(obVehicleType).find(b => b.id === card.dataset.brandId);
        if (!brand) return;
        obSelectedBrand = brand;
        tempProfile.vehicleBrand = brand.name;
        tempProfile.vehicleCategory = obVehicleType;
        gridEl.querySelectorAll('.ob-brand-card').forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
        if (continueBtn) { continueBtn.disabled = false; continueBtn.textContent = `Continuer avec ${brand.name} →`; }
      });
    });
  }

  document.getElementById('ob-brand-continue')?.addEventListener('click', () => {
    if (!obSelectedBrand) return;
    // Populate ob-step-2b header
    const iconEl  = document.getElementById('ob-2b-brand-icon');
    const nameEl  = document.getElementById('ob-2b-brand-name');
    const countEl = document.getElementById('ob-2b-model-count');
    const svgEl   = document.getElementById('ob-2b-vehicle-svg');
    const models  = getModels(obSelectedBrand.id, obVehicleType);
    if (iconEl) {
      iconEl.style.cssText = `width:42px;height:42px;border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:900;flex-shrink:0;background:${obSelectedBrand.color};box-shadow:0 3px 12px ${obSelectedBrand.color}55`;
      if (obSelectedBrand.logo) {
        iconEl.innerHTML = `<img src="${obSelectedBrand.logo}" width="24" height="24" style="object-fit:contain;filter:brightness(0) invert(1)" onerror="this.parentElement.innerHTML='${obSelectedBrand.abbr}';this.parentElement.style.color='white'">`;
      } else {
        iconEl.textContent = obSelectedBrand.abbr;
        iconEl.style.color = 'white';
      }
    }
    if (nameEl)  nameEl.textContent = obSelectedBrand.name;
    if (countEl) countEl.textContent = `${models.length} modèles disponibles`;
    if (svgEl)   svgEl.innerHTML = obVehicleType === 'motorcycle' ? obMiniMotoSVG(obSelectedBrand.color) : obMiniCarSVG(obSelectedBrand.color);
    const header = document.getElementById('ob-2b-brand-header');
    if (header) { header.style.background = `${obSelectedBrand.color}12`; header.style.border = `1px solid ${obSelectedBrand.color}35`; }
    // Reset model selection state
    obSelectedModel = null;
    const modelContinue = document.getElementById('ob-model-continue');
    if (modelContinue) { modelContinue.disabled = true; modelContinue.textContent = 'Choisir un modèle'; }
    obRenderModelList(obSelectedBrand.id);
    goToStep('ob-step-2b', 'forward');
  });

  function obRenderModelList(brandId) {
    const listEl = document.getElementById('ob-models-list');
    if (!listEl) return;
    const models = getModels(brandId, obVehicleType);
    const bc = obSelectedBrand?.color || '#6C63FF';
    if (!models.length) {
      listEl.innerHTML = '<div style="text-align:center;padding:32px;color:rgba(255,255,255,.3);font-size:13px">Aucun modèle disponible</div>';
      return;
    }
    const iconSVG = obVehicleType === 'motorcycle' ? MOTO_ICON_SVG : CAR_ICON_SVG;
    listEl.innerHTML = models.map((m, i) => {
      const fc = FUEL_COLORS[m.fuel] || '#8B84FF';
      const tankStr = m.tank > 0 ? `${m.tank}L` : '—';
      return `<button class="ob-model-row" data-model-id="${m.id}" style="--bc:${bc};animation:fadeUp .35s ease ${i * 0.05}s both">
        <div class="ob-model-icon-wrap">${iconSVG}</div>
        <div style="flex:1;min-width:0">
          <div class="ob-model-name-text">${m.name}</div>
          <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin-top:3px">
            <span class="ob-model-fuel-badge" style="--fc:${fc}">${m.fuel}</span>
            <span class="ob-model-meta-text">${m.year}</span>
            <span class="ob-model-meta-text">Réservoir ${tankStr}</span>
          </div>
        </div>
        <div class="ob-model-hp-block">
          <div class="ob-model-hp-num">${m.hp}</div>
          <div class="ob-model-hp-unit">ch</div>
        </div>
        <div class="ob-model-sel-check"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3"><path d="M20 6L9 17l-5-5"/></svg></div>
      </button>`;
    }).join('');
    const continueBtn = document.getElementById('ob-model-continue');
    listEl.querySelectorAll('.ob-model-row').forEach(btn => {
      btn.addEventListener('click', () => {
        const model = getModels(brandId, obVehicleType).find(m => m.id === btn.dataset.modelId);
        if (!model) return;
        obSelectedModel = model;
        listEl.querySelectorAll('.ob-model-row').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        if (continueBtn) { continueBtn.disabled = false; continueBtn.textContent = `Confirmer — ${model.name} →`; }
      });
    });
  }

  document.getElementById('ob-model-continue')?.addEventListener('click', () => {
    if (!obSelectedModel) return;
    const m = obSelectedModel;
    tempProfile.vehicleModel = m.name;
    tempProfile.vehicleTank  = m.tank;
    tempProfile.vehicleYear  = parseInt(m.year);
    tempProfile.vehicleMotorization = m.tank > 0 ? `${m.name} (${m.tank}L)` : m.name;
    obPreSelectFuel(m.fuel);
    obFuelBack = '2b';
    goToStep('ob-step-3', 'forward');
  });

  function obPreSelectFuel(fuel) {
    document.querySelectorAll('.ob-fuel-card').forEach(c => c.classList.remove('selected'));
    const match = document.querySelector(`.ob-fuel-card[data-fuel="${fuel}"]`);
    if (match) {
      match.classList.add('selected');
      obSelectedFuel = fuel;
      tempProfile.fuelType = fuel;
      const nextBtn = document.getElementById('ob-fuel-next');
      if (nextBtn) nextBtn.disabled = false;
    }
  }

  function obRenderYears() {
    const gridEl = document.getElementById('ob-years-grid');
    if (!gridEl) return;
    const years = getYearRange(1990);
    gridEl.innerHTML = years.map(y => `<button class="ob-year-btn" data-year="${y}">${y}</button>`).join('');
    const reveal = document.getElementById('ob-tank-reveal');
    const nextBtn = document.getElementById('ob-year-next');
    if (reveal) reveal.style.display = 'none';
    if (nextBtn) nextBtn.disabled = true;
    // Pre-select year from model if available
    if (obSelectedModel?.year) {
      const preYear = parseInt(obSelectedModel.year);
      const preBtn = gridEl.querySelector(`[data-year="${preYear}"]`);
      if (preBtn) { preBtn.classList.add('active'); tempProfile.vehicleYear = preYear; if (nextBtn) nextBtn.disabled = false; }
    }
    // Show tank if already known
    if (obSelectedModel?.tank > 0 && reveal) {
      const tankVal = document.getElementById('ob-tank-value');
      if (tankVal) tankVal.textContent = `${obSelectedModel.tank} L`;
      reveal.style.display = 'block';
    }
    gridEl.querySelectorAll('.ob-year-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        gridEl.querySelectorAll('.ob-year-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        tempProfile.vehicleYear = parseInt(btn.dataset.year);
        const tank = obSelectedModel?.tank ?? 0;
        const tankVal = document.getElementById('ob-tank-value');
        if (reveal && tankVal) { tankVal.textContent = tank > 0 ? `${tank} L` : '—'; reveal.style.display = 'block'; }
        if (nextBtn) nextBtn.disabled = false;
      });
    });
  }

  // Vehicle type toggle
  document.querySelectorAll('.ob-vehtype-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      if (btn.dataset.vtype === obVehicleType) return;
      document.querySelectorAll('.ob-vehtype-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      obVehicleType = btn.dataset.vtype;
      tempProfile.vehicleCategory = obVehicleType;
      obSelectedBrand = null;
      obRenderBrandGrid();
    });
  });

  // Initial brand grid render
  obRenderBrandGrid();

  // Brand skip → custom form
  document.getElementById('ob-brand-skip')?.addEventListener('click', () => {
    obCustomBack = '2';
    obFuelBack = '2d';
    goToStep('ob-step-2d', 'forward');
  });

  // Model not found → custom form
  document.getElementById('ob-model-autre')?.addEventListener('click', () => {
    obCustomBack = '2b';
    obFuelBack = '2d';
    // Pre-fill brand name in custom form
    const brandInput = document.getElementById('custom-brand');
    if (brandInput && obSelectedBrand) brandInput.value = obSelectedBrand.name;
    goToStep('ob-step-2d', 'forward');
  });

  // Dynamic back for custom form step
  document.getElementById('ob-2d-back')?.addEventListener('click', () => goToStep(`ob-step-${obCustomBack}`, 'backward'));

  // Dynamic back for fuel step
  document.getElementById('ob-step3-back')?.addEventListener('click', () => goToStep(`ob-step-${obFuelBack}`, 'backward'));

  // Custom fuel buttons in step 2d
  let obCustomFuel = null;
  document.querySelectorAll('.ob-custom-fuel-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.ob-custom-fuel-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      obCustomFuel = btn.dataset.fuel;
    });
  });

  // Custom vehicle "Continuer"
  document.getElementById('ob-custom-next')?.addEventListener('click', () => {
    const brand = document.getElementById('custom-brand')?.value.trim();
    const model = document.getElementById('custom-model')?.value.trim();
    const year  = parseInt(document.getElementById('custom-year')?.value);
    const tank  = parseFloat(document.getElementById('custom-tank')?.value) || 0;
    const errEl = document.getElementById('custom-error');
    if (!brand || !model) { errEl.textContent = 'Merci de renseigner la marque et le modèle.'; errEl.style.display = 'block'; return; }
    errEl.style.display = 'none';
    tempProfile.vehicleBrand = brand;
    tempProfile.vehicleModel = model;
    tempProfile.vehicleYear  = year || new Date().getFullYear();
    tempProfile.vehicleTank  = tank;
    tempProfile.vehicleMotorization = tank > 0 ? `${model} (${tank}L)` : model;
    tempProfile.vehicleCategory = obVehicleType;
    if (obCustomFuel) { obPreSelectFuel(obCustomFuel); }
    goToStep('ob-step-3', 'forward');
  });

  document.getElementById('ob-year-next')?.addEventListener('click', () => goToStep('ob-step-3', 'forward'));

  // Fuel cards
  let obSelectedFuel = null;
  document.querySelectorAll('.ob-fuel-card').forEach(card => {
    card.addEventListener('click', () => {
      document.querySelectorAll('.ob-fuel-card').forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');
      obSelectedFuel = card.dataset.fuel;
      tempProfile.fuelType = obSelectedFuel;
      const nextBtn = document.getElementById('ob-fuel-next');
      if (nextBtn) nextBtn.disabled = false;
    });
  });
  document.getElementById('ob-fuel-next')?.addEventListener('click', () => { if (obSelectedFuel) goToStep('ob-step-4', 'forward'); });

  // Location permission
  document.getElementById('ob-loc-allow')?.addEventListener('click', () => {
    localStorage.setItem('fillz_location_granted', '1');
    window.getAppLocation(
      pos => { userLat = pos.coords.latitude; userLng = pos.coords.longitude; hasGeoloc = true; goToStep('ob-step-4b', 'forward'); },
      () => { goToStep('ob-step-4b', 'forward'); }
    );
  });
  // Push notification permission
  document.getElementById('ob-push-allow')?.addEventListener('click', () => {
    localStorage.setItem('fillz_push_granted', '1');
    if (window.isOptiTankApp && window.OptiTankBridge) {
      window.OptiTankBridge.post({ type: 'requestNotifications' });
    }
    goToStep('ob-step-5', 'forward'); startSuccessAnim();
  });
  document.getElementById('ob-push-skip')?.addEventListener('click', () => {
    localStorage.setItem('fillz_push_granted', '0');
    goToStep('ob-step-5', 'forward'); startSuccessAnim();
  });

  // Success animation (confetti + counter + badge)
  function startSuccessAnim() {
    const cc = document.getElementById('ob-confetti-container');
    if (cc) {
      cc.innerHTML = '';
      const palette = ['#6C63FF','#00D4AA','#F59E0B','#EF4444','#22C55E','#A78BFA'];
      for (let i = 0; i < 60; i++) {
        const el = document.createElement('div');
        const sz = 4 + Math.random() * 7;
        el.style.cssText = `position:absolute;width:${sz}px;height:${sz}px;background:${palette[Math.floor(Math.random()*palette.length)]};border-radius:${Math.random()>.5?'50%':'2px'};left:50%;top:50%;--cx:${(Math.random()-.5)*360}px;--cy:${-Math.random()*400-50}px;--cr:${Math.random()*720-360}deg;animation:ob-confetti ${.8+Math.random()*1.2}s ease-out ${Math.random()*.5}s forwards`;
        cc.appendChild(el);
      }
    }
    const counterEl = document.getElementById('ob-savings-counter');
    if (counterEl) {
      const target = 47.30, dur = 1800, t0 = performance.now();
      const tick = now => {
        const p = Math.min((now - t0) / dur, 1);
        counterEl.textContent = 'CHF ' + (target * (1 - Math.pow(1-p, 3))).toFixed(2);
        if (p < 1) requestAnimationFrame(tick);
      };
      setTimeout(() => requestAnimationFrame(tick), 300);
    }
    const badge = document.getElementById('ob-badge-card');
    if (badge) {
      setTimeout(() => {
        badge.style.transition = 'opacity .4s ease, transform .5s cubic-bezier(0.34,1.56,0.64,1)';
        badge.style.opacity = '1';
        badge.style.transform = 'scale(1) rotate(0deg)';
      }, 600);
    }
  }

  // Finish — save profile and enter app
  document.getElementById('ob-finish')?.addEventListener('click', () => {
    userProfile = {
      name: tempProfile.name || 'Utilisateur',
      email: currentUser?.email || '',
      fuelType: tempProfile.fuelType || selectedFuel || 'SP95',
      vehicleBrand: tempProfile.vehicleBrand || '',
      vehicleModel: tempProfile.vehicleModel || '',
      vehicleYear: tempProfile.vehicleYear || new Date().getFullYear(),
      vehicleMotorization: tempProfile.vehicleMotorization || 'Standard',
      vehicleTank: tempProfile.vehicleTank || 0,
    };
    selectedFuel = userProfile.fuelType;
    localStorage.setItem('fillz_profile', JSON.stringify(userProfile));
    syncToFirestore();
    obContainer.style.opacity = '0';
    setTimeout(() => { obContainer.style.display = 'none'; refreshProfile(); switchView('radar'); runRadarScan(); }, 400);
  });

  // ── Vehicle modal ──────────────────────────────────────
  const modalHTML = `<div class="modal-overlay" id="vehicle-modal" style="display:none">
    <div class="modal-card" style="padding:0;overflow:hidden;height:min(620px,88vh);display:flex;flex-direction:column">

      <!-- Sub-step: Brand picker -->
      <div id="md-step-brand" style="display:flex;flex-direction:column;flex:1;overflow:hidden">
        <div style="padding:16px 18px 10px;flex-shrink:0;display:flex;align-items:center;gap:10px;border-bottom:1px solid rgba(255,255,255,.06)">
          <button id="md-close" style="background:none;border:none;color:rgba(255,255,255,.45);cursor:pointer;padding:2px;line-height:1"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
          <span style="font-size:15px;font-weight:800;color:white">Changer de véhicule</span>
        </div>
        <div style="padding:12px 14px 8px;flex-shrink:0">
          <div class="ob-vehtype-row" style="margin-bottom:10px">
            <button class="ob-vehtype-btn md-vtype-btn active" data-vtype="car">🚗 Voiture</button>
            <button class="ob-vehtype-btn md-vtype-btn" data-vtype="motorcycle">🏍️ Moto</button>
          </div>
          <div style="font-size:13px;color:rgba(255,255,255,.35)">Tap pour sélectionner ta marque</div>
        </div>
        <div style="flex:1;overflow-y:auto;padding:0 12px 8px">
          <div id="md-brands-grid" class="ob-brand-grid"></div>
        </div>
        <div style="padding:10px 14px 18px;flex-shrink:0;display:flex;flex-direction:column;gap:8px">
          <button class="ob-btn-primary" id="md-brand-continue" disabled>Choisir une marque</button>
          <button class="ob-btn-ghost" id="md-brand-skip" style="font-size:12px;padding:8px">Ma marque n'est pas dans la liste</button>
        </div>
      </div>

      <!-- Sub-step: Model picker -->
      <div id="md-step-model" style="display:none;flex-direction:column;flex:1;overflow:hidden">
        <div style="padding:16px 18px 10px;flex-shrink:0;display:flex;align-items:center;gap:10px;border-bottom:1px solid rgba(255,255,255,.06)">
          <button id="md-back-to-brand" style="background:none;border:none;color:rgba(255,255,255,.55);cursor:pointer;padding:2px;line-height:1"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="15 18 9 12 15 6"/></svg></button>
          <span style="font-size:15px;font-weight:800;color:white">Quel modèle ?</span>
        </div>
        <div style="padding:10px 14px 8px;flex-shrink:0">
          <div id="md-brand-header" style="display:flex;align-items:center;gap:10px;border-radius:14px;padding:10px 12px;margin-bottom:8px">
            <div id="md-brand-icon" style="width:38px;height:38px;border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:900;color:white;flex-shrink:0"></div>
            <div>
              <div id="md-brand-name" style="font-size:15px;font-weight:800;color:white"></div>
              <div id="md-model-count" style="font-size:11px;color:rgba(255,255,255,.38)"></div>
            </div>
            <div id="md-brand-svg" style="margin-left:auto;opacity:.6;flex-shrink:0"></div>
          </div>
        </div>
        <div style="flex:1;overflow-y:auto;padding:0 12px">
          <div id="md-models-list"></div>
          <div style="height:6px"></div>
        </div>
        <div style="padding:10px 14px 18px;flex-shrink:0;display:flex;flex-direction:column;gap:8px">
          <button class="ob-btn-primary" id="md-model-save" disabled>Enregistrer</button>
          <button class="ob-btn-ghost" id="md-model-autre" style="font-size:12px;padding:8px">Mon modèle n'est pas dans la liste</button>
        </div>
      </div>

      <!-- Sub-step: Custom vehicle -->
      <div id="md-step-custom" style="display:none;flex-direction:column;flex:1;overflow:hidden">
        <div style="padding:16px 18px 10px;flex-shrink:0;display:flex;align-items:center;gap:10px;border-bottom:1px solid rgba(255,255,255,.06)">
          <button id="md-back-to-model" style="background:none;border:none;color:rgba(255,255,255,.55);cursor:pointer;padding:2px;line-height:1"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="15 18 9 12 15 6"/></svg></button>
          <span style="font-size:15px;font-weight:800;color:white">Véhicule personnalisé</span>
        </div>
        <div style="flex:1;overflow-y:auto;padding:14px 16px">
          <div class="ob-float-field" style="margin-bottom:14px"><input type="text" id="md-custom-brand" class="ob-float-input" placeholder=" " autocomplete="off"/><label for="md-custom-brand">Marque</label><div class="ob-field-line"></div></div>
          <div class="ob-float-field" style="margin-bottom:14px"><input type="text" id="md-custom-model" class="ob-float-input" placeholder=" " autocomplete="off"/><label for="md-custom-model">Modèle</label><div class="ob-field-line"></div></div>
          <div class="ob-float-field" style="margin-bottom:14px"><input type="number" id="md-custom-year" class="ob-float-input" placeholder=" " min="1980" max="2026"/><label for="md-custom-year">Année</label><div class="ob-field-line"></div></div>
          <div style="margin-bottom:14px">
            <div style="font-size:11px;color:rgba(255,255,255,.38);font-weight:700;text-transform:uppercase;letter-spacing:.8px;margin-bottom:9px">Carburant</div>
            <div class="ob-custom-fuel-row">
              <button type="button" class="ob-custom-fuel-btn md-fuel-btn" data-fuel="SP95" style="--fc:#22C55E">SP 95</button>
              <button type="button" class="ob-custom-fuel-btn md-fuel-btn" data-fuel="SP98" style="--fc:#8B84FF">SP 98</button>
              <button type="button" class="ob-custom-fuel-btn md-fuel-btn" data-fuel="Diesel" style="--fc:#F59E0B">Diesel</button>
              <button type="button" class="ob-custom-fuel-btn md-fuel-btn" data-fuel="Electrique" style="--fc:#00D4AA">Élec.</button>
            </div>
          </div>
          <div class="ob-float-field" style="margin-bottom:4px"><input type="number" id="md-custom-tank" class="ob-float-input" placeholder=" " min="5" max="200" step="0.5"/><label for="md-custom-tank">Réservoir (litres)</label><div class="ob-field-line"></div></div>
        </div>
        <div style="padding:8px 14px 18px;flex-shrink:0">
          <div id="md-custom-error" class="ob-error" style="display:none;margin-bottom:8px"></div>
          <button class="ob-btn-primary" id="md-custom-save">Enregistrer →</button>
        </div>
      </div>

    </div>
  </div>`;
  document.body.insertAdjacentHTML('beforeend', modalHTML);

  // ── Refuel Modal ──────────────────────────────────────
  const refuelModalHTML = `<div class="modal-overlay" id="refuel-modal" style="display:none">
    <div class="modal-card" style="position:relative;">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px;">
        <h3 style="margin:0;"><i class="ph-fill ph-gas-pump" style="color:var(--accent-green)"></i> Enregistrer un plein</h3>
        <label for="rf-ocr-input" class="btn-sm" style="cursor:pointer; display:flex; align-items:center; gap:4px; padding:6px 10px; background:rgba(255,255,255,0.1); border-radius:12px;">
          <i class="ph-bold ph-scan"></i> Scanner
        </label>
        <input type="file" id="rf-ocr-input" accept="image/*" capture="environment" style="display:none;">
      </div>
      <div id="ocr-loader" style="display:none; text-align:center; padding:10px; font-size:12px; color:var(--accent-green); background:rgba(74,222,128,0.1); border-radius:8px; margin-bottom:12px;">
        <div class="spinner-small" style="border-color:var(--accent-green) transparent transparent transparent; vertical-align:middle; margin-right:8px;"></div>
        Analyse du ticket en cours...
      </div>
      <p class="text-muted" style="margin-bottom:14px;font-size:12px;">Calculez votre consommation réelle.</p>
      <input type="number" id="rf-liters" class="ob-input" step="0.1" placeholder="Litres (ex: 45.2)"/>
      <input type="number" id="rf-price" class="ob-input" step="0.01" placeholder="Prix Total CHF (ex: 80.50)"/>
      <input type="number" id="rf-km" class="ob-input" placeholder="Kilométrage actuel (ex: 125000)"/>
      <div style="display:flex;gap:10px;margin-top:16px">
        <button class="btn-primary" id="rf-save">Enregistrer</button>
        <button class="btn-link" id="rf-cancel">Annuler</button>
      </div>
    </div>
  </div>`;
  document.body.insertAdjacentHTML('beforeend', refuelModalHTML);

  // ── Vehicle modal: multi-step brand/model picker ───────────
  let mdVehicleType = 'car';
  let mdSelectedBrand = null;
  let mdSelectedModel = null;
  let mdCustomFuel = null;

  function mdShowSubStep(id) {
    ['md-step-brand','md-step-model','md-step-custom'].forEach(s => {
      const el = document.getElementById(s);
      if (el) el.style.display = s === id ? 'flex' : 'none';
    });
  }

  function mdRenderBrandGrid() {
    const gridEl = document.getElementById('md-brands-grid');
    if (!gridEl) return;
    const brands = getBrands(mdVehicleType);
    const continueBtn = document.getElementById('md-brand-continue');
    gridEl.innerHTML = brands.map((b, i) => `
      <button class="ob-brand-card" data-brand-id="${b.id}" style="--bc:${b.color};animation:springIn .4s cubic-bezier(0.34,1.56,0.64,1) ${i * 0.025}s both">
        <div class="ob-brand-check"><svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3.5"><path d="M20 6L9 17l-5-5"/></svg></div>
        ${b.logo
          ? `<div class="ob-brand-icon has-logo" data-abbr="${b.abbr}"><img src="${b.logo}" width="26" height="26" loading="lazy" onerror="this.parentElement.classList.remove('has-logo');this.parentElement.textContent=this.parentElement.dataset.abbr;"></div>`
          : `<div class="ob-brand-icon">${b.abbr}</div>`}
        <div class="ob-brand-name">${b.name}</div>
      </button>`).join('');
    gridEl.querySelectorAll('.ob-brand-card').forEach(card => {
      card.addEventListener('click', () => {
        const brand = brands.find(b => b.id === card.dataset.brandId);
        if (!brand) return;
        mdSelectedBrand = brand;
        gridEl.querySelectorAll('.ob-brand-card').forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
        if (continueBtn) { continueBtn.disabled = false; continueBtn.textContent = `Continuer avec ${brand.name} →`; }
      });
    });
  }

  function mdRenderModelList() {
    const listEl = document.getElementById('md-models-list');
    if (!listEl || !mdSelectedBrand) return;
    const models = getModels(mdSelectedBrand.id, mdVehicleType);
    const bc = mdSelectedBrand.color || '#6C63FF';
    const iconSVG = mdVehicleType === 'motorcycle' ? MOTO_ICON_SVG : CAR_ICON_SVG;
    // Populate brand header
    const iconEl = document.getElementById('md-brand-icon');
    const nameEl = document.getElementById('md-brand-name');
    const countEl = document.getElementById('md-model-count');
    const svgEl   = document.getElementById('md-brand-svg');
    const hdrEl   = document.getElementById('md-brand-header');
    if (iconEl) {
      iconEl.style.cssText = `width:38px;height:38px;border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:900;flex-shrink:0;background:${bc};box-shadow:0 3px 10px ${bc}55`;
      if (mdSelectedBrand.logo) {
        iconEl.innerHTML = `<img src="${mdSelectedBrand.logo}" width="22" height="22" style="object-fit:contain;filter:brightness(0) invert(1)" onerror="this.parentElement.innerHTML='${mdSelectedBrand.abbr}';this.parentElement.style.color='white'">`;
      } else {
        iconEl.textContent = mdSelectedBrand.abbr;
        iconEl.style.color = 'white';
      }
    }
    if (nameEl)  nameEl.textContent = mdSelectedBrand.name;
    if (countEl) countEl.textContent = `${models.length} modèles`;
    if (svgEl)   svgEl.innerHTML = mdVehicleType === 'motorcycle' ? obMiniMotoSVG(bc) : obMiniCarSVG(bc);
    if (hdrEl)   { hdrEl.style.background = `${bc}12`; hdrEl.style.border = `1px solid ${bc}35`; }
    // Reset save button
    const saveBtn = document.getElementById('md-model-save');
    if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = 'Choisir un modèle'; }
    mdSelectedModel = null;
    if (!models.length) {
      listEl.innerHTML = '<div style="text-align:center;padding:28px;color:rgba(255,255,255,.3);font-size:13px">Aucun modèle disponible</div>';
      return;
    }
    listEl.innerHTML = models.map((m, i) => {
      const fc = FUEL_COLORS[m.fuel] || '#8B84FF';
      return `<button class="ob-model-row" data-model-id="${m.id}" style="--bc:${bc};animation:springIn .35s cubic-bezier(0.34,1.56,0.64,1) ${i * 0.025}s both">
        <div class="ob-model-icon-wrap" style="color:${bc}">${iconSVG}</div>
        <div style="flex:1;min-width:0">
          <div class="ob-model-name-text">${m.name}</div>
          <div style="display:flex;align-items:center;gap:6px;margin-top:3px">
            <span class="ob-model-fuel-badge" style="--fc:${fc}">${m.fuel}</span>
            <span class="ob-model-meta-text">${m.year} · ${m.tank > 0 ? m.tank + 'L' : '⚡'}</span>
          </div>
        </div>
        <div class="ob-model-hp-block"><span class="ob-model-hp-num">${m.hp}</span><span class="ob-model-hp-label">ch</span></div>
        <div class="ob-model-sel-check" style="--bc:${bc}"><svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3.5"><path d="M20 6L9 17l-5-5"/></svg></div>
      </button>`;
    }).join('');
    listEl.querySelectorAll('.ob-model-row').forEach(btn => {
      btn.addEventListener('click', () => {
        const model = models.find(m => m.id === btn.dataset.modelId);
        if (!model) return;
        mdSelectedModel = model;
        listEl.querySelectorAll('.ob-model-row').forEach(r => r.classList.remove('selected'));
        btn.classList.add('selected');
        const s = document.getElementById('md-model-save');
        if (s) { s.disabled = false; s.textContent = `Enregistrer ${model.name} →`; }
      });
    });
  }

  function mdCommitVehicle(brand, model, year, fuel, tank, category) {
    userProfile = {
      ...userProfile,
      vehicleCategory: category,
      vehicleBrand: brand,
      vehicleModel: model,
      vehicleYear: year,
      vehicleTank: tank,
      vehicleMotorization: tank > 0 ? `${model} (${tank}L)` : model,
      fuelType: fuel
    };
    localStorage.setItem('fillz_profile', JSON.stringify(userProfile));
    document.getElementById('vehicle-modal').style.display = 'none';
    refreshProfile();
    syncToFirestore();
    if (dataLoaded) renderMarkers();
    runRadarScan();
    showToast('Véhicule mis à jour ✓', 'success');
  }

  // Vehtype toggle
  document.querySelectorAll('.md-vtype-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      if (btn.dataset.vtype === mdVehicleType) return;
      document.querySelectorAll('.md-vtype-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      mdVehicleType = btn.dataset.vtype;
      mdSelectedBrand = null;
      const cont = document.getElementById('md-brand-continue');
      if (cont) { cont.disabled = true; cont.textContent = 'Choisir une marque'; }
      mdRenderBrandGrid();
    });
  });

  // Brand continue
  document.getElementById('md-brand-continue')?.addEventListener('click', () => {
    if (!mdSelectedBrand) return;
    mdRenderModelList();
    mdShowSubStep('md-step-model');
  });

  // Brand skip → custom
  document.getElementById('md-brand-skip')?.addEventListener('click', () => {
    document.getElementById('md-custom-brand').value = '';
    mdShowSubStep('md-step-custom');
  });

  // Model back
  document.getElementById('md-back-to-brand')?.addEventListener('click', () => mdShowSubStep('md-step-brand'));

  // Model save
  document.getElementById('md-model-save')?.addEventListener('click', () => {
    if (!mdSelectedBrand || !mdSelectedModel) return;
    mdCommitVehicle(mdSelectedBrand.name, mdSelectedModel.name, mdSelectedModel.year,
      mdSelectedModel.fuel, mdSelectedModel.tank, mdVehicleType);
  });

  // Model "not listed" → custom
  document.getElementById('md-model-autre')?.addEventListener('click', () => {
    const brandInput = document.getElementById('md-custom-brand');
    if (brandInput && mdSelectedBrand) brandInput.value = mdSelectedBrand.name;
    mdShowSubStep('md-step-custom');
  });

  // Custom back
  document.getElementById('md-back-to-model')?.addEventListener('click', () => {
    mdShowSubStep(mdSelectedBrand ? 'md-step-model' : 'md-step-brand');
  });

  // Custom fuel buttons
  document.querySelectorAll('.md-fuel-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.md-fuel-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      mdCustomFuel = btn.dataset.fuel;
    });
  });

  // Custom floating labels
  document.querySelectorAll('#md-step-custom .ob-float-input').forEach(input => {
    const field = input.closest('.ob-float-field');
    if (!field) return;
    const upd = () => field.classList.toggle('has-val', input.value.length > 0);
    input.addEventListener('focus', () => field.classList.add('focused'));
    input.addEventListener('blur',  () => { field.classList.remove('focused'); upd(); });
    input.addEventListener('input', upd);
  });

  // Custom save
  document.getElementById('md-custom-save')?.addEventListener('click', () => {
    const brand = document.getElementById('md-custom-brand')?.value.trim() || '';
    const model = document.getElementById('md-custom-model')?.value.trim() || '';
    const year  = parseInt(document.getElementById('md-custom-year')?.value) || new Date().getFullYear();
    const tank  = parseFloat(document.getElementById('md-custom-tank')?.value) || 0;
    const errEl = document.getElementById('md-custom-error');
    if (!brand || !model) { errEl.textContent = 'Marque et modèle requis.'; errEl.style.display = 'block'; return; }
    if (!mdCustomFuel) { errEl.textContent = 'Sélectionne un carburant.'; errEl.style.display = 'block'; return; }
    errEl.style.display = 'none';
    mdCommitVehicle(brand, model, year, mdCustomFuel, tank, mdVehicleType);
  });

  // Close
  document.getElementById('md-close')?.addEventListener('click', () => {
    document.getElementById('vehicle-modal').style.display = 'none';
  });

  // Open modal
  document.getElementById('btn-change-vehicle')?.addEventListener('click', () => {
    mdSelectedBrand = null; mdSelectedModel = null; mdCustomFuel = null; mdVehicleType = 'car';
    document.querySelectorAll('.md-vtype-btn').forEach(b => { b.classList.toggle('active', b.dataset.vtype === 'car'); });
    const cont = document.getElementById('md-brand-continue');
    if (cont) { cont.disabled = true; cont.textContent = 'Choisir une marque'; }
    mdRenderBrandGrid();
    mdShowSubStep('md-step-brand');
    document.getElementById('vehicle-modal').style.display = 'flex';
  });

  function refreshProfile() {
    const versionEl = document.getElementById('profile-app-version');
    if (versionEl) versionEl.textContent = `v${localStorage.getItem('fillz_app_version') || '1.0.0'}`;

    const profNameEl = document.getElementById('prof-name');
    if (profNameEl) profNameEl.textContent = [userProfile?.name, userProfile?.surname].filter(Boolean).join(' ') || 'Utilisateur';

    const profEmailEl = document.getElementById('prof-email');
    if (profEmailEl) profEmailEl.textContent = userProfile?.email || (currentUser ? currentUser.email : 'email@exemple.com');

    const el = document.getElementById('prof-vehicle');
    if (el) el.textContent = vehicleSummary();
    const motoEl = document.getElementById('prof-moto');
    if (motoEl) motoEl.textContent = userProfile?.vehicleMemory || userProfile?.vehicleMotorization || '';

    // Logout button visibility
    const logoutBtn = document.getElementById('btn-logout');
    if (logoutBtn) logoutBtn.style.display = currentUser ? 'block' : 'none';

    // Admin button — only for admin email
    const adminBtnWrapper = document.getElementById('admin-btn-wrapper');
    if (adminBtnWrapper) {
      const isAdmin = currentUser?.email === ADMIN_EMAIL;
      adminBtnWrapper.style.display = isAdmin ? 'block' : 'none';
      if (isAdmin) {
        const adminBtn = document.getElementById('btn-open-admin');
        if (adminBtn && !adminBtn._adminWired) {
          adminBtn._adminWired = true;
          adminBtn.addEventListener('click', () => showAdminPanel());
        }
      }
    }

    // Avatar update
    const avatarWrapper = document.getElementById('avatar-img-wrapper');
    if (avatarWrapper && userProfile?.avatar) {
      avatarWrapper.innerHTML = `<img src="${userProfile.avatar}" style="width:100%; height:100%; object-fit:cover;">`;
    } else if (avatarWrapper) {
      avatarWrapper.innerHTML = `<i class="ph-fill ph-user"></i>`;
    }

    // Refresh Favorites in profile
    const favsListEl = document.getElementById('profile-favorites-list');
    if (favsListEl && allStations.length) {
      if (!favorites.length) {
        favsListEl.innerHTML = '<p style="color:var(--text-muted);font-size:13px;text-align:center;padding:10px;"><i class="ph-bold ph-heart" style="font-size:24px;display:block;margin-bottom:8px;opacity:0.5"></i>Aucune station favorite.</p>';
      } else {
        let html = '';
        favorites.forEach(fid => {
          const st = allStations.find(s => s.id === fid);
          if (st) {
            html += `<div class="radar-result-card fav-profile-card" data-id="${st.id}" style="padding:12px;">
              <div class="rrc-left">
                <i class="ph-fill ph-heart" style="color:#ef4444; font-size:16px;"></i>
                <div>
                  <div style="font-size:14px; color:var(--text-main); font-weight:600;">${st.name}</div>
                  <div style="font-size:11px; color:var(--text-muted);">${st.address}</div>
                </div>
              </div>
              <div class="rrc-right">
                <div class="rrc-price">${currencyFor(st.country)} ${parseFloat(st.prices[selectedFuel] || 0).toFixed(3)}</div>
              </div>
            </div>`;
          }
        });
        favsListEl.innerHTML = html;
        favsListEl.querySelectorAll('.fav-profile-card').forEach(card => {
          card.addEventListener('click', () => {
            const st = allStations.find(s => s.id === card.dataset.id);
            if (st) { switchView('map'); setTimeout(() => flyToStation(st), 300); }
          });
        });
      }
    }
    
    // Widget station picker
    const pickerEl = document.getElementById('widget-station-picker');
    if (pickerEl) {
      const deg2rad = d => d * Math.PI / 180;
      const calcDist = (lat1, lng1, lat2, lng2) => {
        const dLat = deg2rad(lat2-lat1), dLng = deg2rad(lng2-lng1);
        const a = Math.sin(dLat/2)**2 + Math.cos(deg2rad(lat1))*Math.cos(deg2rad(lat2))*Math.sin(dLng/2)**2;
        return 6371*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
      };
      const makeRow = (id, name, price, dist, icon) => {
        const sel = widgetStationId === id;
        return `<div class="widget-station-row${sel ? ' selected' : ''}" data-wid="${id}"
          style="display:flex;align-items:center;gap:12px;padding:12px;border-radius:14px;cursor:pointer;
          background:${sel ? 'rgba(139,92,246,0.12)' : 'rgba(255,255,255,0.04)'};
          border:1px solid ${sel ? 'rgba(139,92,246,0.4)' : 'rgba(255,255,255,0.08)'};">
          <span style="font-size:18px;">${icon}</span>
          <div style="flex:1;min-width:0;">
            <div style="font-size:13px;font-weight:700;color:var(--text-main);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${name}</div>
            <div style="font-size:11px;color:var(--text-muted);">${dist !== null ? dist.toFixed(1)+' km · ' : ''}CHF ${price}</div>
          </div>
          <div style="width:20px;height:20px;border-radius:50%;border:2px solid ${sel ? '#8b5cf6' : 'rgba(255,255,255,0.2)'};
            background:${sel ? '#8b5cf6' : 'transparent'};display:flex;align-items:center;justify-content:center;flex-shrink:0;">
            ${sel ? '<i class="ph-fill ph-check" style="font-size:11px;color:#fff;"></i>' : ''}
          </div>
        </div>`;
      };
      let rows = makeRow(null, 'Meilleur prix 25 km (auto)', '—', null, '🎯');
      favorites.forEach(fid => {
        const st = allStations.find(s => s.id === fid);
        if (!st) return;
        const d = calcDist(userLat, userLng, st.lat, st.lng);
        rows += makeRow(st.id, st.name, parseFloat(st.prices[selectedFuel]||0).toFixed(3), d, '❤️');
      });
      pickerEl.innerHTML = rows;
      pickerEl.querySelectorAll('.widget-station-row').forEach(row => {
        row.addEventListener('click', () => {
          widgetStationId = row.dataset.wid === 'null' ? null : row.dataset.wid;
          if (widgetStationId) localStorage.setItem('fillz_widget_station', widgetStationId);
          else localStorage.removeItem('fillz_widget_station');
          syncToFirestore();
          sendWidgetUpdate();
          refreshProfile();
        });
      });
    }

    renderGamificationProfile();
    const profView = document.getElementById('view-profile');
    if (profView && profView.style.display !== 'none' && profView.offsetParent !== null) {
      setTimeout(renderSavingsChart, 100);
    }
  }

  let savingsChartInstance = null;
  function renderSavingsChart() {
    const canvas = document.getElementById('savings-chart');
    if (!canvas || typeof Chart === 'undefined') return;
    if (savingsChartInstance) { savingsChartInstance.destroy(); savingsChartInstance = null; }

    const refuels = JSON.parse(localStorage.getItem('fillz_refuels') || '[]');
    const history = JSON.parse(localStorage.getItem('fillz_price_history') || '{}');
    const fuel = userProfile?.fuelType || selectedFuel || 'SP95';

    // If user has logged refuels → show real expense + savings per refuel
    if (refuels.length >= 1) {
      const sorted = [...refuels].sort((a, b) => new Date(a.date) - new Date(b.date)).slice(-12);
      const labels = sorted.map(r => new Date(r.date).toLocaleDateString('fr-CH', { day:'2-digit', month:'short' }));
      const expenses = sorted.map(r => +(r.price || 0).toFixed(2));
      // Saving per refuel = (avgPrice - paidPerL) * liters, floor 0
      const days = Object.keys(history).sort();
      const savingsData = sorted.map(r => {
        if (!days.length) return 0;
        const rfDate = new Date(r.date).toISOString().slice(0,10);
        const closest = days.reduce((p,c) => Math.abs(new Date(c)-new Date(rfDate)) < Math.abs(new Date(p)-new Date(rfDate)) ? c : p, days[0]);
        const snap = history[closest];
        if (!snap) return 0;
        const prices = Object.values(snap).map(s => s.prices?.[fuel]).filter(Boolean).map(Number);
        if (!prices.length) return 0;
        const maxP = Math.max(...prices);
        const paidL = r.price / r.liters;
        return Math.max(0, +((maxP - paidL) * r.liters).toFixed(2));
      });

      savingsChartInstance = new Chart(canvas, {
        type: 'bar',
        data: {
          labels,
          datasets: [
            { label: 'Dépenses CHF', data: expenses, backgroundColor: 'rgba(139,92,246,0.55)', borderColor: '#8B5CF6', borderWidth: 1.5, borderRadius: 6 },
            { label: 'Économies CHF', data: savingsData, backgroundColor: 'rgba(16,185,129,0.55)', borderColor: '#10B981', borderWidth: 1.5, borderRadius: 6 }
          ]
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { labels: { color: '#a1a1aa', font: { family: 'Outfit', size: 11 } } } },
          scales: {
            x: { stacked: false, grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#a1a1aa', font: { size: 10 } } },
            y: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#a1a1aa', callback: v => 'CHF '+v } }
          }
        }
      });
      return;
    }

    // No refuels → show avg price trend from history (price intelligence)
    const days = Object.keys(history).sort().slice(-14);
    if (!days.length) {
      canvas.parentElement.innerHTML = '<div style="text-align:center;padding:32px;color:rgba(255,255,255,.3);font-size:13px;">Enregistrez vos pleins pour voir vos économies réelles</div>';
      return;
    }
    const labels = days.map(d => { const [,m,day] = d.split('-'); return `${day}.${m}`; });
    const avgPrices = days.map(d => {
      const snap = history[d];
      const prices = Object.values(snap).map(s => s.prices?.[fuel]).filter(Boolean).map(Number);
      return prices.length ? +(prices.reduce((a,b)=>a+b,0)/prices.length).toFixed(3) : null;
    });
    const minPrices = days.map(d => {
      const snap = history[d];
      const prices = Object.values(snap).map(s => s.prices?.[fuel]).filter(Boolean).map(Number);
      return prices.length ? +Math.min(...prices).toFixed(3) : null;
    });

    savingsChartInstance = new Chart(canvas, {
      type: 'line',
      data: {
        labels,
        datasets: [
          { label: `Prix moyen ${fuel}`, data: avgPrices, borderColor: '#8B5CF6', backgroundColor: 'rgba(139,92,246,0.08)', borderWidth: 2, tension: 0.4, fill: true, spanGaps: true, pointRadius: 3 },
          { label: `Meilleur prix ${fuel}`, data: minPrices, borderColor: '#10B981', backgroundColor: 'rgba(16,185,129,0.08)', borderWidth: 2, tension: 0.4, fill: true, spanGaps: true, pointRadius: 3 }
        ]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { labels: { color: '#a1a1aa', font: { family: 'Outfit', size: 11 } } } },
        scales: {
          x: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#a1a1aa', font: { size: 10 } } },
          y: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#a1a1aa', callback: v => v.toFixed(2) } }
        }
      }
    });
  }

  function renderGamificationProfile() {
    const badgesContainer = document.getElementById('badges-container');
    if (!badgesContainer) return;
    let html = '';
    BADGE_DEFINITIONS.forEach(b => {
      const unlocked = userBadges.includes(b.id);
      const [c1, c2] = b.colors;
      html += `
        <div style="flex-shrink:0;width:88px;padding:12px 8px;background:rgba(255,255,255,0.03);border:1px solid ${unlocked ? c1+'44' : 'rgba(255,255,255,0.06)'};border-radius:16px;text-align:center;opacity:${unlocked ? '1' : '0.38'};transition:transform .2s;">
          <div style="width:44px;height:44px;border-radius:50%;background:${unlocked ? `linear-gradient(135deg,${c1},${c2})` : 'rgba(255,255,255,0.06)'};display:flex;align-items:center;justify-content:center;margin:0 auto 8px;${unlocked ? `box-shadow:0 0 12px ${c1}55;` : 'filter:grayscale(1);'}">
            <svg viewBox="0 0 24 24" width="22" height="22" style="color:${unlocked ? '#fff' : 'rgba(255,255,255,0.5)'};">${b.svg}</svg>
          </div>
          <div style="font-size:11px;font-weight:700;line-height:1.2;color:${unlocked ? '#fff' : 'rgba(255,255,255,0.35)'};">${b.label}</div>
        </div>`;
    });
    badgesContainer.innerHTML = html;
  }

  // Avatar Upload Logic
  const avatarInput = document.getElementById('avatar-input');
  document.getElementById('avatar-container')?.addEventListener('click', () => avatarInput.click());

  avatarInput?.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_SIZE = 200;
        let w = img.width;
        let h = img.height;
        if (w > h) {
          if (w > MAX_SIZE) { h *= MAX_SIZE / w; w = MAX_SIZE; }
        } else {
          if (h > MAX_SIZE) { w *= MAX_SIZE / h; h = MAX_SIZE; }
        }
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.7); // slightly more compressed

        // Upload to Firebase Storage
        if (currentUser) {
          const avatarWrapper = document.getElementById('avatar-img-wrapper');
          if (avatarWrapper) avatarWrapper.innerHTML = `<div class="spinner-small" style="border-color:#fff transparent transparent transparent; width:20px; height:20px;"></div>`;
          
          const storageRef = ref(storage, `avatars/${currentUser.uid}`);
          uploadString(storageRef, dataUrl, 'data_url').then(async () => {
            const downloadUrl = await getDownloadURL(storageRef);
            userProfile.avatar = downloadUrl;
            localStorage.setItem('fillz_profile', JSON.stringify(userProfile));
            refreshProfile();
            debouncedSyncToFirestore();
          }).catch(err => {
            console.error('Error uploading avatar:', err);
            avatarWrapper.innerHTML = `<i class="ph-fill ph-user"></i>`;
            alert('Échec upload image.');
          });
        } else {
          userProfile.avatar = dataUrl;
          localStorage.setItem('fillz_profile', JSON.stringify(userProfile));
          refreshProfile();
        }
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  });

  // Logout Logic
  document.getElementById('btn-logout')?.addEventListener('click', () => {
    signOut(auth).then(() => {
      localStorage.removeItem('fillz_profile');
      location.reload();
    });
  });

  // Changer de carburant depuis le profil
  document.getElementById('prof-fuel-sel')?.addEventListener('change', (e) => {
    if (!userProfile) return;
    const newFuel = e.target.value;
    userProfile.fuelType = newFuel;
    selectedFuel = newFuel;
    localStorage.setItem('fillz_profile', JSON.stringify(userProfile));
    debouncedSyncToFirestore(); // Synchronisation back-up pour le cloud
    document.getElementById('chip-fuel').innerHTML = `<i class="ph ph-gas-pump"></i> ${selectedFuel} <i class="ph ph-caret-down"></i>`;
    if (dataLoaded) renderMarkers();
    setTimeout(runRadarScan, 50);
    sendWidgetUpdate();
  });

  // ── Profile Edit ──────────────────────────────────────
  document.getElementById('btn-edit-profile')?.addEventListener('click', openEditProfileModal);

  function openEditProfileModal() {
    document.getElementById('profile-edit-modal')?.remove();
    const modal = document.createElement('div');
    modal.id = 'profile-edit-modal';
    modal.style.cssText = 'position:fixed;inset:0;z-index:9998;background:rgba(0,0,0,0.65);display:flex;align-items:flex-end;';
    modal.innerHTML = `
      <div style="background:var(--bg-card,#1c1c1e);border-radius:24px 24px 0 0;padding:24px;width:100%;max-height:85vh;overflow-y:auto;box-sizing:border-box;">
        <div style="width:40px;height:4px;background:rgba(255,255,255,0.2);border-radius:2px;margin:0 auto 20px;"></div>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:22px;">
          <h3 style="font-size:18px;font-weight:700;color:var(--text-main,#fff);margin:0;">Modifier le profil</h3>
          <button id="pem-close" style="background:rgba(255,255,255,0.08);border:none;border-radius:50%;width:32px;height:32px;cursor:pointer;color:var(--text-muted,#aaa);font-size:18px;display:flex;align-items:center;justify-content:center;">×</button>
        </div>
        <div style="display:flex;flex-direction:column;gap:16px;">
          <div>
            <label style="font-size:11px;color:var(--text-muted,#aaa);font-weight:700;text-transform:uppercase;letter-spacing:0.8px;">Prénom *</label>
            <input id="pem-name" type="text" value="${userProfile?.name || ''}" placeholder="Votre prénom" style="width:100%;box-sizing:border-box;margin-top:6px;padding:13px 14px;background:rgba(255,255,255,0.07);border:1px solid rgba(255,255,255,0.1);border-radius:12px;color:var(--text-main,#fff);font-size:15px;outline:none;">
          </div>
          <div>
            <label style="font-size:11px;color:var(--text-muted,#aaa);font-weight:700;text-transform:uppercase;letter-spacing:0.8px;">Nom de famille</label>
            <input id="pem-surname" type="text" value="${userProfile?.surname || ''}" placeholder="Votre nom de famille" style="width:100%;box-sizing:border-box;margin-top:6px;padding:13px 14px;background:rgba(255,255,255,0.07);border:1px solid rgba(255,255,255,0.1);border-radius:12px;color:var(--text-main,#fff);font-size:15px;outline:none;">
          </div>
          <div>
            <label style="font-size:11px;color:var(--text-muted,#aaa);font-weight:700;text-transform:uppercase;letter-spacing:0.8px;">Email</label>
            <input type="text" value="${userProfile?.email || currentUser?.email || ''}" disabled style="width:100%;box-sizing:border-box;margin-top:6px;padding:13px 14px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.05);border-radius:12px;color:var(--text-muted,#aaa);font-size:15px;outline:none;cursor:not-allowed;">
            <p style="font-size:11px;color:var(--text-muted,#aaa);margin:4px 0 0;opacity:0.6;">Modifiable depuis les paramètres Firebase.</p>
          </div>
        </div>
        <button id="pem-save" style="width:100%;margin-top:22px;padding:15px;background:linear-gradient(135deg,#8b5cf6,#6366f1);border:none;border-radius:14px;color:white;font-size:15px;font-weight:700;cursor:pointer;letter-spacing:0.2px;">Enregistrer les modifications</button>
      </div>`;
    document.body.appendChild(modal);
    document.getElementById('pem-close').onclick = () => modal.remove();
    modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
    document.getElementById('pem-name').focus();
    document.getElementById('pem-save').onclick = () => {
      const name = document.getElementById('pem-name').value.trim();
      const surname = document.getElementById('pem-surname').value.trim();
      if (!name) { document.getElementById('pem-name').style.border = '1px solid #ef4444'; return; }
      if (!userProfile) userProfile = {};
      userProfile.name = name;
      userProfile.surname = surname;
      localStorage.setItem('fillz_profile', JSON.stringify(userProfile));
      debouncedSyncToFirestore();
      refreshProfile();
      modal.remove();
      const toast = document.createElement('div');
      toast.style.cssText = 'position:fixed;bottom:100px;left:50%;transform:translateX(-50%);background:#4ade80;color:#052e16;padding:10px 22px;border-radius:20px;font-size:13px;font-weight:700;z-index:99999;white-space:nowrap;box-shadow:0 4px 20px rgba(74,222,128,0.4);';
      toast.textContent = '✓ Profil mis à jour';
      document.body.appendChild(toast);
      setTimeout(() => toast.remove(), 2500);
    };
  }

  function openAdminLogin() {
    document.getElementById('admin-pwd-modal')?.remove();
    const pwdModal = document.createElement('div');
    pwdModal.id = 'admin-pwd-modal';
    pwdModal.style.cssText = 'position:fixed;inset:0;z-index:100001;background:rgba(0,0,0,0.7);display:flex;align-items:center;justify-content:center;padding:24px;';
    pwdModal.innerHTML = `
      <div style="background:#1a1a2e;border:1px solid rgba(139,92,246,0.3);border-radius:20px;padding:28px;width:100%;max-width:360px;box-sizing:border-box;">
        <h3 style="color:#fff;margin:0 0 6px;font-size:18px;font-weight:700;">🔐 Accès Administration</h3>
        <p style="color:rgba(255,255,255,0.4);font-size:13px;margin:0 0 20px;">Mot de passe requis</p>
        <input id="admin-pwd-input" type="password" placeholder="Mot de passe admin" style="width:100%;box-sizing:border-box;padding:13px 14px;background:rgba(255,255,255,0.07);border:1px solid rgba(255,255,255,0.12);border-radius:12px;color:#fff;font-size:15px;outline:none;margin-bottom:8px;">
        <p id="admin-pwd-err" style="color:#f87171;font-size:12px;margin:0 0 14px;display:none;">Mot de passe incorrect</p>
        <div style="display:flex;gap:10px;">
          <button id="admin-pwd-cancel" style="flex:1;padding:13px;background:rgba(255,255,255,0.07);border:1px solid rgba(255,255,255,0.1);border-radius:12px;color:#fff;font-size:14px;cursor:pointer;">Annuler</button>
          <button id="admin-pwd-ok" style="flex:2;padding:13px;background:linear-gradient(135deg,#8b5cf6,#6366f1);border:none;border-radius:12px;color:#fff;font-size:14px;font-weight:700;cursor:pointer;">Connexion</button>
        </div>
      </div>`;
    document.body.appendChild(pwdModal);
    const pwdInput = document.getElementById('admin-pwd-input');
    pwdInput.focus();
    document.getElementById('admin-pwd-cancel').onclick = () => pwdModal.remove();
    pwdModal.addEventListener('click', e => { if (e.target === pwdModal) pwdModal.remove(); });
    const tryLogin = () => {
      if (pwdInput.value === 'Apolite01%') { pwdModal.remove(); showAdminPanel(); }
      else { document.getElementById('admin-pwd-err').style.display = 'block'; pwdInput.value = ''; pwdInput.focus(); }
    };
    document.getElementById('admin-pwd-ok').onclick = tryLogin;
    pwdInput.addEventListener('keydown', e => { if (e.key === 'Enter') tryLogin(); });
  }

  async function showAdminPanel() {
    if (currentUser?.email !== ADMIN_EMAIL) {
      alert('Accès réservé à l\'administrateur.');
      return;
    }
    document.getElementById('admin-panel-overlay')?.remove();

    // Spinner
    const loadingEl = document.createElement('div');
    loadingEl.id = 'admin-panel-overlay';
    loadingEl.style.cssText = 'position:fixed;inset:0;z-index:100000;background:#f1f5f9;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;';
    loadingEl.innerHTML = `<div style="width:40px;height:40px;border:3px solid #e2e8f0;border-top-color:#8b5cf6;border-radius:50%;animation:adm-spin 0.7s linear infinite;"></div><div style="font-size:14px;font-weight:600;color:#64748b;">Chargement des données...</div><style>@keyframes adm-spin{to{transform:rotate(360deg)}}</style>`;
    document.body.appendChild(loadingEl);

    // Stations: mémoire > cache IndexedDB (30 min) > API TCS
    const ADM_CACHE_KEY = 'fillz_admin_stations_cache';
    const ADM_CACHE_TTL = 30 * 60 * 1000;
    let statsStations = allStations;
    let admCacheTs = null;
    if (statsStations.length === 0) {
      const cached = await cacheGet(ADM_CACHE_KEY);
      if (cached && Date.now() - cached.ts < ADM_CACHE_TTL) {
        statsStations = cached.data;
        admCacheTs = cached.ts;
      } else {
        try {
          statsStations = await fetchAllStations(true); // Admin gets all stations
          await cacheSet(ADM_CACHE_KEY, { data: statsStations, ts: Date.now() });
          admCacheTs = Date.now();
        } catch(_) {}
      }
    }

    // Firestore: snapshot + config + price history (7 jours)
    let lastSync = '—', changedCount = '—', currentAppVersion = localStorage.getItem('fillz_app_version') || '1.0.0';
    const historyDays = 7;
    const dateKeys = Array.from({length: historyDays}, (_,i) => {
      const d = new Date(); d.setDate(d.getDate() - (historyDays - 1 - i));
      return d.toISOString().slice(0, 10);
    });
    const dayLabels = dateKeys.map(k => k.slice(5).replace('-', '/'));
    let histDocs = [];
    try {
      const [snap, cfgSnap, ...hist] = await Promise.all([
        getDoc(doc(db, 'stations_meta', 'snapshot')),
        getDoc(doc(db, 'app_config', 'settings')),
        ...dateKeys.map(k => getDoc(doc(db, 'price_history', k)))
      ]);
      if (snap.exists()) {
        const ts = snap.data()?.timestamps;
        if (ts) {
          const timestamps = Object.values(ts);
          const latest = [...timestamps].sort().pop();
          if (latest) lastSync = new Date(latest).toLocaleTimeString('fr-CH', {hour:'2-digit',minute:'2-digit'}) + ' ' + new Date(latest).toLocaleDateString('fr-CH');
          const today = new Date().toISOString().slice(0,10);
          changedCount = timestamps.filter(t => t?.startsWith(today)).length;
        }
      }
      if (cfgSnap.exists()) currentAppVersion = cfgSnap.data()?.app_version || currentAppVersion;
      histDocs = hist;
    } catch(_) {}

    // Compute daily averages per fuel from price_history
    const CHART_FUELS = ['SP95', 'SP98', 'Diesel', 'GPL'];
    const fuelColors = {'SP95':'#8b5cf6','SP98':'#6366f1','Diesel':'#f59e0b','GPL':'#10b981'};
    const chartData = {};
    CHART_FUELS.forEach(f => chartData[f] = []);
    histDocs.forEach(d => {
      if (d.exists()) {
        const data = d.data();
        CHART_FUELS.forEach(f => {
          const vals = Object.values(data).map(p => parseFloat(p[f])).filter(v => !isNaN(v) && v > 0);
          chartData[f].push(vals.length ? parseFloat((vals.reduce((a,b)=>a+b,0)/vals.length).toFixed(3)) : null);
        });
      } else {
        CHART_FUELS.forEach(f => chartData[f].push(null));
      }
    });

    document.getElementById('admin-panel-overlay')?.remove();

    // Stats
    const stationCount = statsStations.length;
    const stationCountLabel = `${stationCount.toLocaleString('fr')}`;
    const fuelsAvail = ['SP95','SP98','Diesel','GPL'].filter(f => statsStations.some(s => s.prices[f]));

    // Stats par pays — boucle sur les pays réellement présents dans les données.
    const presentCodes = [...new Set(statsStations.map(s => s.country || 'CH'))];
    const countryStats = COUNTRIES.filter(c => presentCodes.includes(c.code)).map(c => {
      const list = statsStations.filter(s => (s.country || 'CH') === c.code);
      const avg = {};
      fuelsAvail.forEach(f => {
        const vals = list.filter(s => s.prices[f]).map(s => parseFloat(s.prices[f]));
        avg[f] = vals.length ? (vals.reduce((a,b)=>a+b,0)/vals.length).toFixed(3) : null;
      });
      const brandMap = {};
      list.forEach(s => { if (s.brand) brandMap[s.brand] = (brandMap[s.brand]||0)+1; });
      const topBrands = Object.entries(brandMap).sort((a,b)=>b[1]-a[1]).slice(0, 10);
      const cheapest = list.filter(s => s.prices[selectedFuel])
        .sort((a,b)=>parseFloat(a.prices[selectedFuel])-parseFloat(b.prices[selectedFuel]))
        .slice(0, 5);
      return {
        ...c,
        count: list.length,
        avg,
        maxAvg: Math.max(...Object.values(avg).filter(Boolean).map(Number), 0) || 1,
        topBrands,
        maxBrand: topBrands[0]?.[1] || 1,
        cheapest,
      };
    });
    const stationCountSub = countryStats.map(c => `${c.flag} ${c.count.toLocaleString('fr')}`).join(' | ');

    // Cache label
    const appCacheRaw = JSON.parse(localStorage.getItem('fillz_stations_cache_v2') || 'null');
    const appCacheAge = appCacheRaw ? Math.round((Date.now() - appCacheRaw.ts) / 60000) : null;
    const appCacheValid = appCacheAge !== null && appCacheAge < 60;
    const admCacheAge = admCacheTs ? Math.round((Date.now() - admCacheTs) / 60000) : null;
    const cacheLabel = appCacheAge !== null
      ? (appCacheValid ? `✅ PWA valide (${appCacheAge} min)` : '⚠️ PWA expiré')
      : admCacheAge !== null ? `💾 Admin cache (${admCacheAge} min)` : '—';
    const cacheKpiVal = appCacheAge !== null ? (appCacheValid ? `${appCacheAge} min` : 'Expiré') : admCacheAge !== null ? `${admCacheAge} min` : '—';
    const cacheKpiColor = appCacheValid ? '#10b981' : admCacheAge !== null ? '#6366f1' : '#64748b';

    const overlay = document.createElement('div');
    overlay.id = 'admin-panel-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:100000;background:#f1f5f9;overflow-y:auto;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;';

    overlay.innerHTML = `
      <style>
        #adm-body { display:flex; height:100vh; overflow:hidden; }
        #adm-sidebar { width:220px; background:#fff; border-right:1px solid #e2e8f0; display:flex; flex-direction:column; flex-shrink:0; }
        #adm-main { flex:1; overflow-y:auto; background:#f8fafc; }
        .adm-nav-item { display:flex; align-items:center; gap:10px; padding:11px 20px; cursor:pointer; font-size:13px; font-weight:600; color:#64748b; border-left:3px solid transparent; transition:all 0.15s; }
        .adm-nav-item:hover { background:#f8fafc; color:#1e293b; }
        .adm-nav-item.active { background:#faf5ff; color:#7c3aed; border-left-color:#8b5cf6; }
        .adm-nav-item span { font-size:16px; }
        .adm-section { display:none; padding:28px 32px; }
        .adm-section.active { display:block; }
        .adm-card { background:#fff; border-radius:14px; padding:22px 24px; border:1px solid #e2e8f0; box-shadow:0 1px 4px rgba(0,0,0,0.04); margin-bottom:16px; }
        .adm-card-title { font-size:13px; font-weight:800; color:#0f172a; margin-bottom:16px; display:flex; align-items:center; gap:6px; }
        .adm-col2 { display:grid; grid-template-columns:1fr 1fr; gap:16px; }
        .adm-col3 { display:grid; grid-template-columns:1fr 1fr 1fr; gap:12px; }
        .adm-row { display:flex; justify-content:space-between; align-items:center; padding:10px 0; border-bottom:1px solid #f1f5f9; font-size:13px; }
        .adm-row:last-child { border-bottom:none; }
        .adm-btn { padding:11px 16px; border-radius:10px; font-size:13px; font-weight:700; cursor:pointer; text-align:left; border:1px solid; display:block; width:100%; margin-bottom:8px; }
      </style>

      <div id="adm-body">
        <!-- Sidebar -->
        <div id="adm-sidebar">
          <div style="padding:20px 20px 16px;border-bottom:1px solid #f1f5f9;">
            <div style="display:flex;align-items:center;gap:10px;">
              <div style="width:34px;height:34px;background:linear-gradient(135deg,#8b5cf6,#6366f1);border-radius:9px;display:flex;align-items:center;justify-content:center;color:white;font-size:16px;flex-shrink:0;">⚙</div>
              <div>
                <div style="font-size:14px;font-weight:800;color:#0f172a;">OptiTank</div>
                <div style="font-size:10px;color:#94a3b8;">Admin Dashboard</div>
              </div>
            </div>
          </div>
          <div style="flex:1;padding:12px 0;">
            <div class="adm-nav-item active" data-section="overview"><span>📊</span> Vue d'ensemble</div>
            <div class="adm-nav-item" data-section="prices"><span>⛽</span> Prix & Stations</div>
            <div class="adm-nav-item" data-section="chart"><span>📈</span> Évolution</div>
            <div class="adm-nav-item" data-section="brands"><span>🏪</span> Marques</div>
            <div class="adm-nav-item" data-section="controls"><span>🛠</span> Contrôles</div>
            <div class="adm-nav-item" data-section="settings"><span>⚙️</span> Paramètres</div>
            <div class="adm-nav-item" data-section="push"><span>📱</span> Notifications</div>
            <div class="adm-nav-item" data-section="system"><span>ℹ️</span> Système</div>
          </div>
          <div style="padding:16px 20px;border-top:1px solid #f1f5f9;">
            <button id="admin-close" style="width:100%;padding:10px;background:#f1f5f9;border:1px solid #e2e8f0;border-radius:9px;cursor:pointer;color:#64748b;font-size:13px;font-weight:600;">✕ Fermer</button>
          </div>
        </div>

        <!-- Main content -->
        <div id="adm-main">

          <!-- Vue d'ensemble -->
          <div class="adm-section active" id="adm-sec-overview">
            <div style="margin-bottom:24px;">
              <div style="font-size:22px;font-weight:800;color:#0f172a;letter-spacing:-0.5px;">Vue d'ensemble</div>
              <div style="font-size:13px;color:#94a3b8;margin-top:3px;">${new Date().toLocaleDateString('fr-CH',{weekday:'long',day:'numeric',month:'long',year:'numeric'})}</div>
            </div>
            <!-- 4 KPIs -->
            <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-bottom:20px;">
              ${[
                {label:'Stations chargées',value:stationCountLabel,icon:'📍',color:'#8b5cf6',sub:stationCountSub},
                {label:'Dernière sync',value:lastSync,icon:'🔄',color:'#6366f1',sub:'syncStationPrices'},
                {label:'Changements aujourd\'hui',value:String(changedCount),icon:'📊',color:'#f59e0b',sub:'prix modifiés'},
                {label:'Cache',value:cacheKpiVal,icon:appCacheValid?'✅':admCacheAge!==null?'💾':'💻',color:cacheKpiColor,sub:'local'},
              ].map(k=>`
                <div style="background:#fff;border-radius:14px;padding:20px;border:1px solid #e2e8f0;box-shadow:0 1px 4px rgba(0,0,0,0.04);">
                  <div style="font-size:24px;margin-bottom:8px;">${k.icon}</div>
                  <div style="font-size:26px;font-weight:800;color:${k.color};letter-spacing:-0.5px;line-height:1.1;">${k.value}</div>
                  <div style="font-size:12px;font-weight:700;color:#0f172a;margin-top:6px;">${k.label}</div>
                  <div style="font-size:11px;color:#94a3b8;margin-top:2px;">${k.sub}</div>
                </div>`).join('')}
            </div>
            <!-- Prix moyens rapide -->
            <div class="adm-card">
              ${countryStats.map((c, ci) => `
              <div class="adm-card-title"${ci > 0 ? ' style="margin-top:18px;"' : ''}>⛽ Prix moyens nationaux (${c.flag} ${c.label})</div>
              <div style="display:grid;grid-template-columns:repeat(${fuelsAvail.length},1fr);gap:12px;">
                ${fuelsAvail.map(f => `
                  <div style="text-align:center;padding:16px;background:#faf5ff;border-radius:12px;border:1px solid #ede9fe;">
                    <div style="font-size:11px;font-weight:700;color:#7c3aed;margin-bottom:6px;text-transform:uppercase;letter-spacing:0.5px;">${f}</div>
                    <div style="font-size:22px;font-weight:800;color:${fuelColors[f]||'#8b5cf6'};">${c.currency} ${c.avg[f]||'—'}</div>
                  </div>`).join('')}
              </div>`).join('')}
            </div>
          </div>

          <!-- Prix & Stations -->
          <div class="adm-section" id="adm-sec-prices">
            <div style="margin-bottom:24px;"><div style="font-size:22px;font-weight:800;color:#0f172a;letter-spacing:-0.5px;">Prix & Stations</div></div>
            
            ${countryStats.map(c => `
            <div style="font-size:16px;font-weight:800;color:#0f172a;margin-bottom:12px;">${c.flag} ${c.label}</div>
            <div class="adm-col2" style="margin-bottom:24px;">
              <div>
                <div class="adm-card">
                  <div class="adm-card-title">⛽ Prix moyens par carburant</div>
                  <div style="display:flex;flex-direction:column;gap:14px;">
                    ${fuelsAvail.map(f => {
                      const avg = c.avg[f];
                      const pct = avg ? Math.round((Number(avg)/c.maxAvg)*100) : 0;
                      return `<div>
                        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
                          <span style="font-size:13px;font-weight:700;color:#1e293b;">${f}</span>
                          <span style="font-size:16px;font-weight:800;color:${fuelColors[f]||'#8b5cf6'};">${c.currency} ${avg||'—'}</span>
                        </div>
                        <div style="background:#f1f5f9;border-radius:6px;height:8px;overflow:hidden;">
                          <div style="height:100%;width:${pct}%;background:${fuelColors[f]||'#8b5cf6'};border-radius:6px;"></div>
                        </div>
                      </div>`;
                    }).join('')}
                  </div>
                </div>
              </div>
              <div>
                <div class="adm-card">
                  <div class="adm-card-title">🏆 Top 5 moins chères — ${selectedFuel}</div>
                  <div style="display:flex;flex-direction:column;gap:8px;">
                    ${c.cheapest.length ? c.cheapest.map((s,i) => `
                      <div style="display:flex;align-items:center;gap:12px;padding:12px 14px;background:${i===0?'linear-gradient(135deg,#f0fdf4,#dcfce7)':'#f8fafc'};border-radius:12px;border:1px solid ${i===0?'#86efac':'#e2e8f0'};">
                        <div style="width:30px;height:30px;background:${i===0?'#22c55e':i===1?'#94a3b8':i===2?'#f59e0b':'#e2e8f0'};border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:800;color:${i<3?'#fff':'#64748b'};flex-shrink:0;">${i+1}</div>
                        <div style="flex:1;min-width:0;">
                          <div style="font-size:13px;font-weight:700;color:#0f172a;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${s.name}</div>
                        </div>
                        <div style="font-size:15px;font-weight:800;color:#16a34a;flex-shrink:0;">${c.currency} ${s.prices[selectedFuel]}</div>
                      </div>`).join('') : '<div style="font-size:13px;color:#94a3b8;text-align:center;padding:24px;">Aucune donnée</div>'}
                  </div>
                </div>
              </div>
            </div>`).join('')}
          </div>

          <!-- Évolution -->
          <div class="adm-section" id="adm-sec-chart">
            <div style="margin-bottom:24px;"><div style="font-size:22px;font-weight:800;color:#0f172a;letter-spacing:-0.5px;">Évolution des prix (Suisse)</div><div style="font-size:13px;color:#94a3b8;margin-top:3px;">Moyenne nationale par carburant sur 7 jours (CHF/L)</div></div>
            <div class="adm-card">
              <div class="adm-card-title">📈 Courbe d'évolution — 7 derniers jours</div>
              <div style="position:relative;height:320px;width:100%;"><canvas id="adm-price-chart"></canvas></div>
            </div>
          </div>

          <!-- Marques -->
          <div class="adm-section" id="adm-sec-brands">
            <div style="margin-bottom:24px;"><div style="font-size:22px;font-weight:800;color:#0f172a;letter-spacing:-0.5px;">Répartition par marque</div></div>
            
            ${countryStats.map(c => `
            <div class="adm-card">
              <div class="adm-card-title">${c.flag} Top 10 enseignes (${c.label})</div>
              ${c.topBrands.length === 0 ? '<div style="font-size:13px;color:#94a3b8;text-align:center;padding:24px;">Aucune donnée</div>' : `
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px 32px;">
                ${c.topBrands.map(([brand, cnt]) => `
                  <div>
                    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:5px;">
                      <span style="font-size:13px;font-weight:700;color:#1e293b;">${brand}</span>
                      <span style="font-size:13px;font-weight:800;color:#8b5cf6;">${cnt}</span>
                    </div>
                    <div style="background:#f1f5f9;border-radius:6px;height:7px;overflow:hidden;">
                      <div style="height:100%;width:${Math.round((cnt/c.maxBrand)*100)}%;background:linear-gradient(90deg,#8b5cf6,#6366f1);border-radius:6px;"></div>
                    </div>
                  </div>`).join('')}
              </div>`}
            </div>`).join('')}
          </div>

          <!-- Contrôles -->
          <div class="adm-section" id="adm-sec-controls">
            <div style="margin-bottom:24px;"><div style="font-size:22px;font-weight:800;color:#0f172a;letter-spacing:-0.5px;">Contrôles</div></div>
            <div class="adm-col2">
              <div>
                <div class="adm-card">
                  <div class="adm-card-title">🛠 Actions stations</div>
                  <button id="adm-clear-cache" class="adm-btn" style="background:#fef3c7;border-color:#fde68a;color:#92400e;">🗑 Vider le cache — forcer rechargement</button>
                  <button id="adm-reload-stations" class="adm-btn" style="background:#ede9fe;border-color:#ddd6fe;color:#5b21b6;">🔄 Recharger les stations maintenant</button>
                  <button id="adm-export-json" class="adm-btn" style="background:#f0fdf4;border-color:#bbf7d0;color:#166534;">📥 Exporter données stations (JSON)</button>
                  <button id="adm-export-csv" class="adm-btn" style="background:#f0f9ff;border-color:#bae6fd;color:#075985;">📊 Exporter prix en CSV</button>
                  <button id="adm-sync-pt" class="adm-btn" style="background:#f0fdfa;border-color:#99f6e4;color:#0f766e;margin-bottom:0;">🇵🇹 Rafraîchir les stations Portugal</button>
                </div>
              </div>
              <div>
                <div class="adm-card">
                  <div class="adm-card-title">💾 Cache & Stockage</div>
                  ${[
                    ['Cache stations', cacheLabel],
                    ['Cache admin (30 min)', admCacheAge !== null ? `💾 ${admCacheAge} min` : '—'],
                    ['Données profil', localStorage.getItem('fillz_profile') ? '✅ Présent' : '—'],
                    ['Favoris', `${(typeof favorites !== 'undefined' ? favorites.length : 0)} station(s)`],
                    ['Alertes prix', `${(typeof priceAlerts !== 'undefined' ? priceAlerts.length : 0)} alerte(s)`],
                    ['Historique pleins', `${JSON.parse(localStorage.getItem('fillz_refuels')||'[]').length} entrée(s)`],
                  ].map(([k,v]) => `<div class="adm-row"><span style="color:#64748b;font-weight:500;">${k}</span><span style="font-weight:700;color:#1e293b;">${v}</span></div>`).join('')}
                </div>
              </div>
            </div>
          </div>

          <!-- Paramètres -->
          <div class="adm-section" id="adm-sec-settings">
            <div style="margin-bottom:24px;"><div style="font-size:22px;font-weight:800;color:#0f172a;letter-spacing:-0.5px;">Paramètres application</div></div>
            <div class="adm-col2">
              <div>
                <div class="adm-card">
                  <div class="adm-card-title">⚙️ Toggles</div>
                  ${[
                    {id:'adm-tog-debug',   key:'fillz_debug',       label:'Mode debug',          sub:'Logs techniques dans la console',               icon:'🐛'},
                    {id:'adm-tog-maint',   key:'fillz_maintenance', label:'Bannière maintenance', sub:'Bannière jaune en haut de l\'app',              icon:'🚧'},
                    {id:'adm-tog-update',  key:'fillz_update_mode', label:'Mode mise à jour',     sub:'Bloque l\'app avec l\'écran Fuelo',             icon:'🔧'},
                    {id:'adm-tog-france',  key:'fillz_enable_france', label:'Activer la France',  sub:'Stations FR (Open Data gouv)',                  icon:'🇫🇷'},
                    {id:'adm-tog-spain',   key:'fillz_enable_spain', label:'Activer l\'Espagne',  sub:'Stations ES (API Minetur)',                    icon:'🇪🇸'},
                    {id:'adm-tog-portugal',key:'fillz_enable_portugal', label:'Activer le Portugal', sub:'Stations PT (DGEG, via backend)',           icon:'🇵🇹'},
                    {id:'adm-tog-germany', key:'fillz_enable_germany', label:'Activer l\'Allemagne', sub:'Bientôt (Tankerkönig)',                     icon:'🇩🇪', disabled:true},
                    {id:'adm-tog-demo',    key:'fillz_force_demo',  label:'Forcer mode démo',     sub:'Utilise les stations de démo',                  icon:'🎭'},
                    {id:'adm-tog-borders', key:'optitank_swiss_borders', label:'Frontières Suisse', sub:'Affiche le contour du pays sur la carte',   icon:'🗺️'},
                    {id:'adm-tog-cities',  key:'optitank_swiss_cities', label:'Noms des villes', sub:'Affiche toutes les villes sur la carte',        icon:'📍'},
                  ].map((t,i,arr) => {
                    const isCountry = COUNTRIES.some(c => c.enableKey === t.key);
                    const on = isCountry ? (localStorage.getItem(t.key) === 'true') : !!localStorage.getItem(t.key);
                    return `
                    <div style="display:flex;align-items:center;justify-content:space-between;padding:14px 0;${i<arr.length-1?'border-bottom:1px solid #f1f5f9;':''}${t.disabled?'opacity:0.45;':''}">
                      <div>
                        <div style="font-size:13px;font-weight:700;color:#1e293b;">${t.icon} ${t.label}</div>
                        <div style="font-size:11px;color:#94a3b8;margin-top:2px;">${t.sub}</div>
                      </div>
                      <div id="${t.id}-wrap" data-key="${t.key}" data-on="${on?'1':'0'}" data-disabled="${t.disabled?'1':'0'}"
                        style="width:46px;height:26px;background:${on?'#8b5cf6':'#e2e8f0'};border-radius:13px;cursor:${t.disabled?'not-allowed':'pointer'};position:relative;transition:background 0.2s;flex-shrink:0;">
                        <div style="width:22px;height:22px;background:white;border-radius:50%;position:absolute;top:2px;left:0;transform:${on?'translateX(22px)':'translateX(2px)'};transition:transform 0.2s;box-shadow:0 1px 3px rgba(0,0,0,0.2);"></div>
                      </div>
                    </div>`;
                  }).join('')}
                </div>
              </div>
              <div>
                <div class="adm-card">
                  <div class="adm-card-title">🔢 Version & Reset PWA</div>
                  <p style="font-size:12px;color:#64748b;margin:0 0 16px;line-height:1.6;">Changer la version force tous les appareils à vider leur cache PWA et recharger l'app sans les déconnecter.</p>
                  <label style="font-size:11px;color:#94a3b8;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;display:block;margin-bottom:6px;">Version actuelle</label>
                  <input id="adm-version-input" type="text" value="${currentAppVersion}"
                    style="width:100%;box-sizing:border-box;padding:12px 14px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;font-size:16px;font-weight:700;color:#1e293b;outline:none;margin-bottom:12px;">
                  <button id="adm-publish-version" style="width:100%;padding:13px;background:linear-gradient(135deg,#8b5cf6,#6366f1);border:none;border-radius:11px;color:#fff;font-size:13px;font-weight:700;cursor:pointer;">
                    🚀 Publier — reset cache de tous les appareils
                  </button>
                </div>
              </div>
            </div>
          </div>

          <!-- Système -->
          <div class="adm-section" id="adm-sec-system">
            <div style="margin-bottom:24px;"><div style="font-size:22px;font-weight:800;color:#0f172a;letter-spacing:-0.5px;">Informations système</div></div>
            <div class="adm-card">
              <div class="adm-card-title">ℹ️ Environnement</div>
              <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;">
                ${[
                  ['Version app', currentAppVersion],
                  ['Environnement','Production'],
                  ['Projet Firebase','optitank-c7709'],
                  ['API TCS','benzinGetStationByBbox'],
                  ['PWA','Service Worker actif'],
                  ['Date', new Date().toLocaleDateString('fr-CH')],
                ].map(([k,v])=>`<div style="padding:12px 14px;background:#f8fafc;border-radius:10px;border:1px solid #e2e8f0;"><div style="font-size:10px;color:#94a3b8;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">${k}</div><div style="font-size:13px;font-weight:700;color:#1e293b;margin-top:3px;">${v}</div></div>`).join('')}
              </div>
            </div>
          </div>

          <!-- Push Notifications -->
          <div class="adm-section" id="adm-sec-push">
            <div style="margin-bottom:24px;">
              <div style="font-size:22px;font-weight:800;color:#0f172a;letter-spacing:-0.5px;">Push Notifications</div>
              <div style="font-size:13px;color:#94a3b8;margin-top:3px;">Envoyer une notification test aux appareils enregistrés</div>
            </div>
            <div class="adm-col2">
              <div>
                <div class="adm-card">
                  <div class="adm-card-title">📱 Appareils enregistrés</div>
                  <div id="adm-tokens-list" style="min-height:60px;display:flex;flex-direction:column;gap:6px;">
                    <div style="font-size:12px;color:#94a3b8;text-align:center;padding:16px;">Cliquez sur "Actualiser" pour voir les appareils</div>
                  </div>
                  <button id="adm-load-tokens" class="adm-btn" style="background:#ede9fe;border-color:#ddd6fe;color:#5b21b6;margin-top:12px;">🔄 Actualiser la liste</button>
                </div>
              </div>
              <div>
                <div class="adm-card">
                  <div class="adm-card-title">✍️ Composer la notification</div>
                  <label style="font-size:11px;color:#94a3b8;font-weight:700;text-transform:uppercase;display:block;margin-bottom:5px;">Token APNs</label>
                  <input id="adm-push-token" type="text" placeholder="Coller un token APNs ici..."
                    style="width:100%;box-sizing:border-box;padding:10px 12px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;font-size:11px;color:#1e293b;margin-bottom:10px;font-family:monospace;">
                  <label style="font-size:11px;color:#94a3b8;font-weight:700;text-transform:uppercase;display:block;margin-bottom:5px;">Titre</label>
                  <input id="adm-push-title" type="text" value="🔔 Test OptiTank"
                    style="width:100%;box-sizing:border-box;padding:10px 12px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;font-size:13px;color:#1e293b;margin-bottom:10px;">
                  <label style="font-size:11px;color:#94a3b8;font-weight:700;text-transform:uppercase;display:block;margin-bottom:5px;">Corps</label>
                  <input id="adm-push-body" type="text" value="SP95 à CHF 1.720 près de vous 🇨🇭"
                    style="width:100%;box-sizing:border-box;padding:10px 12px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;font-size:13px;color:#1e293b;margin-bottom:10px;">
                  <label style="font-size:11px;color:#94a3b8;font-weight:700;text-transform:uppercase;display:block;margin-bottom:5px;">URL (optionnel)</label>
                  <input id="adm-push-url" type="text" placeholder="https://optitank.online"
                    style="width:100%;box-sizing:border-box;padding:10px 12px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;font-size:13px;color:#1e293b;margin-bottom:14px;">
                  <button id="adm-send-push" style="width:100%;padding:13px;background:linear-gradient(135deg,#8b5cf6,#6366f1);border:none;border-radius:11px;color:#fff;font-size:13px;font-weight:700;cursor:pointer;margin-bottom:8px;">
                    🚀 Envoyer à cet appareil
                  </button>
                  <button id="adm-send-push-all" style="width:100%;padding:13px;background:linear-gradient(135deg,#ec4899,#e11d48);border:none;border-radius:11px;color:#fff;font-size:13px;font-weight:700;cursor:pointer;margin-bottom:8px;">
                    🌍 Envoyer à TOUS LES APPAREILS
                  </button>
                  <button id="adm-test-browser-push" style="width:100%;padding:10px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:11px;color:#166534;font-size:13px;font-weight:700;cursor:pointer;">
                    🔔 Test navigateur (local)
                  </button>
                </div>
              </div>
            </div>
          </div>

        </div><!-- /adm-main -->
      </div><!-- /adm-body -->`;

    document.body.appendChild(overlay);

    // ── Sidebar navigation ────────────────────────────────
    overlay.querySelectorAll('.adm-nav-item').forEach(item => {
      item.addEventListener('click', () => {
        overlay.querySelectorAll('.adm-nav-item').forEach(n => n.classList.remove('active'));
        overlay.querySelectorAll('.adm-section').forEach(s => s.classList.remove('active'));
        item.classList.add('active');
        const sec = overlay.querySelector(`#adm-sec-${item.dataset.section}`);
        if (sec) {
          sec.classList.add('active');
          // Init chart lazily when chart section becomes visible
          if (item.dataset.section === 'chart') initAdmChart();
          if (item.dataset.section === 'push') loadPushTokens();
        }
      });
    });

    // ── Chart: évolution des prix (7 jours) ────────────────
    let admChartInited = false;
    function initAdmChart() {
      if (admChartInited) return;
      const chartCanvas = document.getElementById('adm-price-chart');
      if (!chartCanvas) return;
      admChartInited = true;
      new Chart(chartCanvas, {
        type: 'line',
        data: {
          labels: dayLabels,
          datasets: CHART_FUELS.filter(f => chartData[f].some(v => v !== null)).map(f => ({
            label: f,
            data: chartData[f],
            borderColor: fuelColors[f],
            backgroundColor: fuelColors[f] + '18',
            tension: 0.4,
            pointRadius: 5,
            pointHoverRadius: 7,
            borderWidth: 2.5,
            fill: false,
            spanGaps: true,
          }))
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          interaction: { mode: 'index', intersect: false },
          plugins: {
            legend: { position: 'bottom', labels: { boxWidth: 14, font: { size: 13 }, padding: 16 } },
            tooltip: { callbacks: { label: ctx => ` ${ctx.dataset.label}: CHF ${ctx.parsed.y?.toFixed(3)}` } }
          },
          scales: {
            y: {
              beginAtZero: false,
              ticks: { callback: v => 'CHF ' + Number(v).toFixed(3), font: { size: 12 } },
              grid: { color: '#f1f5f9' }
            },
            x: { ticks: { font: { size: 12 } }, grid: { display: false } }
          }
        }
      });
    }

    document.getElementById('admin-close').onclick = () => overlay.remove();

    overlay.getElementById?.('adm-load-tokens')?.addEventListener('click', loadPushTokens);
    document.getElementById('adm-load-tokens')?.addEventListener('click', loadPushTokens);

    document.getElementById('adm-test-browser-push')?.addEventListener('click', async () => {
      const title = document.getElementById('adm-push-title')?.value || '🔔 Test OptiTank';
      const body  = document.getElementById('adm-push-body')?.value  || 'Notification de test';
      const perm  = await Notification.requestPermission();
      if (perm === 'granted') {
        const reg = await navigator.serviceWorker?.ready;
        if (reg) reg.showNotification(title, { body, icon: '/icon-192.png', badge: '/icon-192.png', vibrate: [100, 50, 100] });
        else new Notification(title, { body });
        showAdminToast('✓ Notification affichée sur ce navigateur', '#22c55e', '#052e16');
      } else {
        showAdminToast('⚠ Permission refusée par ce navigateur', '#f59e0b', '#1c1917');
      }
    });

    document.getElementById('adm-send-push')?.addEventListener('click', async () => {
      const token = document.getElementById('adm-push-token')?.value.trim();
      const title = document.getElementById('adm-push-title')?.value.trim();
      const body  = document.getElementById('adm-push-body')?.value.trim();
      const url   = document.getElementById('adm-push-url')?.value.trim();
      if (!token) { showAdminToast('⚠ Entrez un token APNs', '#f59e0b', '#1c1917'); return; }
      if (!title) { showAdminToast('⚠ Entrez un titre', '#f59e0b', '#1c1917'); return; }
      showAdminToast('📤 Envoi en cours...', '#8b5cf6', '#fff');
      try {
        if (!auth.currentUser) throw new Error('Non connecté');
        const idToken = await auth.currentUser.getIdToken();
        const resp = await fetch('https://us-central1-optitank-c7709.cloudfunctions.net/sendPushNotif', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${idToken}` },
          body: JSON.stringify({ data: { token, title, body, data: url ? { url } : undefined } }),
        });
        const result = await resp.json();
        if (!resp.ok) throw new Error(result.error || 'Erreur serveur');
        showAdminToast('✓ Notification envoyée avec succès', '#22c55e', '#052e16');
      } catch(e) {
        showAdminToast('✗ Erreur: ' + (e.message || e), '#ef4444', '#fff');
      }
    });

    document.getElementById('adm-send-push-all')?.addEventListener('click', async () => {
      const title = document.getElementById('adm-push-title')?.value.trim();
      const body  = document.getElementById('adm-push-body')?.value.trim();
      const url   = document.getElementById('adm-push-url')?.value.trim();
      const tokens = window.__adminPushTokens || [];
      if (tokens.length === 0) { showAdminToast("⚠ Veuillez d'abord actualiser la liste des appareils (aucun appareil trouvé)", '#f59e0b', '#1c1917'); return; }
      if (!title) { showAdminToast('⚠ Entrez un titre', '#f59e0b', '#1c1917'); return; }
      if (!confirm(`Envoyer "${title}" à ${tokens.length} appareils ?`)) return;
      showAdminToast(`📤 Envoi à ${tokens.length} appareils en cours...`, '#ec4899', '#fff');
      try {
        if (!auth.currentUser) throw new Error('Non connecté');
        const idToken = await auth.currentUser.getIdToken();
        const resp = await fetch('https://us-central1-optitank-c7709.cloudfunctions.net/sendPushNotif', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${idToken}` },
          body: JSON.stringify({ data: { token: tokens, title, body, data: url ? { url } : undefined } }),
        });
        const result = await resp.json();
        if (!resp.ok) throw new Error(result.error || 'Erreur serveur');
        showAdminToast('✓ Notifications envoyées avec succès à tous', '#22c55e', '#052e16');
      } catch(e) {
        showAdminToast('✗ Erreur: ' + (e.message || e), '#ef4444', '#fff');
      }
    });

    document.getElementById('adm-clear-cache').onclick = () => {
      clearStationCache();
      showAdminToast('✓ Cache vidé — les stations seront rechargées au prochain démarrage', '#f59e0b', '#1c1917');
    };

    document.getElementById('adm-reload-stations').onclick = async () => {
      await clearStationCache();
      showAdminToast('🔄 Rechargement en cours...', '#8b5cf6', '#fff');
      try {
        const { fetchAllStations: fetch_ } = await import('./api.js');
        allStations = await fetch_();
        if (typeof renderMarkersProgressive === 'function') renderMarkersProgressive();
        showAdminToast(`✓ ${allStations.length} stations rechargées`, '#22c55e', '#052e16');
      } catch(e) { showAdminToast('✗ Erreur lors du rechargement', '#ef4444', '#fff'); }
    };

    document.getElementById('adm-sync-pt')?.addEventListener('click', async () => {
      const btn = document.getElementById('adm-sync-pt');
      if (!auth.currentUser) { showAdminToast('✗ Connecte-toi en admin', '#ef4444', '#fff'); return; }
      btn.disabled = true;
      showAdminToast('🇵🇹 Agrégation DGEG en cours (≈1 min)...', '#0f766e', '#fff');
      try {
        const idToken = await auth.currentUser.getIdToken();
        const resp = await fetch('https://us-central1-optitank-c7709.cloudfunctions.net/syncPortugalNow', {
          headers: { 'Authorization': `Bearer ${idToken}` },
        });
        const data = await resp.json();
        if (!resp.ok) throw new Error(data.error || 'Erreur');
        await clearStationCache(['fillz_stations_pt_v1']);
        showAdminToast(`✓ Portugal mis à jour (${data.count} stations)`, '#22c55e', '#052e16');
      } catch (e) {
        showAdminToast('✗ ' + e.message, '#ef4444', '#fff');
      }
      btn.disabled = false;
    });

    document.getElementById('adm-export-json').onclick = () => {
      const blob = new Blob([JSON.stringify(allStations, null, 2)], {type:'application/json'});
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `optitank-stations-${new Date().toISOString().slice(0,10)}.json`;
      a.click();
    };

    document.getElementById('adm-publish-version').onclick = async () => {
      const newVer = document.getElementById('adm-version-input').value.trim();
      if (!newVer) return;
      try {
        await setDoc(doc(db, 'app_config', 'settings'), { app_version: newVer }, { merge: true });
        localStorage.setItem('fillz_app_version', newVer);
        showAdminToast(`🚀 Version ${newVer} publiée — tous les appareils seront mis à jour`, '#8b5cf6', '#fff');
      } catch(e) { showAdminToast('✗ Erreur Firestore', '#ef4444', '#fff'); }
    };

    document.getElementById('adm-export-csv').onclick = () => {
      const fuels = ['SP95','SP98','Diesel','GPL'];
      const header = ['id','name','brand','address','lat','lng',...fuels].join(';');
      const rows = allStations.map(s => [s.id, `"${s.name}"`, `"${s.brand}"`, `"${s.address}"`, s.lat, s.lng, ...fuels.map(f=>s.prices[f]||'')].join(';'));
      const blob = new Blob([[header,...rows].join('\n')], {type:'text/csv;charset=utf-8;'});
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `optitank-prix-${new Date().toISOString().slice(0,10)}.csv`;
      a.click();
    };

    // Wire up toggles with real handlers
    overlay.querySelectorAll('[id$="-wrap"][data-key]').forEach(wrap => {
      wrap.addEventListener('click', () => {
        if (wrap.dataset.disabled === '1') return; // pays pas encore branché
        const isOn = wrap.dataset.on === '1';
        const newOn = !isOn;
        wrap.dataset.on = newOn ? '1' : '0';
        const thumb = wrap.querySelector('div');
        thumb.style.transform = newOn ? 'translateX(22px)' : 'translateX(2px)';
        wrap.style.background = newOn ? '#8b5cf6' : '#e2e8f0';
        const key = wrap.dataset.key;
        // Pays activables : convention 'true'/'false' (lue par fetchAllStations + au chargement).
        const country = COUNTRIES.find(c => c.enableKey === key);
        if (country) localStorage.setItem(key, newOn ? 'true' : 'false');
        else if (newOn) localStorage.setItem(key, '1');
        else localStorage.removeItem(key);
        // Apply effects immediately
        if (key === 'fillz_maintenance') applyMaintenanceBanner(newOn);
        if (key === 'fillz_update_mode') applyUpdateMode(newOn);
        // Persist to Firestore so all devices are affected
        const firestoreKey = { fillz_maintenance: 'maintenance', fillz_update_mode: 'update_mode' }[key];
        if (firestoreKey) {
          setDoc(doc(db, 'app_config', 'settings'), { [firestoreKey]: newOn }, { merge: true }).catch(() => {});
          showAdminToast(newOn ? `✓ Activé sur tous les appareils` : `✓ Désactivé sur tous les appareils`, '#22c55e', '#052e16');
        } else if (country) {
          if (key === 'fillz_enable_france') window.enableFranceConfig = newOn;
          // Propage l'activation à tous les appareils via Firestore.
          if (country.cfg) setDoc(doc(db, 'app_config', 'settings'), { [country.cfg]: newOn }, { merge: true }).catch(() => {});
          showAdminToast(`🔄 ${newOn ? 'Chargement' : 'Suppression'} des stations ${country.flag}...`, '#8b5cf6', '#fff');
          import('./api.js').then(({ fetchAllStations: fetch_ }) => {
            fetch_().then(data => {
              allStations = data;
              if (typeof renderMarkersProgressive === 'function') renderMarkersProgressive();
              if (typeof window.triggerMapLayerUpdate === 'function') window.triggerMapLayerUpdate();
              showAdminToast(newOn ? `✓ ${country.label} activé (${data.length} stations au total)` : `✓ ${country.label} désactivé`, '#22c55e', '#052e16');
            });
          });
        } else if (key === 'fillz_force_demo') {
          if (newOn) {
            allStations = [
              { id:'f1', name:'Garage Emery Sàrl', address:'Route de Sullens 9, 1303 Penthaz', lat:46.5947, lng:6.5413, prices:{SP95:'1.920',Diesel:'2.230'}, city:'Penthaz' },
              { id:'f2', name:'Station Bavois', address:'Autoroute A1, 1372 Bavois', lat:46.6833, lng:6.5667, prices:{SP95:'1.950',Diesel:'2.100'}, city:'Bavois' },
            ];
            if (typeof renderMarkersProgressive === 'function') renderMarkersProgressive();
            if (typeof window.triggerMapLayerUpdate === 'function') window.triggerMapLayerUpdate();
            showAdminToast(`✓ Mode Démo Activé`, '#22c55e', '#052e16');
          } else {
            showAdminToast('🔄 Rechargement des vraies stations...', '#8b5cf6', '#fff');
            import('./api.js').then(({ fetchAllStations: fetch_ }) => {
              fetch_().then(data => {
                allStations = data;
                if (typeof renderMarkersProgressive === 'function') renderMarkersProgressive();
                if (typeof window.triggerMapLayerUpdate === 'function') window.triggerMapLayerUpdate();
                showAdminToast(`✓ Mode Démo Désactivé`, '#22c55e', '#052e16');
              });
            });
          }
        } else if (key === 'optitank_swiss_borders' || key === 'optitank_swiss_cities') {
          if (typeof window.triggerMapLayerUpdate === 'function') window.triggerMapLayerUpdate();
        }
      });
    });

    // ── Charger les tokens push enregistrés ────────────────
    async function loadPushTokens() {
      const listEl = document.getElementById('adm-tokens-list');
      if (!listEl) return;
      listEl.innerHTML = '<div style="font-size:12px;color:#94a3b8;text-align:center;padding:16px;">Chargement...</div>';
      try {
        const entries = [];
        const snap = await getDocs(collection(db, 'push_tokens'));
        snap.docs.forEach(d => {
          const data = d.data();
          const token = data.token || data.apnsToken || d.id;
          if (token) entries.push({ token, uid: data.uid, platform: data.platform || 'ios' });
        });
        if (entries.length === 0) {
          listEl.innerHTML = '<div style="font-size:12px;color:#94a3b8;text-align:center;padding:16px;">Aucun appareil enregistré</div>';
          return;
        }
        listEl.innerHTML = entries.map(({ token, uid, platform }) => {
          window.__adminPushTokens = entries.map(e => e.token);
          const short = token.length > 24 ? token.slice(0, 24) + '…' : token;
          return `<div style="padding:8px 10px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;cursor:pointer;margin-bottom:4px;" onclick="document.getElementById('adm-push-token').value='${token.replace(/'/g, "\\'")}';this.style.background='#ede9fe';">
            <div style="font-size:11px;font-weight:700;color:#1e293b;">${platform} — ${uid ? uid.slice(0,8) + '…' : 'anonyme'}</div>
            <div style="font-size:10px;color:#94a3b8;font-family:monospace;margin-top:2px;">${short}</div>
          </div>`;
        }).join('');
      } catch(e) {
        listEl.innerHTML = `<div style="font-size:12px;color:#ef4444;text-align:center;padding:16px;">Erreur: ${e.message}</div>`;
      }
    }
    document.getElementById('adm-load-tokens')?.addEventListener('click', loadPushTokens);
  }

  function applyMaintenanceBanner(show) {
    const existing = document.getElementById('maint-banner');
    if (show && !existing) {
      const banner = document.createElement('div');
      banner.id = 'maint-banner';
      banner.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:9997;background:#f59e0b;color:#1c1917;text-align:center;padding:9px;font-size:13px;font-weight:700;letter-spacing:0.2px;';
      banner.textContent = '🚧 Mode maintenance — Application temporairement limitée';
      document.body.prepend(banner);
    } else if (!show && existing) {
      existing.remove();
    }
  }

  function applyUpdateMode(show) {
    const existing = document.getElementById('update-mode-overlay');
    if (show && !existing) {
      if (!document.getElementById('update-mode-styles')) {
        const style = document.createElement('style');
        style.id = 'update-mode-styles';
        style.textContent = `
          @keyframes barrierSlide{from{background-position:0 0}to{background-position:44px 0}}
          @keyframes fueloFloat{0%,100%{transform:translateY(0) rotate(-3deg)}50%{transform:translateY(-16px) rotate(3deg)}}
          @keyframes wrenchSlow{0%,100%{transform:rotate(-20deg)}50%{transform:rotate(20deg)}}
          @keyframes dotBounce{0%,80%,100%{transform:scale(0.6);opacity:0.3}40%{transform:scale(1.1);opacity:1}}
          @keyframes fadeInScale{from{opacity:0;transform:scale(0.97)}to{opacity:1;transform:scale(1)}}
        `;
        document.head.appendChild(style);
      }
      const overlay = document.createElement('div');
      overlay.id = 'update-mode-overlay';
      overlay.style.cssText = 'position:fixed;inset:0;z-index:9990;background:#09090b;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:32px;animation:fadeInScale 0.5s ease;';
      overlay.innerHTML = `
        <div style="width:min(300px,88%);height:20px;border-radius:6px;
          background:repeating-linear-gradient(90deg,#fbbf24 0,#fbbf24 22px,#27272a 22px,#27272a 44px);
          animation:barrierSlide 2.4s linear infinite;
          margin-bottom:52px;"></div>
        <div style="position:relative;display:inline-flex;">
          <div style="animation:fueloFloat 3s ease-in-out infinite;">${FUELO_SVG}</div>
          <div style="position:absolute;bottom:6px;right:-22px;font-size:26px;
            animation:wrenchSlow 2.8s ease-in-out infinite;
            transform-origin:bottom left;">🔧</div>
        </div>
        <div style="margin-top:36px;text-align:center;">
          <h2 style="color:#fff;font-size:24px;font-weight:800;margin:0 0 8px;letter-spacing:-0.3px;">Mise à jour en cours…</h2>
          <p style="color:rgba(255,255,255,0.4);font-size:13px;margin:0 0 28px;line-height:1.6;">
            OptiTank revient très bientôt<br>Merci de votre patience 🇨🇭
          </p>
          <div style="display:flex;gap:10px;justify-content:center;">
            <div style="width:9px;height:9px;background:#a78bfa;border-radius:50%;animation:dotBounce 1.6s ease-in-out 0s infinite;"></div>
            <div style="width:9px;height:9px;background:#818cf8;border-radius:50%;animation:dotBounce 1.6s ease-in-out 0.53s infinite;"></div>
            <div style="width:9px;height:9px;background:#c4b5fd;border-radius:50%;animation:dotBounce 1.6s ease-in-out 1.06s infinite;"></div>
          </div>
        </div>
        <div style="width:min(300px,88%);height:20px;border-radius:6px;
          background:repeating-linear-gradient(-90deg,#fbbf24 0,#fbbf24 22px,#27272a 22px,#27272a 44px);
          animation:barrierSlide 2.4s linear infinite;
          margin-top:52px;"></div>
      `;
      document.body.appendChild(overlay);
    } else if (!show && existing) {
      existing.style.opacity = '0';
      existing.style.transition = 'opacity 0.5s ease';
      setTimeout(() => existing.remove(), 500);
    }
  }

  // Apply local flags immediately (no latency)
  if (localStorage.getItem('fillz_maintenance')) applyMaintenanceBanner(true);
  if (localStorage.getItem('fillz_update_mode')) applyUpdateMode(true);

  // Then sync with Firestore for cross-device propagation
  try {
    onSnapshot(doc(db, 'app_config', 'settings'), async (cfgSnap) => {
      if (!cfgSnap.exists()) return;
      const cfg = cfgSnap.data();

      // Sync maintenance & update mode
      const maint = !!cfg.maintenance;
      const upd   = !!cfg.update_mode;
      if (maint !== !!localStorage.getItem('fillz_maintenance')) {
        if (maint) localStorage.setItem('fillz_maintenance', '1'); else localStorage.removeItem('fillz_maintenance');
        applyMaintenanceBanner(maint);
      }
      if (upd !== !!localStorage.getItem('fillz_update_mode')) {
        if (upd) localStorage.setItem('fillz_update_mode', '1'); else localStorage.removeItem('fillz_update_mode');
        applyUpdateMode(upd);
      }

      // Sync de l'activation des pays (propagée à tous les appareils).
      let countryChanged = false;
      COUNTRIES.forEach(c => {
        if (!c.cfg) return;
        const want = !!cfg[c.cfg];
        if (want !== (localStorage.getItem(c.enableKey) === 'true')) {
          localStorage.setItem(c.enableKey, want ? 'true' : 'false');
          if (c.code === 'FR') window.enableFranceConfig = want;
          countryChanged = true;
        }
      });
      if (countryChanged) {
        fetchAllStations().then(data => {
          allStations = data;
          _stationPreload = Promise.resolve(data); // évite que loadMapData réutilise l'ancien préchargement
          if (dataLoaded && mapInstance && typeof renderMarkersProgressive === 'function') renderMarkersProgressive();
        }).catch(() => {});
      }

      // Version check → force SW cache clear + reload if version changed
      // Skip when admin panel is open (would cause infinite reload loop)
      const remoteVersion = cfg.app_version || '1.0.0';
      const localVersion  = localStorage.getItem('fillz_app_version') || '1.0.0';
      if (remoteVersion !== localVersion && !_ADMIN_ROUTE) {
        localStorage.setItem('fillz_app_version', remoteVersion);
        try {
          if ('caches' in window) {
            const names = await caches.keys();
            await Promise.all(names.map(n => caches.delete(n)));
          }
          const reg = await navigator.serviceWorker?.getRegistration();
          if (reg) await reg.update();
        } catch(_) {}
        location.reload(true);
      }
    });
  } catch(e) {
    console.error('Config sync error:', e);
  }

  function showAdminToast(msg, bg, color) {
    const t = document.createElement('div');
    t.style.cssText = `position:fixed;bottom:80px;left:50%;transform:translateX(-50%);background:${bg};color:${color};padding:10px 20px;border-radius:20px;font-size:13px;font-weight:700;z-index:99999;white-space:nowrap;box-shadow:0 4px 20px rgba(0,0,0,0.2);`;
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 3000);
  }

  // Admin auto-open is handled inside onAuthStateChanged to ensure currentUser is set

  // ── MAP THEMES ─────────────────────────────────────────
  const MAP_TILES = {
    dark: { url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', opts: { subdomains: 'abcd', maxZoom: 19 } },
    light: { url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', opts: { subdomains: 'abcd', maxZoom: 19 } },
    satellite: { url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', opts: { maxZoom: 19 } }
  };

  function setMapTheme(name) {
    if (!mapInstance) return;
    currentMapTheme = name;
    localStorage.setItem('fillz_map_theme', name);
    if (tileLayer) mapInstance.removeLayer(tileLayer);
    tileLayer = L.tileLayer(MAP_TILES[name].url, MAP_TILES[name].opts).addTo(mapInstance);
    document.getElementById('leaflet-map').className = 'theme-' + name;
  }

  // ── Widget iOS — mise à jour des données ───────────────
  function sendWidgetUpdate() {
    if (!window.isOptiTankApp || !window.OptiTankBridge || !allStations.length) return;
    const fuel = selectedFuel || 'SP95';
    const deg2rad = d => d * Math.PI / 180;
    const calcDistNum = (lat1, lng1, lat2, lng2) => {
      const dLat = deg2rad(lat2-lat1), dLng = deg2rad(lng2-lng1);
      const a = Math.sin(dLat/2)**2 + Math.cos(deg2rad(lat1))*Math.cos(deg2rad(lat2))*Math.sin(dLng/2)**2;
      return 6371*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
    };
    const calcDist = (lat1, lng1, lat2, lng2) => calcDistNum(lat1, lng1, lat2, lng2).toFixed(1);
    // IQR outlier filter — same logic as the radar scan
    const allPrices = allStations.filter(s => s.prices[fuel]).map(s => parseFloat(s.prices[fuel])).sort((a, b) => a - b);
    let priceLowerBound = 0;
    if (allPrices.length >= 8) {
      const q1 = allPrices[Math.floor(allPrices.length * 0.25)];
      const q3 = allPrices[Math.floor(allPrices.length * 0.75)];
      priceLowerBound = q1 - 1.5 * (q3 - q1);
    }
    const nearby = allStations
      .filter(s => s.prices[fuel] && parseFloat(s.prices[fuel]) >= priceLowerBound && calcDistNum(userLat, userLng, s.lat, s.lng) <= 25)
      .sort((a, b) => parseFloat(a.prices[fuel]) - parseFloat(b.prices[fuel]));
    if (!nearby.length) return;
    const top = nearby.slice(0, 4);
    const best = top[0];
    const selSt = widgetStationId ? allStations.find(s => s.id === widgetStationId) : null;
    const selectedStation = selSt && selSt.prices[fuel] ? {
      name: selSt.name, price: selSt.prices[fuel],
      distance: calcDist(userLat, userLng, selSt.lat, selSt.lng),
      id: selSt.id
    } : null;
    const favStations = favorites
      .map(id => allStations.find(s => s.id === id))
      .filter(s => s && s.prices[fuel])
      .map(s => ({ name: s.name, price: s.prices[fuel], distance: calcDist(userLat, userLng, s.lat, s.lng), id: s.id }));
    window.OptiTankBridge.post({
      type: 'updateWidget',
      payload: {
        bestPrice: best.prices[fuel],
        stationName: best.name,
        distance: calcDist(userLat, userLng, best.lat, best.lng),
        fuelType: fuel,
        stations: top.map(s => ({ name: s.name, price: s.prices[fuel], distance: calcDist(userLat, userLng, s.lat, s.lng), id: s.id })),
        favorites: favStations,
        selectedStation: selectedStation,
        priceHistory: [],
        updatedAt: new Date().toISOString(),
      }
    });
  }

  // ── MAP DATA ───────────────────────────────────────────
  let backgroundLoadTimer = null;
  // Signature de l'état affiché : évite de reconstruire les 20k+ marqueurs à
  // chaque déplacement de carte quand ni le filtre ni les données n'ont changé.
  let renderedMarkersSig = null;
  function markersSig() {
    return `${selectedFuel}|${selectedBrandFilter}|${allStations.length}`;
  }

  async function loadMapData() {
    if (dataLoaded) { renderMarkersProgressive(); return; }
    const loader = document.getElementById('map-loader');
    if (loader) loader.classList.add('active');
    
    // Add safety timeout
    let timeoutId = setTimeout(() => {
        if (loader) {
            loader.innerHTML = '<i class="ph-bold ph-warning" style="font-size:32px; color:#ef4444; margin-bottom:12px;"></i><p>Connexion lente...</p>';
            setTimeout(() => loader.classList.remove('active'), 3000);
        }
    }, 10000);

    try {
      // Prefer the background preload kicked off at DOMContentLoaded — instant if it already resolved.
      allStations = await _stationPreload;
      if (!allStations || !allStations.length) allStations = await fetchAllStations();
    } catch(err) {
      console.error(err);
      allStations = [];
    }

    clearTimeout(timeoutId);

    if (!allStations.length) {
      allStations = [
        { id:'f1', name:'Garage Emery Sàrl', address:'Route de Sullens 9, 1303 Penthaz', lat:46.5947, lng:6.5413, prices:{SP95:'1.920',Diesel:'2.230'} },
        { id:'f2', name:'Station Bavois', address:'Autoroute A1, 1372 Bavois', lat:46.6833, lng:6.5667, prices:{SP95:'1.950',Diesel:'2.100'} },
      ];
      if (loader) {
        loader.innerHTML = '<p>Mode Hors-ligne (Démo)</p>';
        setTimeout(() => loader.classList.remove('active'), 2000);
      }
    } else {
      if (loader) loader.classList.remove('active');
    }
    
    dataLoaded = true;
    recordDailyPrices();
    populateBrandDropdown();
    renderMarkersProgressive();
    refreshProfile();
    sendWidgetUpdate();
  }

  function populateBrandDropdown() {
    const brandDD = document.getElementById('brand-dropdown');
    if (!brandDD) return;
    
    // Extract unique brands from station name/brand fields
    const brandSet = new Set();
    allStations.forEach(s => {
      let b = s.brand || '';
      if (!b && s.name) {
        // Simple heuristic: First word of name could be brand (e.g. "Shell Lausanne" -> "Shell")
        b = s.name.split(' ')[0];
      }
      if (b && b.length > 1) {
        brandSet.add(b.charAt(0).toUpperCase() + b.slice(1).toLowerCase());
      }
    });

    // Known common brands to prioritize or ensure they exist
    const commonBrands = ['Toutes', 'Agla', 'Avia', 'Bp', 'Coop', 'Eni', 'Jubin', 'Migrol', 'Migrolino', 'Mini-Prix', 'Ruedi', 'Shell', 'Socar', 'Tamoil'];
    const finalBrands = new Set([...commonBrands, ...Array.from(brandSet)]);

    let html = '<div class="dropdown-item" data-brand="Toutes">Toutes les marques</div>';
    Array.from(finalBrands).sort().forEach(brand => {
      if (brand !== 'Toutes') {
        html += `<div class="dropdown-item" data-brand="${brand}">${brand}</div>`;
      }
    });
    brandDD.innerHTML = html;

    // Add listeners
    brandDD.querySelectorAll('.dropdown-item').forEach(it => it.addEventListener('click', () => {
      selectedBrandFilter = it.dataset.brand;
      const displayBrand = selectedBrandFilter === 'Toutes' ? 'Toutes' : selectedBrandFilter;
      document.getElementById('chip-brand').innerHTML = `<i class="ph ph-storefront"></i> ${displayBrand} <i class="ph ph-caret-down"></i>`;
      brandDD.classList.remove('visible'); 
      renderMarkers();
    }));
  }

  function getFilteredStations() {
    let f = allStations.filter(s => s.prices[selectedFuel]);
    
    if (selectedBrandFilter !== 'Toutes') {
      f = f.filter(s => {
        const stationName = (s.name || '').toLowerCase();
        const stationBrand = (s.brand || '').toLowerCase();
        const filterStr = selectedBrandFilter.toLowerCase();
        return stationName.includes(filterStr) || stationBrand.includes(filterStr);
      });
    }

    if (sortBy === 'price') f.sort((a, b) => parseFloat(a.prices[selectedFuel]) - parseFloat(b.prices[selectedFuel]));
    else f.sort((a, b) => a.name.localeCompare(b.name));
    return f;
  }

  // Get stations inside current map bounds
  function getStationsInView() {
    if (!mapInstance) return [];
    const bounds = mapInstance.getBounds();
    // Expand bounds slightly
    const expanded = bounds.pad(0.1);
    return getFilteredStations().filter(s => expanded.contains([s.lat, s.lng]));
  }

  function createMarker(s, avgPrice = null) {
    let colorClass = 'marker-avg';
    const price = parseFloat(s.prices[selectedFuel]);
    
    if (avgPrice && price) {
      if (price <= avgPrice - 0.02) colorClass = 'marker-cheap';
      else if (price >= avgPrice + 0.02) colorClass = 'marker-expensive';
    }
    
    const prefix = currencyFor(s.country);
    const icon = L.divIcon({ 
      className: 'custom-marker', 
      html: `<div class="marker-pill ${colorClass}"><i class="ph-fill ph-gas-pump"></i> ${prefix} ${s.prices[selectedFuel]}</div>`, 
      iconSize: [120, 36], 
      iconAnchor: [60, 18] 
    });
    const m = L.marker([s.lat, s.lng], { icon });
    m.on('click', () => showBottomSheet(s));
    return m;
  }

  function renderMarkers() {
    renderMarkersProgressive();
  }

  function renderMarkersProgressive() {
    if (!mapInstance) return;
    if (markersLayer) mapInstance.removeLayer(markersLayer);
    if (backgroundLoadTimer) clearTimeout(backgroundLoadTimer);
    renderedMarkersSig = null;
    const sig = markersSig();

    markersLayer = L.markerClusterGroup({
      maxClusterRadius: 60, disableClusteringAtZoom: 14,
      showCoverageOnHover: false, spiderfyOnMaxZoom: true,
      chunkedLoading: true, chunkInterval: 200, chunkDelay: 50,
      iconCreateFunction(cluster) {
        const c = cluster.getChildCount();
        const sz = c > 50 ? 'large' : c > 20 ? 'medium' : 'small';
        return L.divIcon({ html: `<div class="cluster-icon cluster-${sz}">${c}</div>`, className: 'custom-cluster', iconSize: [44, 44] });
      }
    });

    const allFiltered = getFilteredStations();
    const inView = getStationsInView();
    const inViewIds = new Set(inView.map(s => s.id));

    // Calcul de la moyenne des prix pour les Smart Pins
    let totalPrice = 0, validCount = 0;
    allFiltered.forEach(s => {
      const p = parseFloat(s.prices[selectedFuel]);
      if (p > 0) { totalPrice += p; validCount++; }
    });
    const avgPrice = validCount > 0 ? totalPrice / validCount : null;

    // Phase 1: Render visible stations immediately (addLayers = insertion en
    // masse chunkée du plugin cluster, bien plus rapide que addLayer un à un)
    markersLayer.addLayers(inView.map(s => createMarker(s, avgPrice)));
    mapInstance.addLayer(markersLayer);

    const countEl = document.getElementById('chip-count');
    if (countEl) countEl.innerHTML = `<i class="ph ph-map-trifold"></i> ${allFiltered.length} stations`;

    // Phase 2: Load remaining stations in background (after 300ms)
    backgroundLoadTimer = setTimeout(() => {
      const remaining = allFiltered.filter(s => !inViewIds.has(s.id));
      markersLayer.addLayers(remaining.map(s => createMarker(s, avgPrice)));
      renderedMarkersSig = sig;
    }, 300);
  }

  function initMap() {
    if (mapInstance) return;
    // Start centered on Switzerland, then fly to user
    mapInstance = L.map('leaflet-map', { 
      zoomControl: false,
      attributionControl: false 
    }).setView([46.8182, 8.2275], 8); // Start at Swiss map center
    
    if (hasGeoloc) {
      mapInstance.setView([userLat, userLng], 13);
    } else if (window.userPreloadLat && window.userPreloadLng) {
      userLat = window.userPreloadLat; userLng = window.userPreloadLng; hasGeoloc = true;
      mapInstance.setView([userLat, userLng], 13);
    }
    tileLayer = L.tileLayer(MAP_TILES[currentMapTheme].url, MAP_TILES[currentMapTheme].opts).addTo(mapInstance);
    document.getElementById('leaflet-map').classList.add('theme-' + currentMapTheme);
    const userIcon = L.divIcon({ className: 'user-marker', html: '<div class="user-dot"></div>', iconSize: [24, 24], iconAnchor: [12, 12] });
    if (localStorage.getItem('fillz_location_granted') !== '0') {
      window.getAppLocation(
        p => {
          userLat = p.coords.latitude; userLng = p.coords.longitude;
          mapInstance.flyTo([userLat, userLng], 13, { animate: true, duration: 0.8 });
          if (window.userMarker) {
            window.userMarker.setLatLng([userLat, userLng]);
          } else {
            window.userMarker = L.marker([userLat, userLng], { icon: userIcon }).addTo(mapInstance);
          }
        },
        () => {}
      );
    }
    // Au move-end, ne reconstruire que si tous les marqueurs ne sont pas déjà
    // affichés — une fois la phase 2 terminée, un déplacement ne change rien.
    mapInstance.on('moveend', () => {
      if (dataLoaded && renderedMarkersSig !== markersSig()) renderMarkersProgressive();
    });
    loadMapData();

    // GPS Locate Button Logic
    document.getElementById('btn-gps-locate')?.addEventListener('click', () => {
      if (!mapInstance) return;
      const btn = document.getElementById('btn-gps-locate');
      const ico = btn.querySelector('i');
      ico.className = 'ph-fill ph-spinner-gap spin';
      localStorage.setItem('fillz_location_granted', '1');
      window.getAppLocation(
        p => {
          userLat = p.coords.latitude; 
          userLng = p.coords.longitude;
          mapInstance.flyTo([userLat, userLng], 14, { animate: true, duration: 1.2 });
          
          if (window.userMarker) {
            window.userMarker.setLatLng([userLat, userLng]);
          } else {
            window.userMarker = L.marker([userLat, userLng], { icon: userIcon }).addTo(mapInstance);
          }
          setTimeout(() => ico.className = 'ph ph-crosshair', 1000);
        },
        () => {
          ico.className = 'ph ph-crosshair';
        }
      );
    });

    // Swiss Overlay Logic
    let swissOverlayLayer = null;

    window.triggerMapLayerUpdate = function() {
      try {
        if (swissOverlayLayer && mapInstance) {
          mapInstance.removeLayer(swissOverlayLayer);
          swissOverlayLayer = null;
        }
        loadSwissOverlay();
      } catch (err) {
        console.error(err);
      }
    };

    window.triggerMapLayerUpdate();

    function loadSwissOverlay() {
      try {
        const showBorders = localStorage.getItem('optitank_swiss_borders') === '1';
        const showCities = localStorage.getItem('optitank_swiss_cities') === '1';
        if (!showBorders && !showCities) return;

        swissOverlayLayer = L.layerGroup();
        
        // Load GeoJSON
        if (showBorders) {
          fetch('/coverage.geojson')
            .then(res => res.json())
            .then(data => {
              L.geoJSON(data, {
                style: {
                  color: '#8B84FF',
                  weight: 2,
                  opacity: 0.6,
                  fillColor: '#8B84FF',
                  fillOpacity: 0.02,
                  dashArray: '5, 8'
                },
                interactive: false
              }).addTo(swissOverlayLayer);
            }).catch(err => console.error('Overlay geojson error:', err));
        }
          
        // Add Cities
        if (showCities && allStations.length > 0) {
          const cityMap = new Map(); // name -> {latSum, lngSum, count}
          allStations.forEach(st => {
            if (st.city && st.lat && st.lng) {
               const c = st.city.trim().toUpperCase();
               if (!cityMap.has(c)) cityMap.set(c, {latSum:0, lngSum:0, count:0, name: st.city.trim()});
               const data = cityMap.get(c);
               data.latSum += parseFloat(st.lat);
               data.lngSum += parseFloat(st.lng);
               data.count++;
            }
          });

          cityMap.forEach(data => {
            if (data.count >= 2) {
              const avgLat = data.latSum / data.count;
              const avgLng = data.lngSum / data.count;
              L.marker([avgLat, avgLng], {
                icon: L.divIcon({
                  className: 'city-label',
                  html: data.name
                }),
                interactive: false
              }).addTo(swissOverlayLayer);
            }
          });
        }
        
        if (mapInstance && (showBorders || showCities)) {
          swissOverlayLayer.addTo(mapInstance);
        }
      } catch (e) {
        console.error("Erreur loadSwissOverlay:", e);
      }
    }
  }

  // ── Navigate to station on map ─────────────────────────
  function flyToStation(station) {
    switchView('map');
    setTimeout(() => {
      if (!mapInstance) { initMap(); setTimeout(() => flyToStation(station), 600); return; }
      mapInstance.invalidateSize();
      mapInstance.flyTo([station.lat, station.lng], 16, { animate: true, duration: 1.2 });
      setTimeout(() => showBottomSheet(station), 800);
    }, 150);
  }

  // ── Bottom sheet ───────────────────────────────────────
  let selectedStation = null;
  const bsFavBtn = document.getElementById('bs-fav');
  // Note: Assuming elements exist in DOM based on context
  const bsTitle = document.getElementById('bs-title');
  const bsAddress = document.getElementById('bs-address');
  const bsDistance = document.getElementById('bs-distance');
  const bsOpen = document.getElementById('bs-open');
  const bsPrices = document.getElementById('bs-prices');

  bsFavBtn?.addEventListener('click', () => {
    if (!selectedStation) return;
    const isFav = favorites.includes(selectedStation.id);
    const favIco = bsFavBtn.querySelector('i');
    
    if (isFav) {
      favorites = favorites.filter(id => id !== selectedStation.id);
      favIco.classList.replace('ph-fill', 'ph');
      favIco.style.color = '';
    } else {
      favorites.push(selectedStation.id);
      favIco.classList.replace('ph', 'ph-fill');
      favIco.style.color = '#ef4444';
    }
    
    localStorage.setItem('fillz_favs', JSON.stringify(favorites));
    syncToFirestore();
    sendWidgetUpdate();
  });

  document.getElementById('bs-share')?.addEventListener('click', () => {
    if (!selectedStation || !navigator.share) {
      if (!navigator.share) showToast('Partage natif non supporté sur cet appareil', 'orange');
      return;
    }
    const price = selectedStation.prices[selectedFuel] || Object.values(selectedStation.prices)[0];
    const currency = currencyFor(selectedStation.country);
    navigator.share({
      title: 'OptiTank',
      text: `Regarde ce prix : ${currency} ${parseFloat(price).toFixed(3)} à la station ${selectedStation.brand || selectedStation.name} ! ⛽️`,
      url: window.location.href
    }).catch(console.error);
  });

  const bsheet = document.getElementById('station-bottom-sheet');
  function showBottomSheet(st) {
    selectedStation = st;
    const bsTitle = document.getElementById('bs-title');
    const bsAddress = document.getElementById('bs-address');
    const bsDistance = document.getElementById('bs-distance');
    const bsPrices = document.getElementById('bs-prices');

    if (bsTitle) bsTitle.textContent = st.name;
    if (bsAddress) bsAddress.textContent = st.address;
    if (bsDistance) bsDistance.textContent = getDistKm(userLat, userLng, st.lat, st.lng).toFixed(1) + ' km';
    
    let pricesHTML = '<div class="sheet-prices">';
    const vTank = getTankSize();
    // Only show current fuel and maybe one other in bottom sheet to keep it compact
    const fuels = [selectedFuel, ...Object.keys(st.prices).filter(f => f !== selectedFuel)].slice(0, 2);
    
    fuels.forEach(f => {
      const val = st.prices[f];
      if (!val) return;
      const price = parseFloat(val);
      pricesHTML += `
        <div class="price-item">
          <span class="fuel-type">${f}</span>
          <span class="price">CHF ${price.toFixed(3)}</span>
        </div>`;
    });
    pricesHTML += '</div>';
    if (bsPrices) bsPrices.innerHTML = pricesHTML;
    
    const bsFavBtn = document.getElementById('bs-fav');
    if (bsFavBtn) {
      const isFav = favorites.includes(st.id);
      const favIco = bsFavBtn.querySelector('i');
      if (isFav) {
        favIco.className = 'ph-fill ph-heart';
        favIco.style.color = '#ef4444';
      } else {
        favIco.className = 'ph ph-heart';
        favIco.style.color = '';
      }
    }

    bsheet.classList.add('active');
    // Important: Reset any manual translation from swiping
    bsheet.style.transform = 'translateY(0)';
  };

  // ── Swipe to close logic for bottom sheet ──────────────
  let touchStartY = 0;
  let touchCurrentY = 0;
  let isSwiping = false;

  bsheet.addEventListener('touchstart', (e) => {
    touchStartY = e.touches[0].clientY;
    isSwiping = true;
    bsheet.style.transition = 'none'; // Disable transition for direct follow
  }, { passive: true });

  bsheet.addEventListener('touchmove', (e) => {
    if (!isSwiping) return;
    touchCurrentY = e.touches[0].clientY;
    const deltaY = touchCurrentY - touchStartY;
    
    // Only allow swiping down
    if (deltaY > 0) {
      bsheet.style.transform = `translateY(${deltaY}px)`;
    }
  }, { passive: true });

  bsheet.addEventListener('touchend', (e) => {
    if (!isSwiping) return;
    isSwiping = false;
    bsheet.style.transition = 'transform 0.3s cubic-bezier(0.16, 1, 0.3, 1)';
    
    const deltaY = touchCurrentY - touchStartY;
    if (deltaY > 100) { // Threshold to close
      bsheet.classList.remove('active');
      bsheet.style.transform = 'translateY(100%)';
    } else {
      bsheet.style.transform = 'translateY(0)';
    }
    // Prevent sticking if minimal movement
    touchStartY = 0;
    touchCurrentY = 0;
  });

  // ── Station Details ────────────────────────────────────
  let detHistoryChart = null;

  async function renderStationHistoryChart(st) {
    const section = document.getElementById('det-history-section');
    const emptyEl = document.getElementById('det-history-empty');
    const fuelLabel = document.getElementById('det-history-fuel');
    const canvas = document.getElementById('det-history-chart');

    if (!section || !canvas) return;

    const availableFuels = Object.keys(st.prices);
    const fuelToShow = availableFuels.includes(selectedFuel) ? selectedFuel : availableFuels[0];
    if (fuelLabel) fuelLabel.textContent = '— ' + fuelToShow;

    section.style.display = 'block';
    canvas.style.opacity = '0.4';

    // Fetch Firestore history (14 jours), fusionner avec localStorage en fallback
    const firestoreHistory = await fetchStationHistory(st.id, 14);
    if (!priceHistory) priceHistory = JSON.parse(localStorage.getItem('fillz_price_history') || '{}');

    // Merge: Firestore wins, localStorage comble les trous
    const merged = {};
    Object.entries(priceHistory).forEach(([d, snap]) => {
      const price = snap?.[st.id]?.prices?.[fuelToShow];
      if (price != null) merged[d] = parseFloat(price);
    });
    Object.entries(firestoreHistory).forEach(([d, prices]) => {
      const price = prices?.[fuelToShow];
      if (price != null) merged[d] = parseFloat(price);
    });

    // Build sorted chart data
    const data = [];
    const labels = [];
    Object.keys(merged).sort().forEach(d => {
      const [, m, day] = d.split('-');
      labels.push(`${day}.${m}`);
      data.push(merged[d]);
    });

    // Ajouter le prix live du jour si absent
    const today = new Date().toISOString().slice(0, 10);
    const todayLabel = today.split('-').slice(1).reverse().join('.');
    const livePrice = st.prices[fuelToShow] ? parseFloat(st.prices[fuelToShow]) : null;
    if (livePrice && (labels.length === 0 || labels[labels.length - 1] !== todayLabel)) {
      data.push(livePrice);
      labels.push(todayLabel);
    }

    // Guard: si la station a changé de vue entre-temps, ne pas rendre
    if (!selectedStation || selectedStation.id !== st.id) return;

    canvas.style.opacity = '1';

    const validData = data.filter(Boolean);
    if (validData.length < 2) {
      if (emptyEl) emptyEl.style.display = 'block';
      canvas.style.opacity = '0.3';
      return;
    } else {
      if (emptyEl) emptyEl.style.display = 'none';
    }

    if (detHistoryChart) { detHistoryChart.destroy(); detHistoryChart = null; }

    const ctx = canvas.getContext('2d');
    const minVal = Math.min(...validData) - 0.02;
    const maxVal = Math.max(...validData) + 0.02;

    detHistoryChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          data,
          borderColor: '#c084fc',
          backgroundColor: 'rgba(192,132,252,0.12)',
          borderWidth: 2,
          pointBackgroundColor: '#c084fc',
          pointRadius: data.length <= 7 ? 4 : 3,
          pointHoverRadius: 6,
          tension: 0.4,
          fill: true,
          spanGaps: true,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 400 },
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: 'rgba(20,20,20,0.95)',
            borderColor: 'rgba(192,132,252,0.3)',
            borderWidth: 1,
            titleColor: '#ccc',
            bodyColor: '#c084fc',
            padding: 10,
            callbacks: {
              label: ctx => ` CHF ${ctx.parsed.y?.toFixed(3)}`
            }
          }
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { color: '#555', font: { size: 10 } },
          },
          y: {
            min: minVal,
            max: maxVal,
            grid: { color: 'rgba(255,255,255,0.05)' },
            ticks: {
              color: '#666',
              font: { size: 10 },
              callback: v => 'CHF ' + v.toFixed(3)
            }
          }
        }
      }
    });
  }

  function showStationDetails(st) {
    selectedStation = st;
    switchView('details');
    
    // Fill text immediately
    const nameEl = document.getElementById('det-name');
    const metaEl = document.getElementById('det-meta');
    const addrEl = document.getElementById('det-full-address');
    const pricesEl = document.getElementById('det-prices');

    if (nameEl) nameEl.textContent = st.name;
    const dist = parseFloat(getDistKm(userLat, userLng, st.lat, st.lng).toFixed(1));
    if (metaEl) metaEl.textContent = `${dist} km · ${st.address}`;
    if (addrEl) addrEl.textContent = st.address;

    // ── Dynamic Badges ─────────────────────────────────
    const badgeDist = document.getElementById('badge-distance');
    if (badgeDist) {
      badgeDist.style.display = 'inline-block';
      if (dist <= 2) {
        badgeDist.textContent = '📍 Très proche';
        badgeDist.style.background = 'rgba(74,222,128,0.15)';
        badgeDist.style.color = 'var(--accent-green)';
      } else if (dist <= 8) {
        badgeDist.textContent = `📍 ${dist} km`;
        badgeDist.style.background = 'rgba(251,191,36,0.15)';
        badgeDist.style.color = '#fbbf24';
      } else {
        badgeDist.textContent = `📍 ${dist} km — Loin`;
        badgeDist.style.background = 'rgba(239,68,68,0.12)';
        badgeDist.style.color = '#ef4444';
      }
    }

    // Cheapest badge: check if this station is best priced in db
    const badgeCheapest = document.getElementById('badge-cheapest');
    if (badgeCheapest && allStations.length > 0 && st.prices[selectedFuel]) {
      const myPrice = parseFloat(st.prices[selectedFuel]);
      const minPrice = Math.min(...allStations.filter(s=>s.prices[selectedFuel]).map(s=>parseFloat(s.prices[selectedFuel])));
      badgeCheapest.style.display = myPrice <= minPrice + 0.002 ? 'inline-block' : 'none';
    }

    // Price trend badge from history
    const badgeTrend = document.getElementById('badge-trend');
    if (badgeTrend) {
      const history = JSON.parse(localStorage.getItem('fillz_price_history') || '{}');
      const days = Object.keys(history).sort();
      const recentPrices = days.slice(-7).map(d => history[d]?.[st.id]?.prices?.[selectedFuel]).filter(Boolean);
      if (recentPrices.length >= 3) {
        const slope = predictPriceTrend(recentPrices);
        badgeTrend.style.display = 'inline-block';
        if (slope > 0.002) {
          badgeTrend.textContent = '📈 Prix en hausse';
          badgeTrend.style.background = 'rgba(239,68,68,0.12)';
          badgeTrend.style.color = '#ef4444';
        } else if (slope < -0.002) {
          badgeTrend.textContent = '📉 Moment idéal';
          badgeTrend.style.background = 'rgba(74,222,128,0.15)';
          badgeTrend.style.color = 'var(--accent-green)';
        } else {
          badgeTrend.textContent = '〰️ Prix stable';
          badgeTrend.style.background = 'rgba(255,255,255,0.06)';
          badgeTrend.style.color = 'var(--text-muted)';
        }
      } else {
        badgeTrend.style.display = 'none';
      }
    }
    
    // Heart icon
    const detFavBtn = document.getElementById('det-fav');
    if (detFavBtn) {
      const isFav = favorites.includes(st.id);
      detFavBtn.querySelector('i').className = isFav ? 'ph-fill ph-heart' : 'ph ph-heart';
      detFavBtn.querySelector('i').style.color = isFav ? '#ef4444' : '';
    }

    // Prices immediate render
    let pricesHTML = '';
    Object.entries(st.prices).forEach(([f, val]) => {
      pricesHTML += `
        <div class="price-detail-card">
          <div class="pdc-label">${f}</div>
          <div class="pdc-val">${parseFloat(val).toFixed(3)}<span class="pdc-unit">CHF/L</span></div>
        </div>`;
    });
    if (pricesEl) pricesEl.innerHTML = pricesHTML;

    // ── Update Time ─────────────────────────────────────
    const updatedEl = document.getElementById('det-updated');
    if (updatedEl && st.updatedAt) {
      const date = new Date(st.updatedAt);
      const diffMs = Date.now() - date.getTime();
      const diffMin = Math.round(diffMs / 60000);
      const diffHrs = Math.round(diffMin / 60);
      const diffDays = Math.round(diffHrs / 24);

      let timeText = "";
      if (diffMin < 60) timeText = `il y a ${diffMin} min`;
      else if (diffHrs < 24) timeText = `il y a ${diffHrs} h`;
      else timeText = `il y a ${diffDays} j`;

      updatedEl.innerHTML = `<i class="ph ph-info"></i> Dernière mise à jour — ${timeText}`;
    } else if (updatedEl) {
      updatedEl.innerHTML = `<i class="ph ph-info"></i> Dernière mise à jour — Inconnue`;
    }


    // DEFERRED map + chart creation to avoid blocking view transition
    requestAnimationFrame(() => {
      setTimeout(() => {
        if (!selectedStation || selectedStation.id !== st.id) return; // Guard
        if (detailsMapInstance) detailsMapInstance.remove();
        detailsMapInstance = L.map('details-preview-map', { 
          zoomControl: false, attributionControl: false, 
          dragging: false, touchZoom: false, scrollWheelZoom: false, 
          doubleClickZoom: false 
        }).setView([st.lat, st.lng], 15);
        L.tileLayer(MAP_TILES[currentMapTheme].url, MAP_TILES[currentMapTheme].opts).addTo(detailsMapInstance);
        L.marker([st.lat, st.lng], { 
          icon: L.divIcon({ className: 'custom-marker', html: `<div class="marker-pill" style="transform:none; left:0; top:0;"><i class="ph-fill ph-gas-pump"></i></div>`, iconSize: [40, 40], iconAnchor: [20, 20] }) 
        }).addTo(detailsMapInstance);
        // Render history chart after map
        renderStationHistoryChart(st);
        
        // Add Widget Logic
        const btnAddWidget = document.getElementById('btn-add-widget');
        if (btnAddWidget) {
          btnAddWidget.onclick = () => {
            const url = new URL(window.location.origin);
            url.searchParams.set('view', 'map');
            url.searchParams.set('station', st.id);
            
            if (deferredPrompt) {
              deferredPrompt.prompt();
              deferredPrompt.userChoice.then((choiceResult) => {
                if (choiceResult.outcome === 'accepted') console.log('User accepted A2HS prompt');
                deferredPrompt = null;
              });
            } else if (navigator.share) {
              navigator.share({
                title: `OptiTank - ${st.name}`,
                text: `Suivre le prix en direct de la station ${st.name}`,
                url: url.toString()
              }).catch(console.error);
            } else {
              // Fallback popup
              alert(`Pour ajouter un widget :\n1. Copiez ce lien: ${url.toString()}\n2. Ouvrez-le dans Safari/Chrome\n3. "Ajouter sur l'écran d'accueil"`);
            }
          };
        }
      }, 350); // Delay until view animation completes
    });
  }

  // ── Radar IA ───────────────────────────────────────────
  async function runRadarScan() {
    const resultsDiv = document.getElementById('radar-results');
    const radarContainer = document.querySelector('.radar-container');
    const savingsBanner = document.getElementById('radar-savings-banner');
    const btn = document.getElementById('btn-radar-scan');
    
    // Reset UI for scanning
    btn.disabled = true;
    btn.innerHTML = '<div class="spinner-small"></div> Analyse...';
    resultsDiv.innerHTML = '';
    if (savingsBanner) savingsBanner.style.display = 'none';
    if (radarContainer) radarContainer.style.display = 'block';

    if (!allStations.length) {
      // Use the background preload if it's already done, else fall back to a fresh fetch
      try { allStations = (await _stationPreload) || []; } catch(_) { allStations = []; }
      if (!allStations.length) allStations = await fetchAllStations();
    }

    const vFuel = getVehicleFuel();
    const tank = getTankSize();
    const conso = FUEL_CONSUMPTION[vFuel] || 7.5;
    const radarSubtitle = document.querySelector('.radar-header p');
    if (radarSubtitle) radarSubtitle.innerHTML = `Classement <strong>${vFuel}</strong> — prix du plein <strong>+</strong> coût du trajet aller-retour`;
    const rangeSelect = document.getElementById('radar-range');
    const RADIUS = rangeSelect ? parseInt(rangeSelect.value, 10) : 40;

    // IQR outlier filter — drops stale/fake prices that lie far below the market median
    const allPricesForFuel = allStations
      .filter(s => s.prices[vFuel])
      .map(s => parseFloat(s.prices[vFuel]))
      .sort((a, b) => a - b);
    let priceLowerBound = 0;
    if (allPricesForFuel.length >= 8) {
      const q1 = allPricesForFuel[Math.floor(allPricesForFuel.length * 0.25)];
      const q3 = allPricesForFuel[Math.floor(allPricesForFuel.length * 0.75)];
      priceLowerBound = q1 - 1.5 * (q3 - q1);
    }

    const scored = allStations
      .filter(s => s.prices[vFuel])
      .filter(s => parseFloat(s.prices[vFuel]) >= priceLowerBound)
      .map(s => {
        const dist = getDistKm(userLat, userLng, s.lat, s.lng);
        const pricePerL = parseFloat(s.prices[vFuel]);
        const fullCost = tank > 0 ? pricePerL * tank : 0;
        const tripCost = tank > 0 ? (dist * 2 * conso / 100) * pricePerL : 0;
        return { ...s, dist, pricePerL, fullCost, tripCost, total: fullCost + tripCost };
      })
      .filter(s => s.dist <= RADIUS)
      .sort((a, b) => a.total - b.total);

    const top = scored.slice(0, 5);

    if (!top.length) {
      if (radarContainer) radarContainer.style.display = 'none';
      resultsDiv.innerHTML = '<p style="text-align:center;color:var(--text-muted);padding:30px">Aucune station trouvée.</p>';
      btn.disabled = false; btn.innerHTML = '<i class="ph-bold ph-brain"></i> Analyser';
      return;
    }

    // Savings banner
    const savingsAmount = document.getElementById('radar-savings-amount');
    if (savingsBanner && savingsAmount && top.length > 1) {
      const avgPrice = top.reduce((s, x) => s + x.pricePerL, 0) / top.length;
      const saved = (avgPrice - top[0].pricePerL) * (tank || 50);
      savingsBanner.style.display = 'block';
      savingsAmount.textContent = `CHF ${Math.max(0, saved).toFixed(2)}`;
    }

    const medalColors = ['#FFD700', '#C0C0C0', '#CD7F32', 'rgba(255,255,255,0.4)', 'rgba(255,255,255,0.3)'];
    const rankLabels = ['🥇', '🥈', '🥉', '4', '5'];

    // #1 hero card
    const best = top[0];
    let html = `<div class="radar-result-card radar-result-hero" data-id="${best.id}" style="
      background:linear-gradient(135deg,rgba(108,99,255,0.18),rgba(0,212,170,0.08));
      border:1px solid rgba(108,99,255,0.35);border-radius:20px;
      padding:18px 16px;margin:0 0 10px;cursor:pointer;animation:fadeSlideIn .3s ease;">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;">
        <div style="display:flex;align-items:center;gap:12px;flex:1;min-width:0;">
          <span style="font-size:28px;">🥇</span>
          <div style="min-width:0;">
            <div style="font-size:15px;font-weight:700;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${best.name}</div>
            <div style="font-size:12px;color:rgba(255,255,255,0.5);margin-top:2px;">${best.dist.toFixed(1)} km${best.brand ? ' · ' + best.brand : ''}</div>
          </div>
        </div>
        <div style="text-align:right;flex-shrink:0;">
          <div style="font-size:22px;font-weight:800;color:#00D4AA;">CHF ${best.pricePerL.toFixed(3)}</div>
          ${tank > 0 ? `<div style="font-size:11px;color:rgba(255,255,255,0.4);">Plein : CHF ${best.fullCost.toFixed(2)}</div>` : ''}
        </div>
      </div>
      <button style="margin-top:12px;width:100%;background:linear-gradient(135deg,#6C63FF,#00D4AA);border:none;border-radius:12px;padding:10px;font-size:14px;font-weight:700;color:#fff;cursor:pointer;">
        <i class="ph-bold ph-navigation-arrow"></i> Aller à cette station
      </button>
    </div>`;

    // #2–5 compact cards
    if (top.length > 1) {
      html += '<div style="display:flex;flex-direction:column;gap:8px;">';
      top.slice(1).forEach((s, i) => {
        html += `<div class="radar-result-card" data-id="${s.id}" style="
          background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);
          border-radius:16px;padding:12px 14px;cursor:pointer;
          display:flex;align-items:center;justify-content:space-between;gap:10px;
          animation:fadeSlideIn .3s ease ${(i + 1) * 0.1}s both;">
          <div style="display:flex;align-items:center;gap:10px;flex:1;min-width:0;">
            <span style="font-size:18px;flex-shrink:0;">${rankLabels[i + 1]}</span>
            <div style="min-width:0;">
              <div style="font-size:13px;font-weight:600;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${s.name}</div>
              <div style="font-size:11px;color:rgba(255,255,255,0.4);">${s.dist.toFixed(1)} km</div>
            </div>
          </div>
          <div style="font-size:15px;font-weight:700;color:rgba(255,255,255,0.8);flex-shrink:0;">CHF ${s.pricePerL.toFixed(3)}</div>
        </div>`;
      });
      html += '</div>';
    }

    resultsDiv.innerHTML = html;
    if (radarContainer) radarContainer.style.display = 'none';
    btn.disabled = false; btn.innerHTML = '<i class="ph-bold ph-brain"></i> Relancer';

    // Add click listeners to radar cards to fly to station
    resultsDiv.querySelectorAll('.radar-result-card').forEach(card => {
      card.addEventListener('click', () => {
        const st = allStations.find(s => s.id === card.dataset.id);
        if (st) flyToStation(st);
      });
    });
  }

  document.getElementById('btn-radar-scan').addEventListener('click', runRadarScan);

  // ── Filter dropdowns ───────────────────────────────────
  const fuelDD = document.getElementById('fuel-dropdown');
  const sortDD = document.getElementById('sort-dropdown');
  const themeDD = document.getElementById('theme-dropdown');
  const brandDD = document.getElementById('brand-dropdown');

  document.getElementById('chip-fuel').addEventListener('click', e => { e.stopPropagation(); fuelDD.classList.toggle('visible'); });
  document.getElementById('chip-sort').addEventListener('click', e => { e.stopPropagation(); sortDD.classList.toggle('visible'); });
  document.getElementById('chip-brand').addEventListener('click', e => { e.stopPropagation(); brandDD.classList.toggle('visible'); });
  document.getElementById('btn-theme-toggle').addEventListener('click', e => { e.stopPropagation(); themeDD.classList.toggle('visible'); });

  fuelDD.querySelectorAll('.dropdown-item').forEach(it => it.addEventListener('click', () => {
    selectedFuel = it.dataset.fuel;
    if (userProfile) { userProfile.fuelType = selectedFuel; localStorage.setItem('fillz_profile', JSON.stringify(userProfile)); debouncedSyncToFirestore(); }
    document.getElementById('chip-fuel').innerHTML = `<i class="ph ph-gas-pump"></i> ${selectedFuel} <i class="ph ph-caret-down"></i>`;
    document.getElementById('prof-fuel-sel').value = selectedFuel;
    fuelDD.classList.remove('visible'); renderMarkers();
    sendWidgetUpdate();
  }));
  sortDD.querySelectorAll('.dropdown-item').forEach(it => it.addEventListener('click', () => {
    sortBy = it.dataset.sort;
    sortDD.classList.remove('visible'); renderMarkers();
  }));
  themeDD.querySelectorAll('.theme-opt').forEach(it => it.addEventListener('click', () => {
    setMapTheme(it.dataset.theme); themeDD.classList.remove('visible');
  }));
  document.addEventListener('click', () => { 
    fuelDD.classList.remove('visible'); 
    sortDD.classList.remove('visible'); 
    themeDD.classList.remove('visible'); 
    if(brandDD) brandDD.classList.remove('visible');
  });

  // Search
  document.getElementById('search-field').addEventListener('input', e => {
    const q = e.target.value.toLowerCase().trim();
    const suggContainer = document.getElementById('search-suggestions');
    if (!dataLoaded || !suggContainer) return;
    
    if (!q) {
      suggContainer.style.display = 'none';
      if (markersLayer) renderMarkersProgressive(); // Reset map
      return;
    }

    const matches = getFilteredStations().filter(s => s.name.toLowerCase().includes(q) || s.address.toLowerCase().includes(q));
    
    // 1. Update Map Markers
    if (markersLayer) {
      markersLayer.clearLayers();
      matches.forEach(s => {
        const icon = L.divIcon({ className: 'custom-marker', html: `<div class="marker-pill"><i class="ph-fill ph-gas-pump"></i> CHF ${s.prices[selectedFuel]}</div>`, iconSize: [120, 36], iconAnchor: [60, 18] });
        const m = L.marker([s.lat, s.lng], { icon });
        m.on('click', () => showBottomSheet(s));
        markersLayer.addLayer(m);
      });
      const cc = document.getElementById('chip-count');
      if (cc) cc.innerHTML = `<i class="ph ph-map-trifold"></i> ${matches.length} stations`;
    }

    // 2. Show Autocomplete Suggestions
    if (matches.length > 0) {
      const suggestions = matches.slice(0, 8); // Top 8
      let html = suggestions.map(s => `
        <div class="search-suggestion-item" data-id="${s.id}" style="padding:12px; border-bottom:1px solid rgba(255,255,255,0.05); cursor:pointer; display:flex; flex-direction:column; gap:4px;">
          <strong style="font-size:14px; color:var(--text-main);">${s.name}</strong>
          <span style="font-size:11px; color:var(--text-muted);">${s.address}</span>
        </div>
      `).join('');
      suggContainer.innerHTML = html;
      suggContainer.style.display = 'block';

      // Click on suggestion
      suggContainer.querySelectorAll('.search-suggestion-item').forEach(el => {
        el.addEventListener('click', () => {
          const st = matches.find(s => s.id === el.dataset.id);
          if (st) {
            document.getElementById('search-field').value = st.name;
            suggContainer.style.display = 'none';
            flyToStation(st);
          }
        });
      });
    } else {
      suggContainer.innerHTML = '<div style="padding:12px; font-size:12px; color:var(--text-muted); text-align:center;">Aucune station trouvée</div>';
      suggContainer.style.display = 'block';
    }
  });

  // Close bottom sheet and suggestions on map click
  document.getElementById('view-map')?.addEventListener('click', e => {
    if (!e.target.closest('.custom-marker,.bottom-sheet,.map-filters,.map-top-bar,.filter-dropdown')) {
      document.getElementById('station-bottom-sheet')?.classList.remove('active');
    }
    if (!e.target.closest('.search-input') && !e.target.closest('#search-suggestions')) {
      const suggContainer = document.getElementById('search-suggestions');
      if (suggContainer) suggContainer.style.display = 'none';
    }
  });

  // Delete account (irreversible) — wipes Firestore doc + Firebase Auth user + local storage
  document.getElementById('btn-delete-account')?.addEventListener('click', async () => {
    // In-app confirmation (browser confirm() is blocked in WKWebView)
    const confirmed = await new Promise(resolve => {
      const overlay = document.createElement('div');
      overlay.style.cssText = 'position:fixed;inset:0;z-index:999999;background:rgba(0,0,0,.75);display:flex;align-items:flex-end;padding:0 0 32px;backdrop-filter:blur(8px);';
      overlay.innerHTML = `
        <div style="width:100%;max-width:480px;margin:0 auto;background:#13121F;border:1px solid rgba(239,68,68,.25);border-radius:24px 24px 0 0;padding:28px 24px 12px;">
          <div style="font-size:32px;text-align:center;margin-bottom:10px;">⚠️</div>
          <h3 style="color:white;font-size:17px;font-weight:700;text-align:center;margin-bottom:8px;">Supprimer mon compte</h3>
          <p style="font-size:13px;color:rgba(255,255,255,.5);text-align:center;line-height:1.6;margin-bottom:20px;">Cette action est <strong style="color:#ef4444;">irréversible</strong>. Toutes tes données (profil, historique, favoris) seront définitivement effacées.</p>
          <button id="_del-confirm" style="width:100%;padding:14px;background:#ef4444;border:none;border-radius:14px;color:white;font-size:15px;font-weight:700;cursor:pointer;margin-bottom:10px;">Oui, supprimer mon compte</button>
          <button id="_del-cancel" style="width:100%;padding:12px;background:transparent;border:1px solid rgba(255,255,255,.1);border-radius:14px;color:rgba(255,255,255,.5);font-size:14px;cursor:pointer;">Annuler</button>
        </div>`;
      document.body.appendChild(overlay);
      overlay.querySelector('#_del-confirm').onclick = () => { document.body.removeChild(overlay); resolve(true); };
      overlay.querySelector('#_del-cancel').onclick  = () => { document.body.removeChild(overlay); resolve(false); };
    });
    if (!confirmed) return;

    const btn = document.getElementById('btn-delete-account');
    if (btn) { btn.disabled = true; btn.textContent = 'Suppression en cours…'; }

    const doDelete = async () => {
      if (currentUser) {
        try { await deleteDoc(doc(db, 'users', currentUser.uid)); } catch(_) {}
        try { await deleteDoc(doc(db, 'push_tokens', currentUser.uid + '_ios')); } catch(_) {}
        await deleteUser(currentUser);
      }
      localStorage.clear();
      location.reload();
    };

    try {
      await doDelete();
    } catch(err) {
      if (err?.code === 'auth/requires-recent-login') {
        // Re-authenticate then retry
        showToast('Reconnexion requise pour confirmer la suppression…', 'info');
        try {
          // Ré-authentification avec le fournisseur réellement utilisé par ce compte
          const providerId = currentUser.providerData.some(p => p.providerId === 'google.com') ? 'google' : 'apple';
          if (hasNativeAuth(providerId)) {
            const native = await nativeSocialCredential(providerId);
            if (!native) throw new Error('cancelled');
            await reauthenticateWithCredential(currentUser, native.credential);
          } else {
            await reauthenticateWithPopup(currentUser, buildSocialProvider(providerId));
          }
          await doDelete();
        } catch(reAuthErr) {
          showToast('Reconnexion échouée. Déconnecte-toi puis reconnecte-toi avant de supprimer.', 'error');
          if (btn) { btn.disabled = false; btn.textContent = 'Supprimer définitivement mon compte'; }
        }
      } else {
        showToast('Erreur suppression : ' + (err?.message || 'inconnue'), 'error');
        if (btn) { btn.disabled = false; btn.textContent = 'Supprimer définitivement mon compte'; }
      }
    }
  });

  document.getElementById('btn-support')?.addEventListener('click', () => {
    window.location.href = '/support.html';
  });

  document.getElementById('btn-request-notifications')?.addEventListener('click', () => {
    localStorage.setItem('fillz_push_granted', '1');
    if (window.isOptiTankApp && window.OptiTankBridge) {
      window.OptiTankBridge.post({ type: 'requestNotifications' });
      showToast('Autorisations demandées !', 'success');
    } else {
      showToast("Notifications disponibles uniquement sur l'app iOS.", 'info');
    }
  });

  // ── Router ─────────────────────────────────────────────
  const viewElements = {
    radar: document.getElementById('view-radar'),
    map: document.getElementById('view-map'),
    route: document.getElementById('view-route'),
    profile: document.getElementById('view-profile'),
    stats: document.getElementById('view-stats'),
    details: document.getElementById('view-details'),
  };

  function switchView(name) {
    if (currentView !== name) {
      previousView = currentView;
      currentView = name;
    }
    document.querySelectorAll('.nav-item').forEach(it => it.classList.toggle('active', it.dataset.view === name));
    Object.entries(viewElements).forEach(([k, el]) => {
      if (k === name) {
        el.classList.add('active'); el.style.display = 'flex';
        // Minor delay for heavy operations to let view transition animate
        setTimeout(() => {
          if (name === 'map') { initMap(); mapInstance?.invalidateSize(); }
        }, 50);
      } else {
        el.classList.remove('active'); el.style.display = 'none';
      }
    });

    const bNav = document.querySelector('.bottom-nav');
    if (bNav) {
      if (name === 'details') {
        bNav.style.transform = 'translate(-50%, 150px)';
        bNav.style.opacity = '0';
        bNav.style.pointerEvents = 'none';
      } else {
        bNav.style.transform = 'translate(-50%, 0)';
        bNav.style.opacity = '1';
        bNav.style.pointerEvents = 'auto';
      }
    }
    
    // Fix: Disable global scrolling on views that handle their own interactions (Map, Radar)
    const mainContentEl = document.getElementById('main-content');
    if (mainContentEl) {
      if (name === 'map' || name === 'radar') {
        mainContentEl.style.overflowY = 'hidden';
      } else {
        mainContentEl.style.overflowY = 'auto';
      }
      
      if (name === 'details') {
        mainContentEl.style.paddingBottom = '0px';
      } else {
        mainContentEl.style.paddingBottom = 'var(--nav-height)';
      }
    }
  }

  // New Global Listeners for Details
  document.getElementById('btn-details-back')?.addEventListener('click', () => {
    // Smart back: if prev was list (obsolete) or radar or route, go there.
    if (previousView === 'radar' || previousView === 'route') {
      switchView(previousView);
    } else {
      switchView('map');
    }
  });
  document.getElementById('bs-view-details')?.addEventListener('click', () => {
    if (selectedStation) showStationDetails(selectedStation);
    document.getElementById('station-bottom-sheet')?.classList.remove('active');
  });
  document.getElementById('bs-go')?.addEventListener('click', () => {
    if (selectedStation) {
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
      const url = isIOS ? `https://maps.apple.com/?daddr=${selectedStation.lat},${selectedStation.lng}` : `https://www.google.com/maps/dir/?api=1&destination=${selectedStation.lat},${selectedStation.lng}`;
      if (window.isOptiTankApp) window.location.href = url;
      else window.open(url, '_blank');
    }
  });
  document.getElementById('det-go')?.addEventListener('click', () => {
    if (selectedStation) {
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
      const url = isIOS ? `https://maps.apple.com/?daddr=${selectedStation.lat},${selectedStation.lng}` : `https://www.google.com/maps/dir/?api=1&destination=${selectedStation.lat},${selectedStation.lng}`;
      if (window.isOptiTankApp) window.location.href = url;
      else window.open(url, '_blank');
    }
  });
  document.getElementById('det-fav')?.addEventListener('click', () => {
    if (!selectedStation) return;
    const id = selectedStation.id;
    if (favorites.includes(id)) favorites = favorites.filter(x => x !== id);
    else favorites.push(id);
    localStorage.setItem('fillz_favs', JSON.stringify(favorites));
    showStationDetails(selectedStation); // Refresh UI
    syncToFirestore();
  });

  navItems.forEach(it => it.addEventListener('click', () => switchView(it.dataset.view)));
  if (!isFirstVisit) {
    const urlParams = new URLSearchParams(window.location.search);
    const viewParam = urlParams.get('view');
    const stationParam = urlParams.get('station');
    
    if (viewParam && ['radar','map','route','profile'].includes(viewParam)) {
      switchView(viewParam);
      if (viewParam === 'map' && stationParam) {
        // Wait for map and data to load before zooming
        const checkReady = setInterval(() => {
          if (dataLoaded && allStations.length) {
            clearInterval(checkReady);
            const st = allStations.find(s => s.id === stationParam);
            if (st) setTimeout(() => flyToStation(st), 500);
          }
        }, 100);
      }
    } else {
      switchView('radar');
    }
  }
  // ── PRICE HISTORY & STATS ─────────────────────────────
  function recordDailyPrices() {
    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    if (!priceHistory) {
      priceHistory = JSON.parse(localStorage.getItem('fillz_price_history') || '{}');
    }
    if (priceHistory[today]) return; // Already recorded today

    const FUELS = ['SP95', 'SP98', 'Diesel', 'Diesel Premium', 'GPL'];
    const snapshot = {};
    
    // Process all stations that have fuel prices
    allStations.forEach(s => {
      const stationPrices = {};
      let hasPrices = false;
      FUELS.forEach(f => { 
        if (s.prices[f]) {
          stationPrices[f] = parseFloat(s.prices[f]);
          hasPrices = true;
        } 
      });
      if (hasPrices) {
        snapshot[s.id] = { name: s.name, prices: stationPrices };
      }
    });

    // Skip saving if there's no data
    if (Object.keys(snapshot).length === 0) return;

    priceHistory[today] = snapshot;
    // Keep only last 30 days
    const days = Object.keys(priceHistory).sort();
    if (days.length > 30) {
      days.slice(0, days.length - 30).forEach(d => delete priceHistory[d]);
    }
    try {
      localStorage.setItem('fillz_price_history', JSON.stringify(priceHistory));
    } catch {
      // Quota localStorage dépassé (gros volumes FR/ES) : on retente avec 7 jours.
      const keep = Object.keys(priceHistory).sort().slice(-7);
      priceHistory = Object.fromEntries(keep.map(d => [d, priceHistory[d]]));
      try { localStorage.setItem('fillz_price_history', JSON.stringify(priceHistory)); } catch {}
    }
  }

  let statsChartInstance = null;
  let statsSelectedIds = new Set();
  let statsFuel = selectedFuel;
  let _statsFirestoreHistory = null; // cache Firestore pour la session

  function getStationColors() {
    return [
      '#c084fc','#60a5fa','#4ade80','#f87171','#fbbf24',
      '#34d399','#f472b6','#a78bfa','#38bdf8','#fb923c'
    ];
  }

  async function renderStatsView() {
    const stationListEl = document.getElementById('stats-station-list');
    const emptyEl = document.getElementById('stats-empty');
    const legendEl = document.getElementById('stats-legend');
    const fuelSel = document.getElementById('stats-fuel-sel');

    if (fuelSel) {
      fuelSel.value = statsFuel;
      fuelSel.onchange = () => { statsFuel = fuelSel.value; renderStatsView(); };
    }

    // KPI cards
    const refuelsData = JSON.parse(localStorage.getItem('fillz_refuels') || '[]');
    const { total: kpiSavings } = computeSavings();
    const kpiRefuelsEl = document.getElementById('kpi-refuels');
    const kpiSavingsEl = document.getElementById('kpi-savings');
    if (kpiRefuelsEl) kpiRefuelsEl.textContent = refuelsData.length;
    if (kpiSavingsEl) kpiSavingsEl.textContent = `CHF ${kpiSavings.toFixed(0)}`;

    // Fusionner localStorage + Firestore (favoris, 14 jours)
    // Firestore est la source principale — localStorage complète avec les snapshots locaux
    const localHistory = JSON.parse(localStorage.getItem('fillz_price_history') || '{}');

    if (favorites.length && !_statsFirestoreHistory) {
      try {
        const merged = JSON.parse(JSON.stringify(localHistory));
        await Promise.all(favorites.slice(0, 10).map(async (favId) => {
          try {
            const stName = allStations.find(s => s.id === favId)?.name || favId;
            const fsHist = await fetchStationHistory(favId, 14);
            Object.entries(fsHist).forEach(([day, prices]) => {
              if (!merged[day]) merged[day] = {};
              if (!merged[day][favId]) merged[day][favId] = { name: stName, prices };
            });
          } catch(_) {}
        }));
        _statsFirestoreHistory = merged;
      } catch(_) {}
    }
    const history = _statsFirestoreHistory || localHistory;
    const days = Object.keys(history).sort();

    // Avg and best price from history
    const kpiAvgEl = document.getElementById('kpi-avg-price');
    const kpiBestEl = document.getElementById('kpi-best-price');
    if ((kpiAvgEl || kpiBestEl) && days.length) {
      const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 30);
      const recent = days.filter(d => new Date(d) >= cutoff);
      let prices = [];
      recent.forEach(d => {
        const snap = history[d];
        Object.values(snap).forEach(info => {
          if (info.prices[statsFuel]) prices.push(parseFloat(info.prices[statsFuel]));
        });
      });
      if (prices.length) {
        const avg = prices.reduce((s, p) => s + p, 0) / prices.length;
        const best = Math.min(...prices);
        if (kpiAvgEl) kpiAvgEl.textContent = avg.toFixed(3);
        if (kpiBestEl) kpiBestEl.textContent = best.toFixed(3);
      }
    }

    if (!days.length) {
      if (emptyEl) emptyEl.style.display = 'flex';
      if (statsChartInstance) { statsChartInstance.destroy(); statsChartInstance = null; }
      if (stationListEl) stationListEl.innerHTML = '';
      if (legendEl) legendEl.innerHTML = '';
      return;
    }
    if (emptyEl) emptyEl.style.display = 'none';

    // Collect all station IDs that have data for statsFuel and are in favorites
    const allStationIds = new Map(); // id -> name
    days.forEach(d => {
      const snap = history[d];
      Object.entries(snap).forEach(([id, info]) => {
        if (info.prices[statsFuel] && !allStationIds.has(id) && favorites.includes(id)) {
          // Prioritise live allStations name — fallback to stored name, then ID
          const resolvedName = allStations.find(s => s.id === id)?.name || info.name || id;
          allStationIds.set(id, resolvedName);
        }
      });
    });

    // Init selection if empty
    if (statsSelectedIds.size === 0 && allStationIds.size > 0) {
      let count = 0;
      for (const id of allStationIds.keys()) {
        if (count >= 5) break;
        statsSelectedIds.add(id);
        count++;
      }
    }

    // Station chips
    if (stationListEl) {
      const colors = getStationColors();
      let idx = 0;
      let html = '';
      for (const [id, name] of allStationIds.entries()) {
        const col = colors[idx % colors.length];
        const sel = statsSelectedIds.has(id);
        html += `<button class="stats-chip${sel ? ' sel' : ''}" data-sid="${id}" style="--chip-col:${col}">${name.length > 20 ? name.slice(0,18)+'…' : name}</button>`;
        idx++;
      }
      stationListEl.innerHTML = html;
      stationListEl.querySelectorAll('.stats-chip').forEach(btn => {
        btn.addEventListener('click', () => {
          const sid = btn.dataset.sid;
          if (statsSelectedIds.has(sid)) statsSelectedIds.delete(sid);
          else statsSelectedIds.add(sid);
          renderStatsChart(history, days, Array.from(allStationIds.entries()));
          btn.classList.toggle('sel', statsSelectedIds.has(sid));
        });
      });
    }

    renderStatsChart(history, days, Array.from(allStationIds.entries()));

    // Clear button
    const clearBtn = document.getElementById('stats-clear-btn');
    if (clearBtn) {
      clearBtn.onclick = () => {
        if (confirm('Effacer l\'historique des prix ?')) {
          localStorage.removeItem('fillz_price_history');
          _statsFirestoreHistory = null;
          statsSelectedIds.clear();
          renderStatsView();
        }
      };
    }
  }

  function renderStatsChart(history, days, stationEntries) {
    const emptyEl = document.getElementById('stats-empty');
    if (days.length < 2) {
      if (emptyEl) {
        emptyEl.style.display = 'flex';
        emptyEl.innerHTML = `<i class="ph-bold ph-chart-line-up" style="font-size:48px; display:block; margin-bottom:12px; opacity:0.3;"></i><p style="font-size:14px;">Il faut au moins 2 jours d'historique<br>pour afficher une courbe. Revenez demain !</p>`;
      }
      if (statsChartInstance) { statsChartInstance.destroy(); statsChartInstance = null; }
      return;
    }
    if (emptyEl) emptyEl.style.display = 'none';

    const colors = getStationColors();
    const datasets = [];
    let colorIdx = 0;
    const legendEl = document.getElementById('stats-legend');
    let legendHTML = '';

    stationEntries.forEach(([id, name], i) => {
      const col = colors[i % colors.length];
      if (!statsSelectedIds.has(id)) { colorIdx++; return; }

      const data = days.map(d => {
        const snap = history[d];
        return snap[id]?.prices[statsFuel] ?? null;
      });

      datasets.push({
        label: name.length > 25 ? name.slice(0,23)+'…' : name,
        data,
        borderColor: col,
        backgroundColor: col + '20',
        borderWidth: 2.5,
        pointBackgroundColor: col,
        pointRadius: 4,
        pointHoverRadius: 6,
        tension: 0.35,
        fill: false,
        spanGaps: true,
      });

      legendHTML += `<span style="display:inline-flex;align-items:center;gap:5px;background:rgba(255,255,255,0.04);padding:4px 10px;border-radius:20px;border:1px solid ${col}40;font-size:12px;">
        <span style="width:10px;height:10px;border-radius:50%;background:${col};display:inline-block;"></span>${name.length > 18 ? name.slice(0,16)+'…' : name}
      </span>`;
      colorIdx++;
    });

    if (legendEl) legendEl.innerHTML = legendHTML;

    const canvas = document.getElementById('stats-chart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    if (statsChartInstance) statsChartInstance.destroy();

    if (!datasets.length) {
      statsChartInstance = null;
      return;
    }

    statsChartInstance = new Chart(ctx, {
      type: 'line',
      data: {
        labels: days.map(d => {
          const [y, m, day] = d.split('-');
          return `${day}.${m}`;
        }),
        datasets
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: 'rgba(20,20,20,0.95)',
            borderColor: 'rgba(255,255,255,0.1)',
            borderWidth: 1,
            titleColor: '#fff',
            bodyColor: '#aaa',
            padding: 12,
            callbacks: {
              label: ctx => ` ${ctx.dataset.label}: CHF ${ctx.parsed.y?.toFixed(3) ?? 'N/A'}`,
            }
          }
        },
        scales: {
          x: {
            grid: { color: 'rgba(255,255,255,0.04)' },
            ticks: { color: '#666', font: { size: 11 } },
          },
          y: {
            grid: { color: 'rgba(255,255,255,0.06)' },
            ticks: { color: '#888', font: { size: 11 }, callback: v => 'CHF ' + v.toFixed(3) },
            beginAtZero: false,
          }
        }
      }
    });
  }

  // ── ADD-ON 3 : SUIVI CONSOMMATION ──────────────────────
  function loadRefuels() {
    const listEl = document.getElementById('refuels-list');
    if (!listEl) return;
    const refuels = JSON.parse(localStorage.getItem('fillz_refuels') || '[]');
    if (!refuels.length) {
      listEl.innerHTML = '<p style="color:var(--text-muted);font-size:13px;text-align:center;padding:10px;"><i class="ph-bold ph-gas-pump" style="font-size:24px;display:block;margin-bottom:8px;opacity:0.5"></i>Aucun plein enregistré.</p>';
      return;
    }
    
    let html = '';
    refuels.sort((a,b) => b.km - a.km).forEach((rf, i) => {
      let badge = '';
      if (i < refuels.length - 1) {
        const prev = refuels[i+1];
        const diffKm = rf.km - prev.km;
        if (diffKm > 0) {
          const conso = (rf.liters / diffKm) * 100;
          badge = `<span style="font-size:12px;color:var(--accent-purple);font-weight:700;"><i class="ph-fill ph-trend-down"></i> ${conso.toFixed(1)} L/100</span>`;
        }
      } else {
        badge = `<span style="font-size:11px;color:var(--text-muted);">Plein Initial</span>`;
      }
      const d = new Date(rf.date).toLocaleDateString('fr-CH');
      html += `<div style="background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.06); border-radius:12px; padding:12px; display:flex; justify-content:space-between; align-items:center;">
        <div>
          <strong style="display:block;font-size:14px;color:white;">${rf.liters} L — CHF ${rf.price.toFixed(2)}</strong>
          <span style="color:var(--text-muted);font-size:11px;">${d} · ${rf.km} km</span>
        </div>
        ${badge}
      </div>`;
    });
    listEl.innerHTML = html;
  }

  const rm = document.getElementById('refuel-modal');
  document.getElementById('btn-add-refuel')?.addEventListener('click', () => rm.style.display = 'flex');
  document.getElementById('rf-cancel')?.addEventListener('click', () => rm.style.display = 'none');
  document.getElementById('rf-save')?.addEventListener('click', () => {
    const l = parseFloat(document.getElementById('rf-liters').value);
    const p = parseFloat(document.getElementById('rf-price').value);
    const k = parseInt(document.getElementById('rf-km').value, 10);
    if (!l || !p || !k) return alert('Veuillez remplir tous les champs');
    
    const refuels = JSON.parse(localStorage.getItem('fillz_refuels') || '[]');
    refuels.push({ date: Date.now(), liters: l, price: p, km: k });
    localStorage.setItem('fillz_refuels', JSON.stringify(refuels));
    syncToFirestore(); // Synchronisation au cloud
    
    document.getElementById('rf-liters').value = '';
    document.getElementById('rf-price').value = '';
    document.getElementById('rf-km').value = '';
    rm.style.display = 'none';
    loadRefuels();
  });
  loadRefuels();

  // ── OCR Scanner Logic ─────────────────────────────────
  document.getElementById('rf-ocr-input')?.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    const loader = document.getElementById('ocr-loader');
    if (loader) loader.style.display = 'block';
    
    try {
      if (!window.Tesseract) {
        const tesseractModule = await import('tesseract.js');
        window.Tesseract = tesseractModule.default || tesseractModule;
      }
      const result = await window.Tesseract.recognize(file, 'fra', { logger: m => console.log(m) });
      const text = result.data.text;
      console.log('OCR Output:', text);
      
      // Basic heuristics to find liters and price
      let litersMatch = text.match(/([0-9]+[.,][0-9]{1,2})\s*(L|Litres|litres)/i);
      let priceMatch = text.match(/([0-9]+[.,][0-9]{2})\s*(CHF)/i);
      
      if (!priceMatch) priceMatch = text.match(/(CHF)\s*([0-9]+[.,][0-9]{2})/i); 
      // If still no price, look for words like TOTAL
      if (!priceMatch) {
         const tMatch = text.match(/TOTAL[\s\S]*?([0-9]+[.,][0-9]{2})/i);
         if (tMatch) priceMatch = [tMatch[0], tMatch[1], 'CHF'];
      }

      if (litersMatch) {
        document.getElementById('rf-liters').value = litersMatch[1].replace(',', '.');
      }
      if (priceMatch) {
        const val = priceMatch[1] === 'CHF' ? priceMatch[2] : priceMatch[1];
        document.getElementById('rf-price').value = val.replace(',', '.');
      }
      
      if (!litersMatch && !priceMatch) {
        alert("Scan terminé mais valeurs non trouvées. Veuillez l'entrer manuellement.");
      }
    } catch (err) {
      console.error(err);
      alert("Erreur lors de l'analyse OCR.");
    } finally {
      if (loader) loader.style.display = 'none';
      e.target.value = ''; // Reset
    }
  });

  // ── ADD-ON 1 : TRAJETS INTELLIGENTS ────────────────────
  let currentRoutePolyline = null;

  async function geocode(query) {
    const q = query.toLowerCase().includes('switzerland') || query.toLowerCase().includes('suisse') ? query : query + ', Switzerland';
    const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=1`);
    const data = await res.json();
    return data.length ? data[0] : null;
  }

  document.getElementById('btn-calc-route')?.addEventListener('click', async () => {
    const startQ = document.getElementById('route-start').value;
    const endQ = document.getElementById('route-end').value;
    const btn = document.getElementById('btn-calc-route');
    const resDiv = document.getElementById('route-results');
    
    if (!startQ || !endQ) return alert('Veuillez entrer un départ et une arrivée.');
    
    btn.disabled = true;
    btn.innerHTML = '<div class="spinner-small"></div> Recherche...';
    const emptyState = document.getElementById('route-empty-state');
    if (emptyState) emptyState.style.display = 'none';
    resDiv.innerHTML = `<div style="padding:24px 16px;display:flex;flex-direction:column;gap:12px;">
      ${['Géocodage des adresses','Calcul du trajet OSRM','Analyse des stations','Optimisation des prix'].map((s,i) =>
        `<div style="display:flex;align-items:center;gap:12px;opacity:${i===0?1:0.35};animation:fadeSlideIn .3s ease ${i*.15}s both;">
          <div style="width:8px;height:8px;border-radius:50%;background:${i===0?'#6C63FF':'rgba(255,255,255,0.2)'};${i===0?'box-shadow:0 0 8px #6C63FF;animation:pulseDot 1s infinite;':''}"></div>
          <span style="font-size:13px;color:${i===0?'rgba(255,255,255,0.8)':'rgba(255,255,255,0.35)'};">${s}</span>
        </div>`
      ).join('')}
    </div>`;

    try {
      const startLoc = await geocode(startQ);
      const endLoc = await geocode(endQ);
      
      if (!startLoc || !endLoc) throw new Error('Cité/Code Postal introuvable. Soyez plus précis.');
      
      resDiv.innerHTML = '<p style="text-align:center;color:var(--text-muted);padding:20px;">Calcul du trajet (OSRM)...</p>';
      
      const osrmRes = await fetch(`https://router.project-osrm.org/route/v1/driving/${startLoc.lon},${startLoc.lat};${endLoc.lon},${endLoc.lat}?overview=simplified&geometries=geojson`);
      const osrmData = await osrmRes.json();
      
      if (osrmData.code !== 'Ok') throw new Error('Trajet impossible.');
      
      const routeCoords = osrmData.routes[0].geometry.coordinates; // [lon, lat][]
      const distRoute = osrmData.routes[0].distance / 1000;
      
      // Dessin de la route sur la carte Leaflet
      if (!mapInstance) initMap();
      if (currentRoutePolyline) mapInstance.removeLayer(currentRoutePolyline);
      const latLngs = routeCoords.map(c => [c[1], c[0]]);
      currentRoutePolyline = L.polyline(latLngs, { color: 'var(--accent-purple)', weight: 5, opacity: 0.8, dashArray: '10, 10' }).addTo(mapInstance);
      mapInstance.fitBounds(currentRoutePolyline.getBounds(), { padding: [40, 40] });

      resDiv.innerHTML = `<p style="text-align:center;color:var(--text-muted);padding:20px;">Analyse de ${allStations.length} stations sur ${distRoute.toFixed(0)}km...</p>`;
      
      if (!allStations.length) allStations = await fetchAllStations();
      
      const vFuel = getVehicleFuel();
      const MAX_DEV = 4; // km de déviation max
      
      const stationsOnRoute = allStations
        .filter(s => s.prices[vFuel])
        .map(s => {
          let minD = Infinity;
          for (let i=0; i<routeCoords.length; i+=3) { // optim speed
            const d = getDistKm(s.lat, s.lng, routeCoords[i][1], routeCoords[i][0]);
            if (d < minD) minD = d;
          }
          return { ...s, devDist: minD, pricePerL: parseFloat(s.prices[vFuel]) };
        })
        .filter(s => s.devDist <= MAX_DEV)
        .sort((a, b) => a.pricePerL - b.pricePerL);
        
      const topRoute = stationsOnRoute.slice(0, 5);
      
      if (!topRoute.length) {
        resDiv.innerHTML = '<p style="text-align:center;color:var(--text-muted);padding:20px;">Aucune station trouvée le long de ce trajet sans faire un énorme détour.</p>';
      } else {
        const worstPrice = stationsOnRoute[stationsOnRoute.length - 1].pricePerL;
        const conso = FUEL_CONSUMPTION[vFuel] || 7.5; // L/100km
        const totalLiters = (distRoute * conso) / 100;

        let html = `<div class="radar-cards-label"><i class="ph-fill ph-check-circle" style="color:var(--accent-green)"></i> ${topRoute.length} top stations sur votre trajet</div><div class="radar-cards">`;
        topRoute.forEach((s, i) => {
          const tripCost = totalLiters * s.pricePerL;
          const maxCost = totalLiters * worstPrice;
          const savings = maxCost - tripCost;

          html += `<div class="radar-result-card" data-id="${s.id}" style="animation-delay:${i*0.07}s">
            <div class="rrc-left">
              <span class="rrc-medal" style="font-size:16px;">${i+1}</span>
              <div>
                <div class="rrc-name">${s.name}</div>
                <div class="rrc-tags">
                  <span class="rrc-tag"><i class="ph-bold ph-arrows-split"></i> Détour ${s.devDist.toFixed(1)} km</span>
                  ${savings > 0 ? `<span class="rrc-tag" style="color:var(--accent-green)"><i class="ph-bold ph-piggy-bank"></i> Éco. CHF ${savings.toFixed(2)}</span>` : ''}
                </div>
              </div>
            </div>
            <div class="rrc-right" style="text-align:right">
              <div class="rrc-price">${currencyFor(s.country)} ${s.pricePerL.toFixed(3)}</div>
              <div style="font-size:10px; color:var(--text-muted);">Coût trajet: CHF ${tripCost.toFixed(1)}</div>
            </div>
          </div>`;
        });
        html += '</div>';
        resDiv.innerHTML = html;
        
        // Navigation auto vers la carte au clic !
        resDiv.querySelectorAll('.radar-result-card').forEach(card => {
          const st = topRoute.find(s => s.id === card.dataset.id);
          card.addEventListener('click', () => {
            switchView('map');      // Switch active view to Map
            setTimeout(() => {
              flyToStation(st);     // Fly and open bottomsheet
            }, 300);                // Wait for map layout stabilization
          });
        });
      }
    } catch(err) {
      resDiv.innerHTML = `<p style="text-align:center;color:#ef4444;padding:20px;">${err.message}</p>`;
    }
    
    btn.disabled = false;
    btn.innerHTML = '<i class="ph-bold ph-list-magnifying-glass"></i> Juste les stations les moins chères';
  });

  // ── PLANIFICATEUR DE TRAJET IA (arrêts carburant optimisés) ──
  const PLAN_FN_URL = 'https://us-central1-optitank-c7709.cloudfunctions.net/planRoute';
  let routePlanMarkers = null;

  function fullTankAutonomyKm() {
    const conso = FUEL_CONSUMPTION[getVehicleFuel()] || 7.5;
    const tank = getTankSize() || 0;
    if (!tank || !conso) return 0;
    return Math.round((tank / conso) * 100);
  }

  // Pré-remplit le champ autonomie avec l'autonomie plein du véhicule.
  (function initAutonomyField() {
    const el = document.getElementById('route-autonomy');
    if (!el) return;
    const ft = fullTankAutonomyKm();
    if (ft > 0) {
      el.placeholder = `Autonomie restante (km) — plein ≈ ${ft} km`;
      if (!el.value) el.value = ft;
    }
  })();

  // Planificateur déterministe (repli + réparation du plan IA).
  // À chaque tronçon où la destination n'est pas atteignable, on doit s'arrêter
  // avant (pos + range - reserve) ; on y choisit la station la moins chère.
  function computeGreedyPlan(cands, p) {
    const stops = [];
    let pos = 0, range = p.currentAutonomyKm, guard = 0;
    while (p.totalDistanceKm - pos > range - p.reserveKm) {
      if (guard++ > 60) break;
      const reach = pos + range - p.reserveKm;
      const window = cands.filter(s => s.progressKm > pos + 0.1 && s.progressKm <= reach);
      if (!window.length) return { stops, infeasible: true };
      window.sort((a, b) => a.price - b.price || a.devKm - b.devKm);
      const chosen = window[0];
      stops.push({ stationId: chosen.id, reason: 'Station la moins chère atteignable sur ce tronçon' });
      pos = chosen.progressKm;
      range = p.fullTankAutonomyKm;
    }
    return { stops, infeasible: false };
  }

  // Vérifie qu'une séquence d'arrêts (objets candidats triés) est atteignable.
  function planIsFeasible(stopObjs, p) {
    let pos = 0, range = p.currentAutonomyKm;
    for (const s of stopObjs) {
      if (s.progressKm > pos + range - p.reserveKm + 0.5) return false;
      pos = s.progressKm;
      range = p.fullTankAutonomyKm;
    }
    return (p.totalDistanceKm - pos) <= (range - p.reserveKm + 0.5);
  }

  document.getElementById('btn-plan-route')?.addEventListener('click', async () => {
    const startQ = document.getElementById('route-start').value;
    const endQ = document.getElementById('route-end').value;
    const autoEl = document.getElementById('route-autonomy');
    const btn = document.getElementById('btn-plan-route');
    const resDiv = document.getElementById('route-results');

    if (!startQ || !endQ) return alert('Veuillez entrer un départ et une arrivée.');
    let currentAutonomyKm = parseFloat(autoEl.value);
    if (!currentAutonomyKm || currentAutonomyKm <= 0) currentAutonomyKm = fullTankAutonomyKm();
    if (!currentAutonomyKm || currentAutonomyKm <= 0) return alert('Indiquez votre autonomie restante (en km).');

    const fullTank = fullTankAutonomyKm() || currentAutonomyKm;
    const vFuel = getVehicleFuel();
    const conso = FUEL_CONSUMPTION[vFuel] || 7.5;

    btn.disabled = true;
    btn.innerHTML = '<div class="spinner-small"></div> Planification IA…';
    const emptyState = document.getElementById('route-empty-state');
    if (emptyState) emptyState.style.display = 'none';
    resDiv.innerHTML = `<p style="text-align:center;color:var(--text-muted);padding:20px;">Géocodage & calcul du trajet…</p>`;

    try {
      const startLoc = await geocode(startQ);
      const endLoc = await geocode(endQ);
      if (!startLoc || !endLoc) throw new Error('Cité/Code postal introuvable. Soyez plus précis.');

      const osrmRes = await fetch(`https://router.project-osrm.org/route/v1/driving/${startLoc.lon},${startLoc.lat};${endLoc.lon},${endLoc.lat}?overview=full&geometries=geojson`);
      const osrmData = await osrmRes.json();
      if (osrmData.code !== 'Ok') throw new Error('Trajet impossible.');

      const routeCoords = osrmData.routes[0].geometry.coordinates; // [lon,lat][]
      const totalDistanceKm = osrmData.routes[0].distance / 1000;

      // Distance cumulée depuis le départ à chaque sommet de la polyline.
      const cum = new Array(routeCoords.length).fill(0);
      for (let i = 1; i < routeCoords.length; i++) {
        cum[i] = cum[i - 1] + getDistKm(routeCoords[i - 1][1], routeCoords[i - 1][0], routeCoords[i][1], routeCoords[i][0]);
      }

      // Dessin de la route.
      if (!mapInstance) initMap();
      if (currentRoutePolyline) mapInstance.removeLayer(currentRoutePolyline);
      currentRoutePolyline = L.polyline(routeCoords.map(c => [c[1], c[0]]), { color: '#8b5cf6', weight: 5, opacity: 0.85, dashArray: '10,10' }).addTo(mapInstance);

      resDiv.innerHTML = `<p style="text-align:center;color:var(--text-muted);padding:20px;">Analyse des stations sur ${totalDistanceKm.toFixed(0)} km…</p>`;
      if (!allStations.length) allStations = await fetchAllStations();

      // Stations candidates le long du trajet (≤ 6 km de déviation).
      const DEV_MAX = 6;
      const byId = {};
      const candidates = allStations
        .filter(s => s.prices[vFuel])
        .map(s => {
          let minD = Infinity, bestI = 0;
          for (let i = 0; i < routeCoords.length; i += 2) {
            const d = getDistKm(s.lat, s.lng, routeCoords[i][1], routeCoords[i][0]);
            if (d < minD) { minD = d; bestI = i; }
          }
          return { id: s.id, name: s.name, brand: s.brand, city: s.city, country: s.country, lat: s.lat, lng: s.lng, devKm: +minD.toFixed(2), progressKm: +cum[bestI].toFixed(1), price: parseFloat(s.prices[vFuel]) };
        })
        .filter(s => s.devKm <= DEV_MAX && s.progressKm > 1 && s.progressKm < totalDistanceKm - 1)
        .sort((a, b) => a.progressKm - b.progressKm);
      candidates.forEach(c => { byId[c.id] = c; });

      const compact = candidates
        .map(c => ({ id: c.id, name: c.name, brand: c.brand, city: c.city, progressKm: c.progressKm, devKm: c.devKm, price: c.price }))
        .slice(0, 60);

      const reserveKm = Math.max(5, Math.round(currentAutonomyKm * 0.08));
      const params = { currentAutonomyKm, fullTankAutonomyKm: fullTank, reserveKm, totalDistanceKm };

      let stops = null, explanation = '';
      if (totalDistanceKm <= currentAutonomyKm - reserveKm) {
        stops = [];
        explanation = `Tu peux rejoindre ta destination sans refaire le plein : ${totalDistanceKm.toFixed(0)} km pour environ ${Math.round(currentAutonomyKm)} km d'autonomie.`;
      } else {
        try {
          const user = auth.currentUser;
          if (!user) throw new Error('not-auth');
          const idToken = await user.getIdToken();
          const resp = await fetch(PLAN_FN_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${idToken}` },
            body: JSON.stringify({ candidates: compact, ...params, fuel: vFuel, currency: 'CHF' }),
          });
          if (!resp.ok) throw new Error('plan-fn');
          const data = await resp.json();
          const llmStops = (data.stops || [])
            .map(st => byId[st.stationId] ? { ...byId[st.stationId], reason: st.reason } : null)
            .filter(Boolean)
            .sort((a, b) => a.progressKm - b.progressKm);
          if (!planIsFeasible(llmStops, params)) throw new Error('infeasible');
          stops = llmStops;
          explanation = data.explanation || '';
        } catch (e) {
          // Repli déterministe.
          const g = computeGreedyPlan(compact, params);
          stops = g.stops.map(st => ({ ...byId[st.stationId], reason: st.reason }));
          explanation = g.infeasible
            ? `⚠️ Avec ${Math.round(currentAutonomyKm)} km d'autonomie, aucune station n'est atteignable sur un tronçon de ce trajet. Voici le meilleur plan partiel — fais le plein dès que possible.`
            : 'Plan calculé localement : arrêts les moins chers atteignables sur ton trajet.';
        }
      }

      // ── Chiffrage (calculé en code, pas par l'IA) ──
      const litersFor = km => (km * conso) / 100;
      const segPoints = [0, ...stops.map(s => s.progressKm), totalDistanceKm];
      let cost = 0, liters = 0;
      const cards = stops.map((s, i) => {
        const legKm = Math.max(0, segPoints[i + 2] - s.progressKm);
        const legL = litersFor(legKm);
        cost += legL * s.price;
        liters += legL;
        const fromPrev = s.progressKm - segPoints[i];
        const arrivalRange = (i === 0 ? currentAutonomyKm : fullTank) - fromPrev;
        return { s, legKm, legL, fromPrev, arrivalRange };
      });
      const maxPrice = compact.length ? Math.max(...compact.map(c => c.price)) : 0;
      const savings = Math.max(0, liters * maxPrice - cost);
      const arrivalRangeKm = stops.length
        ? (fullTank - (totalDistanceKm - stops[stops.length - 1].progressKm))
        : (currentAutonomyKm - totalDistanceKm);
      const sym = c => currencyFor(c);

      // ── Marqueurs sur la carte ──
      if (routePlanMarkers) mapInstance.removeLayer(routePlanMarkers);
      routePlanMarkers = L.layerGroup().addTo(mapInstance);
      stops.forEach((s, i) => {
        const icon = L.divIcon({
          className: 'plan-stop-marker',
          html: `<div style="background:#8b5cf6;color:#fff;width:26px;height:26px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:13px;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.4)">${i + 1}</div>`,
          iconSize: [26, 26], iconAnchor: [13, 13],
        });
        L.marker([s.lat, s.lng], { icon }).addTo(routePlanMarkers);
      });
      if (currentRoutePolyline) mapInstance.fitBounds(currentRoutePolyline.getBounds(), { padding: [40, 40] });

      // ── Rendu ──
      let html = `<div style="background:linear-gradient(135deg,rgba(139,92,246,0.18),rgba(99,102,241,0.10));border:1px solid rgba(139,92,246,0.25);border-radius:16px;padding:16px;margin:0 4px 14px;">
        <div style="display:flex;gap:12px;text-align:center;">
          <div style="flex:1;"><div style="font-size:22px;font-weight:800;color:#fff;">${stops.length}</div><div style="font-size:11px;color:rgba(255,255,255,0.55);">arrêt${stops.length > 1 ? 's' : ''}</div></div>
          <div style="flex:1;"><div style="font-size:22px;font-weight:800;color:#fff;">CHF ${cost.toFixed(0)}</div><div style="font-size:11px;color:rgba(255,255,255,0.55);">carburant</div></div>
          <div style="flex:1;"><div style="font-size:22px;font-weight:800;color:var(--accent-green);">CHF ${savings.toFixed(0)}</div><div style="font-size:11px;color:rgba(255,255,255,0.55);">économisé</div></div>
          <div style="flex:1;"><div style="font-size:22px;font-weight:800;color:#fff;">${Math.max(0, Math.round(arrivalRangeKm))}</div><div style="font-size:11px;color:rgba(255,255,255,0.55);">km à l'arrivée</div></div>
        </div>
        ${explanation ? `<div style="margin-top:12px;font-size:13px;line-height:1.5;color:rgba(255,255,255,0.82);">${explanation}</div>` : ''}
      </div>`;

      if (!stops.length) {
        html += `<div style="text-align:center;padding:14px 24px;color:rgba(255,255,255,0.5);font-size:13px;"><i class="ph-fill ph-check-circle" style="color:var(--accent-green);font-size:20px;"></i><br>Aucun arrêt nécessaire — bon trajet !</div>`;
      } else {
        html += `<div class="radar-cards-label"><i class="ph-fill ph-gas-pump" style="color:#8b5cf6"></i> Tes arrêts, dans l'ordre</div><div class="radar-cards">`;
        cards.forEach((c, i) => {
          html += `<div class="radar-result-card" data-id="${c.s.id}" style="animation-delay:${i * 0.07}s">
            <div class="rrc-left">
              <span class="rrc-medal" style="background:#8b5cf6;color:#fff;">${i + 1}</span>
              <div>
                <div class="rrc-name">${c.s.name || c.s.brand || 'Station'}</div>
                <div class="rrc-tags">
                  <span class="rrc-tag"><i class="ph-bold ph-gas-pump"></i> Plein ici · ≈ ${Math.round(c.legL)} L</span>
                  ${c.s.devKm > 0.3 ? `<span class="rrc-tag"><i class="ph-bold ph-arrows-split"></i> Détour ${c.s.devKm.toFixed(1)} km</span>` : ''}
                  <span class="rrc-tag" style="color:rgba(255,255,255,0.5)"><i class="ph-bold ph-flag"></i> Arrivée à ${Math.max(0, Math.round(c.arrivalRange))} km d'autonomie</span>
                </div>
              </div>
            </div>
            <div class="rrc-right" style="text-align:right">
              <div class="rrc-price">${sym(c.s.country)} ${c.s.price.toFixed(3)}</div>
              <div style="font-size:10px;color:var(--text-muted);">à ${Math.round(c.s.progressKm)} km</div>
            </div>
          </div>`;
        });
        html += '</div>';
      }
      resDiv.innerHTML = html;

      resDiv.querySelectorAll('.radar-result-card').forEach(card => {
        const full = allStations.find(x => x.id === card.dataset.id);
        if (!full) return;
        card.addEventListener('click', () => {
          switchView('map');
          setTimeout(() => flyToStation(full), 300);
        });
      });
    } catch (err) {
      resDiv.innerHTML = `<p style="text-align:center;color:#ef4444;padding:20px;">${err.message}</p>`;
    }

    btn.disabled = false;
    btn.innerHTML = '<i class="ph-bold ph-brain"></i> Planifier mes arrêts (IA)';
  });

  // ─────────────────────────────────────────────────────────────
  // ─── NEW FEATURES ────────────────────────────────────────────
  // ─────────────────────────────────────────────────────────────

  // ── 1. PRÉDICTION IA : Régression linéaire ──────────────────
  function predictPriceTrend(prices) {
    const n = prices.length;
    if (n < 2) return 0;
    const sumX = prices.reduce((s, _, i) => s + i, 0);
    const sumY = prices.reduce((s, p) => s + p, 0);
    const sumXY = prices.reduce((s, p, i) => s + i * p, 0);
    const sumX2 = prices.reduce((s, _, i) => s + i * i, 0);
    return (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  }

  // ── 2. TABLEAU DES ÉCONOMIES ─────────────────────────────────
  function computeSavings() {
    const refuels = JSON.parse(localStorage.getItem('fillz_refuels') || '[]');
    if (refuels.length < 2) return { total: 0, refuelsCount: refuels.length };

    const history = JSON.parse(localStorage.getItem('fillz_price_history') || '{}');
    const days = Object.keys(history).sort();
    
    let totalSaved = 0;
    refuels.forEach(rf => {
      // Find avg price on that day from history
      if (!days.length) return;
      const rfDate = new Date(rf.date).toISOString().slice(0, 10);
      const closestDay = days.reduce((prev, curr) =>
        Math.abs(new Date(curr) - new Date(rfDate)) < Math.abs(new Date(prev) - new Date(rfDate)) ? curr : prev
      , days[0]);
      const snap = history[closestDay];
      if (!snap) return;
      const fuel = userProfile?.fuelType || 'SP95';
      const prices = Object.values(snap).map(s => s.prices?.[fuel]).filter(Boolean).map(Number);
      if (!prices.length) return;
      const avgPrice = prices.reduce((a, b) => a + b, 0) / prices.length;
      const maxPrice = Math.max(...prices);
      // saving = (maxPrice - what_user_paid_per_liter) * liters
      const paidPerL = rf.price / rf.liters;
      const savedPerL = maxPrice - paidPerL;
      if (savedPerL > 0) totalSaved += savedPerL * rf.liters;
    });

    return { total: totalSaved, refuelsCount: refuels.length };
  }

  function renderSavingsView() {
    const { total, refuelsCount } = computeSavings();
    const totalEl = document.getElementById('savings-total');
    const subEl = document.getElementById('savings-sub');
    if (totalEl) totalEl.textContent = `CHF ${total.toFixed(2)}`;
    if (subEl) subEl.innerHTML = refuelsCount > 0
      ? `<i class="ph ph-gas-pump"></i> Basé sur ${refuelsCount} pleins enregistrés`
      : `<span style="color:var(--accent-green);">Enregistrez vos pleins pour calculer vos économies réelles !</span>`;

    // Populate commute fields if saved
    if (commute) {
      const startEl = document.getElementById('commute-start');
      const endEl = document.getElementById('commute-end');
      if (startEl) startEl.value = commute.start || '';
      if (endEl) endEl.value = commute.end || '';
      if (commute.stations?.length) renderCommuteStations(commute.stations);
    }
    renderAlertsList();
    renderBadgesGrid();
  }

  // ── 3. MODE COMMUTE ──────────────────────────────────────────

  // Expose for route view too (already defined in route, deduplicated here as a module-level fn)

  async function loadCommuteStations() {
    const startQ = document.getElementById('commute-start')?.value;
    const endQ = document.getElementById('commute-end')?.value;
    const statusEl = document.getElementById('commute-status');
    if (!startQ || !endQ) { alert('Entrez un départ et une arrivée.'); return; }
    if (statusEl) statusEl.textContent = 'Géocodage en cours…';

    try {
      const [startLoc, endLoc] = await Promise.all([geocode(startQ), geocode(endQ)]);
      if (!startLoc || !endLoc) throw new Error('Adresses introuvables.');
      
      const osrmRes = await fetch(`https://router.project-osrm.org/route/v1/driving/${startLoc.lon},${startLoc.lat};${endLoc.lon},${endLoc.lat}?overview=simplified&geometries=geojson`);
      const osrmData = await osrmRes.json();
      if (osrmData.code !== 'Ok') throw new Error('Trajet impossible.');
      
      const coords = osrmData.routes[0].geometry.coordinates;
      const vFuel = getVehicleFuel();
      
      const candidates = allStations
        .filter(s => s.prices[vFuel])
        .map(s => {
          let minD = Infinity;
          for (let i = 0; i < coords.length; i += 2) {
            const d = getDistKm(s.lat, s.lng, coords[i][1], coords[i][0]);
            if (d < minD) minD = d;
          }
          return { ...s, devDist: minD, pricePerL: parseFloat(s.prices[vFuel]) };
        })
        .filter(s => s.devDist <= 3)
        .sort((a, b) => a.pricePerL - b.pricePerL)
        .slice(0, 3);

      commute = { start: startQ, end: endQ, stations: candidates };
      localStorage.setItem('fillz_commute', JSON.stringify(commute));
      if (statusEl) statusEl.textContent = `✅ Trajet enregistré — ${candidates.length} stations trouvées`;
      renderCommuteStations(candidates);
    } catch (e) {
      if (statusEl) statusEl.textContent = '❌ ' + e.message;
    }
  }

  function renderCommuteStations(stations) {
    const el = document.getElementById('commute-stations');
    if (!el) return;
    if (!stations?.length) { el.innerHTML = '<p style="color:var(--text-muted);font-size:13px;">Aucune station sur ce trajet.</p>'; return; }
    el.innerHTML = stations.map((s, i) => `
      <div class="radar-result-card" data-id="${s.id}" style="padding:12px;cursor:pointer;">
        <div class="rrc-left">
          <span class="rrc-medal" style="font-size:16px;">${['🏆','🥈','🥉'][i]||i+1}</span>
          <div><div class="rrc-name">${s.name}</div>
          <div style="font-size:11px;color:var(--text-muted);">À ${s.devDist?.toFixed(1)} km du trajet</div></div>
        </div>
        <div class="rrc-price">${currencyFor(s.country)} ${s.pricePerL.toFixed(3)}</div>
      </div>`).join('');
    el.querySelectorAll('.radar-result-card').forEach(card => {
      card.addEventListener('click', () => {
        const st = stations.find(s => s.id === card.dataset.id);
        if (st) flyToStation(st);
      });
    });
  }

  document.getElementById('btn-save-commute')?.addEventListener('click', () => {
    if (!dataLoaded) { alert('Chargement des stations en cours, réessayez dans un instant.'); return; }
    loadCommuteStations();
  });

  // ── 4. ALERTES PRIX ──────────────────────────────────────────

  function renderAlertsList() {
    const el = document.getElementById('alerts-list');
    if (!el) return;
    if (!priceAlerts.length) {
      el.innerHTML = '<p style="color:var(--text-muted);font-size:13px;text-align:center;padding:8px;">Aucune alerte configurée.</p>';
      return;
    }
    el.innerHTML = priceAlerts.map((a, i) => `
      <div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:12px;display:flex;align-items:center;justify-content:space-between;">
        <div style="display:flex;align-items:center;gap:10px;">
          <i class="ph-fill ph-bell-ringing" style="color:#fbbf24;font-size:18px;"></i>
          <div>
            <div style="font-size:14px;font-weight:600;">${a.fuel} &lt; CHF ${a.price.toFixed(2)}</div>
            <div style="font-size:11px;color:var(--text-muted);">Alerte active</div>
          </div>
        </div>
        <button onclick="deleteAlert(${i})" style="background:rgba(239,68,68,0.12);border:1px solid rgba(239,68,68,0.2);color:#ef4444;border-radius:8px;padding:6px 12px;cursor:pointer;font-size:12px;">Supprimer</button>
      </div>`).join('');
  }

  window.deleteAlert = function(i) {
    priceAlerts.splice(i, 1);
    localStorage.setItem('fillz_alerts', JSON.stringify(priceAlerts));
    renderAlertsList();
  };

  document.getElementById('btn-add-alert')?.addEventListener('click', () => {
    const fuel = document.getElementById('alert-fuel')?.value;
    const price = parseFloat(document.getElementById('alert-price')?.value);
    if (!fuel || isNaN(price) || price <= 0) { alert('Entrez un carburant et un prix valide.'); return; }
    priceAlerts.push({ fuel, price });
    localStorage.setItem('fillz_alerts', JSON.stringify(priceAlerts));
    document.getElementById('alert-price').value = '';
    renderAlertsList();
    if (currentUser) debouncedSyncToFirestore();
  });

  // ── 5. GAMIFICATION ──────────────────────────────────────────
  const BADGE_DEFINITIONS = [
    { id: 'first_refuel', colors: ['#FFD700','#FF8C00'], label: 'Premier Plein', desc: '1er plein enregistré',
      svg: '<path d="M12 2c-3.31 0-6 2.69-6 6 0 4.5 6 11 6 11s6-6.5 6-11c0-3.31-2.69-6-6-6zm0 8.5c-1.38 0-2.5-1.12-2.5-2.5S10.62 5.5 12 5.5s2.5 1.12 2.5 2.5S13.38 10.5 12 10.5z" fill="currentColor"/>',
      check: (r) => r.length >= 1 },
    { id: 'five_refuels', colors: ['#22C55E','#16A34A'], label: 'Économiste', desc: '5 pleins enregistrés',
      svg: '<path d="M11.8 10.9c-2.27-.59-3-1.2-3-2.15 0-1.09 1.01-1.85 2.7-1.85 1.78 0 2.44.85 2.5 2.1h2.21c-.07-1.72-1.12-3.3-3.21-3.81V3h-3v2.16c-1.94.42-3.5 1.68-3.5 3.61 0 2.31 1.91 3.46 4.7 4.13 2.5.6 3 1.48 3 2.41 0 .69-.49 1.79-2.7 1.79-2.06 0-2.87-.92-2.98-2.1h-2.2c.12 2.19 1.76 3.42 3.68 3.83V21h3v-2.15c1.95-.37 3.5-1.5 3.5-3.55 0-2.84-2.43-3.81-4.7-4.4z" fill="currentColor"/>',
      check: (r) => r.length >= 5 },
    { id: 'ten_refuels', colors: ['#3B82F6','#1D4ED8'], label: 'Explorateur', desc: '10 pleins enregistrés',
      svg: '<path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>',
      check: (r) => r.length >= 10 },
    { id: 'saver_5', colors: ['#EF4444','#DC2626'], label: 'Chasseur', desc: 'CHF 5+ économisés',
      svg: '<path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" stroke="currentColor" stroke-width="2" stroke-linecap="round" fill="none"/>',
      check: (r, savings) => savings >= 5 },
    { id: 'saver_20', colors: ['#06B6D4','#0891B2'], label: 'Express', desc: 'CHF 20+ économisés',
      svg: '<path d="M13 10V3L4 14h7v7l9-11h-7z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>',
      check: (r, savings) => savings >= 20 },
    { id: 'fav_3', colors: ['#6C63FF','#4338CA'], label: 'Radar Pro', desc: '3 stations favorites',
      svg: '<circle cx="12" cy="12" r="2" fill="currentColor"/><path d="M12 2a10 10 0 100 20 10 10 0 000-20zm0 4a6 6 0 110 12A6 6 0 0112 6z" fill="currentColor" opacity=".4"/>',
      check: (r, s, favs) => favs.length >= 3 },
    { id: 'radar_pro', colors: ['#F59E0B','#D97706'], label: 'Loyal', desc: 'Radar utilisé 5 fois',
      svg: '<path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" fill="currentColor"/>',
      check: () => parseInt(localStorage.getItem('fillz_radar_count')||'0') >= 5 },
    { id: 'commute_set', colors: ['#00D4AA','#0097A7'], label: 'Voyageur', desc: 'Trajet domicile configuré',
      svg: '<path d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>',
      check: () => !!commute },
    { id: 'alert_set', colors: ['#EAB308','#CA8A04'], label: 'Scanner', desc: 'Alerte prix créée',
      svg: '<path d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>',
      check: (r, s, f, alerts) => alerts.length >= 1 },
    { id: 'community', colors: ['#EC4899','#BE185D'], label: 'Communauté', desc: 'Compte créé',
      svg: '<path d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>',
      check: () => !!currentUser },
    { id: 'veteran', colors: ['#9CA3AF','#6B7280'], label: 'Vétéran', desc: '20 pleins enregistrés',
      svg: '<path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" stroke="currentColor" stroke-width="2" stroke-linecap="round" fill="none"/>',
      check: (r) => r.length >= 20 },
    { id: 'night', colors: ['#4F46E5','#1E1B4B'], label: 'Noctambule', desc: 'Scan après 22h',
      svg: '<path d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" fill="currentColor"/>',
      check: () => { const h = new Date().getHours(); return h >= 22 || h < 5; } },
  ];

  function checkAndUnlockBadges() {
    const refuels = JSON.parse(localStorage.getItem('fillz_refuels') || '[]');
    const { total: savings } = computeSavings();
    let newBadge = false;
    BADGE_DEFINITIONS.forEach(b => {
      if (!userBadges.includes(b.id) && b.check(refuels, savings, favorites, priceAlerts)) {
        userBadges.push(b.id);
        newBadge = true;
        showBadgeToast(b);
      }
    });
    if (newBadge) localStorage.setItem('fillz_badges', JSON.stringify(userBadges));
  }

  function showToast(msg, type = 'success') {
    const t = document.createElement('div');
    const color = type === 'info' ? '#8B84FF' : '#00D4AA';
    t.style.cssText = `position:fixed;bottom:110px;left:50%;transform:translateX(-50%);z-index:9999;background:#1a1a2e;border:1px solid ${color}55;border-radius:20px;padding:12px 20px;font-size:13px;font-weight:600;color:white;white-space:nowrap;box-shadow:0 10px 40px rgba(0,0,0,0.6);animation:fadeSlideIn 0.4s ease;`;
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 3000);
  }

  function showBadgeToast(badge) {
    const toast = document.createElement('div');
    toast.style.cssText = 'position:fixed;bottom:110px;left:50%;transform:translateX(-50%);z-index:9999;background:#1a1a2e;border:1px solid rgba(108,99,255,0.4);border-radius:20px;padding:12px 20px;display:flex;align-items:center;gap:12px;white-space:nowrap;box-shadow:0 10px 40px rgba(0,0,0,0.6);animation:fadeSlideIn 0.4s ease;';
    const [c1, c2] = badge.colors || ['#6C63FF', '#4338CA'];
    toast.innerHTML = `
      <div style="width:38px;height:38px;border-radius:50%;background:linear-gradient(135deg,${c1},${c2});display:flex;align-items:center;justify-content:center;flex-shrink:0;box-shadow:0 0 12px ${c1}66;">
        <svg viewBox="0 0 24 24" width="22" height="22" style="color:#fff;">${badge.svg || ''}</svg>
      </div>
      <div>
        <div style="font-size:13px;font-weight:700;color:#8B84FF;">Badge débloqué !</div>
        <div style="font-size:12px;color:rgba(255,255,255,0.55);">${badge.label}</div>
      </div>`;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 4000);
  }

  function renderBadgesGrid() {
    const el = document.getElementById('badges-grid');
    if (!el) return;
    el.innerHTML = BADGE_DEFINITIONS.map(b => {
      const unlocked = userBadges.includes(b.id);
      const [c1, c2] = b.colors;
      const glowColor = c1 + '55';
      return `<div style="text-align:center;padding:8px 4px;cursor:default;">
        <div style="width:64px;height:64px;border-radius:50%;margin:0 auto 8px;display:flex;align-items:center;justify-content:center;position:relative;
          background:${unlocked ? `linear-gradient(135deg,${c1},${c2})` : 'rgba(255,255,255,0.06)'};
          box-shadow:${unlocked ? `0 0 18px ${glowColor},0 4px 12px rgba(0,0,0,0.4)` : 'none'};
          filter:${unlocked ? 'none' : 'grayscale(1)'};opacity:${unlocked ? '1' : '0.38'};
          transition:transform .2s;">
          <svg viewBox="0 0 24 24" width="28" height="28" style="color:${unlocked ? '#fff' : 'rgba(255,255,255,0.6)'};">
            ${b.svg}
          </svg>
          ${unlocked ? '' : '<div style="position:absolute;inset:0;border-radius:50%;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.3);"><svg viewBox=\'0 0 24 24\' width=\'16\' height=\'16\'><path d=\'M12 1C8.676 1 6 3.676 6 7v1H4v15h16V8h-2V7c0-3.324-2.676-6-6-6zm0 2c2.276 0 4 1.724 4 4v1H8V7c0-2.276 1.724-4 4-4zm0 9a2 2 0 110 4 2 2 0 010-4z\' fill=\'rgba(255,255,255,0.5)\'/></svg></div>'}
        </div>
        <div style="font-size:11px;font-weight:700;color:${unlocked ? '#fff' : 'rgba(255,255,255,0.4)'};line-height:1.2;">${b.label}</div>
        <div style="font-size:9px;color:rgba(255,255,255,0.3);margin-top:2px;">${b.desc}</div>
      </div>`;
    }).join('');
  }

  // ── Register savings + stats views in router ─────────────────
  Object.assign(viewElements, {
    savings: document.getElementById('view-savings'),
    stats: document.getElementById('view-stats'),
  });

  // Wire up savings nav (4th button repurposed, or add savings button)
  // Listen for view switch to savings to render it
  const _savingsNavBtn = document.createElement('button');
  _savingsNavBtn.className = 'nav-item';
  _savingsNavBtn.dataset.view = 'savings';
  _savingsNavBtn.setAttribute('aria-label', 'Économies');
  _savingsNavBtn.innerHTML = '<div class="icon-container"><i class="ph-bold ph-piggy-bank"></i></div>';
  // Insert before profile button
  const _profileBtn = document.querySelector('.nav-item[data-view="profile"]');
  if (_profileBtn) _profileBtn.parentNode.insertBefore(_savingsNavBtn, _profileBtn);
  _savingsNavBtn.addEventListener('click', () => {
    switchView('savings');
    setTimeout(renderSavingsView, 50);
  });

  // When switching to savings/stats/profile, auto-render
  const _origSwitch = switchView;
  switchView = function(name) {
    _origSwitch(name);
    if (name === 'savings') setTimeout(renderSavingsView, 100);
    if (name === 'stats') setTimeout(renderStatsView, 100);
    if (name === 'profile') setTimeout(() => {
      refreshProfile();
      checkAndUnlockBadges();
      renderGamificationProfile();
      renderSavingsChart();
    }, 150);
  };

  // Stats nav button (alongside savings)
  const _statsNavBtn = document.createElement('button');
  _statsNavBtn.className = 'nav-item';
  _statsNavBtn.dataset.view = 'stats';
  _statsNavBtn.setAttribute('aria-label', 'Statistiques');
  _statsNavBtn.innerHTML = '<div class="icon-container"><i class="ph-bold ph-chart-line-up"></i></div>';
  const _savingsBtnRef = document.querySelector('.nav-item[data-view="savings"]');
  if (_savingsBtnRef) _savingsBtnRef.parentNode.insertBefore(_statsNavBtn, _savingsBtnRef);
  _statsNavBtn.addEventListener('click', () => switchView('stats'));

  // Track radar uses for badge
  const _origRadarScan = runRadarScan;
  document.getElementById('btn-radar-scan')?.addEventListener('click', () => {
    const count = parseInt(localStorage.getItem('fillz_radar_count') || '0');
    localStorage.setItem('fillz_radar_count', count + 1);
    setTimeout(() => checkAndUnlockBadges(), 3000);
  }, true);

  // Check alerts after data loads and check badges
  const _checkAfterLoad = setInterval(() => {
    if (dataLoaded) {
      clearInterval(_checkAfterLoad);
      setTimeout(() => {
        checkAndUnlockBadges();
        if (commute?.stations?.length) {
          // Re-render commute with saved station data from allStations
          const freshStations = commute.stations.map(cs => allStations.find(s => s.id === cs.id) || cs);
          commute.stations = freshStations;
          localStorage.setItem('fillz_commute', JSON.stringify(commute));
        }
      }, 800);
    }
  }, 500);

  // ── CROWDSOURCING LOGIC ──────────────────────────────────────
  document.body.addEventListener('click', async (e) => {
    const btnReportPrice = e.target.closest('#btn-report-price');
    if (btnReportPrice) {
      if (!currentUser) return alert('Vous devez être connecté pour signaler un prix.');
      document.getElementById('rep-fuel').value = selectedFuel;
      if (selectedStation && selectedStation.prices[selectedFuel]) {
         document.getElementById('rep-price').value = selectedStation.prices[selectedFuel];
      }
      document.getElementById('report-modal').style.display = 'flex';
      return;
    }

    const repCancel = e.target.closest('#rep-cancel');
    if (repCancel) {
      document.getElementById('report-modal').style.display = 'none';
      return;
    }

    const repSubmit = e.target.closest('#rep-submit');
    if (repSubmit) {
      const f = document.getElementById('rep-fuel').value;
      const p = parseFloat(document.getElementById('rep-price').value);
      if (!f || isNaN(p) || p <= 0) return alert('Veuillez entrer un prix valide.');

      try {
        repSubmit.disabled = true;
        repSubmit.textContent = 'Envoi...';

        await addDoc(collection(db, "price_reports"), {
          stationId: selectedStation.id,
          fuel: f,
          price: p,
          userId: currentUser.uid,
          timestamp: new Date()
        });

        // Appliquer localement le changement temporaire
        selectedStation.prices[f] = p;
        const cached = allStations.find(s => s.id === selectedStation.id);
        if (cached) cached.prices[f] = p;
        
        document.getElementById('report-modal').style.display = 'none';
        
        // Toast Custom de confirmation
        const toast = document.createElement('div');
        toast.style.cssText = 'position:fixed;bottom:80px;left:50%;transform:translateX(-50%);background:#22c55e;color:white;padding:12px 20px;border-radius:30px;font-weight:700;font-size:14px;box-shadow:0 10px 25px rgba(34,197,94,0.3);z-index:100000;opacity:0;transition:opacity 0.3s;pointer-events:none;white-space:nowrap;';
        toast.innerHTML = '<i class="ph-bold ph-check-circle"></i> Prix mis à jour';
        document.body.appendChild(toast);
        setTimeout(() => toast.style.opacity = '1', 50);
        setTimeout(() => {
          toast.style.opacity = '0';
          setTimeout(() => toast.remove(), 300);
        }, 3000);
        
        showStationDetails(selectedStation);
      } catch(err) {
        console.error(err);
        alert('Erreur: ' + err.message);
      } finally {
        repSubmit.disabled = false;
        repSubmit.textContent = 'Valider';
      }
    }
  });

  window.showLegalModal = function(url, title) {
    let modal = document.getElementById('legal-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'legal-modal';
      modal.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:var(--bg-main, #0A0A0F);z-index:999999;display:flex;flex-direction:column;';
      document.body.appendChild(modal);
    }
    modal.style.display = 'flex';
    modal.innerHTML = `
      <div style="height:60px;display:flex;align-items:center;padding:0 20px;background:rgba(255,255,255,0.05);border-bottom:1px solid rgba(255,255,255,0.1);flex-shrink:0;">
        <button onclick="document.getElementById('legal-modal').style.display='none'" style="background:none;border:none;color:#8B84FF;font-size:16px;font-weight:600;display:flex;align-items:center;gap:6px;padding:0;cursor:pointer;">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="15 18 9 12 15 6"/></svg> Retour
        </button>
        <span style="margin:0 auto;font-weight:700;font-size:16px;color:white;text-align:center;">${title}</span>
        <div style="width:70px;"></div> <!-- Spacer for centering -->
      </div>
      <div style="flex:1;overflow:hidden;background:white;">
        <iframe src="${url}" style="width:100%;height:100%;border:none;"></iframe>
      </div>
    `;
  };

});
