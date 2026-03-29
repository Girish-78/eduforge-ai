import { randomUUID } from "crypto";
import { Timestamp } from "firebase-admin/firestore";
import { NextResponse } from "next/server";
import { getDb, getStorageBucket } from "@/lib/firebase-admin";

const ALLOWED_TYPES = new Set(["image/jpeg", "image/png"]);
const MAX_FILE_SIZE = 5 * 1024 * 1024;

function getUserId(request: Request) {
  const { searchParams } = new URL(request.url);
  return searchParams.get("userId")?.trim().toLowerCase() ?? "";
}

export async function GET(request: Request) {
  const userId = getUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "userId is required." }, { status: 400 });
  }

  try {
    const db = getDb();
    const userDoc = await db.collection("users").doc(userId).get();

    if (!userDoc.exists) {
      return NextResponse.json({ error: "User profile not found." }, { status: 404 });
    }

    const data = userDoc.data() ?? {};
    return NextResponse.json({
      user: {
        email: userId,
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
    const formData = await request.formData();
    const userId = String(formData.get("userId") ?? "").trim().toLowerCase();
    const file = formData.get("logo");

    if (!userId) {
      return NextResponse.json({ error: "userId is required." }, { status: 400 });
    }

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
    const userRef = db.collection("users").doc(userId);
    const existingDoc = await userRef.get();

    if (!existingDoc.exists) {
      return NextResponse.json({ error: "User profile not found." }, { status: 404 });
    }

    const extension = file.type === "image/png" ? "png" : "jpg";
    const objectPath = `logos/${encodeURIComponent(userId)}/${Date.now()}-${randomUUID()}.${extension}`;
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
