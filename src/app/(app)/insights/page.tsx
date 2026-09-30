import type { ReactNode } from "react";
import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  FileText,
  Lightbulb,
  PackageOpen,
  Sparkles,
  Upload,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { EmptyState } from "@/components/layout/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { contentTypeLabels, platformLabels } from "@/lib/labels";
import { getInsightsData } from "@/services/db/current-workspace";

export const dynamic = "force-dynamic";

type InsightsData = NonNullable<
  Awaited<ReturnType<typeof getInsightsData>>["data"]
>;

type NextStep = {
  title: string;
  description: string;
  evidence: string;
  href: string;
  actionLabel: string;
  icon: LucideIcon;
};

function SetupActions() {
  return (
    <div className="flex flex-col gap-2 sm:flex-row">
      <Button asChild>
        <Link href="/assets">
          <Upload className="size-4" />
          上传素材
        </Link>
      </Button>
      <Button asChild variant="outline">
        <Link href="/content-studio">
          <Sparkles className="size-4" />
          生成内容
        </Link>
      </Button>
      <Button asChild variant="outline">
        <Link href="/calendar">
          <CalendarDays className="size-4" />
          加入日历
        </Link>
      </Button>
    </div>
  );
}

function compactList(items: string[]) {
  if (items.length === 0) return "";
  if (items.length === 1) return items[0];
  return `${items.slice(0, 2).join("、")}${items.length > 2 ? "等" : ""}`;
}

function buildNextSteps(data: InsightsData): NextStep[] {
  const topMemory = data.insightsInput.brandMemories[0];
  const memoryHint = topMemory
    ? `参考品牌记忆「${topMemory.title}」`
    : "暂无品牌记忆，建议先沉淀 1 条偏好";
  const unusedNames = compactList(
    data.unusedAssetSamples.map((asset) => asset.fileName ?? asset.title),
  );
  const unplannedNames = compactList(
    data.unplannedContentSamples.map((content) => content.title),
  );

  return [
    {
      title:
        data.stats.unusedAssetCount > 0
          ? `先用 ${Math.min(data.stats.unusedAssetCount, 3)} 个未使用素材生成内容`
          : "补充下一批可用素材",
      description:
        data.stats.unusedAssetCount > 0
          ? `从 ${unusedNames || "最近上传的素材"} 开始，生成 1-3 条可发布内容。`
          : "当前没有待消化素材，先上传新品图、卖点文档或场景素材。",
      evidence: `未使用素材 ${data.stats.unusedAssetCount} 个 · ${memoryHint}`,
      href: data.stats.unusedAssetCount > 0 ? "/content-studio" : "/assets",
      actionLabel:
        data.stats.unusedAssetCount > 0 ? "去生成内容" : "去上传素材",
      icon: PackageOpen,
    },
    {
      title:
        data.stats.unplannedContentCount > 0
          ? `给 ${data.stats.unplannedContentCount} 条未排期内容安排发布时间`
          : "生成后立刻加入内容日历",
      description:
        data.stats.unplannedContentCount > 0
          ? `优先处理 ${unplannedNames || "最近保存的草稿"}，避免内容停在草稿箱。`
          : "当前没有未排期内容，下一次生成后建议直接保存并加入日历。",
      evidence: `未排期内容 ${data.stats.unplannedContentCount} 条 · 内容日历 ${data.stats.calendarItemCount} 条`,
      href: "/calendar",
      actionLabel: "查看日历",
      icon: CalendarDays,
    },
    {
      title:
        data.stats.monthlyPublishedCount > 0
          ? "复盘已发布内容，沉淀成品牌记忆"
          : "先发布一条内容，建立可复盘样本",
      description:
        data.stats.monthlyPublishedCount > 0
          ? `本月已有 ${data.stats.monthlyPublishedCount} 条发布记录，把有效标题、语气或禁用表达写进品牌记忆。`
          : "本月还没有已发布内容。先完成一条发布，再用品牌记忆统一后续表达。",
      evidence: `已发布内容 ${data.stats.monthlyPublishedCount} 条 · 品牌记忆 ${data.stats.activeMemoryCount} 条`,
      href:
        data.stats.monthlyPublishedCount > 0 ? "/brand-profile" : "/calendar",
      actionLabel:
        data.stats.monthlyPublishedCount > 0 ? "维护品牌记忆" : "去发布内容",
      icon: Lightbulb,
    },
  ];
}

function NextStepCard({
  step,
  index,
}: {
  step: NextStep;
  index: number;
}) {
  const Icon = step.icon;

  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary text-sm font-semibold text-primary-foreground">
              {index + 1}
            </span>
            <Icon className="size-5 text-primary" />
          </div>
          <Badge variant="outline">下一步</Badge>
        </div>
        <CardTitle className="text-lg leading-7">{step.title}</CardTitle>
        <CardDescription className="leading-6">
          {step.description}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="rounded-md bg-muted/40 px-3 py-2 text-xs leading-5 text-muted-foreground">
          依据：{step.evidence}
        </p>
        <Button asChild size="sm">
          <Link href={step.href}>
            {step.actionLabel}
            <ArrowRight className="size-4" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}

