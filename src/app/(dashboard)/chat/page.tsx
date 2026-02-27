"use client";

import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Menu, MessageSquarePlus, Plus, Trash2, X } from "lucide-react";
import { useLanguage } from "@/components/language-provider";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type {
  ChatConversationListItemDTO,
  ChatConversationListResponse,
  ChatConversationMessagesResponse,
  ChatMessageDTO,
  CreateConversationResponse,
  SendMessageResponse,
} from "@/lib/chat/types";

type ChatMessage = ChatMessageDTO & {
  status?: "loading" | "error";
  error?: string | null;
};

type ApiError = {
  error?: string;
};

const MAX_CONVERSATIONS = 30;

const upsertConversation = (
  conversations: ChatConversationListItemDTO[],
  conversation: ChatConversationListItemDTO,
) => {
  const merged = [
    conversation,
    ...conversations.filter((item) => item.id !== conversation.id),
  ];

  return merged.slice(0, MAX_CONVERSATIONS);
};

export default function ChatPage() {
  const { t, language } = useLanguage();
  const [input, setInput] = useState("");
  const [conversations, setConversations] = useState<
    ChatConversationListItemDTO[]
  >([]);
  const [activeConversationId, setActiveConversationId] = useState<
    string | null
  >(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [isLoadingConversations, setIsLoadingConversations] = useState(true);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isCreatingConversation, setIsCreatingConversation] = useState(false);
  const [deletingConversationId, setDeletingConversationId] = useState<
    string | null
  >(null);
  const [pendingDeleteConversation, setPendingDeleteConversation] =
    useState<ChatConversationListItemDTO | null>(null);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const messageRequestId = useRef(0);
  const activeConversationIdRef = useRef<string | null>(null);
  const skipNextLoadConversationIdRef = useRef<string | null>(null);

  const timeFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(language === "en" ? "en-US" : "zh-CN", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }),
    [language],
  );

  useEffect(() => {
    const node = viewportRef.current;
    if (!node) {
      return;
    }
    node.scrollTop = node.scrollHeight;
  }, [messages]);

  useEffect(() => {
    activeConversationIdRef.current = activeConversationId;
  }, [activeConversationId]);

  const loadConversations = useCallback(
    async (preferredConversationId?: string | null) => {
      setIsLoadingConversations(true);
      setHistoryError(null);

      try {
        const response = await fetch("/api/chat/conversations");
        const data: ChatConversationListResponse & ApiError =
          await response.json();

        if (!response.ok) {
          throw new Error(data.error || t.chat.loadHistoryError);
        }

        const list = Array.isArray(data.conversations)
          ? data.conversations
          : [];
        setConversations(list);

        const currentActiveId = activeConversationIdRef.current;
        const nextActiveId =
          preferredConversationId &&
          list.some(
            (conversation) => conversation.id === preferredConversationId,
          )
            ? preferredConversationId
            : currentActiveId &&
                list.some((conversation) => conversation.id === currentActiveId)
              ? currentActiveId
              : (list[0]?.id ?? null);

        setActiveConversationId(nextActiveId);
        if (!nextActiveId) {
          setMessages([]);
        }
      } catch (error) {
        const fallback =
          error instanceof Error ? error.message : t.chat.loadHistoryError;
        setHistoryError(fallback);
        setConversations([]);
        setActiveConversationId(null);
        setMessages([]);
      } finally {
        setIsLoadingConversations(false);
      }
    },
    [t.chat.loadHistoryError],
  );

  const createConversation = useCallback(
    async (options?: { skipNextLoad?: boolean }) => {
      const response = await fetch("/api/chat/conversations", {
        method: "POST",
      });
      const data: CreateConversationResponse & ApiError = await response.json();

      if (!response.ok || !data.conversation) {
        throw new Error(data.error || t.chat.loadHistoryError);
      }

      setConversations((prev) => upsertConversation(prev, data.conversation));
      if (options?.skipNextLoad) {
        skipNextLoadConversationIdRef.current = data.conversation.id;
      }
      setActiveConversationId(data.conversation.id);
      setMessages([]);

      return data.conversation.id;
    },
    [t.chat.loadHistoryError],
  );

  const loadMessages = useCallback(
    async (conversationId: string) => {
      const requestId = messageRequestId.current + 1;
      messageRequestId.current = requestId;
      setIsLoadingMessages(true);
      setHistoryError(null);

      try {
        const response = await fetch(
          `/api/chat/conversations/${conversationId}/messages`,
        );
        const data: ChatConversationMessagesResponse & ApiError =
          await response.json();

        if (!response.ok) {
          throw new Error(data.error || t.chat.loadHistoryError);
        }

        if (requestId !== messageRequestId.current) {
          return;
        }

        const nextMessages = Array.isArray(data.messages)
          ? data.messages.map((message) => ({ ...message }))
          : [];
        setMessages(nextMessages);
      } catch (error) {
        if (requestId !== messageRequestId.current) {
          return;
        }

        const fallback =
          error instanceof Error ? error.message : t.chat.loadHistoryError;
        setHistoryError(fallback);
        setMessages([]);
      } finally {
        if (requestId === messageRequestId.current) {
          setIsLoadingMessages(false);
        }
      }
    },
    [t.chat.loadHistoryError],
  );

  useEffect(() => {
    void loadConversations();
  }, [loadConversations]);

  useEffect(() => {
    if (!activeConversationId) {
      setMessages([]);
      setIsLoadingMessages(false);
      return;
    }

    if (skipNextLoadConversationIdRef.current === activeConversationId) {
      skipNextLoadConversationIdRef.current = null;
      return;
    }

    void loadMessages(activeConversationId);
  }, [activeConversationId, loadMessages]);

  const handleCreateConversation = async () => {
    if (isCreatingConversation || isSending) {
      return;
    }

    setIsCreatingConversation(true);
    setHistoryError(null);

    try {
      await createConversation();
      setIsHistoryOpen(false);
    } catch (error) {
      const fallback =
        error instanceof Error ? error.message : t.chat.loadHistoryError;
      setHistoryError(fallback);
    } finally {
      setIsCreatingConversation(false);
    }
  };

  const submitMessage = async () => {
    const trimmed = input.trim();
    if (!trimmed || isSending) {
      return;
    }

    setHistoryError(null);

    let conversationId = activeConversationId;
    if (!conversationId) {
      try {
        conversationId = await createConversation({ skipNextLoad: true });
      } catch (error) {
        const fallback =
          error instanceof Error ? error.message : t.chat.loadHistoryError;
        setHistoryError(fallback);
        return;
      }
    }

    const stamp = Date.now();
    const nowIso = new Date(stamp).toISOString();
    const tempUserId = `temp-user-${stamp}`;
    const tempAssistantId = `temp-assistant-${stamp + 1}`;

    setMessages((prev) => [
      ...prev,
      {
        id: tempUserId,
        role: "user",
        content: trimmed,
        createdAt: nowIso,
      },
      {
        id: tempAssistantId,
        role: "assistant",
        content: "",
        createdAt: nowIso,
        status: "loading",
      },
    ]);
    setInput("");
    setIsSending(true);

    try {
      const response = await fetch(
        `/api/chat/conversations/${conversationId}/messages`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ content: trimmed }),
        },
      );

      const data: SendMessageResponse & ApiError = await response.json();

      if (!response.ok || !data.userMessage || !data.assistantMessage) {
        throw new Error(data.error || t.chat.answerError);
      }

      setMessages((prev) =>
        prev.map((message) => {
          if (message.id === tempUserId) {
            return {
              ...data.userMessage,
            };
          }
          if (message.id === tempAssistantId) {
            return {
              ...data.assistantMessage,
              status: data.assistantError ? "error" : undefined,
              error: data.assistantError,
            };
          }
          return message;
        }),
      );

      if (data.conversation) {
        setConversations((prev) => upsertConversation(prev, data.conversation));
      }
    } catch (error) {
      const fallback =
        error instanceof Error ? error.message : t.chat.answerError;

      setMessages((prev) =>
        prev.map((message) =>
          message.id === tempAssistantId
            ? {
                ...message,
                status: "error",
                error: fallback,
                content: fallback,
              }
            : message,
        ),
      );
    } finally {
      setIsSending(false);
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await submitMessage();
  };

  const handleDeleteConversation = async () => {
    if (!pendingDeleteConversation || deletingConversationId) {
      return;
    }

    const targetId = pendingDeleteConversation.id;
    setDeletingConversationId(targetId);
    setHistoryError(null);

    try {
      const response = await fetch(`/api/chat/conversations/${targetId}`, {
        method: "DELETE",
      });
      const data: { success?: boolean; error?: string } = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || t.chat.loadHistoryError);
      }

      setPendingDeleteConversation(null);
      await loadConversations();
    } catch (error) {
      const fallback =
        error instanceof Error ? error.message : t.chat.loadHistoryError;
      setHistoryError(fallback);
    } finally {
      setDeletingConversationId(null);
    }
  };

  return (
    <>
      <section
        className="flat-surface-1 relative flex overflow-hidden"
        style={{ height: "min(794px, calc(100vh - 220px))" }}
      >
        <div className="grid h-full w-full grid-cols-1 bg-card/95 text-foreground dark:bg-slate-900/60 dark:text-white md:grid-cols-[300px_1fr]">
          <aside
            className={`absolute inset-y-0 left-0 z-30 w-[300px] border-r border-border bg-card/95 p-4 transition-transform duration-200 dark:border-white/10 dark:bg-slate-950/95 md:relative md:z-auto md:w-auto md:translate-x-0 ${
              isHistoryOpen ? "translate-x-0" : "-translate-x-full"
            }`}
          >
            <div className="flex h-full flex-col gap-4">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-sm font-semibold text-foreground/80 dark:text-white/80">
                  {t.chat.historyTitle}
                </h2>
                <Button
                  type="button"
                  size="icon-sm"
                  variant="ghost"
                  onClick={() => setIsHistoryOpen(false)}
                  className="md:hidden"
                  aria-label={t.layout.mobileMenu.close}
                >
                  <X className="size-4" />
                </Button>
              </div>

              <Button
                type="button"
                onClick={handleCreateConversation}
                disabled={isCreatingConversation || isSending}
                className="w-full justify-start rounded-xl hover:cursor-pointer"
                variant="outline"
              >
                {isCreatingConversation ? (
                  <Plus className="size-4 animate-spin" />
                ) : (
                  <MessageSquarePlus className="size-4" />
                )}
                {t.chat.newConversation}
              </Button>

              <div className="min-h-0 flex-1 overflow-y-auto">
                {isLoadingConversations ? (
                  <div className="rounded-xl border border-dashed border-border bg-muted/40 p-3 text-sm text-muted-foreground dark:border-white/10 dark:bg-slate-900/50">
                    {t.chat.loadingHistory}
                  </div>
                ) : conversations.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-border bg-muted/40 p-3 text-sm text-muted-foreground dark:border-white/10 dark:bg-slate-900/50">
                    {t.chat.historyEmpty}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {conversations.map((conversation) => {
                      const isActive = conversation.id === activeConversationId;
                      return (
                        <div
                          key={conversation.id}
                          className={`group w-full rounded-xl border p-3 text-left transition hover:cursor-pointer ${
                            isActive
                              ? "border-violet-300/80 bg-violet-500/10"
                              : "border-border bg-background/70 hover:border-violet-300/60 hover:bg-violet-500/5 dark:border-white/10 dark:bg-slate-900/60"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setActiveConversationId(conversation.id);
                                setIsHistoryOpen(false);
                              }}
                              className="min-w-0 flex-1 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring/50 hover:cursor-pointer"
                            >
                              <p className="truncate text-sm font-medium text-foreground dark:text-white/90">
                                {conversation.title}
                              </p>
                              <p className="mt-1 truncate text-xs text-muted-foreground">
                                {conversation.lastMessagePreview ||
                                  t.chat.answerFallback}
                              </p>
                              <p className="mt-1 text-[11px] text-muted-foreground/90">
                                {timeFormatter.format(
                                  new Date(conversation.updatedAt),
                                )}
                              </p>
                            </button>
                            <Button
                              type="button"
                              size="icon-sm"
                              variant="ghost"
                              onClick={() => {
                                setPendingDeleteConversation(conversation);
                              }}
                              aria-label={t.chat.deleteConversation}
                              className="opacity-80 transition hover:text-red-500 group-hover:opacity-100 hover:cursor-pointer"
                              disabled={
                                deletingConversationId === conversation.id
                              }
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </aside>

          <div className="relative flex h-full min-h-0 flex-col p-6 sm:p-8">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="icon-sm"
                  onClick={() => setIsHistoryOpen((prev) => !prev)}
                  className="md:hidden"
                  aria-label={t.chat.historyTitle}
                >
                  <Menu className="size-4" />
                </Button>
                <h2 className="text-2xl font-semibold text-foreground sm:text-3xl dark:text-white">
                  {t.chat.title}
                </h2>
              </div>
            </div>

            {historyError ? (
              <div className="mt-4 rounded-xl border border-red-300/60 bg-red-100/60 px-4 py-2 text-sm text-red-700 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-200">
                {historyError}
              </div>
            ) : null}

            <div className="mt-6 grid min-h-0 flex-1 grid-rows-[1fr_auto] gap-4">
              <div
                ref={viewportRef}
                className="scrollbar-dark flex min-h-0 flex-col gap-4 overflow-y-auto rounded-[16px] border border-border bg-muted/50 p-5 dark:border-white/10 dark:bg-slate-950/60"
              >
                {!activeConversationId ? (
                  <div className="rounded-2xl border border-dashed border-border bg-muted/40 p-6 text-sm text-muted-foreground dark:border-white/10 dark:bg-slate-900/50">
                    {t.chat.historyEmpty}
                  </div>
                ) : isLoadingMessages ? (
                  <div className="rounded-2xl border border-dashed border-border bg-muted/40 p-6 text-sm text-muted-foreground dark:border-white/10 dark:bg-slate-900/50">
                    {t.chat.loadingHistory}
                  </div>
                ) : messages.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-border bg-muted/40 p-6 text-sm text-muted-foreground dark:border-white/10 dark:bg-slate-900/50">
                    {t.chat.emptyState}
                  </div>
                ) : (
                  messages.map((message) => {
                    const isUser = message.role === "user";
                    const isLoading = message.status === "loading";
                    const isError = message.status === "error";

                    return (
                      <div
                        key={message.id}
                        className={`flex w-full ${
                          isUser ? "justify-end" : "justify-start"
                        }`}
                      >
                        <div
                          className={`max-w-[82%] rounded-xl border px-3 py-2 ${
                            isUser
                              ? "border-violet-500/80 bg-violet-600 text-white"
                              : "border-border bg-card text-foreground dark:border-white/10 dark:bg-slate-900/70 dark:text-white/90"
                          }`}
                        >
                          <div className="text-sm whitespace-pre-line">
                            {isLoading ? (
                              <div className="flex items-center gap-1 text-foreground/80">
                                {[0, 1, 2].map((index) => (
                                  <span
                                    key={index}
                                    className="inline-block size-2 animate-bounce rounded-full bg-foreground/70"
                                    style={{
                                      animationDelay: `${index * 120}ms`,
                                    }}
                                  />
                                ))}
                              </div>
                            ) : isError ? (
                              message.error ||
                              message.content ||
                              t.chat.answerError
                            ) : (
                              message.content || t.chat.answerFallback
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              <form onSubmit={handleSubmit}>
                <div className="flex items-center gap-2 rounded-[10px] border border-border bg-card px-3 py-2 transition-colors focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/30 dark:border-white/10 dark:bg-slate-950/70 dark:focus-within:border-violet-300/70 dark:focus-within:ring-violet-500/30">
                  <input
                    type="text"
                    value={input}
                    onChange={(event) => setInput(event.target.value)}
                    placeholder={t.chat.placeholder}
                    aria-label={t.chat.inputLabel}
                    className="h-10 min-w-0 flex-1 bg-transparent px-2 text-sm text-foreground outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-60 dark:text-white"
                    disabled={isSending}
                  />
                  <Button
                    type="submit"
                    variant="cta"
                    size="pill-sm"
                    className="shrink-0"
                    disabled={isSending || input.trim().length === 0}
                  >
                    {isSending ? t.chat.sending : t.chat.send}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </section>

      <AlertDialog
        open={Boolean(pendingDeleteConversation)}
        onOpenChange={(open) => {
          if (!open) {
            setPendingDeleteConversation(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.chat.deleteDialog.title}</AlertDialogTitle>
            <AlertDialogDescription>
              {t.chat.deleteDialog.description}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={Boolean(deletingConversationId)}>
              {t.chat.deleteDialog.cancel}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConversation}
              className="bg-red-600 hover:bg-red-500"
              disabled={Boolean(deletingConversationId)}
            >
              {t.chat.deleteDialog.confirm}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
