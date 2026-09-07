import { createHash, randomBytes } from "node:crypto";

export function createInvitationToken() {
  const token = randomBytes(32).toString("hex");
  return { token, tokenHash: createHash("sha256").update(token).digest("hex") };
}
