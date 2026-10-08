const {setGlobalOptions} = require("firebase-functions");
const {onRequest} = require("firebase-functions/https");
const {onSchedule} = require("firebase-functions/v2/scheduler");
const logger = require("firebase-functions/logger");
const admin = require("firebase-admin");
const {gzipSync} = require("node:zlib");

admin.initializeApp();
setGlobalOptions({ maxInstances: 10 });

// ── TCS Proxy ──────────────────────────────────────────────────────────────
// Champs Minetur réellement consommés par le client (webapp/src/api.js).
// Le payload complet fait ~12 Mo (41 champs/station) ; réduit ≈ 4 Mo, ≈ 0,5 Mo gzippé.
const ES_KEEP_FIELDS = [
  "IDEESS", "Latitud", "Longitud (WGS84)", "Rótulo", "Municipio", "Localidad", "Dirección",
  "Precio Gasolina 95 E5", "Precio Gasolina 98 E5", "Precio Gasoleo A",
  "Precio Gasoleo Premium", "Precio Gases licuados del petróleo", "Precio Bioetanol",
];

exports.tcsProxy = onRequest({ cors: true, memory: "512MiB", timeoutSeconds: 60 }, async (req, res) => {
  try {
    let targetUrl;
    const isES = req.url.startsWith("/api/es");
    if (isES) {
      // API officielle espagnole (Minetur) — pas de CORS, renvoie du XML sans Accept JSON.
      targetUrl = "https://sedeaplicaciones.minetur.gob.es/ServiciosRESTCarburantes/PreciosCarburantes/EstacionesTerrestres/";
    } else if (req.url.startsWith("/api/benzin")) {
      const path = req.url.replace(/^\/api\/benzin/, "");
      targetUrl = "https://europe-west6-tcs-digitalbackend.cloudfunctions.net" + path;
    } else {
      const path = req.url.replace(/^\/api\/tcs/, "");
      targetUrl = "https://firestore.googleapis.com" + path;
    }

    const fetchOptions = {
      method: isES ? "GET" : req.method,
      headers: isES
        ? { "Accept": "application/json" }
        : {
            "Content-Type": "application/json",
            "Referer": "https://benzin.tcs.ch/",
            "Origin": "https://benzin.tcs.ch"
          }
    };

    if (!isES && req.method !== 'GET' && req.method !== 'HEAD') {
      fetchOptions.body = req.rawBody ? req.rawBody.toString() : JSON.stringify(req.body);
    }

    const response = await fetch(targetUrl, fetchOptions);

    if (!response.ok) {
      const errorText = await response.text();
      logger.error(`Erreur cible: ${response.status}`, errorText);
      return res.status(response.status).send(errorText);
    }

    const data = await response.json();

    if (isES) {
      const trimmed = {
        Fecha: data.Fecha,
        ListaEESSPrecio: (data.ListaEESSPrecio || []).map((s) => {
          const out = {};
          for (const k of ES_KEEP_FIELDS) {
            const v = s[k];
            if (v !== undefined && v !== null && v !== "") out[k] = v;
          }
          return out;
        }),
      };
      // Cache CDN Firebase Hosting : les requêtes suivantes ne repayent pas
      // les ~10-25 s de l'API Minetur pendant 1 h (les prix ES changent peu).
      res.set("Cache-Control", "public, max-age=300, s-maxage=3600");
      res.set("Vary", "Accept-Encoding");
      res.set("Content-Type", "application/json; charset=utf-8");
      const body = Buffer.from(JSON.stringify(trimmed), "utf8");
      if ((req.headers["accept-encoding"] || "").includes("gzip")) {
        res.set("Content-Encoding", "gzip");
        return res.status(200).send(gzipSync(body));
      }
      return res.status(200).send(body);
    }

    return res.status(200).json(data);
  } catch (error) {
    logger.error("Erreur proxy interne:", error);
    return res.status(500).json({ error: error.message });
  }
});

