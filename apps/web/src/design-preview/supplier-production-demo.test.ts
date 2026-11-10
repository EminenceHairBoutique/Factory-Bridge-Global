import { describe, expect, it } from "vitest";
import { INSPECTION_JOBS, QUALITY_TRACKS } from "./demo-data/quality";
import { PRODUCTION_TODAY, SUPPLIER_ID } from "./demo-data/supplier-production";
import {
  applyMilestone,
  badgeAllowedZh,
  canConfirmReadiness,
  checkEvidence,
  commitPackedDate,
  inspectionBadgeZh,
  milestoneFlags,
  pendingActions,
  planTextZh,
  readiness,
  supplierTracks,
  validateCorrective,
  validateMilestone,
  validateReschedule,
  type MilestoneInput,
} from "./supplier-production-demo";

const track = supplierTracks(SUPPLIER_ID)[0]!;
const ms = track.milestones;
const psi = INSPECTION_JOBS.find((j) => j.id === "ij_a_psi")!;
const dp = INSPECTION_JOBS.find((j) => j.id === "ij_a_dp")!;
const base: MilestoneInput = {
  key: "percent_complete",
  kind: "reported",
  date: PRODUCTION_TODAY,
  percent: "85",
  reason: "",
  evidence: [],
};

describe("supplier scope", () => {
  it("shows only the supplier's own tracks", () => {
    expect(supplierTracks(SUPPLIER_ID).map((t) => t.id)).toEqual(["qt_labels_a"]);
    expect(QUALITY_TRACKS.length).toBeGreaterThan(1);
  });
});

describe("milestone updates", () => {
  it("accepts forward progress and rejects regressions, bad dates and estimated progress", () => {
    expect(validateMilestone(base, ms, PRODUCTION_TODAY)).toEqual([]);
    expect(validateMilestone({ ...base, percent: "60" }, ms, PRODUCTION_TODAY)).toEqual([
      "进度不能低于上次报告的 70%。",
    ]);
    expect(validateMilestone({ ...base, date: "2026-11-08" }, ms, PRODUCTION_TODAY)).toEqual([
      "“已发生”的日期不能晚于今天。",
    ]);
    expect(
      validateMilestone({ ...base, kind: "estimated", date: "2026-11-09" }, ms, PRODUCTION_TODAY),
    ).toEqual(["生产进度只能按已发生报告。"]);
    expect(
      validateMilestone(
        { ...base, key: "packed", kind: "estimated", date: "2026-11-05" },
        ms,
        PRODUCTION_TODAY,
      ),
    ).toEqual(["预计或承诺日期不能早于今天。"]);
  });
  it("needs 100 % and packing evidence before reporting 包装完成", () => {
    const e = validateMilestone({ ...base, key: "packed", kind: "reported" }, ms, PRODUCTION_TODAY);
    expect(e).toEqual([
      "包装完成前，请先报告生产进度 100%。",
      "报告包装完成需附装箱单或包装照片。",
    ]);
    const at100 = applyMilestone(ms, { ...base, percent: "100" });
    expect(
      validateMilestone(
        { ...base, key: "packed", kind: "reported", evidence: ["packing-list-L-0007.xlsx"] },
        at100,
        PRODUCTION_TODAY,
      ),
    ).toEqual([]);
  });
  it("needs a reason to move a committed date and flags it to the buyer", () => {
    const committed = commitPackedDate(ms);
    const move: MilestoneInput = {
      key: "packed",
      kind: "committed",
      date: "2026-11-13",
      percent: "",
      reason: "",
      evidence: [],
    };
    expect(validateMilestone(move, committed, PRODUCTION_TODAY)).toEqual([
      "更改承诺日期需填写原因（至少 3 个字），买家将看到“交期变更”。",
    ]);
    expect(
      validateMilestone({ ...move, reason: "覆膜机检修" }, committed, PRODUCTION_TODAY),
    ).toEqual([]);
    expect(milestoneFlags(move, committed)).toEqual(["交期变更", "日期推迟"]);
    expect(milestoneFlags({ ...move, kind: "estimated" }, ms)).toEqual(["日期推迟"]);
  });
  it("keeps milestones in workflow order and stores progress as supplier-reported", () => {
    const next = applyMilestone(ms, base);
    expect(next.map((m) => m.key)).toEqual([
      "materials_ready",
      "production_start",
      "percent_complete",
      "packed",
    ]);
    expect(next.find((m) => m.key === "percent_complete")?.value).toBe("85 %（供应商报告）");
  });
  it("runs the shared upload pre-check with Chinese reasons", () => {
    const r = checkEvidence([
      { name: "packing-photo-01.jpg", type: "image/jpeg", size: 2_400_000 },
      {
        name: "生产记录.docx",
        type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        size: 120_000,
      },
    ]);
    expect(r.accepted).toEqual(["packing-photo-01.jpg"]);
    expect(r.rejected[0]?.reason).toContain("不支持此文件类型");
  });
});

