export type ChatRole = "user" | "assistant";

export type ChatMessageDTO = {
  id: string;
  role: ChatRole;
  content: string;
  createdAt: string;
};

export type ChatConversationListItemDTO = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  lastMessageAt: string;
  lastMessagePreview: string | null;
};

export type ChatConversationListResponse = {
  conversations: ChatConversationListItemDTO[];
};

export type ChatConversationMessagesResponse = {
  messages: ChatMessageDTO[];
};

export type CreateConversationResponse = {
  conversation: ChatConversationListItemDTO;
};

export type SendMessageResponse = {
  conversation: ChatConversationListItemDTO;
  userMessage: ChatMessageDTO;
  assistantMessage: ChatMessageDTO;
  assistantError: string | null;
};