// ── Widget API ─────────────────────────────────────────────────────────────
exports.widgetAPI = onRequest({ cors: true }, async (req, res) => {
  try {
    const stationId = req.query.id;
    if (!stationId) return res.status(400).json({ error: "Missing 'id' parameter" });

    const targetUrl = `https://firestore.googleapis.com/v1/projects/tcs-ext-prod/databases/(default)/documents/stations/${stationId}`;

    const response = await fetch(targetUrl, {
      headers: {
        "Content-Type": "application/json",
        "Referer": "https://benzin.tcs.ch/",
        "Origin": "https://benzin.tcs.ch"
      }
    });

    if (!response.ok) {
      return res.status(response.status).json({ error: "Station introuvable" });
    }

    const doc = await response.json();
    const fields = doc.fields || {};

    const result = {
      id: doc.name.split('/').pop(),
      name: fields.name?.stringValue || "Inconnu",
      address: `${fields.address?.stringValue || ""}, ${fields.city?.stringValue || ""}`,
      prices: {},
      updatedAt: fields.updatedAt?.timestampValue || null
    };

    if (fields.prices?.mapValue?.fields) {
      Object.entries(fields.prices.mapValue.fields).forEach(([type, pField]) => {
        if (pField.mapValue?.fields?.amount) {
          result.prices[type] = pField.mapValue.fields.amount.doubleValue
            || pField.mapValue.fields.amount.integerValue
            || null;
        }
      });
    }

    return res.status(200).json(result);
  } catch (error) {
    logger.error("Erreur widgetAPI:", error);
    return res.status(500).json({ error: error.message });
  }
});

// ── Sync horaire des prix TCS → Firestore ──────────────────────────────────
// Récupère les prix TCS chaque heure, compare avec le snapshot stocké,
// et ne met à jour updatedAt QUE si le prix a réellement changé.
const BENZIN_API = "https://europe-west6-tcs-digitalbackend.cloudfunctions.net/benzinGetStationByBbox";
const CH_BBOX = [5.9, 45.8, 10.6, 47.8]; // Suisse entière
const SYNC_FUELS = ["SP95", "SP98", "DIESEL", "GPL"];
const FUEL_DISPLAY_MAP = { SP95: "SP95", SP98: "SP98", DIESEL: "Diesel", GPL: "GPL", GNC: "GNC" };

async function fetchAllStations() {
  const settled = await Promise.allSettled(
    SYNC_FUELS.map(fuel =>
      fetch(BENZIN_API, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Referer": "https://benzin.tcs.ch/", "Origin": "https://benzin.tcs.ch" },
        body: JSON.stringify({ bbox: CH_BBOX, zoom: 14, pixelRatio: 1, filters: { fuel } }),
      }).then(r => r.json()).then(items => ({ fuel, items: Array.isArray(items) ? items : [] }))
    )
  );
  const results = settled.filter(r => r.status === "fulfilled").map(r => r.value);

  const map = {};
  results.forEach(({ fuel, items }) => {
    items.filter(s => !s.cluster && s.price > 0).forEach(s => {
      const id = String(s.id);
      if (!map[id]) map[id] = { id, prices: {} };
      map[id].prices[FUEL_DISPLAY_MAP[fuel] || fuel] = s.price.toFixed(3);
    });
  });

  return Object.values(map).filter(s => Object.keys(s.prices).length > 0);
}

exports.syncStationPrices = onSchedule({
  schedule: "every 60 minutes",
  region: "europe-west6",
  timeoutSeconds: 300,
  memory: "512MiB",
}, async () => {
  const db = admin.firestore();

  // 1. Fetch live data depuis le nouvel endpoint TCS
  const freshStations = await fetchAllStations();

  // 2. Read existing snapshot (prices + timestamps) from our Firestore
  const snapshotRef = db.collection("stations_meta").doc("snapshot");
  const snap = await snapshotRef.get();
  const oldPrices = snap.exists ? (snap.data().prices ?? {}) : {};
  const oldTimestamps = snap.exists ? (snap.data().timestamps ?? {}) : {};

  // 3. Diff: only advance timestamp when a price actually changed
  const now = new Date().toISOString();
  const newPrices = {};
  const newTimestamps = {};
  let changed = 0;

  for (const st of freshStations) {
    newPrices[st.id] = st.prices;
    const prev = oldPrices[st.id];
    const priceChanged = !prev
      || Object.entries(st.prices).some(([fuel, price]) => prev[fuel] !== price);

    if (priceChanged) {
      newTimestamps[st.id] = now;
      changed++;
    } else {
      newTimestamps[st.id] = oldTimestamps[st.id] ?? now;
    }
  }

  // 4. Write updated snapshot (single document write)
  await snapshotRef.set({ prices: newPrices, timestamps: newTimestamps });

  // 5. Write daily price history snapshot (once per day, first run after midnight)
  const todayStr = new Date().toISOString().slice(0, 10);
  const histRef = db.collection("price_history").doc(todayStr);
  const histSnap = await histRef.get();
  if (!histSnap.exists) {
    const dailySnapshot = {};
    for (const st of freshStations) {
      dailySnapshot[st.id] = st.prices;
    }
    await histRef.set(dailySnapshot);
    logger.info(`price_history/${todayStr} créé (${freshStations.length} stations)`);
  }

  logger.info(`syncStationPrices: ${freshStations.length} stations, ${changed} changements de prix`);
});

