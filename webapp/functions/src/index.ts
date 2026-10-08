import { onRequest } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { defineSecret } from "firebase-functions/params";
import { setGlobalOptions } from "firebase-functions";
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import apn from "@parse/node-apn";
import { GoogleGenAI, Type } from "@google/genai";

initializeApp();
setGlobalOptions({ maxInstances: 10, region: "us-central1" });

const apnsKey = defineSecret("APNS_PRIVATE_KEY");
const geminiKey = defineSecret("GEMINI_API_KEY");

const APNS_KEY_ID  = "G4GY77QX25";
const APNS_TEAM_ID = "8X44B5MQDF";
const APNS_BUNDLE  = "online.optitank.app";

async function sendAPNS(
  deviceToken: string | string[],
  title: string,
  body: string,
  payload?: Record<string, string>
): Promise<void> {
  const keyValue = apnsKey.value().replace(/\\n/g, "\n");
  const notif = new apn.Notification();
  notif.alert = { title, body };
  notif.topic = APNS_BUNDLE;
  notif.sound = "default";
  if (payload) notif.payload = payload;

  // Les apps App Store / TestFlight ont des jetons de production, les builds Xcode des
  // jetons sandbox : on essaie la production, puis le sandbox pour les jetons refusés.
  const send = async (production: boolean, tokens: string | string[]) => {
    const provider = new apn.Provider({
      token: { key: keyValue, keyId: APNS_KEY_ID, teamId: APNS_TEAM_ID },
      production,
    });
    try {
      return await provider.send(notif, tokens);
    } finally {
      provider.shutdown();
    }
  };

  let result = await send(true, deviceToken);
  const retry = result.failed
    .filter((f) => f.response?.reason === "BadDeviceToken")
    .map((f) => f.device);
  const sent = result.sent.length;
  if (retry.length > 0) result = await send(false, retry);

  if (sent === 0 && result.sent.length === 0 && result.failed.length > 0) {
    throw new Error(result.failed[0].response?.reason ?? "APNs send failed");
  }
}

export const sendPushNotif = onRequest(
  { secrets: [apnsKey], invoker: "public", cors: true },
  async (req, res) => {
    const authHeader = req.headers.authorization ?? "";
    if (!authHeader.startsWith("Bearer ")) {
      res.status(401).json({ error: "Non authentifié" });
      return;
    }
    try {
      await getAuth().verifyIdToken(authHeader.slice(7));
    } catch {
      res.status(401).json({ error: "Token invalide" });
      return;
    }

    const parsed = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    const { token, title, body, data } = parsed as {
      token: string | string[];
      title: string;
      body: string;
      data?: Record<string, string>;
    };

    if (!token || (Array.isArray(token) && token.length === 0) || !title || !body) {
      res.status(400).json({ error: "token, title et body requis" });
      return;
    }

    try {
      await sendAPNS(token, title, body, data);
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e?.message ?? "Erreur APNs" });
    }
  }
);

// ── NOUVELLE FONCTION CRON POUR ALERTES PRIX ──

const BENZIN_API = "https://europe-west6-tcs-digitalbackend.cloudfunctions.net/benzinGetStationByBbox";
const CH_BBOX = [5.9, 45.8, 10.6, 47.8];
const FETCH_FUELS = ['SP95', 'SP98', 'DIESEL', 'DIESEL_PREMIUM', 'GPL', 'E85'];
const FUEL_LABEL: Record<string, string> = { SP95: 'SP95', SP98: 'SP98', DIESEL: 'Diesel', DIESEL_PREMIUM: 'Diesel Premium', GPL: 'GPL', GNC: 'GNC', E85: 'E85' };

function getDistKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const p = 0.017453292519943295;
  const c = Math.cos;
  const a = 0.5 - c((lat2 - lat1) * p)/2 + c(lat1 * p) * c(lat2 * p) * (1 - c((lon2 - lon1) * p))/2;
  return 12742 * Math.asin(Math.sqrt(a)); 
}

