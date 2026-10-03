/**
 * Lets any page open the site-wide assistant, optionally with a question
 * already typed for the parent. The assistant lives in the floating bubble
 * (components/layout/AIAssistantBubble), which listens for this event, so a
 * page never has to import or mount the drawer itself.
 */
export const OPEN_ASSISTANT_EVENT = "open-assistant-chat";

export interface OpenAssistantDetail {
  question?: string;
}

export function openAssistantChat(question?: string) {
  const trimmed = question?.trim();
  window.dispatchEvent(
    new CustomEvent<OpenAssistantDetail>(OPEN_ASSISTANT_EVENT, {
      detail: { question: trimmed || undefined },
    })
  );
}
