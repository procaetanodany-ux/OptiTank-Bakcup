/**
 * api.js - Connexion à l'API Firestore du TCS (benzin.tcs.ch)
 * Structure réelle des documents identifiée par debug:
 * - displayName, formattedAddress, brand, location{lat,lng}, fuelCollection{SP95{displayPrice}...}
 * - Project ID: tcs-benzin
 */

import { db } from './firebase.js';
import { doc, getDoc } from 'firebase/firestore';

// ── Cache IndexedDB pour les gros jeux de stations ──────────────────────────
// localStorage est limité à ~5 Mo : avec FR/ES activés, les setItem échouaient
// silencieusement et chaque lancement retéléchargeait tout. IndexedDB n'a pas
// cette limite ; localStorage reste utilisé en secours s'il est indisponible.
const IDB_NAME = 'fillz-cache';
const IDB_STORE = 'kv';

function idbOpen() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(IDB_STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function idbCall(mode, fn) {
  return idbOpen().then(dbi => new Promise((resolve, reject) => {
    const tx = dbi.transaction(IDB_STORE, mode);
    const rq = fn(tx.objectStore(IDB_STORE));
    tx.oncomplete = () => { dbi.close(); resolve(rq.result); };
    tx.onerror = () => { dbi.close(); reject(tx.error); };
    tx.onabort = () => { dbi.close(); reject(tx.error); };
  }));
}

export async function cacheGet(key) {
  try {
    return (await idbCall('readonly', store => store.get(key))) ?? null;
  } catch {
    try { return JSON.parse(localStorage.getItem(key) || 'null'); } catch { return null; }
  }
}

export async function cacheSet(key, value) {
  try {
    await idbCall('readwrite', store => store.put(value, key));
  } catch {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* quota — pas bloquant */ }
  }
}

export const STATION_CACHE_KEYS = [
  'fillz_stations_cache_v8', 'fillz_stations_fr_v3', 'fillz_stations_es_v1',
  'fillz_stations_pt_v1', 'fillz_admin_stations_cache',
];

export async function clearStationCache(keys = STATION_CACHE_KEYS) {
  for (const k of keys) {
    try { await idbCall('readwrite', store => store.delete(k)); } catch {}
    try { localStorage.removeItem(k); } catch {}
  }
}

// Libère l'ancien cache localStorage (souvent saturé), désormais en IndexedDB.
for (const k of STATION_CACHE_KEYS) {
  try { localStorage.removeItem(k); } catch {}
}

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

// On force toujours l'URL absolue de Firebase Hosting pour que ça marche depuis TestFlight (où le protocole n'est pas http)
const API_BASE = 'https://optitank-c7709.web.app';
const BENZIN_API = `${API_BASE}/api/benzin/benzinGetStationByBbox`;
const ES_API = `${API_BASE}/api/es`;
const CH_BBOX = [5.9, 45.8, 10.6, 47.8];
const FETCH_FUELS = ['SP95', 'SP98', 'DIESEL', 'DIESEL_PREMIUM', 'GPL', 'E85'];
const FUEL_LABEL = { SP95: 'SP95', SP98: 'SP98', DIESEL: 'Diesel', DIESEL_PREMIUM: 'Diesel Premium', GPL: 'GPL', GNC: 'GNC', E85: 'E85' };

// Pays optionnels activables (la Suisse est toujours chargée).
// Chaque entrée : flag localStorage + fonction de récupération.
const COUNTRY_FETCHERS = {
  FR: { key: 'fillz_enable_france',   fetch: fetchFRStations },
  ES: { key: 'fillz_enable_spain',    fetch: fetchESStations },
  PT: { key: 'fillz_enable_portugal', fetch: fetchPTStations },
};

/**
 * Récupère toutes les stations : Suisse (toujours) + chaque pays activé.
 * @param {boolean} forceAll - si true, charge tous les pays (usage admin) en ignorant les toggles.
 */
export async function fetchAllStations(forceAll = false) {
  const enabled = Object.values(COUNTRY_FETCHERS).filter(
    c => forceAll || localStorage.getItem(c.key) === 'true'
  );
  const results = await Promise.all([
    fetchTCSStations(),
    ...enabled.map(c => c.fetch().catch(() => [])),
  ]);
  return results.flat();
}