async function fetchLiveStations() {
  const settled = await Promise.allSettled(
    FETCH_FUELS.map(fuel =>
      fetch(BENZIN_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Referer': 'https://benzin.tcs.ch/', 'Origin': 'https://benzin.tcs.ch' },
        body: JSON.stringify({ bbox: CH_BBOX, zoom: 14, pixelRatio: 1, filters: { fuel } })
      }).then(r => r.json()).then((items: any) => ({ fuel, items: Array.isArray(items) ? items : [] }))
    )
  );

  const results = settled.filter(r => r.status === 'fulfilled').map(r => (r as PromiseFulfilledResult<any>).value);

  const map: Record<string, any> = {};
  results.forEach(({ fuel, items }) => {
    items.filter((s: any) => !s.cluster && s.price > 0).forEach((s: any) => {
      const id = String(s.id);
      if (!map[id]) {
        map[id] = { id, lat: s.latitude, lng: s.longitude, name: s.displayName || s.brand || 'Station', prices: {} };
      }
      map[id].prices[FUEL_LABEL[fuel] || fuel] = s.price.toFixed(3);
    });
  });
  return Object.values(map);
}

export const checkPriceAlertsCron = onSchedule(
  { schedule: "every 1 hours", secrets: [apnsKey] },
  async (event) => {
    const db = getFirestore();
    const usersSnap = await db.collection("users").get();
    
    const activeUsers = usersSnap.docs.map(d => ({ id: d.id, ...d.data() })).filter((u: any) => 
      u.apnsToken && u.location?.lat && u.location?.lng && u.alerts && u.alerts.length > 0
    );

    if (activeUsers.length === 0) return;

    const allStations = await fetchLiveStations();
    if (allStations.length === 0) return;

    const sends: Promise<void>[] = [];

    for (const user of activeUsers) {
      const { lat: uLat, lng: uLng } = (user as any).location;
      
      const nearStations = allStations.filter(s => getDistKm(uLat, uLng, s.lat, s.lng) <= 20);
      if (nearStations.length === 0) continue;

      const userAlerts = (user as any).alerts as { fuel: string; price: number }[];
      
      let triggered: { alert: any, station: any } | null = null;
      for (const alert of userAlerts) {
        const matches = nearStations.filter(s =>
          s.prices[alert.fuel] && parseFloat(s.prices[alert.fuel]) < alert.price
        );
        if (matches.length > 0) {
          matches.sort((a, b) => parseFloat(a.prices[alert.fuel]) - parseFloat(b.prices[alert.fuel]));
          triggered = { alert, station: matches[0] };
          break;
        }
      }

      if (triggered) {
        const alertId = `${triggered.station.id}_${triggered.alert.fuel}_${triggered.alert.price}`;
        const stateRef = db.collection("users").doc(user.id).collection("alert_state").doc("last_cron_alert");
        const stateSnap = await stateRef.get();
        const lastAlertId = stateSnap.data()?.alertId;
        const lastAlertTime = stateSnap.data()?.timestamp;
        
        const isSame = lastAlertId === alertId;
        const isRecent = lastAlertTime && (Date.now() - lastAlertTime < 24 * 60 * 60 * 1000);
        
        if (!(isSame && isRecent)) {
          sends.push(
            sendAPNS(
              (user as any).apnsToken as string,
              "Alerte Prix 🔔",
              `${triggered.alert.fuel} à CHF ${triggered.station.prices[triggered.alert.fuel]} chez ${triggered.station.name} !`,
              { url: `https://optitank-c7709.web.app/?view=map&stationId=${triggered.station.id}` }
            )
          );
          await stateRef.set({ alertId, timestamp: Date.now() });
        }
      }
    }

    await Promise.allSettled(sends);
  }
);

// ── PLANIFICATEUR DE TRAJET IA ──────────────────────────────
// Le client calcule la géométrie (route OSRM, stations candidates le long du
// trajet avec leur position + prix). Gemini (LLM) décide la séquence d'arrêts
// la moins chère atteignable ; le client revalide et chiffre le résultat.

// Modèle Gemini (Developer API). Flash = bon rapport coût/latence pour cette
// tâche cadrée. Pour plus de qualité, passer à un modèle Pro.
const PLAN_MODEL = "gemini-2.5-flash";

