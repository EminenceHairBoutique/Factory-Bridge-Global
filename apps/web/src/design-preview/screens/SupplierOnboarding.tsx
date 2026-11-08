"use client";

/**
 * 企业资料与认证 — supplier onboarding (IA §2.3 `/supplier/onboarding`; master spec §8; PRD "供应商提供，未核验").
 * Five steps: 企业信息 → 授权代表 → 资质文件 → 贸易能力 → 确认提交. Opens in the resume scenario shown on 工作台
 * (premises proof requested by the platform). Local state only; files never leave the browser (name/size only).
 */
import Link from "next/link";
import { useMemo, useState } from "react";
import {
  FAMILY_OPTIONS,
  INCOTERM_GLOSS,
  ONBOARDING_DOC_TYPES,
  ONBOARDING_EMPTY,
  ONBOARDING_PREFILL,
  PORT_OPTIONS,
  type DocStatus,
  type IncotermCode,
  type OnboardingData,
  type OnboardingDoc,
} from "../demo-data/supplier";
import { formatZhDate, validateCnMobile, validateEmail, validateUscc } from "../supplier-demo";
import { AppShell } from "../ui/AppShell";
import { Icon } from "../ui/icons";
import {
  Badge,
  Button,
  Checkbox,
  Field,
  Notice,
  PageHeader,
  Panel,
  Select,
  Stepper,
  TextArea,
  TextInput,
  buttonClasses,
  cx,
  type StepDef,
  type Tone,
} from "../ui/primitives";

const STEPS: StepDef[] = [
  { id: "company", title: "企业信息", summary: "登记名称、信用代码、类型" },
  { id: "rep", title: "授权代表", summary: "身份、联系方式、授权依据" },
  { id: "docs", title: "资质文件", summary: "营业执照、身份证明、场地证明" },
  { id: "trade", title: "贸易能力", summary: "条款、口岸、产能、验货" },
  { id: "review", title: "确认提交", summary: "核对信息、同意条款" },
];

const DOC_TONE: Record<DocStatus, Tone> = {
  待上传: "neutral",
  待审核: "teal",
  已核验: "ok",
  需补充: "warn",
};

const ALLOWED = new Set(["application/pdf", "image/png", "image/jpeg"]);
const MAX_BYTES = 25 * 1024 * 1024;
const TODAY = "2026-11-07";

type Errors = Partial<Record<string, string>>;

function validateStep(step: number, d: OnboardingData): Errors {
  const e: Errors = {};
  if (step === 0) {
    if (d.company.legalName.trim().length < 4) e.legalName = "请填写营业执照上的企业名称";
    const u = validateUscc(d.company.uscc);
    if (u) e.uscc = u;
    if (!d.company.companyType) e.companyType = "请选择企业类型";
    if (!d.company.city.trim()) e.city = "请填写所在城市";
    if (d.company.families.length === 0) e.families = "请至少选择一个主营品类";
  }
  if (step === 1) {
    if (d.representative.name.trim().length < 2) e.repName = "请填写姓名";
    const m = validateEmail(d.representative.email);
    if (m) e.email = m;
    const p = validateCnMobile(d.representative.mobile);
    if (p) e.mobile = p;
    if (!d.representative.authority) e.authority = "请选择授权依据";
    if (d.representative.wechat.trim() && !d.representative.contactBasis)
      e.contactBasis = "填写微信号时需确认该联系方式用于业务沟通";
  }
  if (step === 2) {
    const factory = d.company.companyType !== "贸易公司";
    for (const t of ONBOARDING_DOC_TYPES) {
      if (!t.required || (t.factoryOnly && !factory)) continue;
      const doc = d.documents.find((x) => x.key === t.key);
      if (!doc?.fileName) e[`doc_${t.key}`] = `请上传${t.label}`;
    }
  }
  if (step === 3) {
    if (d.trade.incoterms.length === 0) e.incoterms = "请至少选择一种可接受的交易条款";
    if (!d.trade.exportExperience) e.exportExperience = "请选择";
    if (d.trade.currencies.length === 0) e.currencies = "请至少选择一种货币";
    if (!d.trade.thirdPartyInspection) e.thirdPartyInspection = "请选择";
    if (!d.trade.samples) e.samples = "请选择";
  }
  if (step === 4) {
    if (!d.consent.dataProcessing) e.dataProcessing = "需同意后才能提交";
    if (!d.consent.truthfulness) e.truthfulness = "需确认后才能提交";
  }
  return e;
}