// ── Portugal : agrégation DGEG → Firestore (stations_pt/snapshot) ───────────
// L'API DGEG n'a pas de dump national propre : on interroge PesquisarPostos
// par type de carburant (coords + prix en masse) et on fusionne par station.
const DGEG_BASE = "https://precoscombustiveis.dgeg.gov.pt/api/PrecoComb";
const PT_FUEL_MAP = {
  "Gasóleo simples": "Diesel",
  "Gasóleo especial": "Diesel Premium",
  "Gasolina simples 95": "SP95",
  "Gasolina 98": "SP98",
  "GPL Auto": "GPL",
};

function parsePtPrice(raw) {
  // "1,689 €/litro" ou "1,689 €" → 1.689
  if (!raw) return null;
  const n = parseFloat(String(raw).replace(",", ".").replace(/[^0-9.]/g, ""));
  return isNaN(n) ? null : n;
}

async function fetchPortugalStations() {
  // 1. IDs des carburants qui nous intéressent (robuste aux changements d'ID)
  const typesRes = await fetch(`${DGEG_BASE}/GetTiposCombustiveis`, { headers: { Accept: "application/json" } });
  const typesJson = await typesRes.json();
  const wanted = (typesJson.resultado || [])
    .filter(t => PT_FUEL_MAP[t.Descritivo])
    .map(t => ({ id: t.Id, fuel: PT_FUEL_MAP[t.Descritivo] }));

  // 2. Pour chaque carburant : paginer PesquisarPostos et fusionner par station
  const map = {};
  for (const { id, fuel } of wanted) {
    const perPage = 5000;
    for (let pagina = 1; pagina <= 5; pagina++) {
      const url = `${DGEG_BASE}/PesquisarPostos?idsTiposComb=${id}&pagina=${pagina}&qtdPorPagina=${perPage}`;
      const r = await fetch(url, { headers: { Accept: "application/json" } });
      if (!r.ok) break;
      const j = await r.json();
      const rows = j.resultado || [];
      for (const row of rows) {
        const lat = Number(row.Latitude);
        const lng = Number(row.Longitude);
        if (!lat || !lng) continue;
        const sid = "PT_" + row.Id;
        if (!map[sid]) {
          map[sid] = {
            id: sid,
            name: String(row.Nome || row.Marca || "Posto").slice(0, 60),
            brand: row.Marca || "",
            city: row.Localidade || row.Municipio || "",
            lat, lng,
            prices: {},
            country: "PT",
          };
        }
        const price = parsePtPrice(row.Preco);
        if (price !== null) map[sid].prices[fuel] = price.toFixed(3);
      }
      if (rows.length < perPage) break;
    }
  }
  return Object.values(map).filter(s => Object.keys(s.prices).length > 0);
}

async function runPortugalSync() {
  const stations = await fetchPortugalStations();
  if (!stations.length) {
    logger.warn("Portugal sync: 0 station récupérée — snapshot précédent conservé");
    return 0;
  }
  await admin.firestore().collection("stations_pt").doc("snapshot").set({ ts: Date.now(), stations });
  logger.info(`Portugal sync: ${stations.length} stations PT écrites`);
  return stations.length;
}

exports.syncPortugalStations = onSchedule({
  schedule: "every 12 hours",
  region: "europe-west6",
  timeoutSeconds: 540,
  memory: "512MiB",
}, async () => {
  try { await runPortugalSync(); } catch (e) { logger.error("syncPortugalStations échec:", e); }
});

// Déclenchement manuel (admin) — permet de peupler/rafraîchir le Portugal à la demande.
const ADMIN_EMAIL = "pro.caetanodany@gmail.com";
exports.syncPortugalNow = onRequest({ cors: true, timeoutSeconds: 540, memory: "512MiB" }, async (req, res) => {
  try {
    const authHeader = req.headers.authorization || "";
    if (!authHeader.startsWith("Bearer ")) return res.status(401).json({ error: "Non authentifié" });
    const decoded = await admin.auth().verifyIdToken(authHeader.slice(7));
    if (decoded.email !== ADMIN_EMAIL) return res.status(403).json({ error: "Réservé à l'administrateur" });
    const count = await runPortugalSync();
    return res.json({ ok: true, count });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});
