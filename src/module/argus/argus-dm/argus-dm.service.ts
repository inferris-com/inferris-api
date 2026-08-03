import type { AccountRole } from "@/module/argus/account/account.schemas.js";
import { argusRoleRank } from "@/module/auth/auth.types.js";
import {
  ArgusDmConversationNotFoundError,
  ArgusDmForbiddenError,
  ArgusDmMessageNotFoundError,
  ArgusDmUserNotFoundError,
  ArgusDmValidationError,
} from "@/module/argus/argus-dm/argus-dm.errors.js";
import {
  toArgusDmConversationResponse,
  toArgusDmMessageResponse,
  toArgusDmParticipantResponse,
  type ArgusDmParticipantRow,
} from "@/module/argus/argus-dm/argus-dm.mapper.js";
import type { ArgusDmPgRepository } from "@/module/argus/argus-dm/argus-dm.pg-repository.js";
import type {
  ArgusDmConversationResponse,
  ArgusDmMessageResponse,
  ArgusDmParticipantResponse,
} from "@/module/argus/argus-dm/argus-dm.response-types.js";
import type {
  CreateArgusDmConversationBody,
  CreateArgusDmMessageBody,
  ListArgusDmConversationsQuery,
  UpdateArgusDmConversationBody,
  UpdateArgusDmMessageBody,
} from "@/module/argus/argus-dm/argus-dm.schemas.js";

export type ArgusDmConversationListResponse = {
  data: ArgusDmConversationResponse[];
  meta: {
    count: number;
    total: number;
    limit: number;
    offset: number;
  };
};

export type ArgusDmUnreadCountResponse = {
  unreadConversations: number;
};

export class ArgusDmService {
  constructor(private readonly repo: ArgusDmPgRepository) {}

  async listConversations(
    argusUserId: string,
    query: ListArgusDmConversationsQuery,
  ): Promise<ArgusDmConversationListResponse> {
    const result = await this.repo.listConversations(argusUserId, query);
    const conversations = await this.hydrateConversations(result.rows, argusUserId);

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
    markRead = true,
  ): Promise<ArgusDmConversationResponse> {
    const conversation = await this.requireConversationParticipant(conversationId, argusUserId);

    if (markRead) {
      await this.repo.markConversationRead(conversationId, argusUserId);
    }

    return this.hydrateConversation(conversation, argusUserId);
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

    return this.hydrateConversation(conversation, ownerArgusUserId);
  }

  async updateConversation(
    conversationId: string,
    input: UpdateArgusDmConversationBody,
    argusUserId: string,
    role: AccountRole,
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

    return this.hydrateConversation(updated, argusUserId);
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
    await this.repo.markConversationRead(conversationId, argusUserId);

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
    role: AccountRole,
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

  async markConversationRead(conversationId: string, argusUserId: string): Promise<void> {
    await this.requireConversationParticipant(conversationId, argusUserId);

    if (!(await this.repo.markConversationRead(conversationId, argusUserId))) {
      throw new ArgusDmConversationNotFoundError(conversationId);
    }
  }

  async getUnreadCount(argusUserId: string): Promise<ArgusDmUnreadCountResponse> {
    return {
      unreadConversations: await this.repo.countUnreadConversations(argusUserId),
    };
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
    currentArgusUserId: string,
  ): Promise<ArgusDmConversationResponse[]> {
    const conversationIds = conversations.map((conversation) => conversation.id);
    const [participantRows, latestMessages, unreadCounts] = await Promise.all([
      this.repo.listActiveParticipants(conversationIds),
      this.repo.listLatestMessages(conversationIds),
      this.repo.countUnreadMessages(conversationIds, currentArgusUserId),
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
    const unreadCountByConversation = new Map(
      unreadCounts.map((row) => [row.conversation_id, Number(row.total)] as const),
    );

    return conversations.map((conversation) =>
      toArgusDmConversationResponse(
        conversation,
        participantsByConversation.get(conversation.id) ?? [],
        latestMessageByConversation.get(conversation.id) ?? null,
        participantsByConversation
          .get(conversation.id)
          ?.find((participant) => participant.argusUserId === currentArgusUserId) ?? null,
        unreadCountByConversation.get(conversation.id) ?? 0,
      ),
    );
  }

  private async hydrateConversation(
    conversation: Awaited<ReturnType<ArgusDmPgRepository["findConversationForParticipant"]>>,
    currentArgusUserId: string,
  ): Promise<ArgusDmConversationResponse> {
    if (!conversation) {
      throw new ArgusDmConversationNotFoundError("unknown");
    }

    const [hydrated] = await this.hydrateConversations([conversation], currentArgusUserId);

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
  role: AccountRole,
): boolean {
  return ownerArgusUserId === argusUserId || argusRoleRank[role] >= argusRoleRank.admin;
}
