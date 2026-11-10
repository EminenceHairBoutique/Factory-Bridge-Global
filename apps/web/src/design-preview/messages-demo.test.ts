import { describe, expect, it } from "vitest";
import { DEMO_THREADS, type Thread, type ThreadMessage } from "./demo-data/messages";
import {
  allowedChannels,
  approvalChain,
  canApprove,
  canCompose,
  inboxSummary,
  outboundLog,
  outboundState,
  sortThreads,
  threadStatus,
  validateDraft,
} from "./messages-demo";

const byId = (id: string): Thread => DEMO_THREADS.find((t) => t.id === id)!;
const tooling = byId("th_tooling");
const draft = tooling.messages[1]!;

describe("outboundState and threadStatus", () => {
  it("derives the thread status from the latest non-system message", () => {
    expect(threadStatus(tooling)).toBe("awaiting_your_approval");
    expect(threadStatus(byId("th_reply_a"))).toBe("replied");
    expect(threadStatus(byId("th_cartons_f"))).toBe("awaiting_reply");
    expect(threadStatus(byId("th_hair_k"))).toBe("replied");
    expect(threadStatus(byId("th_expired_d"))).toBe("info");
    expect(threadStatus(byId("th_sample"))).toBe("replied");
  });
  it("moves a draft through buyer approval, operator return and sending", () => {
    const approved: ThreadMessage = {
      ...draft,
      approval: { ...draft.approval!, buyer: { state: "done", by: "You", at: "x", note: null } },
    };
    expect(outboundState(approved)).toBe("awaiting_operator");
    const returned: ThreadMessage = {
      ...approved,
      approval: {
        ...approved.approval!,
        operator: { state: "returned", by: "Operator (demo)", at: "y", note: "Too vague" },
      },
    };
    expect(outboundState(returned)).toBe("returned_to_you");
    expect(approvalChain(returned.approval!, "platform").map((s) => s.state)).toEqual([
      "waiting",
      "returned",
      "pending",
    ]);
    const sent: ThreadMessage = {
      ...approved,
      approval: {
        ...approved.approval!,
        operator: { state: "done", by: "Operator (demo)", at: "y", note: null },
        sent: { at: "z", channel: "platform", externalRef: "ref-1" },
      },
    };
    expect(outboundState(sent)).toBe("sent");
    expect(approvalChain(sent.approval!, "platform").map((s) => s.state)).toEqual([
      "done",
      "done",
      "done",
    ]);
  });
});

describe("approvalChain", () => {
  it("has exactly one waiting step while a draft is open", () => {
    const steps = approvalChain(draft.approval!, "platform");
    expect(steps.map((s) => [s.who, s.state])).toEqual([
      ["You", "waiting"],
      ["Operator", "pending"],
      ["Sent via platform", "pending"],
    ]);
  });
});

describe("sortThreads and inboxSummary", () => {
  it("puts threads that need the buyer first, then newest activity", () => {
    const sorted = sortThreads(DEMO_THREADS).map((t) => t.id);
    expect(sorted[0]).toBe("th_tooling");
    expect(sorted[1]).toBe("th_reply_a");
    expect(sorted[sorted.length - 1]).toBe("th_sample");
  });
  it("counts the inbox by status", () => {
    expect(inboxSummary(DEMO_THREADS)).toEqual({
      needsYou: 1,
      awaitingOperator: 0,
      awaitingReply: 1,
      replied: 3,
    });
  });
});

describe("canApprove and canCompose", () => {
  it("requires both languages and both approvals open", () => {
    expect(canApprove(draft)).toBe(true);
    expect(canApprove({ ...draft, zh: null })).toBe(false);
    expect(canApprove(byId("th_reply_a").messages[0]!)).toBe(false);
  });
  it("blocks composing while a draft is open, on sample threads and without a supplier", () => {
    expect(canCompose(tooling)).toBe(false);
    expect(canCompose(byId("th_sample"))).toBe(false);
    expect(canCompose({ ...byId("th_expired_d"), supplier: null })).toBe(false);
    expect(canCompose(byId("th_expired_d"))).toBe(true);
    expect(canCompose(byId("th_reply_a"))).toBe(true);
  });
});

describe("validateDraft and allowedChannels", () => {
  it("rejects empty drafts and warns on contact details", () => {
    expect(validateDraft("   ").ok).toBe(false);
    const warned = validateDraft("Please call me on +86 138 0000 0000 about the tooling.");
    expect(warned.ok).toBe(true);
    expect(warned.warnings).toHaveLength(1);
    expect(validateDraft("Is tooling included in the unit price?")).toEqual({
      ok: true,
      errors: [],
      warnings: [],
    });
  });
  it("offers WeChat relay only where a contact basis is recorded", () => {
    expect(allowedChannels(byId("th_reply_a").supplier)).toEqual(["platform", "wechat_relay"]);
    expect(allowedChannels(byId("th_expired_d").supplier)).toEqual(["platform"]);
    expect(allowedChannels(null)).toEqual([]);
  });
});

describe("outboundLog", () => {
  it("lists channel, approvers, time and reference for every sent message only", () => {
    expect(outboundLog(tooling)).toHaveLength(0);
    const rows = outboundLog(byId("th_sample"));
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      channel: "platform",
      buyerApprovedBy: "You",
      operatorApprovedBy: "Operator (demo)",
      externalRef: "portal-msg-demo-2201",
    });
  });
});
