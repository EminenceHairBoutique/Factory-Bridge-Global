import { describe, expect, it } from "vitest";
import { SUPPLIER_THREADS, type SmThread } from "./demo-data/supplier-messages";
import {
  canReply,
  relayLog,
  smSummary,
  smThreadStatus,
  sortSmThreads,
  validateReplyZh,
} from "./supplier-messages-demo";

const byId = (id: string): SmThread => SUPPLIER_THREADS.find((t) => t.id === id)!;

describe("smThreadStatus", () => {
  it("follows the latest buyer or supplier message", () => {
    expect(smThreadStatus(byId("sm_rfq_2"))).toBe("待回复");
    expect(smThreadStatus(byId("sm_rfq_1_moq"))).toBe("已转达");
    expect(smThreadStatus(byId("sm_sample"))).toBe("已完成");
    expect(smThreadStatus(byId("sm_notice_rfq_1"))).toBe("通知");
    expect(smThreadStatus(byId("sm_rfq_3_quote"))).toBe("通知");
  });
  it("moves a reply from 待转达 to 已转达", () => {
    const base = byId("sm_rfq_2");
    const reply = {
      id: "r",
      direction: "我方" as const,
      at: "2026-11-07 10:05",
      zh: "指 EXW 东莞。",
      en: null,
      translationNote: null,
      relayedAt: null,
      attachments: [],
      notice: null,
    };
    const pending = { ...base, messages: [...base.messages, reply] };
    expect(smThreadStatus(pending)).toBe("待转达");
    expect(canReply(pending)).toBe(false);
    const relayed = {
      ...base,
      messages: [...base.messages, { ...reply, relayedAt: "2026-11-07 10:30" }],
    };
    expect(smThreadStatus(relayed)).toBe("已转达");
    expect(canReply(relayed)).toBe(true);
    expect(relayLog(relayed)).toEqual([
      {
        messageId: "r",
        sentAt: "2026-11-07 10:05",
        relayedAt: "2026-11-07 10:30",
        channel: "平台消息",
        checkedBy: "平台运营",
      },
    ]);
  });
});

describe("ordering and counts", () => {
  it("puts 待回复 first and notices after active threads", () => {
    const ids = sortSmThreads(SUPPLIER_THREADS).map((t) => t.id);
    expect(ids[0]).toBe("sm_rfq_2");
    expect(ids[1]).toBe("sm_rfq_1_moq");
    expect(ids[ids.length - 1]).toBe("sm_sample");
  });
  it("counts pending replies, pending relays and unread threads", () => {
    expect(smSummary(SUPPLIER_THREADS)).toEqual({ pendingReply: 1, pendingRelay: 0, unread: 2 });
  });
});

describe("canReply", () => {
  it("blocks closed threads and notices", () => {
    expect(canReply(byId("sm_rfq_2"))).toBe(true);
    expect(canReply(byId("sm_rfq_1_moq"))).toBe(true);
    expect(canReply(byId("sm_sample"))).toBe(false);
    expect(canReply(byId("sm_notice_rfq_1"))).toBe(false);
  });
});

describe("validateReplyZh", () => {
  it("requires text and warns on contact details and prices", () => {
    expect(validateReplyZh("  ").ok).toBe(false);
    const contact = validateReplyZh("可加微信 13800000000 详谈。");
    expect(contact.ok).toBe(true);
    expect(contact.warnings).toHaveLength(1);
    expect(contact.warnings[0]).toContain("联系方式");
    const price = validateReplyZh("刀模费 300 元一次性收取。");
    expect(price.warnings).toHaveLength(1);
    expect(price.warnings[0]).toContain("提交报价");
    expect(validateReplyZh("“出厂价”指 EXW 东莞，刀模费不含在单价内。")).toEqual({
      ok: true,
      errors: [],
      warnings: [],
    });
    expect(validateReplyZh("起订量 5,000 件确认。").warnings).toHaveLength(0);
  });
});
