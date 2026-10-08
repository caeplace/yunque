"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type OnboardingValues = {
  brandName: string;
  productDescription: string;
  targetAudience: string;
  brandTone: string;
  forbiddenExpressions: string;
  platformPreferences: string[];
  initialContentTask: string;
};

type StepKey =
  | "intro"
  | "brand"
  | "product"
  | "audience"
  | "tone"
  | "forbidden"
  | "platforms"
  | "task"
  | "confirm";

type InterviewStep = {
  key: StepKey;
  title: string;
  description: string;
  field?: keyof OnboardingValues;
  placeholder?: string;
  options?: string[];
  multiple?: boolean;
};

const steps: InterviewStep[] = [
  {
    key: "intro",
    title: "先让云雀了解这个品牌",
    description:
      "接下来会问你几个简单问题。你不需要写得很完整，只要给云雀一个基本方向，它就能开始帮你生成内容。这些信息之后都可以随时修改。",
  },
  {
    key: "brand",
    title: "这个品牌叫什么？",
    description:
      "这个名称会作为当前品牌空间的识别信息，后续素材、内容任务和品牌记忆都会归到这里。",
    field: "brandName",
    placeholder: "例如：KHEMIA",
  },
  {
    key: "product",
    title: "这个品牌主要卖什么？有什么特点？",
    description:
      "可以简单写产品类型、材质、风格、价格带、使用场景或核心卖点。不用写成正式介绍，像给同事说明这个品牌一样写就可以。",
    field: "productDescription",
    placeholder:
      "例如：现代设计首饰，主要提供项链、耳饰、手链和戒指，强调建筑感线条、925 银、天然材质和日常佩戴场景。",
    options: [
      "珠宝",
      "家具",
      "服装",
      "美妆",
      "家居用品",
      "电子产品",
      "食品饮品",
      "本地服务",
      "SaaS",
      "其他",
    ],
  },
  {
    key: "audience",
    title: "你最希望内容打动哪类用户？",
    description:
      "告诉云雀这个品牌主要想吸引谁。可以写年龄、性别、生活方式、消费动机、购买场景或审美偏好。",
    field: "targetAudience",
    placeholder:
      "例如：25-45 岁，关注设计、艺术和生活方式的女性消费者，喜欢低调、有质感、不夸张的日常饰品。",
    options: [
      "年轻女性",
      "设计爱好者",
      "高收入人群",
      "独立站买家",
      "礼品购买者",
      "专业客户",
      "家居爱好者",
      "通勤人群",
      "海外消费者",
    ],
  },
  {
    key: "tone",
    title: "你希望这个品牌说话听起来像什么？",
    description:
      "选择或描述品牌的表达方式。云雀之后生成内容时，会尽量保持这种语气。",
    field: "brandTone",
    placeholder:
      "例如：现代、克制、自然、有艺术感，不要太促销，像朋友分享真实体验。",
    options: [
      "高级克制",
      "亲切自然",
      "专业可信",
      "年轻活泼",
      "艺术感",
      "故事感",
      "真实分享",
      "强转化",
      "简洁直接",
      "温柔细腻",
    ],
  },
  {
    key: "forbidden",
    title: "有哪些词或表达，你不希望云雀在文案里使用？",
    description:
      "这里可以写禁用词、敏感表达、夸张营销话术，或任何不符合品牌调性的说法。云雀会在生成内容时主动避开。",
    field: "forbiddenExpressions",
    placeholder:
      "例如：100% 有效、全网第一、永久保证、最低价、治疗、必买、夸张促销、过度煽动、低俗表达。",
    options: [
      "绝对化承诺",
      "夸张促销",
      "医疗功效",
      "最低价",
      "全网第一",
      "永久保证",
      "低俗表达",
      "过度煽动",
      "不符合品牌调性的网络热词",
    ],
  },
  {
    key: "platforms",
    title: "你主要会把内容发布到哪些平台？",
    description:
      "选择常用发布平台。云雀会根据不同平台，调整标题、正文长度、语气、标签和 CTA。",
    field: "platformPreferences",
    multiple: true,
    options: [
      "小红书",
      "Instagram",
      "TikTok",
      "Facebook",
      "Pinterest",
      "LinkedIn",
      "网站文章",
      "邮件营销",
    ],
  },
  {
    key: "task",
    title: "接下来你最想让云雀先帮你做什么？",
    description:
      "选择一个近期内容任务。确认后，云雀会带着刚才的品牌记忆进入创作流程。",
    field: "initialContentTask",
    placeholder:
      "例如：围绕新品首饰系列，生成一组适合 Instagram、小红书和 Pinterest 的新品发布内容。",
    options: [
      "生成新品发布内容",
      "整理一批素材",
      "规划一周社媒内容",
      "写一篇网站文章",
      "生成小红书种草文案",
      "生成 Instagram 文案",
      "生成 TikTok 短视频脚本",
      "生成促销活动文案",
      "暂时不确定",
    ],
  },
  {
    key: "confirm",
    title: "云雀对这个品牌的初步理解",
    description:
      "下面是根据你刚才的回答整理出的品牌记忆。确认后，云雀会在后续内容任务中自动参考这些信息。",
  },
];

