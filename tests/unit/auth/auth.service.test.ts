import { describe, expect, jest, test } from "@jest/globals";

import type { RedisClient } from "../../../src/redis/index.js";
import { hashPassword } from "../../../src/module/auth/auth.crypto.js";
import type { AuthRepository } from "../../../src/module/auth/auth.repository.js";
import { authTokenResponseSchema } from "../../../src/module/auth/auth.response-types.js";
import { AuthService } from "../../../src/module/auth/auth.service.js";
import type { PasswordSecurityService } from "../../../src/module/password-security/password-security.service.js";

const userId = "00000000-0000-4000-8000-000000000001";

describe("AuthService", () => {
  test("login refreshes the password-security cue before returning token data", async () => {
    const password = "correct horse battery staple";
    const findArgusUserByUsernameOrEmail = jest
      .fn<AuthRepository["findArgusUserByUsernameOrEmail"]>()
      .mockResolvedValue({
        id: userId,
        username: "Developer",
        email: "developer@example.com",
        passwordHash: await hashPassword(password),
        role: "admin",
        actorId: "00000000-0000-4000-8000-000000000002",
        accountState: "active",
        accountSecurityLock: null,
      });
    const upsertArgusSession = jest
      .fn<AuthRepository["upsertArgusSession"]>()
      .mockResolvedValue(undefined);
    const findActivePrivilegedSubject = jest
      .fn<AuthRepository["findActivePrivilegedSubject"]>()
      .mockResolvedValue({
        id: "00000000-0000-4000-8000-000000000003",
        role: "administrator",
      });
    const repo = {
      findArgusUserByUsernameOrEmail,
      findActivePrivilegedSubject,
      upsertArgusSession,
    } as unknown as AuthRepository;

    const set = jest
      .fn<(key: string, value: string, options: { EX: number }) => Promise<string | null>>()
      .mockResolvedValue("OK");
    const sAdd = jest.fn<(key: string, value: string) => Promise<number>>().mockResolvedValue(1);
    const expire = jest
      .fn<(key: string, seconds: number) => Promise<boolean>>()
      .mockResolvedValue(true);
    const redis = { set, sAdd, expire } as unknown as RedisClient;

    const refreshPasswordSecurityCue = jest
      .fn<PasswordSecurityService["refreshPasswordSecurityCue"]>()
      .mockResolvedValue({
        breached: true,
        breachCount: 12,
        checkedAtMs: 1_800_000_000_000,
      });
    const passwordSecurityService = {
      refreshPasswordSecurityCue,
    } as unknown as PasswordSecurityService;

    const service = new AuthService(repo, redis, passwordSecurityService);
    const result = await service.login({ usernameOrEmail: "Developer", password });

    expect(refreshPasswordSecurityCue).toHaveBeenCalledWith(userId, password);
    expect(authTokenResponseSchema.parse(result)).toEqual(result);
    expect(result.user).toMatchObject({
      id: userId,
      username: "Developer",
      email: "developer@example.com",
      role: "admin",
      actorId: "00000000-0000-4000-8000-000000000002",
      accountState: "active",
      accountSecurityLock: null,
      privilegedRole: "administrator",
    });
    expect(findActivePrivilegedSubject).toHaveBeenCalledWith(
      "00000000-0000-4000-8000-000000000002",
    );
    expect(upsertArgusSession).toHaveBeenCalledTimes(1);
    expect(set).toHaveBeenCalledTimes(2);
    expect(sAdd).toHaveBeenCalledTimes(1);
    expect(expire).toHaveBeenCalledTimes(1);
  });
});
