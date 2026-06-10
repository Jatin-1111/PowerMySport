"use client";

import { ChevronLeft, MessageSquare, PanelRightClose, PanelRightOpen, RotateCcw } from "lucide-react";
import { motion } from "framer-motion";
import { MessageBubble } from "@/modules/community/components/chat/MessageBubble";
import type { CommunityPageViewModel } from "@/modules/community/hooks/useCommunityPage";

type Props = { page: CommunityPageViewModel };

export default function CommunityChatPanel({ page }: Props) {
  const {
    workspaceView,
    selectedConversationPhotoUrl,
    selectedConversationDisplayName,
    selectedConversationAvatarChar,
    selectedConversation,
    setIsConversationSidebarOpen,
    setSidebarMode,
    setWorkspaceView,
    showGroupMembersPanel,
    setShowGroupMembersPanel,
    selectedConversationIsPending,
    selectedConversationNeedsMyApproval,
    handleAcceptRequest,
    handleRejectRequest,
    messages,
    profile,
    setMobileActionMessageId,
    retryFailedMessage,
    handleBeginEditMessage,
    handleDeleteMessage,
    handleCopyMessage,
    copiedMessageId,
    editingMessageId,
    isMutatingMessageId,
    messagesEndRef,
    editingMessageDraft,
    setEditingMessageDraft,
    handleSaveEditedMessage,
    handleCancelEditMessage,
    newMessage,
    setNewMessage,
    canSendSelectedConversationMessage,
    isSending,
    handleSendMessage,
  } = page;

  return (
                <motion.section
                  className={`h-full min-h-0 min-w-0 flex-col overflow-hidden bg-[#efeae2] bg-[radial-gradient(rgba(255,255,255,0.34)_1px,transparent_1px),radial-gradient(rgba(0,0,0,0.03)_1px,transparent_1px)] bg-position-[0_0,11px_11px] bg-size-[22px_22px] ${workspaceView === "CHAT" ? "flex" : "hidden lg:flex"}`}
                >
                  <div className="sticky top-0 z-20 border-b border-slate-200 bg-white px-3 py-2 sm:px-4 sm:py-2.5 lg:min-h-15 lg:px-4 lg:py-2">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="inline-flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-linear-to-br from-slate-200 to-slate-300 text-sm font-bold uppercase text-slate-700">
                          {selectedConversationPhotoUrl ? (
                            <img
                              src={selectedConversationPhotoUrl}
                              alt={selectedConversationDisplayName}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            selectedConversationAvatarChar
                          )}
                        </div>
                        <div className="min-w-0">
                          <h2 className="truncate text-[15px] font-500 text-slate-900">
                            {selectedConversationDisplayName}
                          </h2>
                          <p className="mt-0.5 text-xs text-slate-500">
                            {selectedConversation?.conversationType === "GROUP"
                              ? "Group"
                              : "Direct message"}
                          </p>
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center justify-end gap-1.5 sm:gap-2">
                        <button
                          onClick={() => {
                            setIsConversationSidebarOpen(true);
                            setSidebarMode("TOOLS");
                            setWorkspaceView("DIRECTORY");
                          }}
                          className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 lg:hidden"
                        >
                          <ChevronLeft size={13} /> Back
                        </button>
                        {selectedConversation?.conversationType === "GROUP" && (
                          <button
                            onClick={() =>
                              setShowGroupMembersPanel(!showGroupMembersPanel)
                            }
                            className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700"
                          >
                            {showGroupMembersPanel ? (
                              <PanelRightClose size={13} />
                            ) : (
                              <PanelRightOpen size={13} />
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                    {selectedConversationIsPending && (
                      <div className="mt-3 rounded-lg border border-power-orange/30 bg-power-orange/8 p-2.5 text-sm text-slate-700">
                        {selectedConversationNeedsMyApproval ? (
                          <>
                            <p className="font-500">Message request pending</p>
                            <div className="mt-2 flex gap-2">
                              <button
                                onClick={handleAcceptRequest}
                                className="rounded-md bg-power-orange px-3 py-1 text-xs font-semibold text-white"
                              >
                                Accept
                              </button>
                              <button
                                onClick={handleRejectRequest}
                                className="rounded-md border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-700"
                              >
                                Reject
                              </button>
                            </div>
                          </>
                        ) : (
                          <p className="text-xs">
                            Request sent. Message while waiting.
                          </p>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-3 pb-3 pt-3 sm:px-4 sm:pb-4 sm:pt-4">
                    {messages.map((message) => (
                      <MessageBubble
                        key={message.id}
                        message={message}
                        isOwnMessage={message.senderId === profile?.userId}
                        isGroupConversation={
                          selectedConversation?.conversationType === "GROUP"
                        }
                        profileUserId={profile?.userId}
                        onOpenMobileActions={(m) =>
                          setMobileActionMessageId(m.id)
                        }
                        onRetry={retryFailedMessage}
                        onEdit={handleBeginEditMessage}
                        onDelete={handleDeleteMessage}
                        onCopy={handleCopyMessage}
                        isCopied={copiedMessageId === message.id}
                        isEditing={editingMessageId === message.id}
                        isMutating={isMutatingMessageId === message.id}
                      />
                    ))}
                    <div ref={messagesEndRef} />
                  </div>

                  {editingMessageId && (
                    <div className="mt-2 shrink-0 border border-power-orange/30 bg-power-orange/8 p-3">
                      <p className="text-xs font-semibold text-power-orange">
                        Editing message
                      </p>
                      <textarea
                        value={editingMessageDraft}
                        onChange={(e) => setEditingMessageDraft(e.target.value)}
                        rows={2}
                        className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-power-orange focus:outline-none"
                      />
                      <div className="mt-2 flex gap-2">
                        <button
                          onClick={handleSaveEditedMessage}
                          disabled={isMutatingMessageId === editingMessageId}
                          className="rounded-md bg-power-orange px-3 py-1.5 text-xs text-white"
                        >
                          Save
                        </button>
                        <button
                          onClick={handleCancelEditMessage}
                          className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-700"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="sticky bottom-0 z-20 shrink-0 border-t border-slate-200/80 bg-[#f0f2f5] px-3 pt-2 pb-[calc(0.75rem+env(safe-area-inset-bottom))] lg:static">
                    <div className="flex min-w-0 items-end gap-2.5">
                      <textarea
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            if (canSendSelectedConversationMessage)
                              handleSendMessage();
                          }
                        }}
                        placeholder={
                          !selectedConversation
                            ? "Select a conversation"
                            : "Type a message..."
                        }
                        disabled={
                          !canSendSelectedConversationMessage || isSending
                        }
                        rows={1}
                        className="max-h-28 flex-1 resize-none rounded-3xl border border-slate-200 bg-white px-4 py-2.5 text-sm focus:border-power-orange focus:outline-none disabled:cursor-not-allowed"
                      />
                      <button
                        disabled={
                          isSending ||
                          !canSendSelectedConversationMessage ||
                          !newMessage.trim()
                        }
                        onClick={handleSendMessage}
                        className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-power-orange text-white disabled:opacity-50"
                      >
                        {isSending ? (
                          <RotateCcw size={16} className="animate-spin" />
                        ) : (
                          <MessageSquare size={16} />
                        )}
                      </button>
                    </div>
                  </div>
                </motion.section>
  );
}