const emptyValues: OnboardingValues = {
  brandName: "",
  productDescription: "",
  targetAudience: "",
  brandTone: "",
  forbiddenExpressions: "",
  platformPreferences: [],
  initialContentTask: "",
};

function appendChoice(current: string, choice: string) {
  if (!current.trim()) {
    return choice;
  }

  if (current.split(/[，,、]/).map((item) => item.trim()).includes(choice)) {
    return current;
  }

  return `${current}，${choice}`;
}

function displayValue(value: string | string[], fallback = "稍后补充") {
  if (Array.isArray(value)) {
    return value.length > 0 ? value.join("、") : fallback;
  }

  return value.trim() || fallback;
}

function contentTaskPrompt(value: string) {
  if (!value.trim() || value === "暂时不确定") {
    return "请根据当前品牌资料，给我 3 个最适合优先开始的内容方向建议。";
  }

  return value.trim();
}

async function requestJson(url: string, init: RequestInit) {
  const response = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });

  if (!response.ok) {
    const message = await response.text().catch(() => "");
    throw new Error(message || response.statusText);
  }

  return response.json().catch(() => null);
}

async function saveBrandProfile(values: OnboardingValues) {
  return requestJson("/api/brand-profile", {
    method: "POST",
    body: JSON.stringify({
      brandName: values.brandName.trim(),
      websiteUrl: "",
      storeUrl: "",
      industry: "",
      productDescription: values.productDescription.trim(),
      targetAudience: values.targetAudience.trim(),
      brandTone: values.brandTone.trim(),
      brandKeywords: "",
      forbiddenWords: values.forbiddenExpressions.trim(),
      competitorLinks: "",
      platformPreferences: values.platformPreferences.join("，"),
    }),
  });
}

async function saveBrandMemories(values: OnboardingValues) {
  const memories = [
    {
      memoryType: "BRAND_RULE",
      title: "品牌定位",
      content: `${values.brandName}：${displayValue(values.productDescription)}`,
      importance: 5,
      source: "品牌初始化问卷",
    },
    {
      memoryType: "PREFERENCE",
      title: "目标用户",
      content: displayValue(values.targetAudience),
      importance: 4,
      source: "品牌初始化问卷",
    },
    {
      memoryType: "CONTENT_RULE",
      title: "品牌语气",
      content: displayValue(values.brandTone),
      importance: 4,
      source: "品牌初始化问卷",
    },
    {
      memoryType: "COMPLIANCE_RULE",
      title: "禁用表达",
      content: displayValue(values.forbiddenExpressions),
      importance: 5,
      source: "品牌初始化问卷",
    },
    {
      memoryType: "PLATFORM_INSIGHT",
      title: "主要发布平台",
      content: displayValue(values.platformPreferences),
      importance: 3,
      source: "品牌初始化问卷",
    },
  ].filter((memory) => memory.content !== "稍后补充");

  await Promise.allSettled(
    memories.map((memory) =>
      requestJson("/api/brand-memories", {
        method: "POST",
        body: JSON.stringify(memory),
      }),
    ),
  );
}

