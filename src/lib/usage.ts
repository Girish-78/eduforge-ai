import { Timestamp } from "firebase-admin/firestore";
import { getDb } from "@/lib/firebase-admin";

const FREE_DAILY_LIMIT = 5;

interface UsageResult {
  allowed: boolean;
  count: number;
  limit: number;
  remaining: number;
  plan: "free" | "pro";
}

function getDateKey() {
  return new Date().toISOString().slice(0, 10);
}

export async function consumeUsage(userId: string): Promise<UsageResult> {
  const db = getDb();
  const dateKey = getDateKey();
  const usageRef = db.collection("usage").doc(`${userId}_${dateKey}`);
  const userRef = db.collection("users").doc(userId);

  return db.runTransaction(async (tx) => {
    const [usageDoc, userDoc] = await Promise.all([tx.get(usageRef), tx.get(userRef)]);

    const plan = (userDoc.data()?.plan as "free" | "pro" | undefined) ?? "free";
    if (plan !== "free") {
      const count = usageDoc.data()?.count ?? 0;
      return {
        allowed: true,
        count,
        limit: Number.MAX_SAFE_INTEGER,
        remaining: Number.MAX_SAFE_INTEGER,
        plan: "pro",
      };
    }

    const count = (usageDoc.data()?.count as number | undefined) ?? 0;
    if (count >= FREE_DAILY_LIMIT) {
      return {
        allowed: false,
        count,
        limit: FREE_DAILY_LIMIT,
        remaining: 0,
        plan: "free",
      };
    }

    const nextCount = count + 1;
    tx.set(
      usageRef,
      {
        userId,
        date: dateKey,
        count: nextCount,
        updatedAt: Timestamp.now(),
      },
      { merge: true },
    );

    return {
      allowed: true,
      count: nextCount,
      limit: FREE_DAILY_LIMIT,
      remaining: Math.max(FREE_DAILY_LIMIT - nextCount, 0),
      plan: "free",
    };
  });
}

