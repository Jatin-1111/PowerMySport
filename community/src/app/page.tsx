"use client";

import { getCommunitySocket } from "@/lib/realtime/socket";
import { redirectToMainLogin } from "@/lib/auth/redirect";
import { toast } from "@/lib/toast";
import { CommunityPageHeader } from "@/modules/community/components/CommunityPageHeader";
import { communityService } from "@/modules/community/services/community";
import {
  CommunityProfile,
  ConversationItem,
  ConversationMessage,
  MessagePrivacy,
  PlayerSearchResult,
} from "@/modules/community/types";
import { MessageSquare, Shield, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

const privacyOptions: Array<{ value: MessagePrivacy; label: string }> = [
  { value: "EVERYONE", label: "Everyone" },
  { value: "REQUEST_ONLY", label: "Request only" },
  { value: "NONE", label: "Nobody" },
];

const shellNavItems = [
  { id: "community-overview", label: "Community", icon: Users },
  { id: "conversations", label: "Conversations", icon: MessageSquare },
  { id: "privacy-settings", label: "Privacy", icon: Shield },
] as const;

export default function CommunityPage() {
  const [profile, setProfile] = useState<CommunityProfile | null>(null);
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [selectedConversationId, setSelectedConversationId] = useState<
    string | null
  >(null);
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [playerSearchQuery, setPlayerSearchQuery] = useState("");
  const [playerSearchResults, setPlayerSearchResults] = useState<
    PlayerSearchResult[]
  >([]);
  const [isSearchingPlayers, setIsSearchingPlayers] = useState(false);
  const [newMessage, setNewMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedConversation = useMemo(
    () =>
      conversations.find(
        (conversation) => conversation.id === selectedConversationId,
      ) || null,
    [conversations, selectedConversationId],
  );

  const appendMessage = (incoming: ConversationMessage) => {
    setMessages((current) => {
      const exists = current.some((message) => message.id === incoming.id);
      if (exists) {
        return current;
      }
      return [...current, incoming];
    });
  };

  const removeMessageById = (messageId: string) => {
    setMessages((current) =>
      current.filter((message) => message.id !== messageId),
    );
  };

  const totalUnread = useMemo(
    () => conversations.reduce((sum, item) => sum + (item.unreadCount || 0), 0),
    [conversations],
  );

  const scrollToSection = (sectionId: string) => {
    const section = document.getElementById(sectionId);
    if (section) {
      section.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  const loadBootstrap = async () => {
    setError(null);
    setIsLoading(true);
    try {
      const session = await communityService.ensureSession();
      if (session.role !== "PLAYER") {
        toast.error("Community chat is available only for player accounts");
        redirectToMainLogin();
        return;
      }

      const [profileData, conversationData] = await Promise.all([
        communityService.getProfile(),
        communityService.listConversations(),
      ]);
      setProfile(profileData);
      setConversations(conversationData);
      if (!selectedConversationId && conversationData.length) {
        setSelectedConversationId(conversationData[0].id);
      }
    } catch (e) {
      const message =
        e instanceof Error ? e.message : "Failed to load community";
      setError(message);
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  const loadMessages = async (conversationId: string) => {
    try {
      const response = await communityService.getMessages(conversationId);
      setMessages(response.messages);
      const refreshedConversations = await communityService.listConversations();
      setConversations(refreshedConversations);
    } catch (e) {
      const message =
        e instanceof Error ? e.message : "Failed to load messages";
      setError(message);
      toast.error(message);
    }
  };

  useEffect(() => {
    loadBootstrap();
  }, []);

  useEffect(() => {
    if (!selectedConversationId) {
      setMessages([]);
      return;
    }

    loadMessages(selectedConversationId);
  }, [selectedConversationId]);

  useEffect(() => {
    const query = playerSearchQuery.trim();

    if (query.length < 2) {
      setPlayerSearchResults([]);
      setIsSearchingPlayers(false);
      return;
    }

    const timeout = setTimeout(async () => {
      try {
        setIsSearchingPlayers(true);
        const players = await communityService.searchPlayers(query);
        setPlayerSearchResults(players);
      } catch (e) {
        const message =
          e instanceof Error ? e.message : "Failed to search players";
        setError(message);
        toast.error(message);
      } finally {
        setIsSearchingPlayers(false);
      }
    }, 300);

    return () => clearTimeout(timeout);
  }, [playerSearchQuery]);

  useEffect(() => {
    const socket = getCommunitySocket();

    socket.on("community:newMessage", (message: ConversationMessage) => {
      if (message.conversationId === selectedConversationId) {
        appendMessage(message);
      }
    });

    socket.on("community:conversationUpdated", async () => {
      const updated = await communityService.listConversations();
      setConversations(updated);
    });

    socket.on("community:error", (payload: { message: string }) => {
      setError(payload.message);
    });

    socket.on("connect_error", (error: Error) => {
      if (/unauthorized|authentication/i.test(error.message)) {
        redirectToMainLogin();
      }
    });

    return () => {
      socket.off("community:newMessage");
      socket.off("community:conversationUpdated");
      socket.off("community:error");
      socket.off("connect_error");
    };
  }, [selectedConversationId]);

  useEffect(() => {
    if (!selectedConversationId) {
      return;
    }

    const socket = getCommunitySocket();
    socket.emit("community:joinConversation", {
      conversationId: selectedConversationId,
    });
  }, [selectedConversationId]);

  const handleProfileUpdate = async (payload: {
    isIdentityPublic?: boolean;
    messagePrivacy?: MessagePrivacy;
    readReceiptsEnabled?: boolean;
    lastSeenVisible?: boolean;
    anonymousAlias?: string;
  }) => {
    if (!profile) {
      return;
    }

    const optimistic = { ...profile, ...payload };
    setProfile(optimistic);
    try {
      const updated = await communityService.updateProfile(payload);
      setProfile(updated);
      toast.success("Privacy settings updated");
    } catch (e) {
      const message =
        e instanceof Error ? e.message : "Failed to update settings";
      setError(message);
      toast.error(message);
      setProfile(profile);
    }
  };

  const handleStartConversation = async (targetUserId: string) => {
    if (!targetUserId.trim()) {
      return;
    }

    setError(null);
    try {
      const conversation = await communityService.startConversation(
        targetUserId.trim(),
      );
      setPlayerSearchQuery("");
      setPlayerSearchResults([]);
      const updated = await communityService.listConversations();
      setConversations(updated);
      setSelectedConversationId(conversation.id);
      toast.success(
        conversation.status === "PENDING"
          ? "Message request sent"
          : "Conversation started",
      );
    } catch (e) {
      const message =
        e instanceof Error ? e.message : "Failed to start conversation";
      setError(message);
      toast.error(message);
    }
  };

  const handleAcceptRequest = async () => {
    if (!selectedConversation) {
      return;
    }

    try {
      await communityService.acceptRequest(selectedConversation.id);
      const updated = await communityService.listConversations();
      setConversations(updated);
      await loadMessages(selectedConversation.id);
      toast.success("Message request accepted");
    } catch (e) {
      const message =
        e instanceof Error ? e.message : "Failed to accept request";
      setError(message);
      toast.error(message);
    }
  };

  const handleRejectRequest = async () => {
    if (!selectedConversation) {
      return;
    }

    try {
      await communityService.rejectRequest(selectedConversation.id);
      const updated = await communityService.listConversations();
      setConversations(updated);
      setSelectedConversationId(updated.length ? updated[0].id : null);
      toast.success("Message request rejected");
    } catch (e) {
      const message =
        e instanceof Error ? e.message : "Failed to reject request";
      setError(message);
      toast.error(message);
    }
  };

  const handleSendMessage = async () => {
    if (!selectedConversation || !newMessage.trim()) {
      return;
    }

    const content = newMessage.trim();
    const optimisticMessageId = `temp-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const optimisticMessage: ConversationMessage = {
      id: optimisticMessageId,
      conversationId: selectedConversation.id,
      senderId: profile?.userId || "me",
      senderDisplayName: "You",
      content,
      createdAt: new Date().toISOString(),
    };

    appendMessage(optimisticMessage);
    setNewMessage("");

    setIsSending(true);
    setError(null);
    try {
      const socket = getCommunitySocket();
      const payload = {
        conversationId: selectedConversation.id,
        content,
      };

      const ack = await new Promise<
        | { success: true; data: ConversationMessage }
        | { success: false; message?: string }
      >((resolve) => {
        socket.emit("community:sendMessage", payload, resolve);
        setTimeout(
          () => resolve({ success: false, message: "Message send timed out" }),
          8000,
        );
      });

      if (!ack.success) {
        throw new Error(ack.message || "Failed to send message");
      }

      removeMessageById(optimisticMessageId);

      if (ack.data.conversationId === selectedConversation.id) {
        appendMessage(ack.data);
      }
    } catch (e) {
      removeMessageById(optimisticMessageId);
      const message = e instanceof Error ? e.message : "Failed to send message";
      setError(message);
      toast.error(message);
    } finally {
      setIsSending(false);
    }
  };

  if (isLoading) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="rounded-2xl border border-border bg-card p-8 text-card-foreground shadow-sm">
          Loading community...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="flex min-h-screen">
        <aside className="sticky top-0 h-screen w-72 border-r border-slate-200 bg-white shadow-sm">
          <div className="p-6">
            <div className="rounded-2xl bg-linear-to-br from-slate-900 to-slate-800 p-5 text-white">
              <p className="text-xs uppercase tracking-wide text-slate-300">
                Community Hub
              </p>
              <h1 className="mt-2 text-2xl font-bold text-white">
                PowerMySport
              </h1>
              <p className="mt-1 text-sm text-slate-200">
                {profile?.anonymousAlias}
              </p>
            </div>
          </div>

          <nav className="mt-2 space-y-1 px-4">
            {shellNavItems.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={() => scrollToSection(item.id)}
                  className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-slate-700 transition-colors hover:bg-slate-100"
                >
                  <Icon size={18} />
                  <span className="text-sm font-semibold">{item.label}</span>
                </button>
              );
            })}
          </nav>
        </aside>

        <main className="flex-1 overflow-auto">
          <div className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 backdrop-blur">
            <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4 sm:px-8">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">
                  Community Dashboard
                </h2>
                <p className="text-sm text-slate-500">
                  Left sidebar navigation with realtime anonymous chat.
                </p>
              </div>
              <div className="rounded-lg bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
                {conversations.length} conversation
                {conversations.length === 1 ? "" : "s"}
              </div>
              <div className="rounded-lg bg-power-orange/10 px-3 py-1 text-xs font-medium text-power-orange">
                {totalUnread} unread
              </div>
            </div>
          </div>

          <div className="mx-auto w-full max-w-6xl px-6 py-8 sm:px-8">
            <section id="community-overview" className="mb-6 scroll-mt-28">
              <CommunityPageHeader
                title="PowerMySport Community"
                subtitle="Anonymous-first player chat with your privacy controls."
                badge="Player Network"
              />
            </section>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-12">
              <section
                id="privacy-settings"
                className="scroll-mt-28 rounded-xl border border-border bg-card p-4 text-card-foreground md:col-span-3"
              >
                <h2 className="text-base font-semibold">Privacy Settings</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Control your identity visibility and message preferences.
                </p>

                <div className="mt-4 space-y-3">
                  <label className="block text-sm">
                    <span className="mb-1 block text-muted-foreground">
                      Anonymous alias
                    </span>
                    <input
                      value={profile?.anonymousAlias || ""}
                      onChange={(event) =>
                        handleProfileUpdate({
                          anonymousAlias: event.target.value,
                        })
                      }
                      className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                    />
                  </label>

                  <label className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">
                      Show my real identity
                    </span>
                    <input
                      type="checkbox"
                      checked={profile?.isIdentityPublic || false}
                      onChange={(event) =>
                        handleProfileUpdate({
                          isIdentityPublic: event.target.checked,
                        })
                      }
                    />
                  </label>

                  <label className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Read receipts</span>
                    <input
                      type="checkbox"
                      checked={profile?.readReceiptsEnabled || false}
                      onChange={(event) =>
                        handleProfileUpdate({
                          readReceiptsEnabled: event.target.checked,
                        })
                      }
                    />
                  </label>

                  <label className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">
                      Show last seen
                    </span>
                    <input
                      type="checkbox"
                      checked={profile?.lastSeenVisible || false}
                      onChange={(event) =>
                        handleProfileUpdate({
                          lastSeenVisible: event.target.checked,
                        })
                      }
                    />
                  </label>

                  <label className="block text-sm">
                    <span className="mb-1 block text-muted-foreground">
                      Who can message me
                    </span>
                    <select
                      className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                      value={profile?.messagePrivacy || "EVERYONE"}
                      onChange={(event) =>
                        handleProfileUpdate({
                          messagePrivacy: event.target.value as MessagePrivacy,
                        })
                      }
                    >
                      {privacyOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              </section>

              <section
                id="conversations"
                className="scroll-mt-28 rounded-xl border border-border bg-card p-4 text-card-foreground md:col-span-3"
              >
                <h2 className="text-base font-semibold">Conversations</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Search players and select an active conversation.
                </p>
                <div className="mt-3 flex gap-2">
                  <input
                    value={playerSearchQuery}
                    onChange={(event) =>
                      setPlayerSearchQuery(event.target.value)
                    }
                    placeholder="Search by name or alias"
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                  />
                </div>

                {playerSearchQuery.trim().length >= 2 && (
                  <div className="mt-2 rounded-md border border-border bg-background p-2">
                    {isSearchingPlayers ? (
                      <p className="text-sm text-muted-foreground">
                        Searching...
                      </p>
                    ) : playerSearchResults.length ? (
                      <div className="space-y-1">
                        {playerSearchResults.map((player) => (
                          <button
                            key={player.id}
                            onClick={() => handleStartConversation(player.id)}
                            className="flex w-full items-center justify-between rounded-md px-2 py-2 text-left text-sm transition-colors hover:bg-muted"
                          >
                            <span>{player.displayName}</span>
                            <span className="text-xs text-muted-foreground">
                              {player.isIdentityPublic ? "Public" : "Anonymous"}
                            </span>
                          </button>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        No players found
                      </p>
                    )}
                  </div>
                )}

                <div className="mt-4 space-y-2">
                  {conversations.map((conversation) => (
                    <button
                      key={conversation.id}
                      onClick={() => setSelectedConversationId(conversation.id)}
                      className={`w-full rounded-md border p-3 text-left transition-colors ${
                        conversation.id === selectedConversationId
                          ? "border-power-orange bg-muted"
                          : "border-border bg-background"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-sm font-medium">
                          {conversation.otherParticipant.displayName}
                        </div>
                        {conversation.unreadCount > 0 && (
                          <span className="inline-flex min-w-6 items-center justify-center rounded-full bg-power-orange px-2 py-0.5 text-xs font-semibold text-white">
                            {conversation.unreadCount}
                          </span>
                        )}
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {conversation.status === "PENDING"
                          ? "Message request"
                          : conversation.latestMessage?.content ||
                            "No messages yet"}
                      </div>
                    </button>
                  ))}
                  {!conversations.length && (
                    <div className="rounded-lg border border-dashed border-border bg-muted/20 p-4 text-center text-sm text-muted-foreground">
                      No conversations yet. Search for a player to start.
                    </div>
                  )}
                </div>
              </section>

              <section className="rounded-xl border border-border bg-card p-4 text-card-foreground md:col-span-6">
                <h2 className="text-base font-semibold">Chat</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Messages stay anonymous unless identity is public.
                </p>

                {selectedConversation?.status === "PENDING" && (
                  <div className="mt-3 rounded-md border border-power-orange/40 bg-power-orange/10 p-3 text-sm text-card-foreground">
                    This conversation is pending approval.
                    <div className="mt-2 flex gap-2">
                      <button
                        onClick={handleAcceptRequest}
                        className="rounded-md bg-power-orange px-3 py-1 text-white hover:opacity-90"
                      >
                        Accept
                      </button>
                      <button
                        onClick={handleRejectRequest}
                        className="rounded-md border border-border bg-background px-3 py-1"
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                )}

                <div className="mt-4 h-[55vh] space-y-2 overflow-y-auto rounded-md border border-border bg-background p-3">
                  {messages.map((message) => (
                    <div
                      key={message.id}
                      className="rounded-md border border-border bg-card p-2 text-sm"
                    >
                      <div className="text-xs text-muted-foreground">
                        {message.senderDisplayName}
                      </div>
                      <div>{message.content}</div>
                    </div>
                  ))}
                  {!selectedConversation && (
                    <div className="rounded-lg border border-dashed border-border bg-muted/20 p-4 text-center text-sm text-muted-foreground">
                      Choose a conversation to start chatting.
                    </div>
                  )}
                </div>

                <div className="mt-3 flex gap-2">
                  <input
                    value={newMessage}
                    onChange={(event) => setNewMessage(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        handleSendMessage();
                      }
                    }}
                    placeholder="Type your message"
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                  />
                  <button
                    disabled={isSending}
                    onClick={handleSendMessage}
                    className="rounded-md bg-power-orange px-3 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
                  >
                    Send
                  </button>
                </div>

                {error && (
                  <p className="mt-2 text-sm text-error-red">{error}</p>
                )}
              </section>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
