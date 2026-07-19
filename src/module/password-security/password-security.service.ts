import { createHash } from "node:crypto";

import type { RedisClient } from "../../redis/index.js";
import {
  passwordSecurityCueSchema,
  type PasswordSecurityCue,
} from "./password-security.schemas.js";
import { config } from "../../config.js";

const passwordSecurityTtlSeconds = 60 * 60 * 24 * 30;
const passwordSecurityRequestTimeoutMs = 5_000;

function passwordSecurityKey(accountId: string): string {
  return `account:password-security:${accountId}`;
}

export class PasswordSecurityService {
  constructor(private readonly redis: RedisClient) {}

  async refreshPasswordSecurityCue(
    accountId: string,
    password: string,
  ): Promise<PasswordSecurityCue | null> {
    await this.clearPasswordSecurityCue(accountId);

    if(!config.argus.notifyDataBreach){
      return null;
    }

    const passwordSecurity = await this.checkPasswordSecurity(password);

    if (passwordSecurity) {
      await this.setPasswordSecurityCue(accountId, passwordSecurity);
    }

    return passwordSecurity;
  }

  async getPasswordSecurityCue(accountId: string): Promise<PasswordSecurityCue | null> {
    const raw = await this.redis.get(passwordSecurityKey(accountId));

    if (!raw) {
      return null;
    }

    try {
      const parsed = passwordSecurityCueSchema.safeParse(JSON.parse(raw));

      if (parsed.success) {
        return parsed.data;
      }
    } catch {
      // Invalid or stale cache values are treated as absent and removed below.
    }

    await this.clearPasswordSecurityCue(accountId);
    return null;
  }

  async clearPasswordSecurityCue(accountId: string): Promise<void> {
    await this.redis.del(passwordSecurityKey(accountId));
  }

  private async checkPasswordSecurity(password: string): Promise<PasswordSecurityCue | null> {
    const sha1 = createHash("sha1").update(password).digest("hex").toUpperCase();
    const prefix = sha1.slice(0, 5);
    const suffix = sha1.slice(5);

    try {
      const response = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
        headers: {
          "User-Agent": "inferris-api",
          "Add-Padding": "true",
        },
        signal: AbortSignal.timeout(passwordSecurityRequestTimeoutMs),
      });

      if (!response.ok) {
        return null;
      }

      const text = await response.text();
      const matchingLine = text
        .split("\n")
        .map((line) => line.trim())
        .find((line) => line.startsWith(`${suffix}:`));

      if (!matchingLine) {
        return null;
      }

      const breachCount = Number.parseInt(matchingLine.slice(suffix.length + 1), 10);

      if (!Number.isSafeInteger(breachCount) || breachCount < 0) {
        return null;
      }

      return passwordSecurityCueSchema.parse({
        breached: true,
        breachCount,
        checkedAtMs: Date.now(),
      });
    } catch {
      return null;
    }
  }

  private async setPasswordSecurityCue(accountId: string, cue: PasswordSecurityCue): Promise<void> {
    await this.redis.set(passwordSecurityKey(accountId), JSON.stringify(cue), {
      EX: passwordSecurityTtlSeconds,
    });
  }
}
