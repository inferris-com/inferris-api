import { argusRoleRank } from "../auth/auth.types.js";
import type { ArgusAccountRole } from "../../db/types.js";
import {
  ArgusDmConversationNotFoundError,
  ArgusDmForbiddenError,
  ArgusDmMessageNotFoundError,
  ArgusDmUserNotFoundError,
  ArgusDmValidationError,
} from "./argus-dm.errors.js";
import {
  toArgusDmConversationResponse,
  toArgusDmMessageResponse,
  toArgusDmParticipantResponse,
  type ArgusDmParticipantRow,
} from "./argus-dm.mapper.js";
import type { ArgusDmPgRepository } from "./argus-dm.pg-repository.js";
import type {
  ArgusDmConversationResponse,
  ArgusDmMessageResponse,
  ArgusDmParticipantResponse,
} from "./argus-dm.response-types.js";
import type {
  CreateArgusDmConversationBody,
  CreateArgusDmMessageBody,
  ListArgusDmConversationsQuery,
  UpdateArgusDmConversationBody,
  UpdateArgusDmMessageBody,
} from "./argus-dm.schemas.js";

export type ArgusDmConversationListResponse = {
  data: ArgusDmConversationResponse[];
  meta: {
    count: number;
    total: number;
    limit: number;
    offset: number;
  };
};

export class ArgusDmService {
  constructor(private readonly repo: ArgusDmPgRepository) {}

  async listConversations(
    argusUserId: string,
    query: ListArgusDmConversationsQuery,
  ): Promise<ArgusDmConversationListResponse> {
    const result = await this.repo.listConversations(argusUserId, query);
    const conversations = await this.hydrateConversations(result.rows);

    return {
      data: conversations,
      meta: {
        count: conversations.length,
        total: result.total,
        limit: result.limit,
        offset: result.offset,
      },
    };
  }

  async getConversation(
    conversationId: string,
    argusUserId: string,
  ): Promise<ArgusDmConversationResponse> {
    const conversation = await this.requireConversationParticipant(conversationId, argusUserId);

    return this.hydrateConversation(conversation);
  }

  async createConversation(
    input: CreateArgusDmConversationBody,
    ownerArgusUserId: string,
  ): Promise<ArgusDmConversationResponse> {
    const participantArgusUserIds = uniqueIds([ownerArgusUserId, ...input.recipientArgusUserIds]);

    if (participantArgusUserIds.length < 2) {
      throw new ArgusDmValidationError("A private DM must include at least one other Argus user.");
    }

    await this.requireActiveArgusUsers(participantArgusUserIds);

    const conversation = await this.repo.createConversation(
      input,
      ownerArgusUserId,
      participantArgusUserIds,
    );

    return this.hydrateConversation(conversation);
  }

  async updateConversation(
    conversationId: string,
    input: UpdateArgusDmConversationBody,
    argusUserId: string,
    role: ArgusAccountRole,
  ): Promise<ArgusDmConversationResponse> {
    const conversation = await this.requireConversationParticipant(conversationId, argusUserId);

    if (!canManageConversation(conversation.owner_argus_user_id, argusUserId, role)) {
      throw new ArgusDmForbiddenError(
        "Only the conversation owner or an Argus admin can manage this conversation.",
      );
    }

    if (input.addRecipientArgusUserIds) {
      await this.requireActiveArgusUsers(uniqueIds(input.addRecipientArgusUserIds));
    }

    const updated = await this.repo.updateConversation(conversationId, input, argusUserId);

    if (!updated) {
      throw new ArgusDmConversationNotFoundError(conversationId);
    }

    return this.hydrateConversation(updated);
  }

  async leaveConversation(conversationId: string, argusUserId: string): Promise<void> {
    await this.requireConversationParticipant(conversationId, argusUserId);

    if (!(await this.repo.leaveConversation(conversationId, argusUserId))) {
      throw new ArgusDmConversationNotFoundError(conversationId);
    }
  }

  async listMessages(
    conversationId: string,
    argusUserId: string,
  ): Promise<ArgusDmMessageResponse[]> {
    await this.requireConversationParticipant(conversationId, argusUserId);

    return (await this.repo.listMessages(conversationId)).map(toArgusDmMessageResponse);
  }

