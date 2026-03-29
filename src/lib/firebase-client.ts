import { getApps, initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";

function getFirebaseClientConfig() {
  return {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  };
}

export function getFirebaseClientAuth() {
  if (!getApps().length) {
    const config = getFirebaseClientConfig();
    if (!config.apiKey || !config.authDomain || !config.projectId || !config.appId) {
      throw new Error("Missing Firebase client environment variables for auth signOut");
    }
    initializeApp(config);
  }

  return getAuth();
}
