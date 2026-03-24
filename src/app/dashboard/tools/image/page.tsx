"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { LoadingDots } from "@/components/ui/loading-dots";

export default function ImageGeneratorPage() {
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [usageWarning, setUsageWarning] = useState("");

  const userId = useMemo(() => {
    if (typeof window === "undefined") return "";
    const raw = localStorage.getItem("saas-user");
    if (!raw) return "";
    try {
      const parsed = JSON.parse(raw) as { email?: string };
      return parsed.email ?? "";
    } catch {
      return "";
    }
  }, []);

  async function onGenerateImage() {
    setError("");
    setImageUrl("");
    setUsageWarning("");

    if (!prompt.trim()) {
      setError("Please enter an image prompt.");
      return;
    }

    if (!userId) {
      setError("Please login first.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, userId }),
      });

      const payload = (await res.json()) as {
        success?: boolean;
        imageUrl?: string;
        error?: string;
        usage?: { plan?: "free" | "pro"; remaining?: number; limit?: number };
      };

      if (!res.ok || !payload.success) {
        setError(payload.error ?? "Failed to generate image.");
        toast.error(payload.error ?? "Failed to generate image.");
        if (payload.usage?.plan === "free" && payload.usage.remaining === 0) {
          setUsageWarning("Daily free limit reached. Upgrade plan when available.");
        }
        return;
      }

      setImageUrl(payload.imageUrl ?? "");
      toast.success("Image generated and saved");
      if (payload.usage?.plan === "free" && typeof payload.usage.remaining === "number") {
        setUsageWarning(
          `Free plan usage: ${payload.usage.remaining} of ${payload.usage.limit} generations remaining today.`,
        );
      }
    } catch {
      setError("Unable to connect to image generation API.");
      toast.error("Unable to connect to image generation API.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="mx-auto w-full max-w-4xl space-y-5">
      <header className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h1 className="text-xl font-semibold text-slate-900">Image Generator</h1>
        <p className="mt-1 text-sm text-slate-600">
          Generate educational visuals with AI. Images are saved to Firebase Storage.
        </p>
      </header>

      <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <label className="mb-2 block text-sm font-medium text-slate-700">
          Prompt
        </label>
        <textarea
          rows={5}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Example: A clean infographic about the water cycle for middle school students."
          className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none ring-slate-200 focus:ring-2"
        />
        <button
          type="button"
          onClick={onGenerateImage}
          disabled={loading}
          className="mt-4 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? "Generating..." : "Generate Image"}
        </button>
        {loading ? (
          <div className="mt-3">
            <LoadingDots label="Creating image" />
          </div>
        ) : null}
      </article>

      <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-2 text-lg font-semibold text-slate-900">Output</h2>
        {error ? (
          <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {error}
          </p>
        ) : null}
        {usageWarning ? (
          <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">
            {usageWarning}
          </p>
        ) : null}
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageUrl}
            alt="Generated result"
            className="mt-3 w-full rounded-xl border border-slate-200"
          />
        ) : (
          <p className="text-sm text-slate-600">Generated image will appear here.</p>
        )}
      </article>
    </section>
  );
}

