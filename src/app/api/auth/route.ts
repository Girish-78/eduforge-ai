import { NextResponse } from "next/server";
import { Timestamp } from "firebase-admin/firestore";
import { getAuth, getDb } from "@/lib/firebase-admin";
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
    const auth = getAuth();
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

      try {
        await auth.createUser({
          email: docId,
          password,
        });
      } catch (createUserError) {
        const code =
          typeof createUserError === "object" &&
          createUserError !== null &&
          "code" in createUserError
            ? String(createUserError.code)
            : "";

        if (code === "auth/email-already-exists") {
          return NextResponse.json(
            { error: "This email is already registered. Please log in." },
            { status: 409 },
          );
        }

        throw createUserError;
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

    try {
      await auth.getUserByEmail(docId);
    } catch (getUserError) {
      const code =
        typeof getUserError === "object" &&
        getUserError !== null &&
        "code" in getUserError
          ? String(getUserError.code)
          : "";

      if (code === "auth/user-not-found") {
        return NextResponse.json(
          { error: "No account found. Please sign up first." },
          { status: 404 },
        );
      }

      throw getUserError;
    }

    const userDoc = await userRef.get();
    if (!userDoc.exists) {
      return NextResponse.json(
        { error: "Account profile is missing. Please contact support." },
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
    const isConfigError = message.includes("Missing Firebase Admin environment variable");
    const isMetadataError =
      message.includes("Getting metadata from plugin failed") ||
      message.includes("Could not load the default credentials");
    const isPemError =
      message.includes("Invalid PEM formatted message") ||
      message.includes("Invalid FIREBASE_PRIVATE_KEY format");

    return NextResponse.json(
      {
        error: isPemError
          ? "Server auth key is invalid. Please re-check FIREBASE_PRIVATE_KEY format in deployment settings."
          : isConfigError || isMetadataError
            ? "Server auth configuration is missing. Please verify Firebase environment variables in deployment settings."
            : "Unable to process auth request right now.",
      },
      { status: 500 },
    );
  }
}
