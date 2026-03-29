"use client";

import { ChangeEvent, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

interface SessionUser {
  email?: string;
  name?: string;
  role?: string;
  logoUrl?: string;
}

interface ProfilePayload {
  user?: {
    logoUrl?: string;
  };
  error?: string;
}

const ALLOWED_TYPES = new Set(["image/jpeg", "image/png"]);

export default function SettingsPage() {
  const session = useMemo(() => {
    if (typeof window === "undefined") return null;
    const raw = localStorage.getItem("saas-user");
    if (!raw) return null;

    try {
      return JSON.parse(raw) as SessionUser;
    } catch {
      localStorage.removeItem("saas-user");
      return null;
    }
  }, []);

  const userId = session?.email ?? "";
  const [logoUrl, setLogoUrl] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadProfile() {
      if (!userId) {
        setLoading(false);
        return;
      }

      setLoading(true);
      setError("");

      try {
        const response = await fetch(`/api/profile?userId=${encodeURIComponent(userId)}`, {
          cache: "no-store",
        });
        const payload = (await response.json()) as ProfilePayload;

        if (!response.ok) {
          throw new Error(payload.error ?? "Unable to load profile.");
        }

        setLogoUrl(payload.user?.logoUrl ?? "");
      } catch (loadError) {
        console.error("Settings profile load error", loadError);
        setError(
          loadError instanceof Error ? loadError.message : "Unable to load profile.",
        );
      } finally {
        setLoading(false);
      }
    }

    void loadProfile();
  }, [userId]);

  function onFileChange(event: ChangeEvent<HTMLInputElement>) {
    const nextFile = event.target.files?.[0] ?? null;
    setError("");

    if (!nextFile) {
      setSelectedFile(null);
      return;
    }

    if (!ALLOWED_TYPES.has(nextFile.type)) {
      setSelectedFile(null);
      setError("Please choose a JPG or PNG image.");
      return;
    }

    setSelectedFile(nextFile);
  }

  async function onUploadLogo() {
    if (!userId) {
      setError("Please login first to update your logo.");
      return;
    }

    if (!selectedFile) {
      setError("Choose a JPG or PNG file before uploading.");
      return;
    }

    setUploading(true);
    setError("");

    try {
      const formData = new FormData();
      formData.append("userId", userId);
      formData.append("logo", selectedFile);

      const response = await fetch("/api/profile", {
        method: "POST",
        body: formData,
      });
      const payload = (await response.json()) as {
        success?: boolean;
        logoUrl?: string;
        error?: string;
      };

      if (!response.ok || !payload.success || !payload.logoUrl) {
        throw new Error(payload.error ?? "Unable to upload logo.");
      }

      setLogoUrl(payload.logoUrl);
      setSelectedFile(null);

      if (typeof window !== "undefined") {
        const raw = localStorage.getItem("saas-user");
        if (raw) {
          try {
            const parsed = JSON.parse(raw) as SessionUser;
            localStorage.setItem(
              "saas-user",
              JSON.stringify({ ...parsed, logoUrl: payload.logoUrl }),
            );
          } catch {
            localStorage.removeItem("saas-user");
          }
        }
      }

      toast.success("Logo uploaded");
    } catch (uploadError) {
      console.error("Logo upload error", uploadError);
      const message =
        uploadError instanceof Error ? uploadError.message : "Unable to upload logo.";
      setError(message);
      toast.error(message);
    } finally {
      setUploading(false);
    }
  }

  return (
    <section className="mx-auto w-full max-w-3xl space-y-6">
      <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-xl font-semibold text-slate-900">Settings</h1>
        <p className="mt-1 text-sm text-slate-600">
          Upload a school logo to use automatically in PDF exports.
        </p>
      </article>

      <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">PDF Logo</h2>
        <p className="mt-1 text-sm text-slate-600">
          Accepted formats: JPG and PNG.
        </p>

        {error ? (
          <p className="mt-4 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {error}
          </p>
        ) : null}

        {loading ? (
          <p className="mt-4 text-sm text-slate-600">Loading profile...</p>
        ) : !userId ? (
          <p className="mt-4 text-sm text-slate-600">
            Login to manage your PDF logo.
          </p>
        ) : (
          <div className="mt-4 space-y-4">
            <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4">
              <p className="text-sm font-medium text-slate-700">Current logo</p>
              {logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={logoUrl}
                  alt="Uploaded school logo"
                  className="mt-3 max-h-24 max-w-full object-contain"
                />
              ) : (
                <p className="mt-3 text-sm text-slate-500">
                  No logo uploaded yet. PDF header will stay empty.
                </p>
              )}
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Upload new logo
              </label>
              <input
                type="file"
                accept="image/png,image/jpeg"
                onChange={onFileChange}
                className="block w-full text-sm text-slate-700 file:mr-4 file:rounded-lg file:border-0 file:bg-slate-900 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-slate-700"
              />
            </div>

            <button
              type="button"
              onClick={onUploadLogo}
              disabled={uploading || !selectedFile}
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {uploading ? "Uploading..." : "Upload Logo"}
            </button>
          </div>
        )}
      </article>
    </section>
  );
}
