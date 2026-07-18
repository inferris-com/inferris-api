import { createHash } from "node:crypto";

import { afterEach, describe, expect, jest, test } from "@jest/globals";

import type { RedisClient } from "../../../src/redis/index.js";
import { PasswordSecurityService } from "../../../src/module/password-security/password-security.service.js";

const accountId = "00000000-0000-4000-8000-000000000001";
const redisKey = `account:password-security:${accountId}`;

function createRedisMock() {
  const get = jest.fn<(key: string) => Promise<string | null>>().mockResolvedValue(null);
  const set = jest
    .fn<(key: string, value: string, options: { EX: number }) => Promise<string | null>>()
    .mockResolvedValue("OK");
  const del = jest.fn<(key: string) => Promise<number>>().mockResolvedValue(1);

  return {
    client: { get, set, del } as unknown as RedisClient,
    get,
    set,
    del,
  };
}

afterEach(() => {
  jest.restoreAllMocks();
});

describe("PasswordSecurityService", () => {
  test("replaces the Redis cue when HIBP reports a breached password", async () => {
    const password = "known-breached-password";
    const sha1 = createHash("sha1").update(password).digest("hex").toUpperCase();
    const prefix = sha1.slice(0, 5);
    const suffix = sha1.slice(5);
    const redis = createRedisMock();
    const now = 1_800_000_000_000;

    jest.spyOn(Date, "now").mockReturnValue(now);
    const fetchSpy = jest
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(`${suffix}:42\r\nABCDEF:1\r\n`, { status: 200 }));

    const service = new PasswordSecurityService(redis.client);
    const result = await service.refreshPasswordSecurityCue(accountId, password);

    expect(fetchSpy).toHaveBeenCalledWith(
      `https://api.pwnedpasswords.com/range/${prefix}`,
      expect.objectContaining({
        headers: {
          "User-Agent": "inferris-api",
          "Add-Padding": "true",
        },
        signal: expect.any(AbortSignal),
      }),
    );
    expect(redis.del).toHaveBeenCalledWith(redisKey);
    expect(result).toEqual({ breached: true, breachCount: 42, checkedAtMs: now });
    expect(redis.set).toHaveBeenCalledWith(redisKey, JSON.stringify(result), {
      EX: 60 * 60 * 24 * 30,
    });
  });

  test("clears an old cue without writing a new one when the password is not breached", async () => {
    const redis = createRedisMock();

    jest
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response("ABCDEF:1\r\n", { status: 200 }));

    const service = new PasswordSecurityService(redis.client);
    const result = await service.refreshPasswordSecurityCue(accountId, "unique-password");

    expect(result).toBeNull();
    expect(redis.del).toHaveBeenCalledWith(redisKey);
    expect(redis.set).not.toHaveBeenCalled();
  });

  test("removes malformed cached cues", async () => {
    const redis = createRedisMock();
    redis.get.mockResolvedValue('{"breached":true,"breachCount":-1}');

    const service = new PasswordSecurityService(redis.client);
    const result = await service.getPasswordSecurityCue(accountId);

    expect(result).toBeNull();
    expect(redis.del).toHaveBeenCalledWith(redisKey);
  });
});
