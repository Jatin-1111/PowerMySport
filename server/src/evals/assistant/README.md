# Assistant evaluation

Answers one question: **did a change to the assistant's prompt, tools or formatting make it
better or worse?** It asks the real assistant a fixed set of parent questions and checks each
answer against rules: which tool it reached for, which pages it linked, what it must never
claim, and that a WhatsApp reply is plain text.

Nothing here is a real parent or a real record. The tools answer from invented data in
`fixtures.ts`, and the run never connects to a database.

## Run it

Build first (`npm run build` in `server/`), or use the scripts, which build for you.

```bash
# No network, no model, about a second. Checks the case file and that the prompt and the tool
# registry agree. Exit code 1 if either is broken.
npm run eval:assistant

# Also asks Gemini every question (29 cases, a few calls each, spaced to stay under the rate
# limit). Writes docs/assistant-eval/model.md and model.json.
npm run eval:assistant:model

# Narrow it, or repeat it to see how stable an answer is.
node dist/evals/assistant/run.js --model --only tool-experts-city
node dist/evals/assistant/run.js --model --category booking-guardrail --runs 3
```

Options: `--only <case-id>`, `--category <name>`, `--runs <n>`, `--delay-ms <n>`,
`--label <name>`, `--out <dir>`.

The no-model checks are also a test (`src/tests/assistantEval.test.ts`), so the suite fails if
the prompt names a tool that is not registered, or a tool is added that the prompt does not
describe.

## How the prompt stays honest

Each tool in `chatToolsService.ts` carries a `summary` and an `example`, and the "Tools
available" part of the system prompt is **built from the registry**. `buildAssistantChatSystemPrompt`
takes the tools as a required argument, so the prompt describes exactly the tools the caller is
about to give the model. Before this, that paragraph was written by hand and named a tool
(`get_pathway_level`) that was never registered.

Keep tool names out of any other hand-written prompt text (the site map, the persona). The
static check fails on any tool-shaped name in the prompt that is not in the registry.

## Adding a capability

1. Add the tool to `chatToolsService.ts` with `name`, `description` (for the model: when to call
   it), `summary` and `example` (for the prompt and for "what can you do"), and, if the model must
   remember something about its results, a `promptNote`.
2. Add it to `ASSISTANT_CHAT_TOOLS`. It is then on the web chat and on WhatsApp.
3. Add a fixture for it in `fixtures.ts`.
4. Add three to five cases to `cases.ts`: one that needs the tool, one that must not call it, and
   any guardrail it touches. A case that names a tool must also require it, and a case must check
   something; `validateCases` rejects the rest.
5. Run `npm run eval:assistant`, then `npm run eval:assistant:model`, and read the replies in the
   report as well as the score.

## What a failure means

| Kind               | Meaning                                                                                                             |
| ------------------ | ------------------------------------------------------------------------------------------------------------------- |
| `missingTool`      | The question needed a lookup and the model answered without one.                                                    |
| `forbiddenTool`    | It looked something up that it had no need to.                                                                      |
| `missingToolArgs`  | It called the right tool with the wrong question (the wrong city or sport).                                         |
| `missingInReply`   | The page the parent needed was not named.                                                                           |
| `forbiddenInReply` | It linked the marketplace that is down, claimed to have booked something, or answered what it should have declined. |
| `tooLong`          | A WhatsApp reply over its limit.                                                                                    |
| `errored`          | The model call failed. It says why, and it is not an assistant regression.                                          |

**Diagnostics.** The report counts how many WhatsApp replies the formatter had to repair. Each is
a place the model ignored the channel rules and `whatsappFormat.ts` caught it, so a rising number
means the prompt's WhatsApp rules need strengthening even though parents see clean text.

## What it does not measure

Whether an answer is warm, accurate in detail or well judged needs a person. The report prints
every reply for exactly that reason. The questions that need a signed-in parent (their child's
ranking, their plan) are covered by the `knownParent` cases: the run builds the same prompt a
recognised parent gets (`identityAddendum`) with an invented account block from
`FIXTURE_PARENT_CONTEXT`, and the tools answer from fixtures. What it cannot check is the
number-to-account match itself or real data; those have their own tests
(`parentContext.integration.test.ts`, `whatsappAssistant.integration.test.ts`).
