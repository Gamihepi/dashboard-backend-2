import path from "path";
import fs from "fs/promises";
import SftpClient from "ssh2-sftp-client";
import { env } from "../config/env.js";

function sanitizeSegment(segment) {
  return String(segment || "")
    .replace(/[\\/]+/g, "")
    .replace(/\.\./g, "")
    .trim();
}

function sanitizeFilename(filename, fallback = "file.bin") {
  const raw = path.basename(String(filename || fallback));
  const cleaned = raw.replace(/[^\w.\-()[\]]+/g, "_");
  return cleaned || fallback;
}

function joinPosix(...parts) {
  return parts
    .filter(Boolean)
    .map((part) => String(part).replace(/\\/g, "/").replace(/\/+$/g, ""))
    .join("/")
    .replace(/\/{2,}/g, "/");
}

async function uploadToLocal(relativeDir, filename, buffer) {
  const destinationDir = path.join(
    process.cwd(),
    env.localUploadBase,
    ...relativeDir.split("/").filter(Boolean)
  );
  await fs.mkdir(destinationDir, { recursive: true });
  const destinationFile = path.join(destinationDir, filename);
  await fs.writeFile(destinationFile, buffer);
}

async function uploadToSftp(relativeDir, filename, buffer) {
  const client = new SftpClient();
  const remoteDir = joinPosix(env.sftp.basePath, relativeDir);
  const remoteFile = joinPosix(remoteDir, filename);

  try {
    await client.connect({
      host: env.sftp.host,
      port: env.sftp.port,
      username: env.sftp.user,
      password: env.sftp.password
    });
    await client.mkdir(remoteDir, true);
    await client.put(buffer, remoteFile);
  } finally {
    try {
      await client.end();
    } catch (error) {
      // ignore disconnect errors
    }
  }
}

export async function testSftpConnection() {
  if (!env.sftp.enabled) {
    // eslint-disable-next-line no-console
    console.log("[SFTP] Disabled. Using local uploads.");
    return;
  }

  const client = new SftpClient();
  try {
    await client.connect({
      host: env.sftp.host,
      port: env.sftp.port,
      username: env.sftp.user,
      password: env.sftp.password
    });
    const exists = await client.exists(env.sftp.basePath);
    // eslint-disable-next-line no-console
    console.log(
      `[SFTP] Connected (${env.sftp.host}:${env.sftp.port}) basePath=${env.sftp.basePath} exists=${Boolean(
        exists
      )}`
    );
  } finally {
    try {
      await client.end();
    } catch (error) {
      // ignore disconnect errors
    }
  }
}

export async function uploadBuffer({ fileFormate, category, subCategory, titleForPath, fileName, buffer }) {
  const safeFileFormate = sanitizeSegment(fileFormate || subCategory || category || "misc");
  const safeTitle = sanitizeSegment(titleForPath);
  const safeFileName = sanitizeFilename(fileName);
  const relativeDir = joinPosix(safeFileFormate, safeTitle);

  if (env.sftp.enabled) {
    await uploadToSftp(relativeDir, safeFileName, buffer);
  } else {
    await uploadToLocal(relativeDir, safeFileName, buffer);
  }

  return safeFileName;
}