async function fetchTCSStations() {
  const CACHE_KEY = 'fillz_stations_cache_v8';
  const CACHE_TTL = 60 * 60 * 1000; // 1 hour

  const cached = await cacheGet(CACHE_KEY);
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return cached.data.map(s => ({ ...s, country: 'CH' }));
  }

  // TCS fetch est critique — si ça échoue on retourne []
  let tcsData;
  try {
    tcsData = await fetchFromTCS();
    tcsData.forEach(s => s.country = 'CH');
  } catch (error) {
    console.error('Erreur API TCS:', error);
    return [];
  }

  // Timestamps Firestore
  try {
    const timestamps = await fetchTimestamps();
    tcsData.forEach(st => {
      st.updatedAt = timestamps[st.id] || (Date.now() - Math.floor(Math.random() * 3600000));
    });
  } catch(e) {}

  // Sauvegarder avec timestamps
  if (tcsData && tcsData.length > 0) {
    await cacheSet(CACHE_KEY, { ts: Date.now(), data: tcsData });
  }

  return tcsData;
}

async function fetchFRStations() {
  const CACHE_KEY = 'fillz_stations_fr_v3';
  const CACHE_TTL = 60 * 60 * 1000 * 12; // 12 hours cache

  const cached = await cacheGet(CACHE_KEY);
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return cached.data;
  }

  try {
    // select= limite l'export aux champs utilisés : ~2,3 Mo au lieu de ~4,5 Mo.
    const resp = await fetch('https://data.economie.gouv.fr/api/explore/v2.1/catalog/datasets/prix-des-carburants-en-france-flux-instantane-v2/exports/json'
      + '?select=' + encodeURIComponent('id,geom,adresse,cp,ville,sp95_prix,sp98_prix,gazole_prix,e85_prix,gplc_prix'));
    if (!resp.ok) throw new Error('Erreur API France');
    
    const records = await resp.json();
    const frStations = [];
    const CHUNK_SIZE = 1000;
    
    // Traitement par blocs pour ne pas bloquer le thread UI
    await new Promise((resolve) => {
      let index = 0;
      function processChunk() {
        const end = Math.min(index + CHUNK_SIZE, records.length);
        for (let i = index; i < end; i++) {
          const s = records[i];
          if (!s.geom || !s.geom.lat || !s.geom.lon) continue;
          
          const prices = {};
          if (s.sp95_prix) prices['SP95'] = s.sp95_prix.toFixed(3);
          if (s.sp98_prix) prices['SP98'] = s.sp98_prix.toFixed(3);
          if (s.gazole_prix) prices['Diesel'] = s.gazole_prix.toFixed(3);
          if (s.e85_prix) prices['E85'] = s.e85_prix.toFixed(3);
          if (s.gplc_prix) prices['GPL'] = s.gplc_prix.toFixed(3);

          if (Object.keys(prices).length === 0) continue;

          const addressFull = `${s.adresse || ''}, ${s.cp || ''} ${s.ville || ''}`.replace(/^, /, '');

          frStations.push({
            id: 'FR_' + s.id,
            name: s.ville ? `${s.ville} - ${s.adresse || 'Station'}` : s.adresse || 'Station France',
            brand: 'Station France',
            address: addressFull,
            city: s.ville || '',
            lat: s.geom.lat,
            lng: s.geom.lon,
            prices,
            country: 'FR',
            updatedAt: Date.now() - Math.floor(Math.random() * 3600000),
            defaultDisplayPrice: '€ ' + (prices['SP95'] || prices['Diesel'] || Object.values(prices)[0]),
            availableFuels: Object.keys(prices),
          });
        }
        index = end;
        if (index < records.length) {
          setTimeout(processChunk, 0); // Yield main thread
        } else {
          resolve();
        }
      }
      processChunk();
    });

    console.log('France: ' + frStations.length + ' stations chargées');

    await cacheSet(CACHE_KEY, { ts: Date.now(), data: frStations });

    return frStations;
  } catch (err) {
    console.error('Erreur API FR:', err);
    return [];
  }
}

// ── Espagne : API officielle Minetur (via proxy /api/es pour le CORS) ──
const FUEL_MAP_ES = {
  'Precio Gasolina 95 E5': 'SP95',
  'Precio Gasolina 98 E5': 'SP98',
  'Precio Gasoleo A': 'Diesel',
  'Precio Gasoleo Premium': 'Diesel Premium',
  'Precio Gases licuados del petróleo': 'GPL',
  'Precio Bioetanol': 'E85',
};

