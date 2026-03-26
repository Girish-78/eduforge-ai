import { NextResponse } from "next/server";
import { Timestamp } from "firebase-admin/firestore";
import { getDb } from "@/lib/firebase-admin";
import type { UserRole } from "@/lib/roles";

interface AuthBody {
  mode?: "login" | "signup";
  email?: string;
  password?: string;
  role?: UserRole;
}

export async function POST(request: Request) {
  const body = (await request.json()) as AuthBody;
  const { mode, email, password, role } = body;

  if (!mode || !email || !password) {
    return NextResponse.json(
      { error: "mode, email and password are required" },
      { status: 400 },
    );
  }

  if (password.length < 6) {
    return NextResponse.json(
      { error: "Password must be at least 6 characters long" },
      { status: 400 },
    );
  }

  try {
    const db = getDb();
    const usersRef = db.collection("users");
    const docId = email.toLowerCase();
    const userRef = usersRef.doc(docId);

    if (mode === "signup") {
      if (!role) {
        return NextResponse.json(
          { error: "Role is required for signup" },
          { status: 400 },
        );
      }

      await userRef.set({
        email: docId,
        role,
        plan: "free",
        updatedAt: Timestamp.now(),
        createdAt: Timestamp.now(),
      });

      return NextResponse.json({
        message: `Account created for ${email}`,
        user: { email: docId, role, plan: "free" },
      });
    }

    const userDoc = await userRef.get();
    if (!userDoc.exists) {
      return NextResponse.json(
        { error: "No account found. Please sign up first." },
        { status: 404 },
      );
    }

    const user = userDoc.data() as { role?: UserRole; plan?: "free" | "pro" };
    if (!user.role) {
      return NextResponse.json(
        { error: "User role missing. Please contact support." },
        { status: 500 },
      );
    }

    return NextResponse.json({
      message: `Logged in as ${email}`,
      user: { email: docId, role: user.role, plan: user.plan ?? "free" },
    });
  } catch (error) {
    console.error("Auth route error", error);
    const message =
      error instanceof Error ? error.message : "Unexpected server error";
    const isConfigError = message.includes(
      "Missing Firebase Admin environment variables",
    );

    return NextResponse.json(
      {
        error: isConfigError
          ? "Server auth configuration is missing. Please verify Firebase environment variables in deployment settings."
          : "Unable to process auth request right now.",
      },
      { status: 500 },
    );
  }
}
