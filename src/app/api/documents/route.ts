import { NextResponse } from "next/server";
import { getDb } from "@/lib/firebase-admin";
import { getServerSessionUser } from "@/lib/session";

export async function GET() {
  try {
    const session = await getServerSessionUser();

    if (!session) {
      return NextResponse.json(
        { success: false, error: "Please login to view documents." },
        { status: 401 },
      );
    }

    const db = getDb();
    const snapshot = await db.collection("documents").where("userId", "==", session.email).get();

    const documents = snapshot.docs.map((doc) => {
      const data = doc.data() as {
        userId: string;
        type: string;
        title?: string;
        input: string;
        output: string;
        timestamp?: { toDate?: () => Date };
      };
      return {
        id: doc.id,
        userId: data.userId,
        type: data.type,
        title: data.title ?? "",
        input: data.input,
        output: data.output,
        timestamp: data.timestamp?.toDate?.().toISOString() ?? null,
      };
    })
    .sort((left, right) => {
      if (!left.timestamp && !right.timestamp) {
        return 0;
      }

      if (!left.timestamp) {
        return 1;
      }

      if (!right.timestamp) {
        return -1;
      }

      return right.timestamp.localeCompare(left.timestamp);
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
    const session = await getServerSessionUser();
    const body = (await request.json()) as { id?: string };
    const id = body.id?.trim();

    if (!session) {
      return NextResponse.json(
        { success: false, error: "Please login to manage documents." },
        { status: 401 },
      );
    }

    if (!id) {
      return NextResponse.json(
        { success: false, error: "Document id is required." },
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
    if (data.userId !== session.email) {
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