  async createMessage(
    conversationId: string,
    input: CreateArgusDmMessageBody,
    authorArgusUserId: string,
  ): Promise<ArgusDmMessageResponse> {
    await this.requireConversationParticipant(conversationId, authorArgusUserId);

    return toArgusDmMessageResponse(
      await this.repo.createMessage(conversationId, authorArgusUserId, input.body),
    );
  }

  async updateMessage(
    conversationId: string,
    messageId: string,
    input: UpdateArgusDmMessageBody,
    argusUserId: string,
  ): Promise<ArgusDmMessageResponse> {
    await this.requireConversationParticipant(conversationId, argusUserId);
    const message = await this.repo.findMessageById(conversationId, messageId);

    if (!message || message.deleted_at_ms !== null) {
      throw new ArgusDmMessageNotFoundError(messageId);
    }

    if (message.author_argus_user_id !== argusUserId) {
      throw new ArgusDmForbiddenError("You can only edit your own DM messages.");
    }

    const updatedMessage = await this.repo.updateMessage(conversationId, messageId, input.body);

    if (!updatedMessage) {
      throw new ArgusDmMessageNotFoundError(messageId);
    }

    return toArgusDmMessageResponse(updatedMessage);
  }

  async deleteMessage(
    conversationId: string,
    messageId: string,
    argusUserId: string,
    role: ArgusAccountRole,
  ): Promise<void> {
    await this.requireConversationParticipant(conversationId, argusUserId);

    if (argusRoleRank[role] < argusRoleRank.admin) {
      throw new ArgusDmForbiddenError("Only Argus admins can delete DM messages.");
    }

    const message = await this.repo.deleteMessage(conversationId, messageId, argusUserId);

    if (!message) {
      throw new ArgusDmMessageNotFoundError(messageId);
    }
  }

  private async requireConversationParticipant(conversationId: string, argusUserId: string) {
    const conversation = await this.repo.findConversationForParticipant(
      conversationId,
      argusUserId,
    );

    if (!conversation) {
      throw new ArgusDmConversationNotFoundError(conversationId);
    }

    return conversation;
  }

  private async requireActiveArgusUsers(argusUserIds: string[]): Promise<void> {
    const existingIds = new Set(await this.repo.listExistingActiveUserIds(argusUserIds));

    for (const argusUserId of argusUserIds) {
      if (!existingIds.has(argusUserId)) {
        throw new ArgusDmUserNotFoundError(argusUserId);
      }
    }
  }

  private async hydrateConversations(
    conversations: Awaited<ReturnType<ArgusDmPgRepository["listConversations"]>>["rows"],
  ): Promise<ArgusDmConversationResponse[]> {
    const conversationIds = conversations.map((conversation) => conversation.id);
    const [participantRows, latestMessages] = await Promise.all([
      this.repo.listActiveParticipants(conversationIds),
      this.repo.listLatestMessages(conversationIds),
    ]);

    const participantsByConversation = new Map<string, ArgusDmParticipantResponse[]>();

    for (const participant of participantRows as (ArgusDmParticipantRow & {
      conversation_id: string;
    })[]) {
      const list = participantsByConversation.get(participant.conversation_id) ?? [];
      list.push(toArgusDmParticipantResponse(participant));
      participantsByConversation.set(participant.conversation_id, list);
    }

    const latestMessageByConversation = new Map(
      latestMessages.map((message) => [message.conversation_id, message] as const),
    );

    return conversations.map((conversation) =>
      toArgusDmConversationResponse(
        conversation,
        participantsByConversation.get(conversation.id) ?? [],
        latestMessageByConversation.get(conversation.id) ?? null,
      ),
    );
  }

  private async hydrateConversation(
    conversation: Awaited<ReturnType<ArgusDmPgRepository["findConversationForParticipant"]>>,
  ): Promise<ArgusDmConversationResponse> {
    if (!conversation) {
      throw new ArgusDmConversationNotFoundError("unknown");
    }

    const [hydrated] = await this.hydrateConversations([conversation]);

    if (!hydrated) {
      throw new ArgusDmConversationNotFoundError(conversation.id);
    }

    return hydrated;
  }
}

function uniqueIds(ids: string[]): string[] {
  return [...new Set(ids)];
}

function canManageConversation(
  ownerArgusUserId: string | null,
  argusUserId: string,
  role: ArgusAccountRole,
): boolean {
  return ownerArgusUserId === argusUserId || argusRoleRank[role] >= argusRoleRank.admin;
}
