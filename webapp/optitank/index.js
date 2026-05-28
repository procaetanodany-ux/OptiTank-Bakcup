const {setGlobalOptions} = require("firebase-functions");
const {onRequest} = require("firebase-functions/https");
const {onSchedule} = require("firebase-functions/v2/scheduler");
const logger = require("firebase-functions/logger");
const admin = require("firebase-admin");

admin.initializeApp();
setGlobalOptions({ maxInstances: 10 });

// ── TCS Proxy ──────────────────────────────────────────────────────────────
exports.tcsProxy = onRequest({ cors: true }, async (req, res) => {
  try {
    let targetUrl;
    if (req.url.startsWith("/api/benzin")) {
      const path = req.url.replace(/^\/api\/benzin/, "");
      targetUrl = "https://europe-west6-tcs-digitalbackend.cloudfunctions.net" + path;
    } else {
      const path = req.url.replace(/^\/api\/tcs/, "");
      targetUrl = "https://firestore.googleapis.com" + path;
    }

    const fetchOptions = {
      method: req.method,
      headers: {
        "Content-Type": "application/json",
        "Referer": "https://benzin.tcs.ch/",
        "Origin": "https://benzin.tcs.ch"
      }
    };

    if (req.method !== 'GET' && req.method !== 'HEAD') {
      fetchOptions.body = req.rawBody ? req.rawBody.toString() : JSON.stringify(req.body);
    }

    const response = await fetch(targetUrl, fetchOptions);

    if (!response.ok) {
      const errorText = await response.text();
      logger.error(`Erreur cible: ${response.status}`, errorText);
      return res.status(response.status).send(errorText);
    }

    const data = await response.json();
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
