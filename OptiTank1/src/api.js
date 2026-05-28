/**
 * api.js - Connexion à l'API Firestore du TCS (benzin.tcs.ch)
 * Structure réelle des documents identifiée par debug:
 * - displayName, formattedAddress, brand, location{lat,lng}, fuelCollection{SP95{displayPrice}...}
 * - Project ID: tcs-benzin
 */

import { db } from './firebase.js';
import { doc, getDoc } from 'firebase/firestore';

/**
 * Récupère l'historique des prix d'une station depuis Firestore (14 derniers jours).
 * Résultat mis en cache dans sessionStorage pour la durée de la session.
 * Retourne un objet { "YYYY-MM-DD": { SP95: "1.789", ... }, ... } trié du plus ancien au plus récent.
 */
export async function fetchStationHistory(stationId, numDays = 14) {
  const cacheKey = `fillz_hist_${stationId}`;
  const cached = sessionStorage.getItem(cacheKey);
  if (cached) return JSON.parse(cached);

  // Build list of date strings: oldest → newest
  const dates = Array.from({ length: numDays }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (numDays - 1 - i));
    return d.toISOString().slice(0, 10);
  });

  try {
    const snaps = await Promise.all(dates.map(date => getDoc(doc(db, 'price_history', date))));
    const history = {};
    snaps.forEach((snap, i) => {
      if (snap.exists()) {
        const prices = snap.data()[stationId];
        if (prices) history[dates[i]] = prices;
      }
    });
    sessionStorage.setItem(cacheKey, JSON.stringify(history));
    return history;
  } catch {
    return {};
  }
}

const BENZIN_API = '/api/benzin/benzinGetStationByBbox';
const CH_BBOX = [5.9, 45.8, 10.6, 47.8];
const FETCH_FUELS = ['SP95', 'SP98', 'DIESEL', 'DIESEL_PREMIUM', 'GPL', 'GNC', 'E85'];
const FUEL_LABEL = { SP95: 'SP95', SP98: 'SP98', DIESEL: 'Diesel', DIESEL_PREMIUM: 'Diesel Premium', GPL: 'GPL', GNC: 'GNC', E85: 'E85' };

/**
 * Récupère TOUTES les stations non-supprimées depuis Firestore
 */
export async function fetchTCSStations() {
  const CACHE_KEY = 'fillz_stations_cache_v3';
  const CACHE_TTL = 60 * 60 * 1000; // 1 hour

  const cached = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return cached.data;
  }

  // TCS fetch est critique — si ça échoue on retourne []
  let tcsData;
  try {
    tcsData = await fetchFromTCS();
  } catch (error) {
    console.error('Erreur API TCS:', error);
    return [];
  }

  // Timestamps Firestore est cosmétique — jamais bloquant
  fetchTimestamps().then(timestamps => {
    tcsData.forEach(st => {
      if (timestamps[st.id]) st.updatedAt = timestamps[st.id];
    });
  }).catch(() => {});

  // Sauvegarder sans timestamps (ils seront là au prochain refresh via cache)
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), data: tcsData }));
  } catch { /* quota dépassé — pas bloquant */ }

  return tcsData;
}

async function fetchFromTCS() {
  // Fetch toutes les fuels en parallèle depuis le nouvel endpoint TCS
  const settled = await Promise.allSettled(
    FETCH_FUELS.map(fuel =>
      fetch(BENZIN_API, {
        method: 'POST',
        credentials: 'omit',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bbox: CH_BBOX, zoom: 14, pixelRatio: 1, filters: { fuel } })
      }).then(async r => { if (!r.ok) { const t = await r.text().catch(()=>''); throw new Error('HTTP ' + r.status + ' ' + t.slice(0,200)); } return r.json(); })
        .then(items => ({ fuel, items: Array.isArray(items) ? items : [] }))
    )
  );
  const results = settled
    .filter(r => r.status === 'fulfilled')
    .map(r => r.value);

  // Fusionner par station ID
  const map = {};
  results.forEach(({ fuel, items }) => {
    items.filter(s => !s.cluster && s.price > 0).forEach(s => {
      const id = String(s.id);
      if (!map[id]) {
        const rawBrand = s.brand;
        map[id] = {
          id,
          name: s.displayName || rawBrand || 'Station',
          brand: (rawBrand && rawBrand !== 'undefined' && rawBrand !== 'null') ? rawBrand : '',
          address: s.formattedAddress || '',
          lat: s.latitude,
          lng: s.longitude,
          prices: {},
        };
      }
      map[id].prices[FUEL_LABEL[fuel] || fuel] = s.price.toFixed(3);
    });
  });

  const stations = Object.values(map)
    .filter(s => Object.keys(s.prices).length > 0)
    .map(s => ({
      ...s,
      defaultDisplayPrice: 'CHF ' + (s.prices['SP95'] || s.prices['Diesel'] || Object.values(s.prices)[0]),
      availableFuels: Object.keys(s.prices),
    }));

  console.log('TCS: ' + stations.length + ' stations chargées');
  return stations;
}

async function fetchTimestamps() {
  try {
    const snap = await getDoc(doc(db, 'stations_meta', 'snapshot'));
    return snap.exists() ? (snap.data()?.timestamps ?? {}) : {};
  } catch {
    return {};
  }
}
