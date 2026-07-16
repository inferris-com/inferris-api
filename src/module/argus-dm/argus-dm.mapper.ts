import type { Selectable } from "kysely";

import type { ArgusDmConversations, ArgusDmMessages } from "../../db/types.js";
import { int8ToString, int8ToStringOrNull } from "../../shared/db/int8.js";
import type {
  ArgusDmConversationResponse,
  ArgusDmMessageResponse,
  ArgusDmParticipantResponse,
} from "./argus-dm.response-types.js";

export type ArgusDmParticipantRow = {
  argus_user_id: string;
  username: string;
  role: "moderator" | "admin";
  invited_by_argus_user_id: string | null;
  joined_at_ms: string | number | bigint;
};

export function toArgusDmConversationResponse(
  row: Selectable<ArgusDmConversations>,
  participants: ArgusDmParticipantResponse[],
  latestMessage: Selectable<ArgusDmMessages> | null,
): ArgusDmConversationResponse {
  return {
    id: row.id,
    title: row.title,
    ownerArgusUserId: row.owner_argus_user_id,
    participants,
    latestMessage: latestMessage
      ? {
          id: latestMessage.id,
          authorArgusUserId: latestMessage.author_argus_user_id,
          body: latestMessage.deleted_at_ms === null ? latestMessage.body : null,
          isDeleted: latestMessage.deleted_at_ms !== null,
          createdAtMs: int8ToString(latestMessage.created_at_ms),
        }
      : null,
    createdAtMs: int8ToString(row.created_at_ms),
    updatedAtMs: int8ToStringOrNull(row.updated_at_ms),
  };
}

export function toArgusDmParticipantResponse(
  row: ArgusDmParticipantRow,
): ArgusDmParticipantResponse {
  return {
    argusUserId: row.argus_user_id,
    username: row.username,
    role: row.role,
    invitedByArgusUserId: row.invited_by_argus_user_id,
    joinedAtMs: int8ToString(row.joined_at_ms),
  };
}

export function toArgusDmMessageResponse(row: Selectable<ArgusDmMessages>): ArgusDmMessageResponse {
  const isDeleted = row.deleted_at_ms !== null;

  return {
    id: row.id,
    conversationId: row.conversation_id,
    authorArgusUserId: row.author_argus_user_id,
    body: isDeleted ? null : row.body,
    isDeleted,
    createdAtMs: int8ToString(row.created_at_ms),
    editedAtMs: int8ToStringOrNull(row.edited_at_ms),
    deletedAtMs: int8ToStringOrNull(row.deleted_at_ms),
    deletedByArgusUserId: row.deleted_by_argus_user_id,
  };
}