export function BrandInterviewOnboarding(_props: Record<string, unknown> = {}) {
  void _props;

  const router = useRouter();
  const [stepIndex, setStepIndex] = useState(0);
  const [values, setValues] = useState<OnboardingValues>(emptyValues);
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const step = steps[stepIndex];
  const isIntro = step.key === "intro";
  const isConfirm = step.key === "confirm";
  const questionStep = Math.min(Math.max(stepIndex, 1), 7);
  const progressPercent = isIntro ? 0 : isConfirm ? 100 : (questionStep / 7) * 100;

  const firstSuggestion = useMemo(() => {
    const task = contentTaskPrompt(values.initialContentTask);

    if (values.initialContentTask === "暂时不确定" || !values.initialContentTask.trim()) {
      return "建议先让云雀根据品牌资料生成 3 个内容方向，再选择一个方向进入创作。";
    }

    return `建议先围绕「${task}」创建一个内容任务，并生成 3 条不同平台版本的文案。`;
  }, [values.initialContentTask]);

  function updateValue(field: keyof OnboardingValues, value: string | string[]) {
    setValues((current) => ({
      ...current,
      [field]: value,
    }));
    setError("");
  }

  function handleOption(option: string) {
    if (!step.field) {
      return;
    }

    if (step.multiple) {
      const selected = values.platformPreferences.includes(option)
        ? values.platformPreferences.filter((item) => item !== option)
        : [...values.platformPreferences, option];
      updateValue("platformPreferences", selected);
      return;
    }

    const field = step.field;
    const currentValue = values[field];

    if (typeof currentValue === "string") {
      updateValue(field, appendChoice(currentValue, option));
    }
  }

  function goNext() {
    if (step.key === "brand" && !values.brandName.trim()) {
      setError("品牌 / 项目名称必填，云雀需要先知道这个品牌是谁。");
      return;
    }

    setStepIndex((current) => Math.min(current + 1, steps.length - 1));
    setError("");
  }

  function goBack() {
    setStepIndex((current) => Math.max(current - 1, 0));
    setError("");
  }

  function skipCurrentStep() {
    if (step.key === "brand") {
      setError("品牌名称是唯一必填项，填写后才能继续。");
      return;
    }

    goNext();
  }

  async function handleSubmit() {
    if (!values.brandName.trim()) {
      setStepIndex(1);
      setError("品牌 / 项目名称必填，云雀需要先知道这个品牌是谁。");
      return;
    }

    setIsSaving(true);
    setError("");

    try {
      await saveBrandProfile(values);
      await saveBrandMemories(values);

      const prompt = contentTaskPrompt(values.initialContentTask);
      const params = new URLSearchParams({
        initialPrompt: prompt,
        prompt,
        source: "brand-onboarding",
      });

      router.push(`/content-studio?${params.toString()}`);
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "保存失败，请稍后重试。",
      );
      setIsSaving(false);
    }
  }

  return (
    <main className="min-h-[calc(100vh-80px)] bg-slate-50 px-4 py-8 text-slate-950 sm:px-6 lg:px-8">
      <section className="mx-auto flex w-full max-w-3xl flex-col gap-6">
        <div className="text-center">
          <p className="text-sm font-medium text-teal-700">品牌初始化访谈</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-normal text-slate-950">
            让云雀认识这个品牌
          </h1>
          <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-slate-600">
            先回答几个关键问题，云雀会把这些信息整理成品牌记忆。之后生成内容、规划任务和给出建议时，都会自动参考。
          </p>
        </div>

        {!isIntro ? (
          <div className="rounded-full bg-white p-1 shadow-sm ring-1 ring-slate-200">
            <div className="flex items-center justify-between px-3 py-2 text-xs font-medium text-slate-500">
              <span>{isConfirm ? "确认品牌记忆" : `第 ${questionStep} / 7 步`}</span>
              <span>{Math.round(progressPercent)}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-teal-700 transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        ) : null}

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-8">
          {isConfirm ? (
            <ConfirmStep values={values} firstSuggestion={firstSuggestion} />
          ) : (
            <QuestionStep
              step={step}
              values={values}
              onChange={updateValue}
              onOption={handleOption}
            />
          )}

          {step.key === "task" && values.initialContentTask === "暂时不确定" ? (
            <p className="mt-4 rounded-xl bg-teal-50 px-4 py-3 text-sm text-teal-800">
              没关系，云雀会先根据品牌资料给你几个内容方向建议。
            </p>
          ) : null}

          {error ? (
            <p className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </p>
          ) : null}

          <div className="mt-8 flex flex-col-reverse gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:items-center sm:justify-between">
            {isIntro ? (
              <span className="text-sm text-slate-500">
                这些信息之后都可以随时修改。
              </span>
            ) : (
              <button
                type="button"
                onClick={goBack}
                className="inline-flex h-10 items-center justify-center rounded-lg border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                {isConfirm ? "返回修改" : "上一步"}
              </button>
            )}

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              {!isIntro && !isConfirm ? (
                <button
                  type="button"
                  onClick={skipCurrentStep}
                  className="inline-flex h-10 items-center justify-center rounded-lg px-4 text-sm font-medium text-slate-500 transition hover:bg-slate-50 hover:text-slate-700"
                >
                  跳过，稍后再补充
                </button>
              ) : null}

              <button
                type="button"
                disabled={isSaving}
                onClick={
                  isConfirm ? handleSubmit : isIntro ? () => setStepIndex(1) : goNext
                }
                className="inline-flex h-10 items-center justify-center rounded-lg bg-teal-700 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSaving
                  ? "保存中..."
                  : isConfirm
                    ? "确认并开始创作"
                    : isIntro
                      ? "开始"
                      : "下一步"}
              </button>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

