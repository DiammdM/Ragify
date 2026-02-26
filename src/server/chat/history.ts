import { prisma } from "@/lib/prisma";
import type {
  ChatConversationListItemDTO,
  ChatMessageDTO,
  ChatRole,
} from "@/lib/chat/types";
import type { ConversationTurn } from "@/server/answers/generator";

const OBJECT_ID_PATTERN = /^[a-f0-9]{24}$/i;
const DEFAULT_CONVERSATION_TITLE = "New chat";
const TITLE_MAX_LENGTH = 30;
const PREVIEW_MAX_LENGTH = 120;

export const MAX_CONVERSATIONS_PER_USER = 30;
export const MAX_CONTEXT_TURNS = 12;

type ConversationWithPreview = {
  id: string;
  title: string;
  createdAt: Date;
  updatedAt: Date;
  lastMessageAt: Date;
  messages: Array<{ content: string }>;
};

const isValidObjectId = (value: string) => OBJECT_ID_PATTERN.test(value);

const normalizeText = (value: string) => value.replace(/\s+/g, " ").trim();

const truncateText = (value: string, max: number) => {
  if (value.length <= max) {
    return value;
  }
  return `${value.slice(0, max).trimEnd()}...`;
};

export const deriveConversationTitle = (value: string) => {
  const normalized = normalizeText(value);
  if (!normalized) {
    return DEFAULT_CONVERSATION_TITLE;
  }
  return truncateText(normalized, TITLE_MAX_LENGTH);
};

const toMessageDTO = (message: {
  id: string;
  role: string;
  content: string;
  createdAt: Date;
}): ChatMessageDTO => ({
  id: message.id,
  role: message.role === "assistant" ? "assistant" : "user",
  content: message.content,
  createdAt: message.createdAt.toISOString(),
});

const toConversationListItem = (
  conversation: ConversationWithPreview,
): ChatConversationListItemDTO => {
  const preview = conversation.messages[0]?.content
    ? truncateText(normalizeText(conversation.messages[0].content), PREVIEW_MAX_LENGTH)
    : null;

  return {
    id: conversation.id,
    title: conversation.title || DEFAULT_CONVERSATION_TITLE,
    createdAt: conversation.createdAt.toISOString(),
    updatedAt: conversation.updatedAt.toISOString(),
    lastMessageAt: conversation.lastMessageAt.toISOString(),
    lastMessagePreview: preview,
  };
};

export const listConversationsForUser = async (userId: string) => {
  const conversations = await prisma.chatConversation.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      title: true,
      createdAt: true,
      updatedAt: true,
      lastMessageAt: true,
      messages: {
        select: { content: true },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });

  return conversations.map((conversation) =>
    toConversationListItem(conversation as ConversationWithPreview),
  );
};

export const getConversationListItemForUser = async (
  userId: string,
  conversationId: string,
) => {
  if (!isValidObjectId(conversationId)) {
    return null;
  }

  const conversation = await prisma.chatConversation.findFirst({
    where: { id: conversationId, userId },
    select: {
      id: true,
      title: true,
      createdAt: true,
      updatedAt: true,
      lastMessageAt: true,
      messages: {
        select: { content: true },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });

  if (!conversation) {
    return null;
  }

  return toConversationListItem(conversation as ConversationWithPreview);
};

const trimExcessConversations = async (userId: string) => {
  const staleConversations = await prisma.chatConversation.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
    skip: MAX_CONVERSATIONS_PER_USER,
    select: { id: true },
  });

  if (staleConversations.length === 0) {
    return;
  }

  const staleIds = staleConversations.map((conversation) => conversation.id);
  await prisma.$transaction([
    prisma.chatMessage.deleteMany({
      where: { conversationId: { in: staleIds } },
    }),
    prisma.chatConversation.deleteMany({
      where: { id: { in: staleIds }, userId },
    }),
  ]);
};

export const createConversationForUser = async (userId: string) => {
  const conversation = await prisma.chatConversation.create({
    data: {
      userId,
      title: DEFAULT_CONVERSATION_TITLE,
      lastMessageAt: new Date(),
    },
    select: {
      id: true,
      title: true,
      createdAt: true,
      updatedAt: true,
      lastMessageAt: true,
    },
  });

  await trimExcessConversations(userId);

  return {
    id: conversation.id,
    title: conversation.title,
    createdAt: conversation.createdAt.toISOString(),
    updatedAt: conversation.updatedAt.toISOString(),
    lastMessageAt: conversation.lastMessageAt.toISOString(),
    lastMessagePreview: null,
  } satisfies ChatConversationListItemDTO;
};

export const getConversationForUser = async (
  userId: string,
  conversationId: string,
) => {
  if (!isValidObjectId(conversationId)) {
    return null;
  }

  return prisma.chatConversation.findFirst({
    where: { id: conversationId, userId },
    select: { id: true, title: true },
  });
};

export const getMessagesForConversation = async (
  conversationId: string,
): Promise<ChatMessageDTO[]> => {
  const messages = await prisma.chatMessage.findMany({
    where: { conversationId },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      role: true,
      content: true,
      createdAt: true,
    },
  });

  return messages.map((message) => toMessageDTO(message));
};

export const getRecentConversationTurns = async (
  conversationId: string,
  limit = MAX_CONTEXT_TURNS,
): Promise<ConversationTurn[]> => {
  const messages = await prisma.chatMessage.findMany({
    where: { conversationId },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      role: true,
      content: true,
    },
  });

  return messages
    .reverse()
    .map((message) => {
      const role: ConversationTurn["role"] =
        message.role === "assistant" ? "assistant" : "user";

      return {
        role,
        content: message.content,
      };
    })
    .filter((message) => message.content.trim().length > 0);
};

export const getMessageCountForConversation = async (conversationId: string) =>
  prisma.chatMessage.count({ where: { conversationId } });

export const createMessageForConversation = async (options: {
  conversationId: string;
  role: ChatRole;
  content: string;
  updateTitle?: string;
}) => {
  const normalized = options.content.trim();
  const now = new Date();

  const message = await prisma.$transaction(async (tx) => {
    const created = await tx.chatMessage.create({
      data: {
        conversationId: options.conversationId,
        role: options.role,
        content: normalized,
        createdAt: now,
      },
      select: {
        id: true,
        role: true,
        content: true,
        createdAt: true,
      },
    });

    await tx.chatConversation.update({
      where: { id: options.conversationId },
      data: {
        lastMessageAt: now,
        ...(options.updateTitle ? { title: options.updateTitle } : {}),
      },
    });

    return created;
  });

  return toMessageDTO(message);
};

export const deleteConversationForUser = async (
  userId: string,
  conversationId: string,
) => {
  if (!isValidObjectId(conversationId)) {
    return false;
  }

  const conversation = await prisma.chatConversation.findFirst({
    where: { id: conversationId, userId },
    select: { id: true },
  });

  if (!conversation) {
    return false;
  }

  await prisma.$transaction([
    prisma.chatMessage.deleteMany({
      where: { conversationId },
    }),
    prisma.chatConversation.delete({
      where: { id: conversationId },
    }),
  ]);

  return true;
};
