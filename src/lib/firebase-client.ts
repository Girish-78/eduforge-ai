import { getApp, getApps, initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

function getFirebaseClientConfig() {
  return {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  };
}

export function getFirebaseClientApp() {
  if (!getApps().length) {
    const config = getFirebaseClientConfig();
    if (!config.apiKey || !config.authDomain || !config.projectId || !config.appId) {
      throw new Error("Missing Firebase client environment variables.");
    }
    initializeApp(config);
  }

  return getApp();
}

export function getFirebaseClientAuth() {
  return getAuth(getFirebaseClientApp());
}

export function getFirebaseClientFirestore() {
  return getFirestore(getFirebaseClientApp());
}

export function getFirebaseClientStorage() {
  const app = getFirebaseClientApp();
  if (!app.options.storageBucket) {
    throw new Error("Missing NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET.");
  }

  return getStorage(app);
}
