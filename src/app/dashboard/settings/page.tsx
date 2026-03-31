"use client";

import { ChangeEvent, useEffect, useState } from "react";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { getDownloadURL, ref, uploadBytesResumable } from "firebase/storage";
import { toast } from "sonner";
import {
  disabledButtonClassName,
  disabledButtonStateClassName,
  errorButtonStateClassName,
  primaryButtonClassName,
  successButtonStateClassName,
} from "@/lib/button-styles";
import {
  getFirebaseClientApp,
  getFirebaseClientFirestore,
  getFirebaseClientStorage,
} from "@/lib/firebase-client";

const ALLOWED_TYPES = new Set(["image/jpeg", "image/png"]);
const MAX_FILE_SIZE = 5 * 1024 * 1024;

type UploadStatus = "idle" | "uploading" | "success" | "error";

function Spinner({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={`${className} animate-spin`}
      fill="none"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" className="opacity-25" stroke="currentColor" strokeWidth="3" />
      <path
        d="M21 12a9 9 0 0 0-9-9"
        className="opacity-100"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}

function formatFileSize(size: number) {
  if (size < 1024) {
    return `${size} B`;
  }

  if (size < 1024 * 1024) {
    return `${Math.round(size / 1024)} KB`;
  }

  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

export default function SettingsPage() {
  const [logoUrl, setLogoUrl] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [uploadStatus, setUploadStatus] = useState<UploadStatus>("idle");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState("");

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
    setStatusMessage("");
    setUploadStatus("idle");
    setUploadProgress(0);

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
      const snapshot = await new Promise<import("firebase/storage").UploadTaskSnapshot>(
        (resolve, reject) => {
          const uploadTask = uploadBytesResumable(storageRef, file, {
            contentType: file.type,
          });

          uploadTask.on(
            "state_changed",
            (taskSnapshot) => {
              const progress = Math.round(
                (taskSnapshot.bytesTransferred / taskSnapshot.totalBytes) * 100,
              );
              setUploadProgress(progress);
              setStatusMessage(`Uploading ${progress}%`);
            },
            (taskError) => reject(taskError),
            () => resolve(uploadTask.snapshot),
          );
        },
      );
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
      setUploadStatus("error");
      return;
    }

    setUploading(true);
    setError("");
    setUploadStatus("uploading");
    setUploadProgress(0);
    setStatusMessage("Preparing upload...");

    try {
      const downloadURL = await handleLogoUpload(selectedFile);
      setLogoUrl(downloadURL);
      setUploadStatus("success");
      setUploadProgress(100);
      setStatusMessage("Logo uploaded successfully");
      toast.success("Logo uploaded successfully");
    } catch (uploadError) {
      const message =
        uploadError instanceof Error ? uploadError.message : "Unable to upload logo right now";
      setUploadStatus("error");
      setError(message);
      setStatusMessage(message);
      toast.error(message);
    } finally {
      setUploading(false);
    }
  }

  const uploadButtonClassName = [
    primaryButtonClassName,
    uploading
      ? ""
      : uploadStatus === "success"
        ? successButtonStateClassName
        : uploadStatus === "error"
          ? errorButtonStateClassName
          : "",
    uploading || (!selectedFile && uploadStatus !== "success")
      ? disabledButtonStateClassName
      : "",
  ].join(" ");

  const chooseFileButtonClassName = [
    primaryButtonClassName,
    "min-w-[140px]",
    uploading ? disabledButtonClassName : "",
  ].join(" ");

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
          <div className="mt-5 space-y-5">
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

            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <label className="mb-3 block text-sm font-medium text-slate-700">
                Upload new logo
              </label>
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div className="flex-1 space-y-3">
                  <input
                    id="logo-upload-input"
                    type="file"
                    accept="image/png,image/jpeg"
                    onChange={onFileChange}
                    disabled={uploading}
                    className="hidden"
                  />
                  <div className="flex flex-wrap items-center gap-3">
                    <label
                      htmlFor="logo-upload-input"
                      className={chooseFileButtonClassName}
                    >
                      Choose File
                    </label>
                    <div className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                      {selectedFile ? (
                        <>
                          <p className="truncate text-sm font-semibold text-slate-900">
                            {selectedFile.name}
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            {formatFileSize(selectedFile.size)}
                          </p>
                        </>
                      ) : (
                        <p className="text-sm text-slate-500">
                          No file selected yet.
                        </p>
                      )}
                    </div>
                  </div>

                  {uploading || uploadStatus === "success" ? (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs font-medium text-slate-600">
                        <span>{statusMessage}</span>
                        <span>{uploadProgress}%</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-slate-200">
                        <div
                          className={`h-full rounded-full transition-all duration-300 ${
                            uploadStatus === "success" ? "bg-[#16a34a]" : "bg-[#2563eb]"
                          }`}
                          style={{ width: `${uploadProgress}%` }}
                        />
                      </div>
                    </div>
                  ) : null}
                </div>

                <button
                  type="button"
                  onClick={onUploadLogo}
                  disabled={uploading || (!selectedFile && uploadStatus !== "success")}
                  className={`${uploadButtonClassName} min-w-[160px]`}
                >
                  {uploading ? (
                    <>
                      <Spinner />
                      Uploading...
                    </>
                  ) : uploadStatus === "success" ? (
                    "Uploaded ✓"
                  ) : (
                    "Upload Logo"
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </article>
    </section>
  );
}
