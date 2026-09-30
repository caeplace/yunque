"use client";

import {
  type DragEvent,
  type FormEvent,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import type {
  ContentStatus,
  ContentType,
  MemoryType,
  Platform,
} from "@prisma/client";
import {
  AlertTriangle,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  Copy,
  Download,
  Eye,
  FilePlus2,
  FileText,
  Loader2,
  MessageSquareText,
  Pencil,
  Save,
  SendHorizontal,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  UploadCloud,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast-provider";
import { getApiErrorMessage, parseApiPayload } from "@/lib/client-api";
import {
  contentStatusLabels,
  contentTypeLabels,
  formatDateTime,
  memoryTypeLabels,
  platformLabels,
} from "@/lib/labels";
import type { ComplianceCheckResult } from "@/lib/prompts/compliance-check";
import { cn } from "@/lib/utils";
import type {
  ContentGenerationFormValues,
  ContentOutputLanguage,
  GeneratedContentVariantValues,
} from "@/lib/validators/content-studio";

type AssetOption = {
  id: string;
  title: string;
  fileName: string | null;
  type: string;
  tags: string[];
  aiDescription: string | null;
  productName: string | null;
  scene: string | null;
};

type RecentContentItem = {
  id: string;
  title: string;
  body: string;
  status: ContentStatus;
  platforms: Platform[];
  type: ContentType;
  hashtags: string[];
  callToAction: string | null;
  createdAt: string;
  riskNotes: ComplianceCheckResult | null;
  assets: Array<{
    id: string;
    title: string;
    fileName: string | null;
  }>;
};

type BrandMemoryOption = {
  id: string;
  type: MemoryType;
  title: string;
  content: string;
  source: string | null;
  importance: number;
  priority: number;
  createdAt: string;
  updatedAt: string;
};

type NoticeState = {
  type: "success" | "error" | "info";
  message: string;
} | null;

type ContentGeneratorProps = {
  workspaceName: string;
  brandName: string | null;
  brandTone: string | null;
  assets: AssetOption[];
  brandMemories: BrandMemoryOption[];
  recentContents: RecentContentItem[];
  initialSelectedAssetIds?: string[];
  initialCreativeBrief?: string;
};

type PlatformChoice = Platform | "AUTO";

type GenerationTurn = {
  id: string;
  taskId: string;
  taskRootPrompt: string;
  turnIndex: number;
  prompt: string;
  assetIds: string[];
  generationForm: ContentGenerationFormValues;
  platformChoice: PlatformChoice;
  variants: GeneratedContentVariantValues[];
  status: "loading" | "done" | "error";
  createdAt: string;
  message?: string;
};

type ContentTaskState = {
  id: string;
  title: string;
  rootPrompt: string;
  createdAt: string;
};

type EditingVariantState = {
  turnId: string;
  index: number;
} | null;

const acceptedFileTypes = [
  "image/*",
  "video/*",
  "application/pdf",
  ".doc",
  ".docx",
  ".ppt",
  ".pptx",
  ".xls",
  ".xlsx",
  ".txt",
  ".md",
  ".csv",
  ".tsv",
].join(",");

const platformOptions = [
  "INSTAGRAM",
  "TIKTOK",
  "FACEBOOK",
  "PINTEREST",
  "LINKEDIN",
  "XIAOHONGSHU",
] as Platform[];

const contentTypeOptions = [
  "POST",
  "CAROUSEL",
  "SHORT_VIDEO_SCRIPT",
  "STORY",
  "AD_COPY",
] as ContentType[];

const outputLanguageOptions = [
  { value: "ZH_CN", label: "中文" },
  { value: "EN_WITH_ZH", label: "英文 + 中文对照" },
] as const;

const outputLanguageLabels: Record<ContentOutputLanguage, string> = {
  ZH_CN: "中文",
  EN_WITH_ZH: "英文 + 中文对照",
};

const defaultForm: ContentGenerationFormValues = {
  platform: "XIAOHONGSHU",
  contentType: "POST",
  marketingGoal: "",
  selectedAssets: [],
  tone: "清爽、可信、克制，像朋友分享真实体验",
  numberOfVariants: 3,
  outputLanguage: "ZH_CN",
  extraInstructions: "",
};

const quickModificationActions = [
  {
    label: "改短一点",
    instruction: "把上一版改短一点，保留核心卖点、自然 CTA 和可直接发布的语气。",
  },
  {
    label: "更适合小红书",
    instruction:
      "把上一版改成更适合小红书的种草表达：真实分享感更强，标题更有收藏价值，标签更贴近小红书。",
    platform: "XIAOHONGSHU" as Platform,
  },
  {
    label: "更像真实分享",
    instruction:
      "把上一版改得更像真实用户分享，减少广告感，增加具体场景、体验细节和可信表达。",
  },
  {
    label: "生成英文版本",
    instruction:
      "基于上一版生成英文版本，并附中文对照；英文要自然，适合海外社媒发布。",
    outputLanguage: "EN_WITH_ZH" as ContentOutputLanguage,
  },
];

function createLocalId() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
}

function isPlatform(value: string): value is Platform {
  return (platformOptions as readonly string[]).includes(value);
}

function isContentType(value: string): value is ContentType {
  return (contentTypeOptions as readonly string[]).includes(value);
}

function isOutputLanguage(value: string): value is ContentOutputLanguage {
  return outputLanguageOptions.some((option) => option.value === value);
}

function validateGenerationForm(
  values: ContentGenerationFormValues,
):
  | { ok: true; data: ContentGenerationFormValues }
  | { ok: false; message: string } {
  const platform = String(values.platform);
  const contentType = String(values.contentType);
  const marketingGoal = values.marketingGoal.trim();
  const tone = values.tone.trim();
  const extraInstructions = values.extraInstructions.trim();
  const numberOfVariants = Number(values.numberOfVariants);
  const selectedAssets = values.selectedAssets.filter(Boolean).slice(0, 12);
  const outputLanguage = String(values.outputLanguage);

  if (!isPlatform(platform)) {
    return { ok: false, message: "请选择生成平台。" };
  }

  if (!isContentType(contentType)) {
    return { ok: false, message: "请选择内容类型。" };
  }

  if (marketingGoal.length < 2) {
    return { ok: false, message: "请先描述你想生成什么内容。" };
  }

  if (marketingGoal.length > 1200) {
    return { ok: false, message: "创作需求最多 1200 个字。" };
  }

  if (
    !Number.isInteger(numberOfVariants) ||
    numberOfVariants < 1 ||
    numberOfVariants > 5
  ) {
    return { ok: false, message: "生成数量需要在 1 到 5 之间。" };
  }

  if (tone.length > 120) {
    return { ok: false, message: "语气描述最多 120 个字。" };
  }

  if (extraInstructions.length > 1000) {
    return { ok: false, message: "额外要求最多 1000 个字。" };
  }

  if (!isOutputLanguage(outputLanguage)) {
    return { ok: false, message: "请选择输出语言。" };
  }

  return {
    ok: true,
    data: {
      platform,
      contentType,
      marketingGoal,
      selectedAssets,
      tone,
      numberOfVariants,
      outputLanguage,
      extraInstructions,
    },
  };
}

function getAssetName(asset: AssetOption) {
  return asset.fileName ?? asset.title;
}

function getRiskBadgeVariant(riskLevel?: "low" | "medium" | "high") {
  if (riskLevel === "high") return "default";
  if (riskLevel === "medium") return "accent";
  return "secondary";
}

function getRiskLabel(riskLevel?: "low" | "medium" | "high") {
  if (riskLevel === "high") return "高风险";
  if (riskLevel === "medium") return "中风险";
  if (riskLevel === "low") return "低风险";
  return "未检查";
}

function getDefaultCalendarValue() {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  date.setHours(10, 0, 0, 0);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function inferPlatformFromBrief(brief: string): Platform | null {
  const text = brief.toLowerCase();

  if (text.includes("instagram") || text.includes("ins") || text.includes("ig")) {
    return "INSTAGRAM";
  }

  if (text.includes("tiktok") || text.includes("抖音")) {
    return "TIKTOK";
  }

  if (text.includes("facebook") || text.includes("fb")) {
    return "FACEBOOK";
  }

  if (text.includes("pinterest")) {
    return "PINTEREST";
  }

  if (text.includes("linkedin") || text.includes("领英")) {
    return "LINKEDIN";
  }

  if (
    text.includes("小红书") ||
    text.includes("xiaohongshu") ||
    text.includes("red book") ||
    text.includes("rednote")
  ) {
    return "XIAOHONGSHU";
  }

  return null;
}

function formatVariantText(variant: GeneratedContentVariantValues) {
  const tags =
    variant.hashtags.length > 0 ? `\n\n${variant.hashtags.join(" ")}` : "";

  return `${variant.title}\n\n${variant.hook}\n\n${variant.body}\n\n${variant.cta}${tags}`;
}

function normalizePublishTag(tag: string) {
  const trimmed = tag.trim();

  if (!trimmed) return null;

  return trimmed.startsWith("#") ? trimmed : `#${trimmed}`;
}

function getPublishTags(variant: GeneratedContentVariantValues) {
  return variant.hashtags
    .map(normalizePublishTag)
    .filter((tag): tag is string => Boolean(tag))
    .join(" ");
}

function getPublishBody(variant: GeneratedContentVariantValues) {
  return [variant.hook, variant.body].filter(Boolean).join("\n\n");
}

function formatPublishText(variant: GeneratedContentVariantValues) {
  const tags = getPublishTags(variant);

  return [
    `标题：\n${variant.title}`,
    `正文：\n${getPublishBody(variant)}`,
    `标签：\n${tags || "无"}`,
    `CTA：\n${variant.cta}`,
  ].join("\n\n");
}

function formatPublishMarkdown(variant: GeneratedContentVariantValues) {
  const tags = getPublishTags(variant);

  return [
    `# ${variant.title}`,
    `## 正文\n\n${getPublishBody(variant)}`,
    `## 标签\n\n${tags || "无"}`,
    `## CTA\n\n${variant.cta}`,
  ].join("\n\n");
}

function sanitizeExportFileName(value: string) {
  return (
    value
      .replace(/[<>:"/\\|?*\u0000-\u001F]/g, "")
      .replace(/\s+/g, "-")
      .slice(0, 60) || "generated-content"
  );
}

function downloadTextFile(fileName: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: `${mimeType};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function normalizeCreatedMemory(value: unknown): BrandMemoryOption | null {
  if (!value || typeof value !== "object") return null;

  const record = value as Record<string, unknown>;

  if (
    typeof record.id !== "string" ||
    typeof record.title !== "string" ||
    typeof record.content !== "string" ||
    typeof record.type !== "string" ||
    !(record.type in memoryTypeLabels)
  ) {
    return null;
  }

  return {
    id: record.id,
    type: record.type as MemoryType,
    title: record.title,
    content: record.content,
    source: typeof record.source === "string" ? record.source : null,
    importance:
      typeof record.importance === "number" ? record.importance : 7,
    priority: typeof record.priority === "number" ? record.priority : 7,
    createdAt:
      typeof record.createdAt === "string"
        ? record.createdAt
        : new Date().toISOString(),
    updatedAt:
      typeof record.updatedAt === "string"
        ? record.updatedAt
        : new Date().toISOString(),
  };
}

function getAssetHint(asset: AssetOption) {
  if (asset.productName || asset.scene) {
    return [asset.productName, asset.scene].filter(Boolean).join(" · ");
  }

  if (asset.aiDescription) return asset.aiDescription;
  if (asset.tags.length > 0) return asset.tags.slice(0, 4).join("，");
  return "未分析素材";
}

function getVariantKey(turnId: string, index: number) {
  return `${turnId}:${index}`;
}

function getTaskTitle(prompt: string) {
  const normalized = prompt.replace(/\s+/g, " ").trim();

  if (!normalized) return "新的内容任务";

  return normalized.length > 34 ? `${normalized.slice(0, 34)}...` : normalized;
}

function buildContinuationPrompt(
  rootPrompt: string,
  previousDraft: string,
  instruction: string,
) {
  return [
    `当前内容任务：${rootPrompt.replace(/\s+/g, " ").slice(0, 360)}`,
    `上一版内容摘要：\n${previousDraft.slice(0, 520)}`,
    `继续修改要求：${instruction}`,
  ]
    .join("\n\n")
    .slice(0, 1200);
}

function extractPreferenceFromPrompt(prompt: string) {
  const marker = "继续修改要求：";
  const markerIndex = prompt.lastIndexOf(marker);

  if (markerIndex >= 0) {
    const preference = prompt.slice(markerIndex + marker.length).trim();
    if (preference) return preference;
  }

  return prompt.trim();
}

function normalizeUploadedAsset(value: unknown): AssetOption | null {
  if (!value || typeof value !== "object") return null;

  const record = value as Record<string, unknown>;

  if (typeof record.id !== "string" || typeof record.title !== "string") {
    return null;
  }

  return {
    id: record.id,
    title: record.title,
    fileName: typeof record.fileName === "string" ? record.fileName : null,
    type: typeof record.type === "string" ? record.type : "DOCUMENT",
    tags: Array.isArray(record.tags)
      ? record.tags.filter((tag): tag is string => typeof tag === "string")
      : [],
    aiDescription:
      typeof record.aiDescription === "string" ? record.aiDescription : null,
    productName:
      typeof record.productName === "string" ? record.productName : null,
    scene: typeof record.scene === "string" ? record.scene : null,
  };
}

export function ContentGenerator({
  workspaceName,
  brandName,
  brandTone,
  assets,
  brandMemories,
  recentContents,
  initialSelectedAssetIds = [],
  initialCreativeBrief = "",
}: ContentGeneratorProps) {
  const router = useRouter();
  const { showToast } = useToast();
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [composerText, setComposerText] = useState(initialCreativeBrief);
  const [platformChoice, setPlatformChoice] = useState<PlatformChoice>("AUTO");
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [assetDialogOpen, setAssetDialogOpen] = useState(false);
  const [assetSearch, setAssetSearch] = useState("");
  const [uploadedAssets, setUploadedAssets] = useState<AssetOption[]>([]);
  const [memoryItems, setMemoryItems] =
    useState<BrandMemoryOption[]>(brandMemories);
  const [selectedMemory, setSelectedMemory] =
    useState<BrandMemoryOption | null>(null);
  const [memoryDialogOpen, setMemoryDialogOpen] = useState(false);
  const [memoryDraft, setMemoryDraft] = useState("");
  const [memoryTitle, setMemoryTitle] = useState("");
  const [isSavingMemory, setIsSavingMemory] = useState(false);
  const [form, setForm] = useState<ContentGenerationFormValues>(() => {
    const availableAssetIds = new Set(assets.map((asset) => asset.id));
    const selectedAssets = initialSelectedAssetIds
      .filter((assetId) => availableAssetIds.has(assetId))
      .slice(0, 12);

    return {
      ...defaultForm,
      selectedAssets,
    };
  });
  const [task, setTask] = useState<ContentTaskState | null>(null);
  const [turns, setTurns] = useState<GenerationTurn[]>([]);
  const [notice, setNotice] = useState<NoticeState>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [savedKeys, setSavedKeys] = useState<string[]>([]);
  const [savedContentIds, setSavedContentIds] = useState<Record<string, string>>(
    {},
  );
  const [detailsContent, setDetailsContent] = useState<RecentContentItem | null>(
    null,
  );
  const [editingContent, setEditingContent] = useState<RecentContentItem | null>(
    null,
  );
  const [editingVariant, setEditingVariant] =
    useState<EditingVariantState>(null);
  const [calendarContent, setCalendarContent] = useState<RecentContentItem | null>(
    null,
  );
  const [editTitle, setEditTitle] = useState("");
  const [editBody, setEditBody] = useState("");
  const [variantEditTitle, setVariantEditTitle] = useState("");
  const [variantEditBody, setVariantEditBody] = useState("");
  const [calendarScheduledAt, setCalendarScheduledAt] = useState(
    getDefaultCalendarValue,
  );
  const [calendarOwnerName, setCalendarOwnerName] = useState("");
  const [calendarNotes, setCalendarNotes] = useState("");
  const [actionContentId, setActionContentId] = useState<string | null>(null);

  const availableAssets = useMemo(() => {
    const assetMap = new Map<string, AssetOption>();

    for (const asset of assets) {
      assetMap.set(asset.id, asset);
    }

    for (const asset of uploadedAssets) {
      assetMap.set(asset.id, asset);
    }

    return [...assetMap.values()];
  }, [assets, uploadedAssets]);

  const selectedAssetDetails = useMemo(
    () =>
      availableAssets.filter((asset) => form.selectedAssets.includes(asset.id)),
    [availableAssets, form.selectedAssets],
  );

  const filteredAssets = useMemo(() => {
    const keyword = assetSearch.trim().toLowerCase();

    if (!keyword) return availableAssets;

    return availableAssets.filter((asset) => {
      const haystack = [
        asset.title,
        asset.fileName,
        asset.type,
        asset.productName,
        asset.scene,
        asset.tags.join(" "),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(keyword);
    });
  }, [assetSearch, availableAssets]);

  const referencedMemories = useMemo(
    () =>
      [...memoryItems]
        .sort((a, b) => {
          if (b.importance !== a.importance) return b.importance - a.importance;
          if (b.priority !== a.priority) return b.priority - a.priority;
          return (
            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
          );
        })
        .slice(0, 5),
    [memoryItems],
  );

  const latestDoneTurn = useMemo(
    () =>
      [...turns]
        .reverse()
        .find((turn) => turn.status === "done" && turn.variants.length > 0) ??
      null,
    [turns],
  );

  function notify(
    type: "success" | "error" | "info",
    title: string,
    message: string,
  ) {
    setNotice({ type, message });
    showToast({ type, title, description: message });
  }

  function updateForm<K extends keyof ContentGenerationFormValues>(
    key: K,
    value: ContentGenerationFormValues[K],
  ) {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function handlePlatformChoiceChange(value: string) {
    const nextChoice = value as PlatformChoice;
    setPlatformChoice(nextChoice);

    if (nextChoice !== "AUTO") {
      updateForm("platform", nextChoice);
    }
  }

  function toggleAsset(assetId: string) {
    setForm((current) => {
      const exists = current.selectedAssets.includes(assetId);
      return {
        ...current,
        selectedAssets: exists
          ? current.selectedAssets.filter((id) => id !== assetId)
          : [...current.selectedAssets, assetId].slice(0, 12),
      };
    });
  }

  function buildTaskContext(turn: GenerationTurn) {
    const history = turns
      .filter((item) => item.taskId === turn.taskId)
      .map((item) => ({
        prompt: item.prompt.slice(0, 1200),
        createdAt: item.createdAt,
      }));

    if (!history.some((item) => item.createdAt === turn.createdAt)) {
      history.push({
        prompt: turn.prompt.slice(0, 1200),
        createdAt: turn.createdAt,
      });
    }

    return {
      taskId: turn.taskId,
      rootPrompt: turn.taskRootPrompt.slice(0, 1200),
      turnPrompt: turn.prompt.slice(0, 1200),
      turnIndex: turn.turnIndex,
      modificationHistory: history.slice(-20),
    };
  }

  function resetContentTask() {
    if (isGenerating) return;

    setTask(null);
    setTurns([]);
    setComposerText("");
    setSavedKeys([]);
    setSavedContentIds({});
    setNotice(null);
    window.setTimeout(() => composerRef.current?.focus(), 0);
  }

  function openMemoryPreferenceDialog(initialContent?: string) {
    const latestModificationTurn =
      [...turns].reverse().find((turn) => turn.turnIndex > 1) ?? null;
    const sourceContent =
      initialContent?.trim() ||
      composerText.trim() ||
      latestModificationTurn?.prompt.trim() ||
      "";

    setMemoryTitle("内容修改偏好");
    setMemoryDraft(extractPreferenceFromPrompt(sourceContent));
    setMemoryDialogOpen(true);
  }

  async function handleSaveMemoryPreference() {
    const content = memoryDraft.trim();

    if (content.length < 2) {
      notify("error", "还缺一点信息", "请先填写要保存的偏好。");
      return;
    }

    setIsSavingMemory(true);

    try {
      const response = await fetch("/api/brand-memories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          memoryType: "PREFERENCE",
          title: memoryTitle.trim(),
          content,
          source: "Content Studio 修改偏好",
          importance: 7,
        }),
      });
      const payload = await parseApiPayload(response);

      if (!response.ok) {
        notify(
          "error",
          "保存失败",
          getApiErrorMessage(payload, "品牌记忆保存失败，请稍后再试。"),
        );
        return;
      }

      const memory = normalizeCreatedMemory(payload.memory);

      if (memory) {
        setMemoryItems((current) => [memory, ...current]);
      }

      setMemoryDialogOpen(false);
      setMemoryDraft("");
      setMemoryTitle("");
      notify("success", "已保存为品牌记忆", "后续内容生成会参考这条偏好。");
      router.refresh();
    } catch {
      notify("error", "保存失败", "网络暂时不可用，品牌记忆保存失败。");
    } finally {
      setIsSavingMemory(false);
    }
  }

  function addUploadedAssetsToContext(nextAssets: AssetOption[]) {
    if (nextAssets.length === 0) return;

    setUploadedAssets((current) => {
      const assetMap = new Map(current.map((asset) => [asset.id, asset]));

      for (const asset of nextAssets) {
        assetMap.set(asset.id, asset);
      }

      return [...assetMap.values()];
    });

    setForm((current) => ({
      ...current,
      selectedAssets: [
        ...new Set([...current.selectedAssets, ...nextAssets.map((asset) => asset.id)]),
      ].slice(0, 12),
    }));
  }

  function buildGenerationValues(
    promptText: string,
    options: {
      formOverride?: Partial<ContentGenerationFormValues>;
      platformChoiceOverride?: PlatformChoice;
    } = {},
  ) {
    const nextForm = {
      ...form,
      ...options.formOverride,
    };
    const nextPlatformChoice =
      options.platformChoiceOverride ?? platformChoice;
    const userBrief = promptText.trim();
    const advancedGoal = nextForm.marketingGoal.trim();
    const marketingGoal = [
      userBrief,
      advancedGoal ? `补充营销目标：${advancedGoal}` : "",
    ]
      .filter(Boolean)
      .join("\n\n");
    const inferredPlatform =
      nextPlatformChoice === "AUTO"
        ? inferPlatformFromBrief(userBrief) ?? nextForm.platform
        : nextPlatformChoice;
    const helperNotes = [
      nextPlatformChoice === "AUTO"
        ? "用户没有手动固定平台。请根据需求和品牌资料判断最适合的平台；如果需求没有明确平台，请生成适合多平台复用的通用社媒版本，并在 platformNotes 中说明推荐平台。"
        : "",
      nextForm.selectedAssets.length === 0
        ? "用户没有选择素材。请基于品牌档案和品牌记忆生成，并让素材建议保持通用、可执行。"
        : "",
    ].filter(Boolean);
    const extraInstructions = [nextForm.extraInstructions.trim(), ...helperNotes]
      .filter(Boolean)
      .join("\n\n");

    return validateGenerationForm({
      ...nextForm,
      platform: inferredPlatform,
      marketingGoal,
      extraInstructions,
    });
  }

  async function uploadFiles(files: File[]) {
    if (files.length === 0 || isUploading) return;

    setIsUploading(true);
    setNotice({
      type: "info",
      message: "正在上传素材，上传完成后会自动加入当前创作上下文。",
    });

    try {
      const formData = new FormData();
      const batchName = `内容生成上传 ${new Intl.DateTimeFormat("zh-CN", {
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date())}`;

      formData.append("name", batchName);
      formData.append("tags", "内容生成");
      for (const file of files) {
        formData.append("files", file);
      }

      const response = await fetch("/api/assets/upload", {
        method: "POST",
        body: formData,
      });
      const payload = await parseApiPayload(response);

      if (!response.ok) {
        notify(
          "error",
          "上传失败",
          getApiErrorMessage(payload, "素材上传失败，请稍后再试。"),
        );
        return;
      }

      const nextAssets = Array.isArray(payload.assets)
        ? (payload.assets as unknown[])
            .map(normalizeUploadedAsset)
            .filter((asset): asset is AssetOption => Boolean(asset))
        : [];

      addUploadedAssetsToContext(nextAssets);
      notify(
        "success",
        "上传完成",
        nextAssets.length > 0
          ? `已上传并选中 ${nextAssets.length} 个素材。`
          : "素材已上传，页面会刷新后显示。",
      );
      router.refresh();
    } catch {
      notify("error", "上传失败", "网络暂时不可用，素材上传失败。");
    } finally {
      setIsUploading(false);
      setIsDragging(false);
    }
  }

  function handleDrop(event: DragEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsDragging(false);
    const files = Array.from(event.dataTransfer.files ?? []);
    void uploadFiles(files);
  }

  async function submitGeneration(
    promptText: string,
    options: {
      formOverride?: Partial<ContentGenerationFormValues>;
      platformChoiceOverride?: PlatformChoice;
    } = {},
  ) {
    if (isGenerating) return;

    const normalizedPrompt = promptText.trim();
    const parsed = buildGenerationValues(normalizedPrompt, options);

    if (!parsed.ok) {
      notify("error", "还缺一点信息", parsed.message);
      return;
    }

    const startedAt = new Date().toISOString();
    const activeTask =
      task ??
      ({
        id: createLocalId(),
        title: getTaskTitle(normalizedPrompt),
        rootPrompt: normalizedPrompt,
        createdAt: startedAt,
      } satisfies ContentTaskState);
    const turnIndex =
      turns.filter((turnItem) => turnItem.taskId === activeTask.id).length + 1;
    const selectedAssetIds = [...parsed.data.selectedAssets];
    const nextPlatformChoice =
      options.platformChoiceOverride ?? platformChoice;
    const turn: GenerationTurn = {
      id: createLocalId(),
      taskId: activeTask.id,
      taskRootPrompt: activeTask.rootPrompt,
      turnIndex,
      prompt: normalizedPrompt,
      assetIds: selectedAssetIds,
      generationForm: parsed.data,
      platformChoice: nextPlatformChoice,
      variants: [],
      status: "loading",
      createdAt: startedAt,
    };

    if (!task) {
      setTask(activeTask);
    }

    if (selectedAssetIds.length === 0) {
      setNotice({
        type: "info",
        message: "当前没有选择素材；可以直接生成，添加素材后内容会更贴合具体产品。",
      });
    } else {
      setNotice({
        type: "info",
        message: "正在生成内容并进行合规检查，通常需要 10-30 秒。",
      });
    }

    setTurns((current) => [...current, turn]);
    setComposerText("");
    setIsGenerating(true);

    try {
      const response = await fetch("/api/content-studio/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });
      const payload = await parseApiPayload(response);

      if (!response.ok) {
        const message = getApiErrorMessage(
          payload,
          "内容生成失败，请稍后再试。",
        );
        setTurns((current) =>
          current.map((item) =>
            item.id === turn.id ? { ...item, status: "error", message } : item,
          ),
        );
        notify("error", "生成失败", message);
        return;
      }

      const nextVariants = Array.isArray(payload.variants)
        ? payload.variants
        : [];

      if (nextVariants.length === 0) {
        const message = "AI 没有返回可展示的内容，请调整需求后重试。";
        setTurns((current) =>
          current.map((item) =>
            item.id === turn.id ? { ...item, status: "error", message } : item,
          ),
        );
        notify("error", "生成失败", message);
        return;
      }

      setTurns((current) =>
        current.map((item) =>
          item.id === turn.id
            ? {
                ...item,
                status: "done",
                variants: nextVariants,
                message:
                  typeof payload.message === "string"
                    ? payload.message
                    : "内容已生成。",
              }
            : item,
        ),
      );
      notify(
        "success",
        "生成完成",
        typeof payload.message === "string" ? payload.message : "内容已生成。",
      );
    } catch {
      const message = "网络暂时不可用，内容生成失败。";
      setTurns((current) =>
        current.map((item) =>
          item.id === turn.id ? { ...item, status: "error", message } : item,
        ),
      );
      notify("error", "生成失败", message);
    } finally {
      setIsGenerating(false);
    }
  }

  async function handleGenerate(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();

    const promptText =
      composerText.trim() ||
      (form.selectedAssets.length > 0
        ? "请基于已选素材生成一条适合社媒发布的内容。"
        : "");

    await submitGeneration(promptText);
  }

  async function handleQuickModification(
    action: (typeof quickModificationActions)[number],
  ) {
    if (isGenerating) return;

    const sourceTurn = latestDoneTurn;
    const sourceVariant = sourceTurn?.variants[0];

    if (!sourceTurn || !sourceVariant) {
      notify("info", "先生成一版内容", "有了第一版后，就可以继续让云雀修改。");
      return;
    }

    const promptText = buildContinuationPrompt(
      task?.rootPrompt ?? sourceTurn.taskRootPrompt,
      formatVariantText(sourceVariant),
      action.instruction,
    );
    const formOverride: Partial<ContentGenerationFormValues> = {};
    let platformChoiceOverride: PlatformChoice | undefined;

    if (action.platform) {
      formOverride.platform = action.platform;
      platformChoiceOverride = action.platform;
      setPlatformChoice(action.platform);
      updateForm("platform", action.platform);
    }

    if (action.outputLanguage) {
      formOverride.outputLanguage = action.outputLanguage;
      updateForm("outputLanguage", action.outputLanguage);
    }

    await submitGeneration(promptText, {
      formOverride,
      platformChoiceOverride,
    });
  }

  async function handleSave(
    variant: GeneratedContentVariantValues,
    index: number,
    turn: GenerationTurn,
  ) {
    const key = getVariantKey(turn.id, index);
    setNotice(null);
    setSavingKey(key);

    try {
      const response = await fetch("/api/content-studio/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...turn.generationForm,
          variant,
          taskContext: buildTaskContext(turn),
        }),
      });
      const payload = await parseApiPayload(response);

      if (!response.ok) {
        notify(
          "error",
          "保存失败",
          getApiErrorMessage(payload, "保存失败，请稍后再试。"),
        );
        return;
      }

      const contentId =
        payload.content && typeof payload.content.id === "string"
          ? payload.content.id
          : null;

      setSavedKeys((current) => [...new Set([...current, key])]);
      if (contentId) {
        setSavedContentIds((current) => ({ ...current, [key]: contentId }));
      }
      notify(
        "success",
        "保存成功",
        typeof payload.message === "string" ? payload.message : "内容已保存。",
      );
      router.refresh();
    } catch {
      notify("error", "保存失败", "网络暂时不可用，内容保存失败。");
    } finally {
      setSavingKey(null);
    }
  }

  async function handleCopy(content: RecentContentItem) {
    try {
      await navigator.clipboard.writeText(content.body);
      notify("success", "复制成功", "正文已复制。");
    } catch {
      notify("error", "复制失败", "请手动选中正文复制。");
    }
  }

  async function handleCopyVariant(variant: GeneratedContentVariantValues) {
    try {
      await navigator.clipboard.writeText(formatVariantText(variant));
      notify("success", "复制成功", "生成内容已复制。");
    } catch {
      notify("error", "复制失败", "请手动选中内容复制。");
    }
  }

  async function handleCopyPublishVariant(
    variant: GeneratedContentVariantValues,
  ) {
    try {
      await navigator.clipboard.writeText(formatPublishText(variant));
      notify("success", "复制成功", "已复制可直接发布的格式。");
    } catch {
      notify("error", "复制失败", "请手动选中内容复制。");
    }
  }

  function handleExportVariant(
    variant: GeneratedContentVariantValues,
    format: "markdown" | "txt",
  ) {
    const baseName = sanitizeExportFileName(variant.title);

    if (format === "markdown") {
      downloadTextFile(
        `${baseName}.md`,
        formatPublishMarkdown(variant),
        "text/markdown",
      );
      notify("success", "导出完成", "Markdown 文件已下载。");
      return;
    }

    downloadTextFile(`${baseName}.txt`, formatPublishText(variant), "text/plain");
    notify("success", "导出完成", "TXT 文件已下载。");
  }

  function openEdit(content: RecentContentItem) {
    setEditingContent(content);
    setEditTitle(content.title);
    setEditBody(content.body);
  }

  function openVariantEdit(
    variant: GeneratedContentVariantValues,
    turnId: string,
    index: number,
  ) {
    setEditingVariant({ turnId, index });
    setVariantEditTitle(variant.title);
    setVariantEditBody(variant.body);
  }

  function handleUpdateVariant() {
    if (!editingVariant) return;

    setTurns((current) =>
      current.map((turn) =>
        turn.id === editingVariant.turnId
          ? {
              ...turn,
              variants: turn.variants.map((variant, index) =>
                index === editingVariant.index
                  ? {
                      ...variant,
                      title: variantEditTitle.trim() || variant.title,
                      body: variantEditBody.trim() || variant.body,
                    }
                  : variant,
              ),
            }
          : turn,
      ),
    );
    setEditingVariant(null);
    notify("success", "已更新", "生成结果已在当前页面更新，保存后会写入内容库。");
  }

  function openCalendar(content: RecentContentItem) {
    setCalendarContent(content);
    setCalendarScheduledAt(getDefaultCalendarValue());
    setCalendarOwnerName("");
    setCalendarNotes("");
  }

  function openGeneratedVariantCalendar(
    variant: GeneratedContentVariantValues,
    index: number,
    turn: GenerationTurn,
  ) {
    const key = getVariantKey(turn.id, index);
    const contentId = savedContentIds[key];

    if (!contentId) {
      notify("info", "先保存内容", "保存到内容库后，就可以加入内容日历。");
      return;
    }

    const assetsForTurn = availableAssets.filter((asset) =>
      turn.assetIds.includes(asset.id),
    );

    openCalendar({
      id: contentId,
      title: variant.title,
      body: `${variant.hook}\n\n${variant.body}`,
      status: "DRAFT",
      platforms: [turn.generationForm.platform],
      type: turn.generationForm.contentType,
      hashtags: variant.hashtags,
      callToAction: variant.cta,
      createdAt: new Date().toISOString(),
      riskNotes: variant.complianceCheck ?? null,
      assets: assetsForTurn.map((asset) => ({
        id: asset.id,
        title: asset.title,
        fileName: asset.fileName,
      })),
    });
  }

  function continueFromVariant(
    variant: GeneratedContentVariantValues,
    turn: GenerationTurn,
  ) {
    const promptText = buildContinuationPrompt(
      turn.taskRootPrompt,
      formatVariantText(variant),
      "",
    );

    setComposerText(promptText);
    window.setTimeout(() => composerRef.current?.focus(), 0);
  }

  async function handleUpdateContent() {
    if (!editingContent) return;

    setNotice(null);
    setActionContentId(editingContent.id);

    try {
      const response = await fetch(`/api/content-studio/${editingContent.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: editTitle,
          body: editBody,
        }),
      });
      const payload = await parseApiPayload(response);

      if (!response.ok) {
        notify(
          "error",
          "更新失败",
          getApiErrorMessage(payload, "更新失败，请稍后再试。"),
        );
        return;
      }

      setEditingContent(null);
      notify(
        "success",
        "更新成功",
        typeof payload.message === "string" ? payload.message : "内容已更新。",
      );
      router.refresh();
    } catch {
      notify("error", "更新失败", "网络暂时不可用，内容更新失败。");
    } finally {
      setActionContentId(null);
    }
  }

  async function handleDeleteContent(content: RecentContentItem) {
    if (!window.confirm(`确定删除「${content.title}」吗？`)) return;

    setNotice(null);
    setActionContentId(content.id);

    try {
      const response = await fetch(`/api/content-studio/${content.id}`, {
        method: "DELETE",
      });
      const payload = await parseApiPayload(response);

      if (!response.ok) {
        notify(
          "error",
          "删除失败",
          getApiErrorMessage(payload, "删除失败，请稍后再试。"),
        );
        return;
      }

      notify(
        "success",
        "删除成功",
        typeof payload.message === "string" ? payload.message : "内容已删除。",
      );
      router.refresh();
    } catch {
      notify("error", "删除失败", "网络暂时不可用，内容删除失败。");
    } finally {
      setActionContentId(null);
    }
  }

  async function handleAddToCalendar() {
    if (!calendarContent) return;

    setNotice(null);
    setActionContentId(calendarContent.id);

    try {
      const response = await fetch(
        `/api/content-studio/${calendarContent.id}/calendar`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            scheduledAt: new Date(calendarScheduledAt).toISOString(),
            ownerName: calendarOwnerName,
            notes: calendarNotes,
          }),
        },
      );
      const payload = await parseApiPayload(response);

      if (!response.ok) {
        notify(
          "error",
          "加入日历失败",
          getApiErrorMessage(payload, "加入日历失败，请稍后再试。"),
        );
        return;
      }

      setCalendarContent(null);
      notify(
        "success",
        "已加入日历",
        typeof payload.message === "string"
          ? payload.message
          : "已加入内容日历。",
      );
      router.refresh();
    } catch {
      notify("error", "加入日历失败", "网络暂时不可用，加入日历失败。");
    } finally {
      setActionContentId(null);
    }
  }

  function renderVariantCard(
    variant: GeneratedContentVariantValues,
    index: number,
    turn: GenerationTurn,
  ) {
    const key = getVariantKey(turn.id, index);
    const isSaved = savedKeys.includes(key);
    const riskLevel = variant.complianceCheck?.riskLevel;

    return (
      <div
        key={key}
        className={cn(
          "rounded-md border bg-background p-4 shadow-sm",
          riskLevel === "high" && "border-destructive/40 bg-destructive/5",
        )}
      >
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="mb-2 flex flex-wrap gap-1.5">
              <Badge variant="outline">
                {turn.platformChoice === "AUTO"
                  ? `AI 推荐 · ${platformLabels[turn.generationForm.platform]}`
                  : platformLabels[turn.generationForm.platform]}
              </Badge>
              <Badge variant="secondary">
                {contentTypeLabels[turn.generationForm.contentType]}
              </Badge>
              <Badge variant="outline">
                {outputLanguageLabels[turn.generationForm.outputLanguage]}
              </Badge>
              <Badge
                variant={getRiskBadgeVariant(riskLevel)}
                className={
                  riskLevel === "high"
                    ? "bg-destructive text-destructive-foreground"
                    : ""
                }
              >
                {getRiskLabel(riskLevel)}
              </Badge>
            </div>
            <h3 className="text-base font-semibold leading-6">{variant.title}</h3>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <Badge variant="outline" className="gap-1">
                <CheckCircle2 className="size-3" />
                已参考品牌档案
              </Badge>
              <Badge variant="outline" className="gap-1">
                <CheckCircle2 className="size-3" />
                已参考素材 {turn.assetIds.length}
              </Badge>
              <Badge variant="outline" className="gap-1">
                <CheckCircle2 className="size-3" />
                已参考品牌记忆 {referencedMemories.length}
              </Badge>
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => handleCopyVariant(variant)}
            >
              <Copy className="size-4" />
              复制
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => handleCopyPublishVariant(variant)}
            >
              <Copy className="size-4" />
              发布格式复制
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => handleExportVariant(variant, "markdown")}
            >
              <Download className="size-4" />
              导出 MD
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => handleExportVariant(variant, "txt")}
            >
              <Download className="size-4" />
              导出 TXT
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => openVariantEdit(variant, turn.id, index)}
            >
              <Pencil className="size-4" />
              编辑
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={savingKey === key}
              onClick={() => handleSave(variant, index, turn)}
            >
              {savingKey === key ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Save className="size-4" />
              )}
              {isSaved ? "已保存" : "保存"}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => openGeneratedVariantCalendar(variant, index, turn)}
            >
              <CalendarDays className="size-4" />
              加入日历
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => continueFromVariant(variant, turn)}
            >
              <MessageSquareText className="size-4" />
              继续修改
            </Button>
          </div>
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_16rem]">
          <div className="space-y-4">
            <div>
              <p className="text-xs font-medium text-muted-foreground">开头钩子</p>
              <p className="mt-2 text-sm leading-7">{variant.hook}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">正文</p>
              <p className="mt-2 whitespace-pre-line text-sm leading-7">
                {variant.body}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">CTA</p>
              <p className="mt-2 text-sm leading-7">{variant.cta}</p>
            </div>
          </div>
          <div className="rounded-md bg-muted/35 p-4">
            <p className="text-sm font-medium">标签</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {variant.hashtags.length > 0 ? (
                variant.hashtags.map((tag) => (
                  <Badge key={tag} variant="outline">
                    {tag}
                  </Badge>
                ))
              ) : (
                <span className="text-xs text-muted-foreground">暂无标签</span>
              )}
            </div>
            <div className="mt-4 border-t pt-4">
              <p className="text-sm font-medium">建议使用的素材</p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {variant.visualSuggestion}
              </p>
            </div>
            <div className="mt-4 border-t pt-4">
              <p className="text-sm font-medium">风险提示</p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {variant.complianceCheck?.overallSuggestion ?? "暂无合规检查结果。"}
              </p>
              {riskLevel === "high" &&
              variant.complianceCheck?.issues.length ? (
                <p className="mt-2 text-xs leading-5 text-muted-foreground">
                  主要问题：{variant.complianceCheck.issues[0]?.reason}
                </p>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-4">
      <div className="rounded-lg border bg-card px-4 py-3 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="min-w-0">
            <p className="text-xs uppercase text-muted-foreground">
              Content Studio
            </p>
            <h1 className="mt-1 truncate text-xl font-semibold tracking-normal">
              {brandName ?? "未填写品牌名称"}
            </h1>
            <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
              {brandTone || "默认使用清爽、可信、克制的表达。"}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary">工作区：{workspaceName}</Badge>
            <Badge variant="outline">已选素材 {selectedAssetDetails.length}</Badge>
            {task ? (
              <Badge variant="outline">任务已进行 {turns.length} 轮</Badge>
            ) : null}
          </div>
        </div>
        {task ? (
          <div className="mt-3 flex flex-col gap-3 rounded-md border bg-muted/25 p-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="text-xs font-medium text-muted-foreground">
                当前内容任务
              </p>
              <p className="mt-1 truncate text-sm font-medium">{task.title}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                创建于 {formatDateTime(new Date(task.createdAt))}
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={resetContentTask}
              disabled={isGenerating}
            >
              新任务
            </Button>
          </div>
        ) : null}
        <div className="mt-3 rounded-md border bg-background/70 p-3">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium">本次参考的品牌记忆</p>
              <p className="text-xs text-muted-foreground">
                默认取高重要度的长期偏好、规则和平台经验，生成时作为上下文参考。
              </p>
            </div>
            <Badge variant="secondary">{referencedMemories.length} 条</Badge>
          </div>
          {referencedMemories.length > 0 ? (
            <div className="mt-3 grid gap-2 md:grid-cols-2">
              {referencedMemories.map((memory) => (
                <button
                  key={memory.id}
                  type="button"
                  className="rounded-md border bg-card p-3 text-left transition-colors hover:bg-muted/40"
                  onClick={() => setSelectedMemory(memory)}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="min-w-0 truncate text-sm font-medium">
                      {memory.title}
                    </p>
                    <Badge variant="outline" className="shrink-0">
                      重要度 {memory.importance}
                    </Badge>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <Badge variant="secondary">
                      {memoryTypeLabels[memory.type]}
                    </Badge>
                    {memory.source ? (
                      <Badge variant="outline">{memory.source}</Badge>
                    ) : null}
                  </div>
                  <p className="mt-2 line-clamp-2 text-xs leading-5 text-muted-foreground">
                    {memory.content}
                  </p>
                </button>
              ))}
            </div>
          ) : (
            <div className="mt-3 rounded-md border border-dashed bg-muted/25 p-4 text-sm text-muted-foreground">
              还没有可参考的品牌记忆。你可以在下方把修改偏好保存为长期记忆。
            </div>
          )}
        </div>
      </div>

      {notice ? (
        <div
          className={cn(
            "rounded-md border px-3 py-2 text-sm",
            notice.type === "success" &&
              "border-emerald-200 bg-emerald-50 text-emerald-800",
            notice.type === "info" &&
              "border-primary/20 bg-primary/5 text-foreground",
            notice.type === "error" &&
              "border-destructive/30 bg-destructive/10 text-destructive",
          )}
        >
          {notice.message}
        </div>
      ) : null}

      <Card className="overflow-hidden">
        <CardContent className="min-h-[52vh] space-y-5 overflow-y-auto p-4 md:p-6">
          {turns.length === 0 ? (
            <div className="flex min-h-[40vh] items-center justify-center">
              <div className="max-w-xl text-center">
                <Sparkles className="mx-auto mb-4 size-10 text-primary" />
                <h2 className="text-xl font-semibold">把素材和需求交给云雀</h2>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">
                  输入一句需求后会形成一个内容任务。后续可以继续要求改短、
                  更适合小红书、更像真实分享，直到保存成可排期内容。
                </p>
              </div>
            </div>
          ) : null}

          {turns.map((turn) => {
            const turnAssets = availableAssets.filter((asset) =>
              turn.assetIds.includes(asset.id),
            );

            return (
              <div key={turn.id} className="space-y-4">
                <div className="flex justify-end">
                  <div className="max-w-[88%] rounded-lg bg-primary px-4 py-3 text-primary-foreground shadow-sm">
                    <div className="mb-2 flex flex-wrap items-center justify-end gap-2 text-xs text-primary-foreground/75">
                      <span>
                        {turn.turnIndex === 1
                          ? "初始需求"
                          : `继续修改 ${turn.turnIndex - 1}`}
                      </span>
                      <span>{formatDateTime(new Date(turn.createdAt))}</span>
                    </div>
                    <p className="whitespace-pre-line text-sm leading-7">
                      {turn.prompt}
                    </p>
                    {turnAssets.length > 0 ? (
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {turnAssets.map((asset) => (
                          <span
                            key={asset.id}
                            className="rounded-md bg-primary-foreground/15 px-2 py-1 text-xs"
                          >
                            {getAssetName(asset)}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </div>

                <div className="flex gap-3">
                  <div className="mt-1 flex size-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                    <Sparkles className="size-4" />
                  </div>
                  <div className="min-w-0 flex-1 space-y-3">
                    {turn.status === "loading" ? (
                      <div className="rounded-md border bg-muted/25 p-4 text-sm text-muted-foreground">
                        <Loader2 className="mr-2 inline size-4 animate-spin" />
                        正在生成内容并完成合规检查...
                      </div>
                    ) : null}

                    {turn.status === "error" ? (
                      <div className="rounded-md border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
                        <AlertTriangle className="mr-2 inline size-4" />
                        {turn.message ?? "生成失败，请稍后再试。"}
                      </div>
                    ) : null}

                    {turn.status === "done" ? (
                      <>
                        {turn.message ? (
                          <p className="text-xs text-muted-foreground">
                            {turn.message}
                          </p>
                        ) : null}
                        {turn.variants.map((variant, index) =>
                          renderVariantCard(variant, index, turn),
                        )}
                      </>
                    ) : null}
                  </div>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <section className="sticky bottom-0 z-20 rounded-lg border bg-background/95 p-3 shadow-lg backdrop-blur">
        <form
          className={cn(
            "rounded-md border border-dashed p-3 transition-colors",
            isDragging && "border-primary bg-primary/5",
          )}
          onSubmit={handleGenerate}
          onDragOver={(event) => {
            event.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
        >
          <input
            ref={fileInputRef}
            className="hidden"
            type="file"
            accept={acceptedFileTypes}
            multiple
            onChange={(event) => {
              const files = Array.from(event.currentTarget.files ?? []);
              event.currentTarget.value = "";
              void uploadFiles(files);
            }}
          />
          {task ? (
            <div className="mb-3 flex flex-wrap items-center gap-2 rounded-md bg-muted/35 px-3 py-2">
              <span className="text-xs font-medium text-muted-foreground">
                继续修改
              </span>
              {quickModificationActions.map((action) => (
                <Button
                  key={action.label}
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={isGenerating || !latestDoneTurn}
                  onClick={() => void handleQuickModification(action)}
                >
                  {action.label}
                </Button>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => openMemoryPreferenceDialog()}
              >
                <Save className="size-4" />
                保存为品牌记忆
              </Button>
            </div>
          ) : null}
          <Textarea
            ref={composerRef}
            className="min-h-28 resize-none border-0 px-0 py-0 text-base leading-7 shadow-none focus-visible:ring-0"
            value={composerText}
            onChange={(event) => setComposerText(event.target.value)}
            placeholder="描述你想生成的内容，例如：用这些产品图写一篇适合 Instagram 的新品发布文案。"
            disabled={isGenerating}
          />

          <div className="mt-3 flex flex-wrap items-center gap-2">
            {selectedAssetDetails.length > 0 ? (
              selectedAssetDetails.map((asset) => (
                <button
                  key={asset.id}
                  type="button"
                  className="inline-flex max-w-56 items-center gap-1 rounded-md border bg-background px-2 py-1 text-xs hover:bg-muted"
                  title="点击移除素材"
                  onClick={() => toggleAsset(asset.id)}
                >
                  <FileText className="size-3" />
                  <span className="truncate">{getAssetName(asset)}</span>
                  <X className="size-3 text-muted-foreground" />
                </button>
              ))
            ) : (
              <span className="text-xs text-muted-foreground">
                可直接拖拽文件到这里上传；不选素材也能生成。
              </span>
            )}
          </div>

          <div className="mt-3 rounded-md border">
            <button
              type="button"
              className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left"
              onClick={() => setAdvancedOpen((current) => !current)}
            >
              <span className="inline-flex items-center gap-2 text-sm font-medium">
                <SlidersHorizontal className="size-4 text-primary" />
                高级设置
              </span>
              <ChevronDown
                className={cn(
                  "size-4 text-muted-foreground transition-transform",
                  advancedOpen && "rotate-180",
                )}
              />
            </button>

            {advancedOpen ? (
              <div className="grid gap-3 border-t p-3 md:grid-cols-2">
                <label className="space-y-2 text-sm font-medium">
                  平台
                  <select
                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                    value={platformChoice}
                    onChange={(event) =>
                      handlePlatformChoiceChange(event.target.value)
                    }
                    disabled={isGenerating}
                  >
                    <option value="AUTO">AI 自动识别 / 通用</option>
                    {platformOptions.map((platform) => (
                      <option key={platform} value={platform}>
                        {platformLabels[platform]}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="space-y-2 text-sm font-medium">
                  内容类型
                  <select
                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                    value={form.contentType}
                    onChange={(event) =>
                      updateForm("contentType", event.target.value as ContentType)
                    }
                    disabled={isGenerating}
                  >
                    {contentTypeOptions.map((contentType) => (
                      <option key={contentType} value={contentType}>
                        {contentTypeLabels[contentType]}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="space-y-2 text-sm font-medium">
                  输出语言
                  <select
                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                    value={form.outputLanguage}
                    onChange={(event) =>
                      updateForm(
                        "outputLanguage",
                        event.target.value as ContentOutputLanguage,
                      )
                    }
                    disabled={isGenerating}
                  >
                    {outputLanguageOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="space-y-2 text-sm font-medium">
                  生成数量
                  <Input
                    min={1}
                    max={5}
                    type="number"
                    value={form.numberOfVariants}
                    onChange={(event) =>
                      updateForm("numberOfVariants", Number(event.target.value))
                    }
                    disabled={isGenerating}
                  />
                </label>

                <label className="space-y-2 text-sm font-medium md:col-span-2">
                  营销目标
                  <Input
                    value={form.marketingGoal}
                    onChange={(event) =>
                      updateForm("marketingGoal", event.target.value)
                    }
                    placeholder="可选，例如：新品首发、提升转化、引导收藏。"
                    disabled={isGenerating}
                  />
                </label>

                <label className="space-y-2 text-sm font-medium">
                  语气
                  <Input
                    value={form.tone}
                    onChange={(event) => updateForm("tone", event.target.value)}
                    placeholder="例如：专业、轻松、可信、有画面感"
                    disabled={isGenerating}
                  />
                </label>

                <label className="space-y-2 text-sm font-medium md:col-span-2">
                  额外要求
                  <Textarea
                    className="min-h-20"
                    value={form.extraInstructions}
                    onChange={(event) =>
                      updateForm("extraInstructions", event.target.value)
                    }
                    placeholder="例如：避免夸大功效；标题更像真实分享；CTA 不要太硬。"
                    disabled={isGenerating}
                  />
                </label>
              </div>
            ) : null}
          </div>

          <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-muted-foreground">
              {platformChoice === "AUTO"
                ? "平台未固定，云雀会从你的描述中识别 Instagram / TikTok / 小红书等平台。"
                : `将按 ${platformLabels[platformChoice]} 风格生成。`}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={isUploading}
                onClick={() => fileInputRef.current?.click()}
              >
                {isUploading ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <UploadCloud className="size-4" />
                )}
                上传素材
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setAssetDialogOpen(true)}
              >
                <FilePlus2 className="size-4" />
                选择素材
              </Button>
              <Button disabled={isGenerating} type="submit">
                {isGenerating ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <SendHorizontal className="size-4" />
                )}
                生成
              </Button>
            </div>
          </div>
        </form>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>最近生成内容</CardTitle>
          <CardDescription>已保存的内容放在下方，不打断主创作流程。</CardDescription>
        </CardHeader>
        <CardContent>
          {recentContents.length > 0 ? (
            <div className="grid gap-3 lg:grid-cols-2">
              {recentContents.map((content) => {
                const riskLevel = content.riskNotes?.riskLevel;
                const isActing = actionContentId === content.id;

                return (
                  <div key={content.id} className="rounded-md border p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <div className="mb-2 flex flex-wrap gap-1.5">
                          {content.platforms.map((platform) => (
                            <Badge key={platform} variant="outline">
                              {platformLabels[platform]}
                            </Badge>
                          ))}
                          <Badge variant="secondary">
                            {contentTypeLabels[content.type]}
                          </Badge>
                          <Badge variant="outline">
                            {contentStatusLabels[content.status]}
                          </Badge>
                          <Badge
                            variant={getRiskBadgeVariant(riskLevel)}
                            className={
                              riskLevel === "high"
                                ? "bg-destructive text-destructive-foreground"
                                : ""
                            }
                          >
                            {getRiskLabel(riskLevel)}
                          </Badge>
                        </div>
                        <p className="truncate font-medium">{content.title}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {formatDateTime(new Date(content.createdAt))}
                          {" · "}
                          {content.assets.length > 0
                            ? `${content.assets.length} 个素材`
                            : "未关联素材"}
                        </p>
                      </div>
                      <div className="flex shrink-0 justify-end gap-1.5">
                        <Button
                          size="icon"
                          variant="outline"
                          title="查看详情"
                          onClick={() => setDetailsContent(content)}
                        >
                          <Eye className="size-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="outline"
                          title="复制正文"
                          onClick={() => handleCopy(content)}
                        >
                          <Copy className="size-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="outline"
                          title="编辑"
                          onClick={() => openEdit(content)}
                        >
                          <Pencil className="size-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="outline"
                          title="加入内容日历"
                          onClick={() => openCalendar(content)}
                        >
                          <CalendarDays className="size-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="outline"
                          title="删除"
                          disabled={isActing}
                          onClick={() => handleDeleteContent(content)}
                        >
                          {isActing ? (
                            <Loader2 className="size-4 animate-spin" />
                          ) : (
                            <Trash2 className="size-4" />
                          )}
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="rounded-md border border-dashed bg-muted/30 p-8 text-center">
              <p className="text-sm font-medium">
                保存生成结果后，它会出现在这里。
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                最近内容只保留轻量管理入口。
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={Boolean(selectedMemory)}
        onOpenChange={() => setSelectedMemory(null)}
      >
        <DialogContent className="sm:max-w-2xl">
          {selectedMemory ? (
            <>
              <DialogHeader>
                <DialogTitle>{selectedMemory.title}</DialogTitle>
                <DialogDescription>
                  {memoryTypeLabels[selectedMemory.type]}
                  {" · "}
                  重要度 {selectedMemory.importance}
                  {selectedMemory.source ? ` · ${selectedMemory.source}` : ""}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="rounded-md border bg-muted/25 p-4">
                  <p className="whitespace-pre-line text-sm leading-7">
                    {selectedMemory.content}
                  </p>
                </div>
                <p className="text-xs text-muted-foreground">
                  最近更新：{formatDateTime(new Date(selectedMemory.updatedAt))}
                </p>
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={memoryDialogOpen} onOpenChange={setMemoryDialogOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>保存为品牌记忆</DialogTitle>
            <DialogDescription>
              把本次修改偏好保存为长期上下文，后续生成内容时会优先参考。
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <label className="space-y-2 text-sm font-medium">
              标题
              <Input
                value={memoryTitle}
                onChange={(event) => setMemoryTitle(event.target.value)}
                placeholder="例如：内容修改偏好"
              />
            </label>
            <label className="space-y-2 text-sm font-medium">
              偏好内容
              <Textarea
                className="min-h-36"
                value={memoryDraft}
                onChange={(event) => setMemoryDraft(event.target.value)}
                placeholder="例如：后续小红书文案要更像真实用户分享，少用营销话术。"
              />
            </label>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setMemoryDialogOpen(false)}
            >
              取消
            </Button>
            <Button
              type="button"
              disabled={isSavingMemory}
              onClick={handleSaveMemoryPreference}
            >
              {isSavingMemory ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Save className="size-4" />
              )}
              保存记忆
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={assetDialogOpen} onOpenChange={setAssetDialogOpen}>
        <DialogContent className="max-h-[86vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>选择素材</DialogTitle>
            <DialogDescription>
              最多选择 12 个素材。也可以直接把文件拖到输入区上传。
            </DialogDescription>
          </DialogHeader>
          <Input
            value={assetSearch}
            onChange={(event) => setAssetSearch(event.target.value)}
            placeholder="搜索文件名、标签、产品或场景"
          />
          <div className="space-y-2">
            {filteredAssets.length > 0 ? (
              filteredAssets.map((asset) => {
                const selected = form.selectedAssets.includes(asset.id);

                return (
                  <button
                    key={asset.id}
                    type="button"
                    className={cn(
                      "flex w-full items-start gap-3 rounded-md border p-3 text-left transition-colors hover:bg-muted/50",
                      selected && "border-primary bg-primary/5",
                    )}
                    onClick={() => toggleAsset(asset.id)}
                  >
                    <span
                      className={cn(
                        "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded border text-xs",
                        selected
                          ? "border-primary bg-primary text-primary-foreground"
                          : "bg-background",
                      )}
                    >
                      {selected ? <Check className="size-3" /> : null}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">
                        {getAssetName(asset)}
                      </span>
                      <span className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">
                        {getAssetHint(asset)}
                      </span>
                      {asset.tags.length > 0 ? (
                        <span className="mt-2 flex flex-wrap gap-1.5">
                          {asset.tags.slice(0, 5).map((tag) => (
                            <Badge key={tag} variant="outline">
                              {tag}
                            </Badge>
                          ))}
                        </span>
                      ) : null}
                    </span>
                  </button>
                );
              })
            ) : (
              <div className="rounded-md border border-dashed p-8 text-center">
                <p className="text-sm font-medium">暂无匹配素材</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  可直接在内容生成页上传素材，上传后会自动加入当前上下文。
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => updateForm("selectedAssets", [])}
              disabled={form.selectedAssets.length === 0}
            >
              清空
            </Button>
            <Button type="button" onClick={() => setAssetDialogOpen(false)}>
              <CheckCircle2 className="size-4" />
              完成选择
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(detailsContent)}
        onOpenChange={() => setDetailsContent(null)}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
          {detailsContent ? (
            <>
              <DialogHeader>
                <DialogTitle>{detailsContent.title}</DialogTitle>
                <DialogDescription>
                  {detailsContent.platforms
                    .map((platform) => platformLabels[platform])
                    .join("，")}
                  {" · "}
                  {contentTypeLabels[detailsContent.type]}
                  {" · "}
                  {contentStatusLabels[detailsContent.status]}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  <Badge
                    variant={getRiskBadgeVariant(
                      detailsContent.riskNotes?.riskLevel,
                    )}
                  >
                    {getRiskLabel(detailsContent.riskNotes?.riskLevel)}
                  </Badge>
                  {detailsContent.hashtags.map((tag) => (
                    <Badge key={tag} variant="outline">
                      {tag}
                    </Badge>
                  ))}
                </div>
                <div className="rounded-md border bg-muted/30 p-4">
                  <p className="whitespace-pre-line text-sm leading-7">
                    {detailsContent.body}
                  </p>
                </div>
                {detailsContent.callToAction ? (
                  <div>
                    <p className="text-sm font-medium">CTA</p>
                    <p className="mt-2 text-sm text-muted-foreground">
                      {detailsContent.callToAction}
                    </p>
                  </div>
                ) : null}
                <div>
                  <p className="text-sm font-medium">关联素材</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {detailsContent.assets.length > 0 ? (
                      detailsContent.assets.map((asset) => (
                        <Badge key={asset.id} variant="secondary">
                          {asset.fileName ?? asset.title}
                        </Badge>
                      ))
                    ) : (
                      <span className="text-sm text-muted-foreground">
                        暂无关联素材
                      </span>
                    )}
                  </div>
                </div>
                {detailsContent.riskNotes ? (
                  <div>
                    <p className="text-sm font-medium">风险说明</p>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
                      {detailsContent.riskNotes.overallSuggestion}
                    </p>
                    {detailsContent.riskNotes.issues.length > 0 ? (
                      <div className="mt-3 space-y-2">
                        {detailsContent.riskNotes.issues.map((issue, index) => (
                          <div
                            key={`${issue.text}-${index}`}
                            className="rounded-md border p-3"
                          >
                            <p className="text-sm font-medium">{issue.text}</p>
                            <p className="mt-1 text-sm text-muted-foreground">
                              {issue.reason}
                            </p>
                            <p className="mt-1 text-sm text-muted-foreground">
                              建议：{issue.suggestion}
                            </p>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(editingVariant)}
        onOpenChange={() => setEditingVariant(null)}
      >
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>编辑生成结果</DialogTitle>
            <DialogDescription>
              这里只修改当前对话里的草稿，点击保存后才会写入内容库。
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <label className="space-y-2 text-sm font-medium">
              标题
              <Input
                value={variantEditTitle}
                onChange={(event) => setVariantEditTitle(event.target.value)}
              />
            </label>
            <label className="space-y-2 text-sm font-medium">
              正文
              <Textarea
                className="min-h-60"
                value={variantEditBody}
                onChange={(event) => setVariantEditBody(event.target.value)}
              />
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingVariant(null)}>
              取消
            </Button>
            <Button onClick={handleUpdateVariant}>
              <Save className="size-4" />
              更新草稿
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(editingContent)}
        onOpenChange={() => setEditingContent(null)}
      >
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>编辑内容</DialogTitle>
            <DialogDescription>可修改标题和正文，状态与风险记录暂不变。</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <label className="space-y-2 text-sm font-medium">
              标题
              <Input
                value={editTitle}
                onChange={(event) => setEditTitle(event.target.value)}
              />
            </label>
            <label className="space-y-2 text-sm font-medium">
              正文
              <Textarea
                className="min-h-60"
                value={editBody}
                onChange={(event) => setEditBody(event.target.value)}
              />
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingContent(null)}>
              取消
            </Button>
            <Button
              disabled={Boolean(
                editingContent && actionContentId === editingContent.id,
              )}
              onClick={handleUpdateContent}
            >
              {editingContent && actionContentId === editingContent.id ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Save className="size-4" />
              )}
              保存修改
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(calendarContent)}
        onOpenChange={() => setCalendarContent(null)}
      >
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>加入内容日历</DialogTitle>
            <DialogDescription>
              创建一个 ContentCalendarItem，状态默认为已排期。
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <label className="space-y-2 text-sm font-medium">
              排期时间
              <Input
                type="datetime-local"
                value={calendarScheduledAt}
                onChange={(event) => setCalendarScheduledAt(event.target.value)}
              />
            </label>
            <label className="space-y-2 text-sm font-medium">
              负责人
              <Input
                value={calendarOwnerName}
                onChange={(event) => setCalendarOwnerName(event.target.value)}
                placeholder="例如：Mia"
              />
            </label>
            <label className="space-y-2 text-sm font-medium">
              备注
              <Textarea
                value={calendarNotes}
                onChange={(event) => setCalendarNotes(event.target.value)}
                placeholder="例如：发布前复核封面和禁用词。"
              />
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCalendarContent(null)}>
              取消
            </Button>
            <Button
              disabled={Boolean(
                calendarContent && actionContentId === calendarContent.id,
              )}
              onClick={handleAddToCalendar}
            >
              {calendarContent && actionContentId === calendarContent.id ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <CalendarDays className="size-4" />
              )}
              加入日历
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
