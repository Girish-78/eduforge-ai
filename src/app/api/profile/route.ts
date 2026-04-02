import { randomUUID } from "crypto";
import { Timestamp } from "firebase-admin/firestore";
import { NextResponse } from "next/server";

import {
  getAuth as getAdminAuth,
  getDb,
  getStorageBucket,
} from "@/lib/firebase-admin";
import { getServerSessionUser } from "@/lib/session";

const ALLOWED_TYPES = new Set(["image/jpeg", "image/png"]);
const MAX_FILE_SIZE = 5 * 1024 * 1024;

async function getProfileReferences(email: string) {
  const db = getDb();
  const authUser = await getAdminAuth().getUserByEmail(email);
  const primaryRef = db.collection("users").doc(authUser.uid);
  const legacyRef = db.collection("users").doc(email);
  const [primaryDoc, legacyDoc] = await Promise.all([primaryRef.get(), legacyRef.get()]);

  return {
    email,
    uid: authUser.uid,
    primaryDoc,
    primaryRef,
    legacyDoc,
    legacyRef,
  };
}

function getExistingProfileData(
  primaryDoc: FirebaseFirestore.DocumentSnapshot,
  legacyDoc: FirebaseFirestore.DocumentSnapshot,
) {
  if (primaryDoc.exists) {
    return primaryDoc.data() ?? {};
  }

  if (legacyDoc.exists) {
    return legacyDoc.data() ?? {};
  }

  return null;
}

export async function GET() {
  const session = await getServerSessionUser();
  if (!session) {
    return NextResponse.json({ error: "Please login to view your profile." }, { status: 401 });
  }

  try {
    const { email, primaryDoc, legacyDoc } = await getProfileReferences(session.email);
    const data = getExistingProfileData(primaryDoc, legacyDoc);

    if (!data) {
      return NextResponse.json({ error: "User profile not found." }, { status: 404 });
    }

    return NextResponse.json({
      user: {
        email,
        name: data.name ?? "",
        role: data.role ?? null,
        plan: data.plan ?? "free",
        logoUrl: data.logoUrl ?? "",
        logoPath: data.logoPath ?? "",
      },
    });
  } catch (error) {
    console.error("/api/profile GET error", error);
    return NextResponse.json(
      { error: "Unable to load profile right now." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSessionUser();
    if (!session) {
      return NextResponse.json(
        { error: "Please login to update your profile." },
        { status: 401 },
      );
    }

    const formData = await request.formData();
    const file = formData.get("logo");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Logo file is required." }, { status: 400 });
    }

    if (!ALLOWED_TYPES.has(file.type)) {
      return NextResponse.json(
        { error: "Only JPG and PNG files are allowed." },
        { status: 400 },
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "Logo file must be 5MB or smaller." },
        { status: 400 },
      );
    }

    const bucket = getStorageBucket();
    const refs = await getProfileReferences(session.email);
    const existingData = getExistingProfileData(refs.primaryDoc, refs.legacyDoc);

    if (!existingData) {
      return NextResponse.json({ error: "User profile not found." }, { status: 404 });
    }

    const objectPath = `users/${refs.uid}/logo.png`;
    const token = randomUUID();
    const buffer = Buffer.from(await file.arrayBuffer());
    const uploadedFile = bucket.file(objectPath);

    await uploadedFile.save(buffer, {
      resumable: false,
      metadata: {
        contentType: file.type,
        cacheControl: "public,max-age=31536000,immutable",
        metadata: {
          firebaseStorageDownloadTokens: token,
        },
      },
    });

    const logoUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(objectPath)}?alt=media&token=${token}`;
    const previousPath = typeof existingData.logoPath === "string" ? existingData.logoPath : "";

    const update = {
      uid: refs.uid,
      email: refs.email,
      logoUrl,
      logoPath: objectPath,
      updatedAt: Timestamp.now(),
    };

    await refs.primaryRef.set(update, { merge: true });

    if (refs.legacyRef.id !== refs.primaryRef.id && refs.legacyDoc.exists) {
      await refs.legacyRef.set(update, { merge: true });
    }

    if (previousPath && previousPath !== objectPath) {
      await bucket.file(previousPath).delete({ ignoreNotFound: true });
    }

    return NextResponse.json({ success: true, logoUrl, logoPath: objectPath });
  } catch (error) {
    console.error("/api/profile POST error", error);
    return NextResponse.json(
      { error: "Unable to upload logo right now." },
      { status: 500 },
    );
  }
}
