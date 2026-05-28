import { onRequest } from "firebase-functions/v2/https";
import { onDocumentWritten } from "firebase-functions/v2/firestore";
import { defineSecret } from "firebase-functions/params";
import { setGlobalOptions } from "firebase-functions";
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import apn from "@parse/node-apn";

initializeApp();
setGlobalOptions({ maxInstances: 10 });

const apnsKey = defineSecret("APNS_PRIVATE_KEY");

const APNS_KEY_ID  = "G4GY77QX25";
const APNS_TEAM_ID = "8X44B5MQDF";
const APNS_BUNDLE  = "online.optitank.app";

async function sendAPNS(
  deviceToken: string,
  title: string,
  body: string,
  payload?: Record<string, string>
): Promise<void> {
  const keyValue = apnsKey.value().replace(/\\n/g, "\n");
  const provider = new apn.Provider({
    token: { key: keyValue, keyId: APNS_KEY_ID, teamId: APNS_TEAM_ID },
    production: false,
  });
  const notif = new apn.Notification();
  notif.alert = { title, body };
  notif.topic = APNS_BUNDLE;
  notif.sound = "default";
  if (payload) notif.payload = payload;

  const result = await provider.send(notif, deviceToken);
  provider.shutdown();

  if (result.failed.length > 0) {
    throw new Error(result.failed[0].response?.reason ?? "APNs send failed");
  }
}

// HTTP endpoint — envoie une notif APNs (auth vérifiée via Bearer token)
export const sendPush = onRequest(
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
      token: string;
      title: string;
      body: string;
      data?: Record<string, string>;
    };

    console.log("sendPush body:", JSON.stringify({ token: token?.slice(0, 8), title, body }));

    if (!token || !title || !body) {
      res.status(400).json({ error: "token, title et body requis", received: { token: !!token, title: !!title, body: !!body } });
      return;
    }

    try {
      await sendAPNS(token, title, body, data);
      res.json({ success: true });
    } catch (e: any) {
      console.error("sendAPNS error:", e?.message, e?.stack);
      res.status(500).json({ error: e?.message ?? String(e) ?? "Erreur APNs" });
    }
  }
);

// Déclenché automatiquement quand les prix changent — alerte si prix en baisse
export const priceAlertTrigger = onDocumentWritten(
  { document: "price_history/{date}", secrets: [apnsKey] },
  async (event) => {
    const after = event.data?.after?.data() as
      | Record<string, Record<string, string>>
      | undefined;
    if (!after) return;

    const db = getFirestore();
    const usersSnap = await db.collection("users").get();
    const sends: Promise<void>[] = [];

    for (const userDoc of usersSnap.docs) {
      const data = userDoc.data() as {
        apnsToken?: string;
        profile?: { fuelType?: string; priceAlerts?: boolean };
        favorites?: string[];
      };

      const apnsToken = data.apnsToken;
      if (!apnsToken) continue;

      const priceAlerts = data.profile?.priceAlerts ?? true;
      if (!priceAlerts) continue;

      const fuel = data.profile?.fuelType ?? "SP95";
      const favorites = data.favorites ?? [];

      for (const stationId of favorites) {
        const prices = after[stationId];
        if (!prices?.[fuel]) continue;
        const newPrice = prices[fuel];

        const stateRef = db
          .collection("users")
          .doc(userDoc.id)
          .collection("alert_state")
          .doc(stationId);

        const prevSnap = await stateRef.get();
        const prevPrice = prevSnap.data()?.[fuel] as string | undefined;

        if (!prevPrice || parseFloat(newPrice) < parseFloat(prevPrice) - 0.01) {
          sends.push(
            sendAPNS(
              apnsToken,
              "Prix en baisse !",
              `${fuel} à CHF ${newPrice} dans ta station favorite`,
              { stationId, fuel, price: newPrice }
            )
          );
          await stateRef.set({ [fuel]: newPrice }, { merge: true });
        }
      }
    }

    await Promise.allSettled(sends);
  }
);
