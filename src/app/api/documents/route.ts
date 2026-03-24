import { NextResponse } from "next/server";
import { getDb } from "@/lib/firebase-admin";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId")?.trim();

    if (!userId) {
      return NextResponse.json(
        { success: false, error: "userId query param is required." },
        { status: 400 },
      );
    }

    const db = getDb();
    const snapshot = await db
      .collection("documents")
      .where("userId", "==", userId)
      .orderBy("timestamp", "desc")
      .get();

    const documents = snapshot.docs.map((doc) => {
      const data = doc.data() as {
        userId: string;
        type: string;
        input: string;
        output: string;
        timestamp?: { toDate?: () => Date };
      };
      return {
        id: doc.id,
        userId: data.userId,
        type: data.type,
        input: data.input,
        output: data.output,
        timestamp: data.timestamp?.toDate?.().toISOString() ?? null,
      };
    });

    return NextResponse.json({ success: true, documents });
  } catch (error) {
    console.error("/api/documents GET error", error);
    return NextResponse.json(
      { success: false, error: "Failed to load documents." },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const body = (await request.json()) as { id?: string; userId?: string };
    const id = body.id?.trim();
    const userId = body.userId?.trim();

    if (!id || !userId) {
      return NextResponse.json(
        { success: false, error: "id and userId are required." },
        { status: 400 },
      );
    }

    const db = getDb();
    const ref = db.collection("documents").doc(id);
    const doc = await ref.get();

    if (!doc.exists) {
      return NextResponse.json(
        { success: false, error: "Document not found." },
        { status: 404 },
      );
    }

    const data = doc.data() as { userId?: string };
    if (data.userId !== userId) {
      return NextResponse.json(
        { success: false, error: "Not authorized to delete this document." },
        { status: 403 },
      );
    }

    await ref.delete();
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("/api/documents DELETE error", error);
    return NextResponse.json(
      { success: false, error: "Failed to delete document." },
      { status: 500 },
    );
  }
}

