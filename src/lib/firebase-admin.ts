import admin from "firebase-admin";

type FirebaseServiceAccountPayload = {
  client_email: string;
  private_key: string;
  project_id: string;
};

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

function isFirebaseServiceAccountPayload(
  value: unknown,
): value is FirebaseServiceAccountPayload {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { project_id?: unknown }).project_id === "string" &&
    typeof (value as { client_email?: unknown }).client_email === "string" &&
    typeof (value as { private_key?: unknown }).private_key === "string"
  );
}

function getFirebaseConfig(): admin.ServiceAccount & { storageBucket?: string } {
  const privateKeyBase64 = process.env.FIREBASE_PRIVATE_KEY_B64?.trim();
  let projectId = process.env.FIREBASE_PROJECT_ID?.trim();
  let clientEmail = process.env.FIREBASE_CLIENT_EMAIL?.trim();
  let privateKeySource: string | undefined;

  if (privateKeyBase64) {
    const decodedPrivateKey = Buffer.from(privateKeyBase64, "base64").toString("utf8").trim();

    try {
      const parsedValue: unknown = JSON.parse(decodedPrivateKey);
      if (isFirebaseServiceAccountPayload(parsedValue)) {
        projectId = parsedValue.project_id.trim();
        clientEmail = parsedValue.client_email.trim();
        privateKeySource = parsedValue.private_key;
      } else {
        privateKeySource = decodedPrivateKey;
      }
    } catch {
      privateKeySource = decodedPrivateKey;
    }
  } else {
    privateKeySource = getRequiredEnv("FIREBASE_PRIVATE_KEY");
  }

  const privateKey = normalizePrivateKey(privateKeySource);
  const storageBucket = process.env.FIREBASE_STORAGE_BUCKET?.trim();

  return {
    projectId: projectId || getRequiredEnv("FIREBASE_PROJECT_ID"),
    clientEmail: clientEmail || getRequiredEnv("FIREBASE_CLIENT_EMAIL"),
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
