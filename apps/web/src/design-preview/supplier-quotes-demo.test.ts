import { describe, expect, it } from "vitest";
import { QUOTES_TODAY, QUOTE_GROUPS, QUOTE_VERSIONS } from "./demo-data/supplier-quotes";
import {
  applyCancelSubmission,
  applyNewVersion,
  applyWithdraw,
  canCancelSubmission,
  canUpdate,
  canWithdraw,
  currentVersion,
  diffVersions,
  draftFromVersion,
  newVersionGate,
  quotesSummary,
  sortGroups,
  validityText,
  withdrawReasonError,
  zhStatus,
} from "./supplier-quotes-demo";

const group = (id: string) => QUOTE_GROUPS.find((g) => g.id === id)!;
const version = (id: string) => QUOTE_VERSIONS.find((v) => v.id === id)!;

describe("zhStatus (migration 0009 lifecycle + review task)", () => {
  it("maps review and lifecycle states to the fixed Chinese labels", () => {
    expect(zhStatus(version("qv_sleeve_1"), QUOTES_TODAY)).toBe("待审核");
    expect(zhStatus(version("qv_labels_1"), QUOTES_TODAY)).toBe("已更新");
    expect(zhStatus(version("qv_labels_2"), QUOTES_TODAY)).toBe("已确认");
    expect(zhStatus(version("qv_hair_1"), QUOTES_TODAY)).toBe("即将过期");
    expect(zhStatus(version("qv_cartons_1"), QUOTES_TODAY)).toBe("已过期");
    expect(zhStatus(version("qv_pet_1"), QUOTES_TODAY)).toBe("已撤回");
    expect(zhStatus({ ...version("qv_labels_2"), validUntil: "2026-11-01" }, QUOTES_TODAY)).toBe(
      "已过期",
    );
  });
  it("prints validity with the remaining days or 未注明", () => {
    expect(validityText(version("qv_hair_1"), QUOTES_TODAY)).toBe(
      "有效期至 2026年11月12日（剩余 5 天）",
    );
    expect(validityText(version("qv_cartons_1"), QUOTES_TODAY)).toBe("已于 2026年10月20日 过期");
    expect(validityText({ ...version("qv_hair_1"), validUntil: null }, QUOTES_TODAY)).toContain(
      "未注明",
    );
  });
});

describe("what the supplier may do", () => {
  it("withdraws only a current confirmed or expiring version, with a reason", () => {
    expect(canWithdraw(version("qv_labels_2"), QUOTES_TODAY)).toBe(true);
    expect(canWithdraw(version("qv_hair_1"), QUOTES_TODAY)).toBe(true);
    expect(canWithdraw(version("qv_cartons_1"), QUOTES_TODAY)).toBe(false);
    expect(canWithdraw(version("qv_labels_1"), QUOTES_TODAY)).toBe(false);
    expect(canWithdraw(version("qv_pet_1"), QUOTES_TODAY)).toBe(false);
    expect(canWithdraw(version("qv_sleeve_1"), QUOTES_TODAY)).toBe(false);
    expect(withdrawReasonError("涨")).toContain("至少 3 个字");
    expect(withdrawReasonError("原材料涨价")).toBeNull();
    const w = applyWithdraw(version("qv_labels_2"), "原材料涨价", "2026-11-07 10:00");
    expect(w.status).toBe("withdrawn");
    expect(w.events[w.events.length - 1]).toMatchObject({
      from: "confirmed",
      to: "withdrawn",
      actor: "供应商（您）",
    });
  });
  it("takes back only a pending submission, and allows a new version only when none is under review", () => {
    expect(canCancelSubmission(version("qv_sleeve_1"))).toBe(true);
    expect(canCancelSubmission(version("qv_labels_2"))).toBe(false);
    expect(applyCancelSubmission(version("qv_sleeve_1"), "报错了价格", "t").reviewStatus).toBe(
      "rejected",
    );
    expect(canUpdate(version("qv_labels_2"), QUOTES_TODAY, group("qg_labels"))).toBe(true);
    expect(canUpdate(version("qv_cartons_1"), QUOTES_TODAY, group("qg_cartons"))).toBe(true);
    expect(canUpdate(version("qv_pet_1"), QUOTES_TODAY, group("qg_pet"))).toBe(false);
    expect(canUpdate(version("qv_labels_1"), QUOTES_TODAY, group("qg_labels"))).toBe(false);
    const withPending = [
      ...QUOTE_VERSIONS,
      {
        ...version("qv_labels_2"),
        id: "x",
        version: 3,
        isCurrent: false,
        reviewStatus: "pending" as const,
        status: null,
      },
    ];
    expect(canUpdate(version("qv_labels_2"), QUOTES_TODAY, group("qg_labels"), withPending)).toBe(
      false,
    );
  });
});

describe("new version (更新报价)", () => {
  it("requires the RFQ gate, a future validity, a reason and a real change", () => {
    const prev = version("qv_cartons_1");
    const same = {
      ...draftFromVersion(prev),
      validUntil: "2026-10-20",
      specConfirmed: true,
      changeReason: "延长",
    };
    const gate = newVersionGate(same, prev, QUOTES_TODAY);
    expect(gate).toContain("有效期须晚于今天");
    expect(gate).toContain("更新原因（至少 3 个字）");
    expect(gate).toContain("与上一版本相同，请修改后再提交");
    const ok = { ...same, validUntil: "2026-12-31", changeReason: "延长有效期" };
    expect(newVersionGate(ok, prev, QUOTES_TODAY)).toEqual([]);
    expect(diffVersions(prev, { ...prev, validUntil: "2026-12-31" })).toEqual([
      { field: "有效期", before: "2026年10月20日", after: "2026年12月31日" },
    ]);
  });
  it("creates version n+1 pending review while the previous stays current", () => {
    const prev = version("qv_labels_2");
    const draft = {
      ...draftFromVersion(prev),
      validUntil: "2027-01-31",
      changeReason: "延长有效期并微调",
      specConfirmed: true,
    };
    draft.tiers[1] = { ...draft.tiers[1]!, unitPrice: 0.2 };
    const next = applyNewVersion(prev, draft, "2026-11-07 10:05", QUOTES_TODAY);
    expect(next).toMatchObject({
      id: "qg_labels_v3",
      version: 3,
      reviewStatus: "pending",
      status: null,
      isCurrent: false,
      confirmedAt: null,
      validUntil: "2027-01-31",
    });
    expect(zhStatus(next, QUOTES_TODAY)).toBe("待审核");
    expect(diffVersions(prev, next).map((d) => d.field)).toEqual(["阶梯价格", "有效期"]);
    expect(next.events[0]?.reason).toContain("更新报价（v3）");
  });
});

describe("list", () => {
  it("summarises and orders: review first, then expiring and expired, then confirmed, terminal last", () => {
    expect(quotesSummary(QUOTE_GROUPS, QUOTE_VERSIONS, QUOTES_TODAY)).toEqual({
      pending: 1,
      expiring: 1,
      expired: 1,
      confirmed: 1,
    });
    expect(sortGroups(QUOTE_GROUPS, QUOTE_VERSIONS, QUOTES_TODAY).map((g) => g.id)).toEqual([
      "qg_sleeve",
      "qg_hair",
      "qg_cartons",
      "qg_labels",
      "qg_pet",
    ]);
    expect(currentVersion(group("qg_labels"))?.id).toBe("qv_labels_2");
  });
});
