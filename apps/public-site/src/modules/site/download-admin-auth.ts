import { createHash, timingSafeEqual } from "node:crypto";

import { cookies } from "next/headers";

const SESSION_COOKIE_NAME = "download_admin_session";

function sha256(input: string) {
  return createHash("sha256").update(input).digest("hex");
}

function getConfiguredHash() {
  return process.env.DOWNLOAD_ADMIN_SECRET_HASH?.trim() || process.env.DOWNLOADS_ADMIN_SECRET_HASH?.trim() || "";
}

function getSessionToken() {
  const configuredHash = getConfiguredHash();
  return process.env.DOWNLOAD_ADMIN_SESSION_TOKEN?.trim() || sha256(`session:${configuredHash || "qiuaihub-download-admin"}`);
}

function constantTimeHexEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left, "hex");
  const rightBuffer = Buffer.from(right, "hex");
  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return timingSafeEqual(leftBuffer, rightBuffer);
}

export function hasDownloadAdminConfigured() {
  return Boolean(getConfiguredHash());
}

export function verifyDownloadAdminSecret(secret: string) {
  const configuredHash = getConfiguredHash();
  if (!configuredHash) {
    return false;
  }

  const candidate = sha256(secret.trim());
  if (candidate.length !== configuredHash.length) {
    return false;
  }

  try {
    return constantTimeHexEqual(candidate, configuredHash);
  } catch {
    return false;
  }
}

export async function isDownloadAdminAuthenticated() {
  const store = await cookies();
  const value = store.get(SESSION_COOKIE_NAME)?.value;
  return Boolean(value && value === getSessionToken());
}

export async function createDownloadAdminSession() {
  const store = await cookies();
  store.set(SESSION_COOKIE_NAME, getSessionToken(), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 14,
  });
}

export async function clearDownloadAdminSession() {
  const store = await cookies();
  store.set(SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: new Date(0),
  });
}
