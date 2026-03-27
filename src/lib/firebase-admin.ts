import admin from "firebase-admin";

function normalizePrivateKey(value: string) {
  const trimmed = value.trim();
  const unquoted =
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
      ? trimmed.slice(1, -1)
      : trimmed;

  const normalized = unquoted.replace(/\r\n/g, "\n").replace(/\\n/g, "\n").trim();

  const hasBegin = normalized.includes("-----BEGIN PRIVATE KEY-----");
  const hasEnd = normalized.includes("-----END PRIVATE KEY-----");
  if (!hasBegin || !hasEnd) {
    throw new Error(
      "Invalid FIREBASE_PRIVATE_KEY format. Expected PEM with BEGIN/END PRIVATE KEY markers.",
    );
  }

  return normalized;
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
  const privateKeyBase64 = process.env.FIREBASE_PRIVATE_KEY_B64?.trim();
  const privateKeySource = privateKeyBase64
    ? Buffer.from(privateKeyBase64, "base64").toString("utf8")
    : getRequiredEnv("FIREBASE_PRIVATE_KEY");
  const privateKey = normalizePrivateKey(privateKeySource);
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