function QuestionStep({
  step,
  values,
  onChange,
  onOption,
}: {
  step: InterviewStep;
  values: OnboardingValues;
  onChange: (field: keyof OnboardingValues, value: string | string[]) => void;
  onOption: (option: string) => void;
}) {
  const field = step.field;
  const value = field ? values[field] : "";

  return (
    <div>
      <h2 className="text-2xl font-semibold tracking-normal text-slate-950">
        {step.title}
      </h2>
      <p className="mt-3 text-sm leading-6 text-slate-600">{step.description}</p>

      {field && !step.multiple ? (
        <textarea
          value={typeof value === "string" ? value : ""}
          onChange={(event) => onChange(field, event.target.value)}
          placeholder={step.placeholder}
          rows={field === "brandName" ? 2 : 6}
          className="mt-6 w-full resize-none rounded-xl border border-slate-200 bg-white px-4 py-3 text-base leading-7 text-slate-950 shadow-inner outline-none transition placeholder:text-slate-400 focus:border-teal-600 focus:ring-4 focus:ring-teal-100"
        />
      ) : null}

      {field && step.multiple ? (
        <div className="mt-6 flex flex-wrap gap-2">
          {step.options?.map((option) => {
            const active = values.platformPreferences.includes(option);

            return (
              <button
                key={option}
                type="button"
                onClick={() => onOption(option)}
                className={`rounded-full border px-4 py-2 text-sm font-medium transition ${
                  active
                    ? "border-teal-700 bg-teal-700 text-white"
                    : "border-slate-200 bg-slate-50 text-slate-700 hover:border-teal-200 hover:bg-teal-50 hover:text-teal-800"
                }`}
              >
                {option}
              </button>
            );
          })}
        </div>
      ) : null}

      {!step.multiple && step.options?.length ? (
        <div className="mt-5 flex flex-wrap gap-2">
          {step.options.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => onOption(option)}
              className="rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-teal-200 hover:bg-teal-50 hover:text-teal-800"
            >
              {option}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function ConfirmStep({
  values,
  firstSuggestion,
}: {
  values: OnboardingValues;
  firstSuggestion: string;
}) {
  const summaries = [
    {
      title: "品牌定位",
      content: `${displayValue(values.brandName, "未填写品牌名称")}；${displayValue(
        values.productDescription,
      )}`,
    },
    {
      title: "目标用户",
      content: displayValue(values.targetAudience),
    },
    {
      title: "品牌语气",
      content: displayValue(values.brandTone),
    },
    {
      title: "主要平台",
      content: displayValue(values.platformPreferences),
    },
    {
      title: "禁用表达",
      content: displayValue(values.forbiddenExpressions),
    },
    {
      title: "第一步建议",
      content: firstSuggestion,
    },
  ];

  return (
    <div>
      <h2 className="text-2xl font-semibold tracking-normal text-slate-950">
        云雀对这个品牌的初步理解
      </h2>
      <p className="mt-3 text-sm leading-6 text-slate-600">
        下面是根据你刚才的回答整理出的品牌记忆。确认后，云雀会在后续内容任务中自动参考这些信息。
      </p>

      <div className="mt-6 grid gap-3">
        {summaries.map((summary) => (
          <div
            key={summary.title}
            className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-4"
          >
            <p className="text-sm font-semibold text-slate-950">{summary.title}</p>
            <p className="mt-2 text-sm leading-6 text-slate-600">{summary.content}</p>
          </div>
        ))}
      </div>

      <p className="mt-5 rounded-xl bg-teal-50 px-4 py-3 text-sm leading-6 text-teal-800">
        最近先做什么会作为当前内容任务的初始需求带入内容生成页，不会沉淀为长期品牌记忆。
      </p>
    </div>
  );
}
