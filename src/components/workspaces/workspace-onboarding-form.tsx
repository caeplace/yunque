"use client";

import { type FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import type { Platform } from "@prisma/client";
import { ArrowRight, Check, Loader2, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast-provider";
import { getApiErrorMessage, parseApiPayload } from "@/lib/client-api";
import { platformLabels } from "@/lib/labels";
import { cn } from "@/lib/utils";

type NoticeState = {
  type: "success" | "error";
  message: string;
} | null;

type WorkspaceOnboardingFormProps = {
  workspaceName: string;
  initialValues?: {
    brandName?: string | null;
    productDescription?: string | null;
    targetAudience?: string | null;
    platforms?: Platform[] | null;
    brandTone?: string | null;
    forbiddenWords?: string[] | null;
  };
};

const platformOptions = [
  "XIAOHONGSHU",
  "INSTAGRAM",
  "TIKTOK",
  "FACEBOOK",
  "PINTEREST",
  "LINKEDIN",
] as Platform[];

const defaultTone = "真实、清晰、可信，像熟悉产品的运营人员在认真推荐";

function getPayloadString(payload: unknown, key: string) {
  if (!payload || typeof payload !== "object") return null;
  const value = (payload as Record<string, unknown>)[key];
  return typeof value === "string" ? value : null;
}

export function WorkspaceOnboardingForm({
  workspaceName,
  initialValues,
}: WorkspaceOnboardingFormProps) {
  const router = useRouter();
  const { showToast } = useToast();
  const [notice, setNotice] = useState<NoticeState>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [brandName, setBrandName] = useState(
    initialValues?.brandName ?? workspaceName,
  );
  const [productDescription, setProductDescription] = useState(
    initialValues?.productDescription ?? "",
  );
  const [targetAudience, setTargetAudience] = useState(
    initialValues?.targetAudience ?? "",
  );
  const [platforms, setPlatforms] = useState<Platform[]>(
    initialValues?.platforms?.length
      ? initialValues.platforms
      : ["XIAOHONGSHU"],
  );
  const [brandTone, setBrandTone] = useState(
    initialValues?.brandTone ?? defaultTone,
  );
  const [forbiddenWords, setForbiddenWords] = useState(
    initialValues?.forbiddenWords?.join("，") ?? "",
  );
  const [currentContentTask, setCurrentContentTask] = useState("");

  function togglePlatform(platform: Platform) {
    setPlatforms((current) => {
      if (current.includes(platform)) {
        return current.length > 1
          ? current.filter((item) => item !== platform)
          : current;
      }

      return [...current, platform];
    });
  }

  function notify(type: "success" | "error", title: string, message: string) {
    setNotice({ type, message });
    showToast({ type, title, description: message });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice(null);

    const values = {
      brandName: brandName.trim(),
      productDescription: productDescription.trim(),
      targetAudience: targetAudience.trim(),
      platforms,
      brandTone: brandTone.trim(),
      forbiddenWords: forbiddenWords.trim(),
      currentContentTask: currentContentTask.trim(),
    };

    if (!values.brandName) {
      notify("error", "还缺一点信息", "请填写品牌/项目名称。");
      return;
    }

    if (!values.productDescription || !values.targetAudience) {
      notify("error", "还缺一点信息", "请补充主要产品或服务、目标用户。");
      return;
    }

    if (!values.currentContentTask) {
      notify("error", "还缺一点信息", "请写下近期最想完成的内容任务。");
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/workspaces/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const payload = await parseApiPayload(response);

      if (!response.ok) {
        throw new Error(getApiErrorMessage(payload, "品牌初始化失败。"));
      }

      const message =
        getPayloadString(payload, "message") ?? "品牌初始化已完成。";
      notify("success", "初始化完成", message);
      router.push(getPayloadString(payload, "nextPath") ?? "/dashboard");
      router.refresh();
    } catch (error) {
      const message = error instanceof Error ? error.message : "品牌初始化失败。";
      notify("error", "保存失败", message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Card className="max-w-4xl">
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle>用 7 个问题初始化品牌</CardTitle>
            <CardDescription className="mt-2">
              这些答案会自动写入品牌档案，并沉淀成品牌记忆，后续生成内容会直接参考。
            </CardDescription>
          </div>
          <Badge variant="secondary" className="w-fit">
            当前空间：{workspaceName}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <form className="space-y-6" onSubmit={handleSubmit}>
          {notice ? (
            <div
              className={`rounded-md border px-3 py-2 text-sm ${
                notice.type === "success"
                  ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                  : "border-destructive/30 bg-destructive/10 text-destructive"
              }`}
            >
              {notice.message}
            </div>
          ) : null}

          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-2 text-sm font-medium">
              1. 品牌/项目名称
              <Input
                value={brandName}
                onChange={(event) => setBrandName(event.target.value)}
                placeholder="例如：青柠生活馆"
                required
                maxLength={80}
              />
            </label>

            <div className="space-y-2 text-sm font-medium">
              4. 主要发布平台
              <div className="flex flex-wrap gap-2">
                {platformOptions.map((platform) => {
                  const selected = platforms.includes(platform);

                  return (
                    <button
                      key={platform}
                      type="button"
                      className={cn(
                        "inline-flex h-9 items-center gap-2 rounded-md border px-3 text-sm transition-colors",
                        selected
                          ? "border-primary bg-primary text-primary-foreground"
                          : "bg-background hover:bg-muted",
                      )}
                      onClick={() => togglePlatform(platform)}
                    >
                      {selected ? <Check className="size-3.5" /> : null}
                      {platformLabels[platform]}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <label className="space-y-2 text-sm font-medium">
              2. 主要产品或服务
              <Textarea
                className="min-h-32"
                value={productDescription}
                onChange={(event) => setProductDescription(event.target.value)}
                placeholder="例如：面向年轻家庭的实木家具，主打耐看、环保、适合小户型。"
                required
                maxLength={1200}
              />
            </label>

            <label className="space-y-2 text-sm font-medium">
              3. 目标用户
              <Textarea
                className="min-h-32"
                value={targetAudience}
                onChange={(event) => setTargetAudience(event.target.value)}
                placeholder="例如：25-40 岁的新家装修用户，关注质感、收纳和性价比。"
                required
                maxLength={1200}
              />
            </label>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <label className="space-y-2 text-sm font-medium">
              5. 希望的品牌语气
              <Textarea
                className="min-h-28"
                value={brandTone}
                onChange={(event) => setBrandTone(event.target.value)}
                placeholder="例如：真实、可信、克制，像懂产品的朋友在分享。"
                required
                maxLength={600}
              />
            </label>

            <label className="space-y-2 text-sm font-medium">
              6. 禁止使用的表达
              <Textarea
                className="min-h-28"
                value={forbiddenWords}
                onChange={(event) => setForbiddenWords(event.target.value)}
                placeholder="例如：全网第一、100% 有效、永久保证；没有的话可以留空。"
                maxLength={600}
              />
            </label>
          </div>

          <label className="space-y-2 text-sm font-medium">
            7. 近期最想完成的内容任务
            <Textarea
              className="min-h-28 text-base leading-7"
              value={currentContentTask}
              onChange={(event) => setCurrentContentTask(event.target.value)}
              placeholder="例如：用新到的一批沙发产品图，生成一组适合小红书和 Instagram 的新品发布文案。"
              required
              maxLength={800}
            />
          </label>

          <div className="flex flex-col gap-3 rounded-md border bg-muted/25 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm text-muted-foreground">
              提交后会保存品牌档案，并带着第 7 个任务进入内容生成页。
            </div>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Sparkles className="size-4" />
              )}
              {isSubmitting ? "正在初始化..." : "保存并开始创作"}
              {!isSubmitting ? <ArrowRight className="size-4" /> : null}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
