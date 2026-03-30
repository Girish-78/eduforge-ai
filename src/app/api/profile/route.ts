import { randomUUID } from "crypto";
import { Timestamp } from "firebase-admin/firestore";
import { NextResponse } from "next/server";
import { getDb, getStorageBucket } from "@/lib/firebase-admin";
import { getServerSessionUser } from "@/lib/session";

const ALLOWED_TYPES = new Set(["image/jpeg", "image/png"]);
const MAX_FILE_SIZE = 5 * 1024 * 1024;

export async function GET() {
  const session = await getServerSessionUser();
  if (!session) {
    return NextResponse.json({ error: "Please login to view your profile." }, { status: 401 });
  }

  try {
    const db = getDb();
    const userDoc = await db.collection("users").doc(session.email).get();

    if (!userDoc.exists) {
      return NextResponse.json({ error: "User profile not found." }, { status: 404 });
    }

    const data = userDoc.data() ?? {};
    return NextResponse.json({
      user: {
        email: session.email,
        name: data.name ?? "",
        role: data.role ?? null,
        plan: data.plan ?? "free",
        logoUrl: data.logoUrl ?? "",
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

    const db = getDb();
    const bucket = getStorageBucket();
    const userRef = db.collection("users").doc(session.email);
    const existingDoc = await userRef.get();

    if (!existingDoc.exists) {
      return NextResponse.json({ error: "User profile not found." }, { status: 404 });
    }

    const objectPath = `users/${session.email}/logo.png`;
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
    const previousPath = existingDoc.data()?.logoPath as string | undefined;

    await userRef.set(
      {
        logoUrl,
        logoPath: objectPath,
        updatedAt: Timestamp.now(),
      },
      { merge: true },
    );

    if (previousPath && previousPath !== objectPath) {
      await bucket.file(previousPath).delete({ ignoreNotFound: true });
    }

    return NextResponse.json({ success: true, logoUrl });
  } catch (error) {
    console.error("/api/profile POST error", error);
    return NextResponse.json(
      { error: "Unable to upload logo right now." },
      { status: 500 },
    );
  }
}
