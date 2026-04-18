import { getApp, getApps, initializeApp } from "firebase/app";
import {
  browserLocalPersistence,
  getAuth,
  inMemoryPersistence,
  setPersistence,
} from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCbUTSxjFaXXufkF9klJPJKziDuHnjJe_Q",
  authDomain: "swaraj-infra.firebaseapp.com",
  projectId: "swaraj-infra",
  storageBucket: "swaraj-infra.firebasestorage.app",
  messagingSenderId: "1098335552248",
  appId: "1:1098335552248:web:8057b140e8cc7a1802f10d",
  measurementId: "G-MZEVRXZ8ZF",
};

export const firebaseApp =
  getApps().length > 0 ? getApps()[0]! : initializeApp(firebaseConfig);

export const auth = getAuth(firebaseApp);
export const db = getFirestore(firebaseApp);

export function getSecondaryApp() {
  try {
    return getApp("secondary");
  } catch {
    return initializeApp(firebaseConfig, "secondary");
  }
}

export function getSecondaryAuth() {
  const secondaryAuth = getAuth(getSecondaryApp());
  void setPersistence(secondaryAuth, inMemoryPersistence);
  return secondaryAuth;
}

export async function ensureAuthPersistence() {
  if (typeof window === "undefined") return;
  await setPersistence(auth, browserLocalPersistence);
}

export async function getBrowserAnalytics() {
  if (typeof window === "undefined") return null;
  try {
    const { getAnalytics } = await import("firebase/analytics");
    return getAnalytics(firebaseApp);
  } catch {
    return null;
  }
}
