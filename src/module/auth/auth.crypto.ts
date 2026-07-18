import { createHmac, createHash, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import argon2 from "argon2";
import { SignJWT, jwtVerify } from "jose";

import { config } from "../../config.js";
import type { AccountRole } from "../account/account.schemas.js";

const jwtSecret = new TextEncoder().encode(config.auth.jwtSecret);

export type AccessTokenPayload = {
  sub: string;
  actorId: string | null;
  role: AccountRole;
  sessionId?: string;
  typ: "access";
};

export function hashApiKeySecret(secret: string): string {
  return createHmac("sha256", config.auth.apiKeyPepper).update(secret).digest("hex");
}

export function compareHashes(actual: string, expected: string): boolean {
  const actualBuffer = Buffer.from(actual);
  const expectedBuffer = Buffer.from(expected);

  return (
    actualBuffer.length === expectedBuffer.length && timingSafeEqual(actualBuffer, expectedBuffer)
  );
}

export function parseApiKeyToken(token: string): { keyId: string; secret: string } | null {
  const parts = token.split(".");

  if (parts.length !== 2) {
    return null;
  }

  const keyId = parts[0];
  const secret = parts[1];

  if (!keyId || !secret) {
    return null;
  }

  return { keyId, secret };
}

export function createApiKeyToken(keyId = randomUUID()): {
  keyId: string;
  token: string;
  keyHash: string;
} {
  const secret = randomBytes(32).toString("base64url");
  const token = `${keyId}.${secret}`;

  return {
    keyId,
    token,
    keyHash: hashApiKeySecret(secret),
  };
}

export async function verifyPassword(
  passwordHash: string | null,
  password: string,
): Promise<boolean> {
  if (passwordHash == null) {
    return false;
  }

  return argon2.verify(passwordHash, password);
}

export async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password);
}

export async function signAccessToken(
  payload: Omit<AccessTokenPayload, "typ"> & { sessionId: string },
): Promise<string> {
  return new SignJWT({
    actorId: payload.actorId,
    role: payload.role,
    sessionId: payload.sessionId,
    typ: "access",
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime(`${config.auth.accessTokenTtlSeconds}s`)
    .sign(jwtSecret);
}

export async function verifyAccessToken(token: string): Promise<AccessTokenPayload> {
  const { payload } = await jwtVerify(token, jwtSecret);

  if (payload.typ !== "access" || typeof payload.sub !== "string") {
    throw new Error("Invalid access token payload");
  }

  if (payload.actorId !== null && typeof payload.actorId !== "string") {
    throw new Error("Invalid access token actor");
  }

  if (payload.role !== "moderator" && payload.role !== "admin") {
    throw new Error("Invalid access token role");
  }

  if (payload.sessionId !== undefined && typeof payload.sessionId !== "string") {
    throw new Error("Invalid access token session");
  }

  return {
    sub: payload.sub,
    actorId: payload.actorId,
    role: payload.role,
    ...(payload.sessionId !== undefined ? { sessionId: payload.sessionId } : {}),
    typ: "access",
  };
}

export function createRefreshToken(): { token: string; tokenHash: string } {
  const token = randomBytes(48).toString("base64url");

  return {
    token,
    tokenHash: hashRefreshToken(token),
  };
}

export function hashRefreshToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function createMinecraftSessionToken(): { token: string; tokenHash: string } {
  const token = randomBytes(48).toString("base64url");

  return {
    token,
    tokenHash: hashMinecraftSessionToken(token),
  };
}

export function hashMinecraftSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function createServerInstanceToken(): { token: string; tokenHash: string } {
  const token = randomBytes(48).toString("base64url");

  return {
    token,
    tokenHash: hashServerInstanceToken(token),
  };
}

export function hashServerInstanceToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
