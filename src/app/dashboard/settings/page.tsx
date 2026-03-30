"use client";

import { ChangeEvent, useEffect, useState } from "react";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { toast } from "sonner";
import {
  getFirebaseClientApp,
  getFirebaseClientFirestore,
  getFirebaseClientStorage,
} from "@/lib/firebase-client";

const ALLOWED_TYPES = new Set(["image/jpeg", "image/png"]);
const MAX_FILE_SIZE = 5 * 1024 * 1024;

export default function SettingsPage() {
  const [logoUrl, setLogoUrl] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const auth = getAuth(getFirebaseClientApp());
    const db = getFirebaseClientFirestore();

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setLoading(true);
      setError("");

      if (!user) {
        setLogoUrl("");
        setLoading(false);
        setError("User not logged in");
        return;
      }

      try {
        const snapshot = await getDoc(doc(db, "users", user.uid));
        setLogoUrl((snapshot.data()?.logoUrl as string | undefined) ?? "");
      } catch (loadError) {
        console.error("Settings profile load error", loadError);
        setError(
          loadError instanceof Error ? loadError.message : "Unable to load profile.",
        );
      } finally {
        setLoading(false);
      }
    });

    return unsubscribe;
  }, []);

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

    if (nextFile.size > MAX_FILE_SIZE) {
      setSelectedFile(null);
      setError("Logo file must be 5MB or smaller.");
      return;
    }

    setSelectedFile(nextFile);
  }

  async function handleLogoUpload(file: File) {
    const auth = getAuth(getFirebaseClientApp());
    const storage = getFirebaseClientStorage();
    const db = getFirebaseClientFirestore();

    try {
      const user = auth.currentUser;

      if (!user) {
        throw new Error("User not logged in");
      }

      console.log("User:", user.uid);
      console.log("File:", file);

      if (!file.type.startsWith("image/")) {
        throw new Error("Only image files allowed");
      }

      if (!ALLOWED_TYPES.has(file.type)) {
        throw new Error("Only PNG and JPG files are allowed");
      }

      if (file.size > MAX_FILE_SIZE) {
        throw new Error("File must be less than 5MB");
      }

      const storageRef = ref(storage, `users/${user.uid}/logo.png`);
      const snapshot = await uploadBytes(storageRef, file, {
        contentType: file.type,
      });
      const downloadURL = await getDownloadURL(snapshot.ref);

      await setDoc(
        doc(db, "users", user.uid),
        {
          uid: user.uid,
          email: user.email ?? "",
          logoUrl: downloadURL,
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );

      return downloadURL;
    } catch (uploadError) {
      console.error("Upload error:", uploadError);
      throw uploadError;
    }
  }

  async function onUploadLogo() {
    if (!selectedFile) {
      setError("Choose a JPG or PNG file before uploading.");
      return;
    }

    setUploading(true);
    setError("");

    try {
      const downloadURL = await handleLogoUpload(selectedFile);
      setLogoUrl(downloadURL);
      setSelectedFile(null);
      toast.success("Logo uploaded successfully");
    } catch (uploadError) {
      const message =
        uploadError instanceof Error ? uploadError.message : "Unable to upload logo right now";
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
