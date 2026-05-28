import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getAnalytics } from "firebase/analytics";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyAeo6stBSEBh7uQUIkYgJ7TFFjM8Siu4AU",
  // Use the custom domain the iOS WKWebView actually loads from, so the
  // /__/auth/handler redirect dance stays same-origin (no Safari ITP /
  // storage-partitioning breakage). For users on web.app, popup still works
  // cross-origin via postMessage.
  authDomain: "optitank.online",
  projectId: "optitank-c7709",
  storageBucket: "optitank-c7709.firebasestorage.app",
  messagingSenderId: "234789643916",
  appId: "1:234789643916:web:aabec1180d95eff9093da9",
  measurementId: "G-8ZZBVN0DTL"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const analytics = getAnalytics(app);
