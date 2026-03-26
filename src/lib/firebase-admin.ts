import admin from "firebase-admin";

function normalizePrivateKey(value: string) {
  const trimmed = value.trim();
  const unquoted =
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
      ? trimmed.slice(1, -1)
      : trimmed;

  return unquoted.replace(/\\n/g, "\n");
}

function getRequiredEnv(name: string) {
  const value = process.env[name];
  if (!value || !value.trim()) {
    throw new Error(`Missing Firebase Admin environment variable: ${name}`);
  }
  return value.trim();
}

function getFirebaseConfig(): admin.ServiceAccount & { storageBucket?: string } {
  const projectId = getRequiredEnv("FIREBASE_PROJECT_ID");
  const clientEmail = getRequiredEnv("FIREBASE_CLIENT_EMAIL");
  const privateKey = normalizePrivateKey(getRequiredEnv("FIREBASE_PRIVATE_KEY"));
  const storageBucket = process.env.FIREBASE_STORAGE_BUCKET?.trim();

  return {
    projectId,
    clientEmail,
    privateKey,
    storageBucket,
  };
}

function getApp() {
  if (!admin.apps.length) {
    const config = getFirebaseConfig();
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: config.projectId,
        clientEmail: config.clientEmail,
        privateKey: config.privateKey,
      }),
      storageBucket: config.storageBucket,
    });
  }

  return admin.app();
}

export function getAuth() {
  return getApp().auth();
}

export function getDb() {
  return getApp().firestore();
}

export function getStorageBucket() {
  return getApp().storage().bucket();
}

export function getFirebaseProjectId() {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  if (!projectId || !projectId.trim()) {
    throw new Error("Missing Firebase Admin environment variable: FIREBASE_PROJECT_ID");
  }
  return projectId.trim();
}