function formatBytes(n: number): string {
  return n < 1024 * 1024 ? `${(n / 1024).toFixed(0)} KB` : `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export function SupplierOnboarding() {
  const [data, setData] = useState<OnboardingData>(ONBOARDING_PREFILL);
  const [resume, setResume] = useState(true);
  const [step, setStep] = useState(2);
  const [completed, setCompleted] = useState<Set<number>>(new Set([0, 1, 3]));
  const [errors, setErrors] = useState<Errors>({});
  const [fileError, setFileError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  const factory = data.company.companyType !== "贸易公司";
  const blocking = useMemo(() => {
    const all: string[] = [];
    for (let i = 0; i < 4; i++)
      all.push(...(Object.values(validateStep(i, data)).filter(Boolean) as string[]));
    return all;
  }, [data]);

  const update = <K extends keyof OnboardingData>(key: K, patch: Partial<OnboardingData[K]>) => {
    setData((d) => ({ ...d, [key]: { ...d[key], ...patch } }));
    setErrors({});
    setSavedAt(TODAY);
  };

  const setDoc = (key: string, patch: Partial<OnboardingDoc>) =>
    setData((d) => ({
      ...d,
      documents: d.documents.map((x) => (x.key === key ? { ...x, ...patch } : x)),
    }));

  const goTo = (i: number) => {
    setStep(i);
    setErrors({});
    window.scrollTo({ top: 0 });
  };

  const next = () => {
    const e = validateStep(step, data);
    setErrors(e);
    if (Object.keys(e).length > 0) return;
    setCompleted((s) => new Set(s).add(step));
    goTo(Math.min(step + 1, STEPS.length - 1));
  };

  const addFile = (key: string, list: FileList | null) => {
    const f = list?.[0];
    if (!f) return;
    if (!ALLOWED.has(f.type)) return setFileError(`${f.name}：仅接受 PDF、JPG、PNG`);
    if (f.size > MAX_BYTES) return setFileError(`${f.name}：超过 25 MB`);
    setFileError(null);
    setDoc(key, { fileName: f.name, size: f.size, status: "待审核", reviewerNote: undefined });
    setErrors({});
  };

  const startFresh = () => {
    setData(ONBOARDING_EMPTY);
    setResume(false);
    setStep(0);
    setCompleted(new Set());
    setErrors({});
    setSubmitted(false);
    setSavedAt(null);
  };

  if (submitted) {
    return (
      <AppShell workspace="supplier" title="企业资料与认证">
        <div className="mx-auto max-w-2xl">
          <Panel>
            <div className="flex items-start gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-(--fbg-status-success-fill) text-(--fbg-status-success)">
                <Icon name="check" size={18} />
              </span>
              <div className="min-w-0">
                <h2 className="text-lg font-semibold text-(--fbg-text-primary)">
                  {resume ? "补充材料已提交，待平台审核" : "认证资料已提交，待平台审核"}
                </h2>
                <p className="mt-1 text-[15px] text-(--fbg-text-secondary)">
                  平台运营人员将在 3
                  个工作日内审核。审核通过后，您的企业资料会显示“企业身份已核验（日期）”，并记录核验人员与依据；需补充时您会在工作台收到提示。上传的证书在核验前不会向买家显示为“已认证”。
                </p>
                <ul className="mt-3 flex flex-col gap-1 text-sm text-(--fbg-text-secondary)">
                  {data.documents
                    .filter((d) => d.fileName)
                    .map((d) => (
                      <li key={d.key} className="flex items-center gap-2">
                        <Icon name="document" size={14} />
                        <span className="fbg-num">{d.fileName}</span>
                        <Badge tone={DOC_TONE[d.status]}>{d.status}</Badge>
                        {d.status !== "已核验" ? (
                          <span className="text-xs">供应商提供，未核验</span>
                        ) : null}
                      </li>
                    ))}
                </ul>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Link
                    href="/design-preview/supplier/dashboard"
                    className={buttonClasses("primary")}
                  >
                    返回工作台
                  </Link>
                  <Button onClick={() => setSubmitted(false)}>查看已提交的资料</Button>
                </div>
              </div>
            </div>
          </Panel>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell workspace="supplier" title="企业资料与认证">
      <div className="flex flex-col gap-5">
        <PageHeader
          title="企业资料与认证"
          lead="认证由平台运营人员审核；通过后买家会看到“企业身份已核验（日期）”。上传的文件在审核前一律标注为“供应商提供，未核验”。"
          meta={
            <>
              <Badge tone={resume ? "warn" : "neutral"} icon={resume ? "alert" : "info"}>
                {resume ? "总体状态：需补充（生产场地证明）" : "首次填写"}
              </Badge>
              <span className="flex items-center gap-1 text-xs text-(--fbg-text-secondary)">
                <Icon name={savedAt ? "check" : "clock"} size={12} />
                {savedAt ? `草稿已本地保存（${formatZhDate(savedAt)}）` : "草稿自动保存"}
              </span>
            </>
          }
          actions={
            resume ? (
              <Button variant="ghost" onClick={startFresh} title="演示：切换到空白的首次填写流程">
                清空并从头填写（演示）
              </Button>
            ) : null
          }
        />

        {resume && step !== 4 ? (
          <Notice tone="warn" title="平台要求补充：生产场地证明">
            平台运营（2026年11月5日）：请上传近期厂房照片（含门头与车间）或租赁合同首页，用于核对注册地址与生产场地是否一致。其他已核验项目无需重新提交。
          </Notice>
        ) : null}

        <div className="grid gap-5 lg:grid-cols-[16rem_1fr]">
          <div className="min-w-0 lg:sticky lg:top-20 lg:self-start">
            <Stepper steps={STEPS} current={step} completed={completed} onSelect={goTo} />
          </div>

          <div className="min-w-0">
            {/* 1 企业信息 */}
            {step === 0 && (
              <Panel title="企业信息" description="请与营业执照保持一致；平台将核对登记记录。">
                <div className="grid gap-5 sm:grid-cols-2">
                  <Field
                    label="企业名称（营业执照登记名称）"
                    htmlFor="legalName"
                    required
                    optionalText="（可选）"
                    error={errors.legalName}
                    className="sm:col-span-2"
                  >
                    <TextInput
                      id="legalName"
                      value={data.company.legalName}
                      onChange={(e) => update("company", { legalName: e.target.value })}
                      aria-invalid={Boolean(errors.legalName)}
                    />
                  </Field>
                  <Field
                    label="统一社会信用代码"
                    htmlFor="uscc"
                    required
                    optionalText="（可选）"
                    error={errors.uscc}
                    hint="18 位；此处仅校验格式与校验位，真实性由平台核对。"
                  >
                    <TextInput
                      id="uscc"
                      value={data.company.uscc}
                      onChange={(e) => update("company", { uscc: e.target.value.toUpperCase() })}
                      className="fbg-num"
                      maxLength={18}
                      aria-invalid={Boolean(errors.uscc)}
                    />
                  </Field>
                  <Field
                    label="企业类型"
                    htmlFor="companyType"
                    required
                    optionalText="（可选）"
                    error={errors.companyType}
                  >
                    <Select
                      id="companyType"
                      value={data.company.companyType}
                      onChange={(e) =>
                        update("company", {
                          companyType: e.target.value as OnboardingData["company"]["companyType"],
                        })
                      }
                      aria-invalid={Boolean(errors.companyType)}
                    >
                      <option value="">请选择</option>
                      <option value="生产型工厂">生产型工厂</option>
                      <option value="工贸一体">工贸一体</option>
                      <option value="贸易公司">贸易公司</option>
                    </Select>
                  </Field>
                  <Field label="省份" htmlFor="province" optionalText="（可选）">
                    <TextInput
                      id="province"
                      value={data.company.province}
                      onChange={(e) => update("company", { province: e.target.value })}
                      placeholder="广东省"
                    />
                  </Field>
                  <Field
                    label="所在城市"
                    htmlFor="city"
                    required
                    optionalText="（可选）"
                    error={errors.city}
                  >
                    <TextInput
                      id="city"
                      value={data.company.city}
                      onChange={(e) => update("company", { city: e.target.value })}
                      placeholder="深圳市"
                      aria-invalid={Boolean(errors.city)}
                    />
                  </Field>
                  <Field
                    label="注册地址"
                    htmlFor="address"
                    optionalText="（可选）"
                    className="sm:col-span-2"
                  >
                    <TextInput
                      id="address"
                      value={data.company.address}
                      onChange={(e) => update("company", { address: e.target.value })}
                    />
                  </Field>
                  <Field label="成立年份" htmlFor="foundedYear" optionalText="（可选）">
                    <TextInput
                      id="foundedYear"
                      inputMode="numeric"
                      className="fbg-num"
                      value={data.company.foundedYear}
                      onChange={(e) => update("company", { foundedYear: e.target.value })}
                      placeholder="2014"
                    />
                  </Field>
                  <fieldset className="sm:col-span-2">
                    <legend className="text-sm font-medium text-(--fbg-text-primary)">
                      主营品类 <span className="text-(--fbg-status-danger)">*</span>
                    </legend>
                    <div className="mt-2 grid gap-2 sm:grid-cols-2">
                      {FAMILY_OPTIONS.map((f) => (
                        <Checkbox
                          key={f}
                          id={`fam_${f}`}
                          label={f}
                          checked={data.company.families.includes(f)}
                          onChange={(on) =>
                            update("company", {
                              families: on
                                ? [...data.company.families, f]
                                : data.company.families.filter((x) => x !== f),
                            })
                          }
                        />
                      ))}
                    </div>
                    {errors.families ? (
                      <p className="mt-1 text-xs text-(--fbg-status-danger)">{errors.families}</p>
                    ) : null}
                  </fieldset>
                </div>
              </Panel>
            )}

            {/* 2 授权代表 */}
            {step === 1 && (
              <Panel
                title="授权代表"
                description="联系方式仅平台被指派的运营人员可见，不会向买家展示；向买家披露需您另行签署授权。"
              >
                <div className="grid gap-5 sm:grid-cols-2">
                  <Field
                    label="姓名"
                    htmlFor="repName"
                    required
                    optionalText="（可选）"
                    error={errors.repName}
                  >
                    <TextInput
                      id="repName"
                      value={data.representative.name}
                      onChange={(e) => update("representative", { name: e.target.value })}
                      aria-invalid={Boolean(errors.repName)}
                    />
                  </Field>
                  <Field label="职务" htmlFor="repTitle" optionalText="（可选）">
                    <TextInput
                      id="repTitle"
                      value={data.representative.title}
                      onChange={(e) => update("representative", { title: e.target.value })}
                      placeholder="外贸经理"
                    />
                  </Field>
                  <Field
                    label="工作邮箱"
                    htmlFor="repEmail"
                    required
                    optionalText="（可选）"
                    error={errors.email}
                  >
                    <TextInput
                      id="repEmail"
                      type="email"
                      value={data.representative.email}
                      onChange={(e) => update("representative", { email: e.target.value })}
                      aria-invalid={Boolean(errors.email)}
                    />
                  </Field>
                  <Field
                    label="手机号"
                    htmlFor="repMobile"
                    required
                    optionalText="（可选）"
                    error={errors.mobile}
                  >
                    <TextInput
                      id="repMobile"
                      inputMode="tel"
                      className="fbg-num"
                      value={data.representative.mobile}
                      onChange={(e) => update("representative", { mobile: e.target.value })}
                      aria-invalid={Boolean(errors.mobile)}
                    />
                  </Field>
                  <Field
                    label="授权依据"
                    htmlFor="authority"
                    required
                    optionalText="（可选）"
                    error={errors.authority}
                    hint="授权代表需在“资质文件”中上传加盖公章的授权书。"
                  >
                    <Select
                      id="authority"
                      value={data.representative.authority}
                      onChange={(e) =>
                        update("representative", {
                          authority: e.target
                            .value as OnboardingData["representative"]["authority"],
                        })
                      }
                      aria-invalid={Boolean(errors.authority)}
                    >
                      <option value="">请选择</option>
                      <option value="法定代表人本人">法定代表人本人</option>
                      <option value="授权代表（附授权书）">授权代表（附授权书）</option>
                    </Select>
                  </Field>
                  <Field
                    label="微信号"
                    htmlFor="wechat"
                    optionalText="（可选）"
                    hint="仅用于平台运营人员与您的业务沟通。"
                  >
                    <TextInput
                      id="wechat"
                      value={data.representative.wechat}
                      onChange={(e) => update("representative", { wechat: e.target.value })}
                    />
                  </Field>
                  <div className="sm:col-span-2">
                    <Checkbox
                      id="contactBasis"
                      label="我确认以上联系方式为企业业务联系方式，同意平台被指派的运营人员用于业务沟通"
                      description="记录为联系依据（供应商为业务目的提供）。未经您另行授权，不会向任何买家披露。"
                      checked={data.representative.contactBasis}
                      onChange={(on) => update("representative", { contactBasis: on })}
                    />
                    {errors.contactBasis ? (
                      <p className="mt-1 text-xs text-(--fbg-status-danger)">
                        {errors.contactBasis}
                      </p>
                    ) : null}
                  </div>
                </div>
              </Panel>
            )}

            {/* 3 资质文件 */}
            {step === 2 && (
              <Panel
                title="资质文件"
                description="PDF、JPG、PNG，单个文件不超过 25 MB。文件先进入隔离区并完成安全扫描，再由运营人员审核。"
              >
                <Notice
                  tone="warn"
                  title="原型：文件不会上传"
                  action={
                    <Link
                      href="/design-preview/supplier/documents"
                      className={buttonClasses("secondary", "sm")}
                    >
                      文件资料
                    </Link>
                  }
                >
                  本界面仅记录文件名与大小。正式系统中的上传、扫描与审核由后端任务完成；所有文件及其审核状态在“文件资料”中集中管理。
                </Notice>
                {fileError ? (
                  <div className="mt-3">
                    <Notice tone="danger" title="文件未添加">
                      {fileError}
                    </Notice>
                  </div>
                ) : null}
                <ul className="mt-4 divide-y divide-(--fbg-border-subtle)">
                  {ONBOARDING_DOC_TYPES.filter((t) => !(t.factoryOnly && !factory)).map((t) => {
                    const doc = data.documents.find((x) => x.key === t.key);
                    const status: DocStatus = doc?.status ?? "待上传";
                    const err = errors[`doc_${t.key}`];
                    return (
                      <li
                        key={t.key}
                        className={cx(
                          "flex flex-col gap-2 py-4 lg:flex-row lg:items-start lg:justify-between",
                          status === "需补充" &&
                            "rounded-(--fbg-radius-control) bg-(--fbg-status-warning-fill)/60 px-3",
                        )}
                      >
                        <div className="min-w-0">
                          <p className="flex flex-wrap items-center gap-2 text-[15px] font-medium text-(--fbg-text-primary)">
                            {t.label}
                            {t.required ? (
                              <Badge tone="ink" icon={null}>
                                必需
                              </Badge>
                            ) : (
                              <Badge tone="neutral" icon={null}>
                                可选
                              </Badge>
                            )}
                            <Badge tone={DOC_TONE[status]}>{status}</Badge>
                          </p>
                          <p className="text-sm text-(--fbg-text-secondary)">{t.hint}</p>
                          {t.certification ? (
                            <p className="mt-1 flex items-start gap-1 text-xs text-(--fbg-status-warning)">
                              <Icon name="alert" size={12} className="mt-0.5 shrink-0" />
                              证书在平台核验前不会向买家显示为“已认证”，仅标注“供应商提供，未核验”。
                            </p>
                          ) : null}
                          {doc?.reviewerNote ? (
                            <p className="mt-1 text-xs text-(--fbg-text-primary)">
                              {doc.reviewerNote}
                            </p>
                          ) : null}
                          {doc?.fileName ? (
                            <p className="fbg-num mt-1.5 flex flex-wrap items-center gap-2 text-sm text-(--fbg-text-primary)">
                              <Icon
                                name="document"
                                size={14}
                                className="text-(--fbg-text-secondary)"
                              />
                              {doc.fileName}
                              {doc.size ? (
                                <span className="text-xs text-(--fbg-text-secondary)">
                                  {formatBytes(doc.size)}
                                </span>
                              ) : null}
                              {status === "已核验" && doc.reviewedAt ? (
                                <span className="text-xs text-(--fbg-status-success)">
                                  已核验 {formatZhDate(doc.reviewedAt)}
                                </span>
                              ) : (
                                <span className="text-xs text-(--fbg-text-secondary)">
                                  供应商提供，未核验
                                </span>
                              )}
                            </p>
                          ) : null}
                          {err ? (
                            <p className="mt-1 flex items-center gap-1 text-xs text-(--fbg-status-danger)">
                              <Icon name="alert" size={12} /> {err}
                            </p>
                          ) : null}
                        </div>
                        <div className="flex shrink-0 flex-wrap gap-2">
                          <label
                            className={cx(
                              buttonClasses(
                                status === "需补充" || !doc?.fileName ? "primary" : "secondary",
                                "sm",
                              ),
                              "cursor-pointer",
                            )}
                          >
                            <Icon name="upload" size={14} />
                            {doc?.fileName ? "替换文件" : "选择文件"}
                            <input
                              type="file"
                              className="sr-only"
                              accept=".pdf,.jpg,.jpeg,.png"
                              onChange={(e) => {
                                addFile(t.key, e.target.files);
                                e.target.value = "";
                              }}
                            />
                          </label>
                          {doc?.fileName && status !== "已核验" ? (
                            <Button
                              size="sm"
                              variant="ghost"
                              icon="x"
                              aria-label={`移除${t.label}`}
                              onClick={() =>
                                setDoc(t.key, {
                                  fileName: null,
                                  size: null,
                                  status: doc.reviewerNote ? "需补充" : "待上传",
                                })
                              }
                            />
                          ) : null}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </Panel>
            )}

            {/* 4 贸易能力 */}
            {step === 3 && (
              <Panel
                title="贸易能力"
                description="这些信息帮助运营人员判断询价是否适合您，不会被当作认证结论。"
              >
                <div className="flex flex-col gap-5">
                  <fieldset>
                    <legend className="text-sm font-medium text-(--fbg-text-primary)">
                      可接受的交易条款 <span className="text-(--fbg-status-danger)">*</span>
                    </legend>
                    <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                      {(["EXW", "FCA", "FOB", "CIF", "DAP", "DDP"] as IncotermCode[]).map((c) => (
                        <Checkbox
                          key={c}
                          id={`inco_${c}`}
                          label={INCOTERM_GLOSS[c]}
                          checked={data.trade.incoterms.includes(c)}
                          onChange={(on) =>
                            update("trade", {
                              incoterms: on
                                ? [...data.trade.incoterms, c]
                                : data.trade.incoterms.filter((x) => x !== c),
                            })
                          }
                        />
                      ))}
                    </div>
                    {errors.incoterms ? (
                      <p className="mt-1 text-xs text-(--fbg-status-danger)">{errors.incoterms}</p>
                    ) : null}
                  </fieldset>
                  <div className="grid gap-5 sm:grid-cols-2">
                    <Field
                      label="出口经验"
                      htmlFor="exportExperience"
                      required
                      optionalText="（可选）"
                      error={errors.exportExperience}
                    >
                      <Select
                        id="exportExperience"
                        value={data.trade.exportExperience}
                        onChange={(e) =>
                          update("trade", {
                            exportExperience: e.target
                              .value as OnboardingData["trade"]["exportExperience"],
                          })
                        }
                      >
                        <option value="">请选择</option>
                        <option value="有">有（曾直接出口）</option>
                        <option value="无">无（通过外贸公司）</option>
                      </Select>
                    </Field>
                    <Field label="常用出口口岸" htmlFor="ports" optionalText="（可选）">
                      <div className="flex flex-wrap gap-2" id="ports">
                        {PORT_OPTIONS.map((p) => {
                          const on = data.trade.ports.includes(p);
                          return (
                            <button
                              key={p}
                              type="button"
                              aria-pressed={on}
                              onClick={() =>
                                update("trade", {
                                  ports: on
                                    ? data.trade.ports.filter((x) => x !== p)
                                    : [...data.trade.ports, p],
                                })
                              }
                              className={cx(
                                "h-9 rounded-(--fbg-radius-control) border px-3 text-sm",
                                on
                                  ? "border-(--fbg-action-primary) bg-(--fbg-selected) text-(--fbg-text-primary)"
                                  : "border-(--fbg-border-subtle) text-(--fbg-text-secondary) hover:border-(--fbg-border-strong)",
                              )}
                            >
                              {p}
                            </button>
                          );
                        })}
                      </div>
                    </Field>
                    <fieldset>
                      <legend className="text-sm font-medium text-(--fbg-text-primary)">
                        可接受货币 <span className="text-(--fbg-status-danger)">*</span>
                      </legend>
                      <div className="mt-2 flex flex-col gap-2">
                        {["CNY", "USD"].map((c) => (
                          <Checkbox
                            key={c}
                            id={`cur_${c}`}
                            label={c === "CNY" ? "人民币 ¥ CNY" : "美元 $ USD"}
                            checked={data.trade.currencies.includes(c)}
                            onChange={(on) =>
                              update("trade", {
                                currencies: on
                                  ? [...data.trade.currencies, c]
                                  : data.trade.currencies.filter((x) => x !== c),
                              })
                            }
                          />
                        ))}
                      </div>
                      {errors.currencies ? (
                        <p className="mt-1 text-xs text-(--fbg-status-danger)">
                          {errors.currencies}
                        </p>
                      ) : null}
                    </fieldset>
                    <Field
                      label="月产能（自述）"
                      htmlFor="capacity"
                      optionalText="（可选）"
                      hint="自述信息，不作为认证结论。"
                    >
                      <TextInput
                        id="capacity"
                        value={data.trade.monthlyCapacity}
                        onChange={(e) => update("trade", { monthlyCapacity: e.target.value })}
                      />
                    </Field>
                    <Field
                      label="标准交期（天，稿件确认后）"
                      htmlFor="leadDays"
                      optionalText="（可选）"
                    >
                      <TextInput
                        id="leadDays"
                        inputMode="numeric"
                        className="fbg-num"
                        value={data.trade.standardLeadDays}
                        onChange={(e) => update("trade", { standardLeadDays: e.target.value })}
                      />
                    </Field>
                    <Field
                      label="是否接受第三方验货"
                      htmlFor="tpi"
                      required
                      optionalText="（可选）"
                      error={errors.thirdPartyInspection}
                    >
                      <Select
                        id="tpi"
                        value={data.trade.thirdPartyInspection}
                        onChange={(e) =>
                          update("trade", {
                            thirdPartyInspection: e.target
                              .value as OnboardingData["trade"]["thirdPartyInspection"],
                          })
                        }
                      >
                        <option value="">请选择</option>
                        <option value="接受">接受</option>
                        <option value="不接受">不接受</option>
                      </Select>
                    </Field>
                    <Field
                      label="是否可提供样品"
                      htmlFor="samples"
                      required
                      optionalText="（可选）"
                      error={errors.samples}
                    >
                      <Select
                        id="samples"
                        value={data.trade.samples}
                        onChange={(e) =>
                          update("trade", {
                            samples: e.target.value as OnboardingData["trade"]["samples"],
                          })
                        }
                      >
                        <option value="">请选择</option>
                        <option value="可提供">可提供</option>
                        <option value="不提供">不提供</option>
                      </Select>
                    </Field>
                    <Field
                      label="样品费说明"
                      htmlFor="sampleFee"
                      optionalText="（可选）"
                      className="sm:col-span-2"
                    >
                      <TextArea
                        id="sampleFee"
                        value={data.trade.sampleFeeNote}
                        onChange={(e) => update("trade", { sampleFeeNote: e.target.value })}
                      />
                    </Field>
                  </div>
                </div>
              </Panel>
            )}

            {/* 5 确认提交 */}
            {step === 4 && (
              <div className="flex flex-col gap-4">
                {blocking.length > 0 ? (
                  <Notice tone="warn" title={`还有 ${blocking.length} 项需要完成`}>
                    {blocking.join("；")}。
                  </Notice>
                ) : (
                  <Notice tone="ok" title="资料完整，可以提交">
                    提交后进入“待审核”。运营人员核对登记记录、授权书与场地证明后，才会标注“企业身份已核验”。
                  </Notice>
                )}
                <Panel
                  title="企业信息"
                  actions={
                    <Button size="sm" onClick={() => goTo(0)}>
                      修改
                    </Button>
                  }
                >
                  <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
                    {[
                      ["企业名称", data.company.legalName],
                      ["统一社会信用代码", data.company.uscc],
                      ["企业类型", data.company.companyType],
                      ["所在地", `${data.company.province} ${data.company.city}`.trim()],
                      ["主营品类", data.company.families.join("、")],
                      ["授权代表", `${data.representative.name} · ${data.representative.title}`],
                    ].map(([k, v]) => (
                      <div key={k}>
                        <dt className="text-xs text-(--fbg-text-secondary)">{k}</dt>
                        <dd className="fbg-num mt-0.5 text-(--fbg-text-primary)">{v || "—"}</dd>
                      </div>
                    ))}
                  </dl>
                </Panel>
                <Panel
                  title="资质文件"
                  actions={
                    <Button size="sm" onClick={() => goTo(2)}>
                      修改
                    </Button>
                  }
                  padded={false}
                >
                  <ul className="divide-y divide-(--fbg-border-subtle)">
                    {ONBOARDING_DOC_TYPES.filter((t) => !(t.factoryOnly && !factory)).map((t) => {
                      const doc = data.documents.find((x) => x.key === t.key);
                      return (
                        <li
                          key={t.key}
                          className="flex flex-wrap items-center justify-between gap-2 px-5 py-2.5 text-sm"
                        >
                          <span className="text-(--fbg-text-primary)">{t.label}</span>
                          <span className="flex items-center gap-2">
                            <span className="fbg-num text-xs text-(--fbg-text-secondary)">
                              {doc?.fileName ?? "未上传"}
                            </span>
                            <Badge tone={DOC_TONE[doc?.status ?? "待上传"]}>
                              {doc?.status ?? "待上传"}
                            </Badge>
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </Panel>
                <Panel title="同意与声明">
                  <div className="flex flex-col gap-3">
                    <Checkbox
                      id="c_data"
                      label="我同意平台存储、翻译上述信息，并在平台内部用于供应商评估"
                      description="买家仅能看到您在“数据共享设置”中允许的字段；联系人信息始终需单独授权。"
                      checked={data.consent.dataProcessing}
                      onChange={(on) => update("consent", { dataProcessing: on })}
                    />
                    {errors.dataProcessing ? (
                      <p className="text-xs text-(--fbg-status-danger)">{errors.dataProcessing}</p>
                    ) : null}
                    <Checkbox
                      id="c_truth"
                      label="我确认所提供的信息与文件真实、有效"
                      description="提供虚假信息将导致账户暂停，并记录在审计日志中。"
                      checked={data.consent.truthfulness}
                      onChange={(on) => update("consent", { truthfulness: on })}
                    />
                    {errors.truthfulness ? (
                      <p className="text-xs text-(--fbg-status-danger)">{errors.truthfulness}</p>
                    ) : null}
                    <Checkbox
                      id="c_catalog"
                      label="认证通过前，目录与价格默认“仅内部”可见"
                      description="通过后可在“数据共享设置”中逐项开放。"
                      checked={data.consent.catalogDefaultInternal}
                      onChange={(on) => update("consent", { catalogDefaultInternal: on })}
                    />
                  </div>
                </Panel>
              </div>
            )}

            {/* 操作栏 */}
            <div className="sticky bottom-16 z-20 mt-4 flex flex-wrap items-center justify-between gap-2 rounded-(--fbg-radius-card) border border-(--fbg-border-subtle) bg-(--fbg-bg-surface)/95 p-3 backdrop-blur md:bottom-4">
              <Button
                variant="ghost"
                icon="chevron-left"
                disabled={step === 0}
                onClick={() => goTo(step - 1)}
              >
                上一步
              </Button>
              <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
                <Button onClick={() => setSavedAt(TODAY)}>保存草稿</Button>
                {step < STEPS.length - 1 ? (
                  <Button variant="primary" iconRight="chevron-right" onClick={next}>
                    下一步
                  </Button>
                ) : (
                  <Button
                    variant="primary"
                    icon="upload"
                    disabled={
                      blocking.length > 0 ||
                      !data.consent.dataProcessing ||
                      !data.consent.truthfulness
                    }
                    title={blocking.length > 0 ? blocking.join("；") : undefined}
                    onClick={() => {
                      const e = validateStep(4, data);
                      setErrors(e);
                      if (Object.keys(e).length > 0) return;
                      setSubmitted(true);
                    }}
                  >
                    {resume ? "提交补充材料" : "提交审核"}
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