function CompactSection({
  title,
  description,
  icon: Icon,
  children,
}: {
  title: string;
  description: string;
  icon: LucideIcon;
  children: ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Icon className="size-4 text-primary" />
          {title}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function EmptyLine({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center gap-2 rounded-md border border-dashed p-4 text-sm text-muted-foreground">
      <CheckCircle2 className="size-4 text-primary" />
      {children}
    </div>
  );
}

export default async function InsightsPage() {
  const result = await getInsightsData();
  const data = result.data;

  if (!data) {
    return (
      <div className="space-y-6">
        <PageHeader
          eyebrow="Insights"
          title="运营建议"
          description="这里不会做数据大屏，只告诉你下一步该做什么。"
        />
        <EmptyState
          title="暂无可用数据"
          description={
            result.error ?? "请按顺序完成：上传素材、生成内容、加入日历。"
          }
          action={<SetupActions />}
        />
      </div>
    );
  }

  const hasOperationalData =
    data.stats.assetCount > 0 ||
    data.stats.contentCount > 0 ||
    data.stats.calendarItemCount > 0;

  if (!hasOperationalData) {
    return (
      <div className="space-y-6">
        <PageHeader
          eyebrow="Insights"
          title={`${data.workspace.name} 运营建议`}
          description="先建立素材、内容和日历，之后这里会给出下一步动作。"
        />
        <EmptyState
          title="还没有可建议的运营数据"
          description="建议按顺序完成：1. 上传素材  2. 生成内容  3. 加入日历。"
          action={<SetupActions />}
        />
      </div>
    );
  }

  const nextSteps = buildNextSteps(data);
  const topMemories = data.insightsInput.brandMemories.slice(0, 3);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Insights"
        title={`${data.workspace.name} 下一步建议`}
        description="基于未使用素材、未排期内容、已发布内容和品牌记忆生成。"
      />

      <section className="space-y-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold">先做这 3 件事</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              不展示复杂报表，只保留今天能推进的动作。
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline">
              未使用素材 {data.stats.unusedAssetCount}
            </Badge>
            <Badge variant="outline">
              未排期内容 {data.stats.unplannedContentCount}
            </Badge>
            <Badge variant="outline">
              已发布内容 {data.stats.monthlyPublishedCount}
            </Badge>
            <Badge variant="outline">
              品牌记忆 {data.stats.activeMemoryCount}
            </Badge>
          </div>
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          {nextSteps.map((step, index) => (
            <NextStepCard key={step.title} step={step} index={index} />
          ))}
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-3">
        <CompactSection
          title="可用素材"
          description="只列最近几个未使用素材，方便直接拿去生成。"
          icon={PackageOpen}
        >
          {data.unusedAssetSamples.length > 0 ? (
            <div className="space-y-2">
              {data.unusedAssetSamples.slice(0, 3).map((asset) => (
                <div key={asset.id} className="rounded-md border p-3">
                  <p className="truncate text-sm font-medium">
                    {asset.fileName ?? asset.title}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {asset.tags.slice(0, 3).join("，") || "暂无标签"}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <EmptyLine>当前没有未使用素材。</EmptyLine>
          )}
        </CompactSection>

        <CompactSection
          title="待排期内容"
          description="保存过但还没加入日历的内容。"
          icon={FileText}
        >
          {data.unplannedContentSamples.length > 0 ? (
            <div className="space-y-2">
              {data.unplannedContentSamples.slice(0, 3).map((content) => (
                <div key={content.id} className="rounded-md border p-3">
                  <p className="truncate text-sm font-medium">{content.title}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {contentTypeLabels[content.type]} ·{" "}
                    {content.platforms
                      .map((platform) => platformLabels[platform])
                      .join("，") || "未设置平台"}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <EmptyLine>当前没有未排期内容。</EmptyLine>
          )}
        </CompactSection>

        <CompactSection
          title="品牌记忆"
          description="本页建议会优先参考这些长期上下文。"
          icon={Lightbulb}
        >
          {topMemories.length > 0 ? (
            <div className="space-y-2">
              {topMemories.map((memory) => (
                <div key={memory.title} className="rounded-md border p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-medium">{memory.title}</p>
                    <Badge variant="outline">重要度 {memory.importance}</Badge>
                  </div>
                  <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">
                    {memory.content}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <EmptyLine>暂无品牌记忆，建议先补充语气和内容规则。</EmptyLine>
          )}
        </CompactSection>
      </section>
    </div>
  );
}
