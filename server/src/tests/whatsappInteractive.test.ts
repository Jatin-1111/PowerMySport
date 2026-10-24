// What a parent can tap on WhatsApp, what each tap means, how a reply becomes a link button, and
// how each message is shaped for Meta (and falls back to text when Meta refuses it).
process.env.WHATSAPP_ACCESS_TOKEN = "test-token";
process.env.WHATSAPP_PHONE_NUMBER_ID = "123";

import assert from "node:assert/strict";
import test from "node:test";
import {
  FEEDBACK_BUTTONS,
  NEXT_STEP_ROWS,
  WELCOME_ROWS,
  intentForReply,
  splitLinkButton,
  wantsMenu,
} from "../shared/services/whatsappInteractive";
import {
  extractInboundMessages,
  sendWhatsAppButtons,
  sendWhatsAppLinkButton,
  sendWhatsAppList,
} from "../shared/services/whatsappService";
import { deliver } from "../shared/routes/whatsappWebhook";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Sent = Record<string, any>;

/** Replaces fetch for one test and records what would have gone to Meta. */
async function withFetch(
  respond: (body: Sent) => boolean,
  run: (sent: Sent[]) => Promise<void>
): Promise<void> {
  const original = globalThis.fetch;
  const sent: Sent[] = [];
  globalThis.fetch = (async (_url: unknown, init: { body: string }) => {
    const body = JSON.parse(init.body) as Sent;
    sent.push(body);
    return respond(body)
      ? ({ ok: true, text: async () => "" } as Response)
      : ({ ok: false, status: 400, text: async () => "bad" } as Response);
  }) as typeof fetch;
  try {
    await run(sent);
  } finally {
    globalThis.fetch = original;
  }
}

test("every row and button fits the WhatsApp limits and has a unique id", () => {
  assert.ok(WELCOME_ROWS.length <= 10 && NEXT_STEP_ROWS.length <= 10);
  assert.ok(FEEDBACK_BUTTONS.length <= 3);
  for (const row of [...WELCOME_ROWS, ...NEXT_STEP_ROWS]) {
    assert.ok(row.title.length <= 24, `row title too long: ${row.title}`);
    assert.ok((row.description ?? "").length <= 72);
  }
  for (const button of FEEDBACK_BUTTONS) assert.ok(button.title.length <= 20);
  const ids = [...WELCOME_ROWS, ...NEXT_STEP_ROWS, ...FEEDBACK_BUTTONS].map((r) => r.id);
  assert.equal(new Set(ids).size, ids.length);
});

test("every row and button id means something, and an unknown id means nothing", () => {
  for (const row of [...WELCOME_ROWS, ...NEXT_STEP_ROWS, ...FEEDBACK_BUTTONS]) {
    assert.ok(intentForReply(row.id), `${row.id} is wired to an intent`);
  }
  assert.equal(intentForReply("something_stale"), null);
  assert.equal(intentForReply(null), null);
  assert.deepEqual(intentForReply("next_done"), { kind: "done" });
  assert.deepEqual(intentForReply("fb_not_helpful"), { kind: "feedback", value: "not_helpful" });
  const ask = intentForReply("next_coach");
  assert.equal(ask?.kind, "ask");
  assert.match((ask as { text: string }).text, /coach or academy/);
});

test("a greeting or a request for the menu shows the menu; a question does not", () => {
  for (const yes of ["hi", "Hello!", "hey", "namaste", "Menu", "help", "good morning", " HI "]) {
    assert.equal(wantsMenu(yes), true, yes);
  }
  for (const no of [
    "hi, which sport suits my son?",
    "hello can you help me book an expert",
    "tennis",
    "my daughter is 9",
    "",
  ]) {
    assert.equal(wantsMenu(no), false, no);
  }
});

test("a reply with one PowerMySport link becomes a body and a labelled button", () => {
  const link = splitLinkButton(
    "You can see his open times and book here:\nhttps://powermysport.com/experts/6a649c2da23135da4b5a7a03"
  );
  assert.ok(link);
  assert.equal(link.url, "https://powermysport.com/experts/6a649c2da23135da4b5a7a03");
  assert.equal(link.label, "View expert profile");
  assert.equal(link.body, "You can see his open times and book here:");
  assert.ok(!link.body.includes("http"));
});