// System prompt stable → mis en cache (prompt caching) avec la définition d'outil.
const PLAN_SYSTEM = `You are a fuel-stop route planner for a Swiss fuel-price app (OptiTank).

You receive a driver's trip as JSON: a list of candidate fuel stations along their route (each with "progressKm" = distance in km from the start along the route, "devKm" = detour distance in km off the route, and "price" = price per litre for the driver's fuel), plus "currentAutonomyKm" (km the driver can still drive right now), "fullTankAutonomyKm" (km on a full tank), "reserveKm" (safety margin), and "totalDistanceKm" (length of the whole route).

Your job: choose the ordered sequence of stations where the driver should refuel so they (1) NEVER run out of fuel and (2) pay as little as possible.

Hard constraints — a plan that violates any of these is wrong:
- The first stop's progressKm must be <= currentAutonomyKm - reserveKm.
- Assume a FULL tank after each stop. From a stop at progressKm = P, the next reachable position is P + fullTankAutonomyKm - reserveKm; the next stop's progressKm must be <= that.
- After the last stop at progressKm = P, the destination must be reachable: totalDistanceKm - P <= fullTankAutonomyKm - reserveKm.
- If totalDistanceKm <= currentAutonomyKm - reserveKm, no stop is needed: return an empty "stops" list.

Optimisation (after the hard constraints are satisfied): minimise total fuel cost. Add a stop only when range requires it; among the stations reachable in a given leg, prefer the cheapest; when prices are close, prefer a smaller detour (devKm).

Only pick stations from the provided candidate list, referenced by their "id". Respond ONLY with a JSON object matching the required schema (keys: "stops" and "explanation"). Write every "reason" and the "explanation" in French.`;

const PLAN_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    stops: {
      type: Type.ARRAY,
      description: "Ordered list of stops from start to destination. Empty if no refuelling stop is needed.",
      items: {
        type: Type.OBJECT,
        properties: {
          stationId: { type: Type.STRING, description: "The id of one of the candidate stations." },
          reason: { type: Type.STRING, description: "Short reason in French for this stop." },
        },
        required: ["stationId", "reason"],
      },
    },
    explanation: {
      type: Type.STRING,
      description: "A short (2-3 sentence) natural-language summary of the plan, in French.",
    },
  },
  required: ["stops", "explanation"],
};

interface PlanCandidate {
  id: string;
  name?: string;
  brand?: string;
  city?: string;
  progressKm: number;
  devKm: number;
  price: number;
}

export const planRoute = onRequest(
  { secrets: [geminiKey], invoker: "public", cors: true, timeoutSeconds: 120 },
  async (req, res) => {
    const authHeader = req.headers.authorization ?? "";
    if (!authHeader.startsWith("Bearer ")) {
      res.status(401).json({ error: "Non authentifié" });
      return;
    }
    try {
      await getAuth().verifyIdToken(authHeader.slice(7));
    } catch {
      res.status(401).json({ error: "Token invalide" });
      return;
    }

    const parsed = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    const {
      candidates,
      currentAutonomyKm,
      fullTankAutonomyKm,
      reserveKm,
      totalDistanceKm,
      fuel,
      currency,
    } = parsed as {
      candidates: PlanCandidate[];
      currentAutonomyKm: number;
      fullTankAutonomyKm: number;
      reserveKm: number;
      totalDistanceKm: number;
      fuel?: string;
      currency?: string;
    };

    if (
      !Array.isArray(candidates) ||
      typeof currentAutonomyKm !== "number" ||
      typeof fullTankAutonomyKm !== "number" ||
      typeof totalDistanceKm !== "number"
    ) {
      res.status(400).json({ error: "Paramètres de trajet invalides" });
      return;
    }

    const userText = [
      "Trip parameters:",
      `- currentAutonomyKm: ${currentAutonomyKm}`,
      `- fullTankAutonomyKm: ${fullTankAutonomyKm}`,
      `- reserveKm: ${reserveKm ?? 0}`,
      `- totalDistanceKm: ${totalDistanceKm}`,
      `- fuel: ${fuel ?? "n/a"}`,
      `- currency: ${currency ?? "CHF"}`,
      "",
      "Candidate stations along the route (JSON, sorted by progressKm):",
      JSON.stringify(candidates),
    ].join("\n");

    try {
      const ai = new GoogleGenAI({ apiKey: geminiKey.value() });
      const result = await ai.models.generateContent({
        model: PLAN_MODEL,
        contents: userText,
        config: {
          systemInstruction: PLAN_SYSTEM,
          responseMimeType: "application/json",
          responseSchema: PLAN_SCHEMA,
          temperature: 0.2,
        },
      });

      const text = result.text;
      if (!text) {
        res.status(502).json({ error: "Plan IA indisponible" });
        return;
      }
      const plan = JSON.parse(text) as {
        stops?: { stationId: string; reason: string }[];
        explanation?: string;
      };
      res.json({ stops: plan.stops ?? [], explanation: plan.explanation ?? "" });
    } catch (e: any) {
      res.status(500).json({ error: e?.message ?? "Erreur IA" });
    }
  }
);
