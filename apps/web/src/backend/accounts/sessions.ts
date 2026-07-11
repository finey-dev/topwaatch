import { AccountWithToken } from "@/stores/auth";
import { trpcClient } from "@/utils/trpc";

export interface SessionResponse {
  id: string;
  userId: string;
  createdAt: string;
  accessedAt: string;
  device: string;
  userAgent: string;
}

export interface SessionUpdate {
  deviceName: string;
}

function mapSession(session: {
  id: string;
  userId: string;
  createdAt: Date | string;
  updatedAt?: Date | string | null;
  userAgent?: string | null;
}): SessionResponse {
  return {
    id: session.id,
    userId: session.userId,
    createdAt: new Date(session.createdAt).toISOString(),
    accessedAt: new Date(session.updatedAt ?? session.createdAt).toISOString(),
    device: session.userAgent?.slice(0, 80) || "Web",
    userAgent: session.userAgent ?? "",
  };
}

export async function getSessions(
  _url: string,
  _account: AccountWithToken,
): Promise<SessionResponse[]> {
  // Use our tRPC route  Better Auth's /list-sessions requires a "fresh"
  // session (default 1 day) and returns SESSION_NOT_FRESH otherwise.
  const rows = await trpcClient.me.listSessions.query();
  return rows.map(mapSession);
}

export async function updateSession(
  _url: string,
  account: AccountWithToken,
  update: SessionUpdate,
): Promise<SessionResponse[]> {
  // Better Auth sessions don't store a custom device name; keep local store in sync only.
  account.deviceName = update.deviceName;
  return getSessions(_url, account);
}

export async function removeSession(
  _url: string,
  _token: string,
  sessionId: string,
) {
  await trpcClient.me.revokeSession.mutate({ sessionId });
  return [] as SessionResponse[];
}
