import { getDownloadURL, ref } from "firebase/storage";

import { getFirebaseClientStorage } from "@/lib/firebase-client";

const MAX_LOGO_WIDTH_PX = 160;
const MAX_LOGO_HEIGHT_PX = 60;

export interface ExportLogoAsset {
  dataUrl: string;
  downloadUrl: string;
  imageType: "jpg" | "png";
  bytes: Uint8Array;
  width: number;
  height: number;
}

function decodeStorageObjectPath(pathname: string) {
  const objectMarker = "/o/";
  const objectIndex = pathname.indexOf(objectMarker);
  if (objectIndex === -1) {
    return null;
  }

  return decodeURIComponent(pathname.slice(objectIndex + objectMarker.length));
}

function extractStorageSource(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  if (trimmed.startsWith("gs://")) {
    return trimmed;
  }

  if (/^https?:\/\//i.test(trimmed)) {
    try {
      const url = new URL(trimmed);
      if (url.hostname === "firebasestorage.googleapis.com") {
        return decodeStorageObjectPath(url.pathname);
      }
    } catch (error) {
      console.error("Unable to parse storage URL", error);
    }

    return null;
  }

  return trimmed;
}

function blobToDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
        return;
      }

      reject(new Error("Unable to read logo file."));
    };
    reader.onerror = () => reject(reader.error ?? new Error("Unable to read logo file."));
    reader.readAsDataURL(blob);
  });
}

function getLogoProxyUrl(url: string) {
  if (typeof window === "undefined") {
    return url;
  }

  const proxyUrl = new URL("/api/export/logo", window.location.origin);
  proxyUrl.searchParams.set("url", url);
  return proxyUrl.toString();
}

async function fetchLogoBlob(url: string) {
  const response = await fetch(getLogoProxyUrl(url), {
    credentials: "same-origin",
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`School logo could not be loaded (status ${response.status}).`);
  }

  const blob = await response.blob();
  if (!blob.type.startsWith("image/")) {
    throw new Error("School logo must be a PNG or JPG image.");
  }

  return blob;
}

function getFittedDimensions(width: number, height: number) {
  if (!width || !height) {
    return {
      width: MAX_LOGO_WIDTH_PX,
      height: MAX_LOGO_HEIGHT_PX,
    };
  }

  const scale = Math.min(MAX_LOGO_WIDTH_PX / width, MAX_LOGO_HEIGHT_PX / height, 1);

  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

function getImageDimensions(dataUrl: string) {
  return new Promise<{ width: number; height: number }>((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      resolve({
        width: image.naturalWidth,
        height: image.naturalHeight,
      });
    };
    image.onerror = () => reject(new Error("Unable to read school logo dimensions."));
    image.src = dataUrl;
  });
}

function getImageType(mimeType: string) {
  return mimeType === "image/jpeg" ? "jpg" : "png";
}

export async function resolveFirebaseStorageDownloadUrl(source?: string | null) {
  if (!source?.trim()) {
    return null;
  }

  const storageSource = extractStorageSource(source);
  if (!storageSource) {
    return source;
  }

  return getDownloadURL(ref(getFirebaseClientStorage(), storageSource));
}

export async function toBase64(url: string) {
  const blob = await fetchLogoBlob(url);
  return blobToDataUrl(blob);
}

export async function prepareLogoAsset(source?: string | null): Promise<ExportLogoAsset | null> {
  const downloadUrl = await resolveFirebaseStorageDownloadUrl(source);
  if (!downloadUrl) {
    return null;
  }

  const blob = await fetchLogoBlob(downloadUrl);

  const [arrayBuffer, dataUrl] = await Promise.all([blob.arrayBuffer(), blobToDataUrl(blob)]);
  const dimensions = await getImageDimensions(dataUrl).catch(() => ({
    width: MAX_LOGO_WIDTH_PX,
    height: MAX_LOGO_HEIGHT_PX,
  }));
  const fittedDimensions = getFittedDimensions(dimensions.width, dimensions.height);

  return {
    dataUrl,
    downloadUrl,
    imageType: getImageType(blob.type),
    bytes: new Uint8Array(arrayBuffer),
    width: fittedDimensions.width,
    height: fittedDimensions.height,
  };
}