async function fetchESStations() {
  const CACHE_KEY = 'fillz_stations_es_v1';
  const CACHE_TTL = 60 * 60 * 1000 * 12; // 12 h

  const cached = await cacheGet(CACHE_KEY);
  if (cached && Date.now() - cached.ts < CACHE_TTL) return cached.data;

  // Décimales espagnoles : "1,459" → 1.459
  const num = v => {
    if (v === undefined || v === null || v === '') return null;
    const n = parseFloat(String(v).replace(',', '.'));
    return isNaN(n) ? null : n;
  };

  try {
    const resp = await fetch(ES_API);
    if (!resp.ok) throw new Error('Erreur API Espagne');
    const json = await resp.json();
    const list = json.ListaEESSPrecio || [];
    const esStations = [];
    const CHUNK_SIZE = 1000;

    await new Promise((resolve) => {
      let index = 0;
      function processChunk() {
        const end = Math.min(index + CHUNK_SIZE, list.length);
        for (let i = index; i < end; i++) {
          const s = list[i];
          const lat = num(s['Latitud']);
          const lng = num(s['Longitud (WGS84)']);
          if (lat === null || lng === null) continue;

          const prices = {};
          for (const [k, fuel] of Object.entries(FUEL_MAP_ES)) {
            const p = num(s[k]);
            if (p !== null) prices[fuel] = p.toFixed(3);
          }
          if (Object.keys(prices).length === 0) continue;

          const brand = (s['Rótulo'] || '').trim();
          const city = (s['Municipio'] || s['Localidad'] || '').trim();
          const address = `${s['Dirección'] || ''}, ${city}`.replace(/^, /, '');

          esStations.push({
            id: 'ES_' + s['IDEESS'],
            name: city ? `${city} - ${brand || 'Estación'}` : (brand || 'Estación'),
            brand,
            address,
            city,
            lat,
            lng,
            prices,
            country: 'ES',
            updatedAt: Date.now() - Math.floor(Math.random() * 3600000),
            defaultDisplayPrice: '€ ' + (prices['SP95'] || prices['Diesel'] || Object.values(prices)[0]),
            availableFuels: Object.keys(prices),
          });
        }
        index = end;
        if (index < list.length) setTimeout(processChunk, 0);
        else resolve();
      }
      processChunk();
    });

    console.log('Espagne: ' + esStations.length + ' stations chargées');
    await cacheSet(CACHE_KEY, { ts: Date.now(), data: esStations });
    return esStations;
  } catch (err) {
    console.error('Erreur API ES:', err);
    return [];
  }
}

// ── Portugal : snapshot agrégé par le cron backend (Firestore stations_pt) ──
async function fetchPTStations() {
  const CACHE_KEY = 'fillz_stations_pt_v1';
  const CACHE_TTL = 60 * 60 * 1000 * 12; // 12 h

  const cached = await cacheGet(CACHE_KEY);
  if (cached && Date.now() - cached.ts < CACHE_TTL) return cached.data;

  try {
    const snap = await getDoc(doc(db, 'stations_pt', 'snapshot'));
    if (!snap.exists()) return [];
    const raw = snap.data().stations || [];
    const ptStations = raw.map(s => ({
      ...s,
      country: 'PT',
      updatedAt: s.updatedAt || (snap.data().ts ?? Date.now()),
      defaultDisplayPrice: '€ ' + (s.prices?.['SP95'] || s.prices?.['Diesel'] || Object.values(s.prices || {})[0] || ''),
      availableFuels: Object.keys(s.prices || {}),
    }));
    console.log('Portugal: ' + ptStations.length + ' stations chargées');
    await cacheSet(CACHE_KEY, { ts: Date.now(), data: ptStations });
    return ptStations;
  } catch (err) {
    console.error('Erreur API PT:', err);
    return [];
  }
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
        const address = (s.formattedAddress && s.formattedAddress.toLowerCase() !== 'undefined' && s.formattedAddress.toLowerCase() !== 'null') ? s.formattedAddress : '';
        let extractedCity = '';
        if (address) {
          const match = address.match(/\b\d{4}\s+([^,]+)/);
          if (match) extractedCity = match[1].trim();
          else {
            const parts = address.split(',');
            extractedCity = parts[parts.length - 1].replace(/\b\d{4}\b/g, '').trim();
          }
        }
        map[id] = {
          id,
          name: s.displayName || rawBrand || 'Station',
          brand: (rawBrand && rawBrand.toLowerCase() !== 'undefined' && rawBrand.toLowerCase() !== 'null') ? rawBrand : '',
          address,
          city: extractedCity,
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