test("a reply is left as plain text when a button cannot carry it", () => {
  assert.equal(splitLinkButton("No link here."), null);
  assert.equal(
    splitLinkButton(
      "Two pages: https://powermysport.com/guidance and https://powermysport.com/planner"
    ),
    null,
    "a button carries one link"
  );
  assert.equal(splitLinkButton("See https://example.com/other"), null, "only our own pages");
  assert.equal(splitLinkButton(`${"x".repeat(1100)} https://powermysport.com/guidance`), null);
  assert.equal(splitLinkButton("https://powermysport.com/guidance"), null, "nothing to say");
});

test("the same link written twice is still one link", () => {
  const link = splitLinkButton(
    "Try the tool https://powermysport.com/guidance. Again: https://powermysport.com/guidance"
  );
  assert.ok(link);
  assert.equal(link.url, "https://powermysport.com/guidance");
});

test("a tapped list row or button is read with its id", () => {
  const payload = (interactive: unknown) => ({
    entry: [
      {
        changes: [
          {
            value: {
              messages: [{ id: "w1", from: "919876543210", type: "interactive", interactive }],
            },
          },
        ],
      },
    ],
  });
  const row = extractInboundMessages(
    payload({
      type: "list_reply",
      list_reply: { id: "menu_sport", title: "Choosing the right sport" },
    })
  )[0]!;
  assert.equal(row.replyId, "menu_sport");
  assert.equal(row.text, "Choosing the right sport");
  const button = extractInboundMessages(
    payload({ type: "button_reply", button_reply: { id: "fb_helpful", title: "Yes, helpful" } })
  )[0]!;
  assert.equal(button.replyId, "fb_helpful");
});

test("the senders build what Meta expects, and trim titles to its limits", async () => {
  await withFetch(
    () => true,
    async (sent) => {
      await sendWhatsAppList("919876543210", "Pick", "A button label that is far too long", [
        { id: "a", title: "A title that is much longer than twenty four", description: "d" },
      ]);
      await sendWhatsAppButtons("919876543210", "Was it useful?", [
        { id: "y", title: "A button title over twenty" },
      ]);
      await sendWhatsAppLinkButton(
        "919876543210",
        "Book here",
        "A very long link label here",
        "https://powermysport.com/experts"
      );

      const [list, buttons, cta] = sent as any[];
      assert.equal(list.interactive.type, "list");
      assert.ok(list.interactive.action.button.length <= 20);
      assert.ok(list.interactive.action.sections[0].rows[0].title.length <= 24);
      assert.equal(buttons.interactive.type, "button");
      assert.ok(buttons.interactive.action.buttons[0].reply.title.length <= 20);
      assert.equal(cta.interactive.type, "cta_url");
      assert.equal(cta.interactive.action.parameters.url, "https://powermysport.com/experts");
      assert.ok(cta.interactive.action.parameters.display_text.length <= 20);
    }
  );
});

test("when WhatsApp refuses an interactive message the parent still gets the words", async () => {
  await withFetch(
    (body) => body.type === "text",
    async (sent) => {
      assert.equal(
        await sendWhatsAppList("9198", "Pick one", "Choose", [{ id: "a", title: "Alpha" }]),
        true
      );
      assert.equal(sent.length, 2);
      assert.equal(sent[1]!.type, "text");
      assert.match(sent[1]!.text.body, /Pick one[\s\S]*Alpha/);

      sent.length = 0;
      await sendWhatsAppLinkButton("9198", "Book here", "Open", "https://powermysport.com/experts");
      assert.match(sent[1]!.text.body, /Book here\nhttps:\/\/powermysport\.com\/experts/);
    }
  );
});

test("deliver sends each kind of answer the way it was meant", async () => {
  await withFetch(
    () => true,
    async (sent) => {
      await deliver("9198", { reply: "Welcome", firstContact: false, menu: true });
      await deliver("9198", { reply: "Useful?", firstContact: false, feedbackPrompt: true });
      await deliver("9198", { reply: "Plain answer.", firstContact: false });
      await deliver("9198", {
        reply: "Book here:\nhttps://powermysport.com/experts/abc",
        firstContact: false,
      });
      await deliver("9198", { reply: "Guidance.", firstContact: false, nextSteps: true });

      const kinds = sent.map((s) => s.interactive?.type ?? s.type);
      assert.deepEqual(kinds, ["list", "button", "text", "cta_url", "text", "list"]);
      const nextSteps = sent[5]!.interactive.action.sections[0].rows.map((r: any) => r.id);
      assert.deepEqual(
        nextSteps,
        NEXT_STEP_ROWS.map((r) => r.id)
      );
    }
  );
});