describe("inspection readiness and reschedule", () => {
  it("lists the readiness conditions and blocks confirmation until they hold", () => {
    expect(readiness(psi, ms).map((r) => r.met)).toEqual([false, true]);
    expect(canConfirmReadiness(psi, ms, false)).toEqual([
      "请确认检验当日现场可提供 QSR v3 与生产留样。",
    ]);
    expect(canConfirmReadiness(psi, ms, true)).toEqual([]);
    const late = applyMilestone(ms, {
      key: "packed",
      kind: "estimated",
      date: "2026-11-14",
      percent: "",
      reason: "",
      evidence: [],
    });
    expect(canConfirmReadiness(psi, late, true)).toEqual([
      "包装完成日期晚于检验日，请先更新日期或申请改期。",
    ]);
    expect(commitPackedDate(ms).find((m) => m.key === "packed")?.dateKind).toBe("committed");
  });
  it("validates a reschedule request", () => {
    expect(validateReschedule(psi, "2026-11-12", "", PRODUCTION_TODAY)).toEqual([
      "建议日期与现定日期相同。",
      "请填写改期原因（至少 3 个字）。",
    ]);
    expect(validateReschedule(psi, "2026-11-14", "覆膜机检修两天", PRODUCTION_TODAY)).toEqual([]);
  });
});

describe("corrective action, badges and pending actions", () => {
  it("requires action, quantity, description and evidence for rework", () => {
    const major = dp.result!.findings.find((f) => f.class === "major")!;
    expect(
      validateCorrective(major, { action: null, quantity: "x", description: "", evidence: [] }),
    ).toEqual([
      "请选择整改方式。",
      "数量须为 0 或正整数。",
      "请说明原因与整改措施（至少 10 个字）。",
    ]);
    expect(
      validateCorrective(major, {
        action: "reworked",
        quantity: "1",
        description: "重新校准套印后重印该卷并全检。",
        evidence: [],
      }),
    ).toEqual(["返工或更换需附照片或记录。"]);
    expect(
      validateCorrective(major, {
        action: "quarantined",
        quantity: "1",
        description: "该卷已隔离，不随批次出货。",
        evidence: [],
      }),
    ).toEqual([]);
  });
  it("prints the fixed Chinese badge and the plan, without claims", () => {
    expect(inspectionBadgeZh(dp, "L-0007")).toBe(
      "批次 L-0007 生产中检验通过（2026年11月5日）：抽检 80 / 10,000 件，依据 ISO 2859-1 一般检验水平 II，AQL 0/2.5/4.0，检验清单 v3",
    );
    expect(inspectionBadgeZh(psi, "L-0007")).toBe(
      "出货前检验已安排（2026年11月12日，检验清单 v3）",
    );
    expect(planTextZh(10_000)).toContain("样本量字码 L，抽检 200 件");
    expect(badgeAllowedZh(inspectionBadgeZh(dp, "L-0007"))).toBe(true);
    expect(badgeAllowedZh("零缺陷，质量保证")).toBe(false);
  });
  it("lists what the supplier has to do and clears it as they act", () => {
    const start = {
      readinessConfirmed: false,
      rescheduleRequested: false,
      correctiveSubmitted: new Set<string>(),
      lastProgressAt: "2026-11-06 18:40",
    };
    expect(pendingActions(track, ms, start, PRODUCTION_TODAY).map((a) => a.key)).toEqual([
      "readiness",
      "corrective",
      "progress",
    ]);
    const done = {
      readinessConfirmed: true,
      rescheduleRequested: false,
      correctiveSubmitted: new Set(["df_a1"]),
      lastProgressAt: `${PRODUCTION_TODAY} 10:00`,
    };
    expect(pendingActions(track, ms, done, PRODUCTION_TODAY)).toEqual([]);
  });
});
