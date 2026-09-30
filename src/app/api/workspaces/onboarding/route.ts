import { MemoryType } from "@prisma/client";
import {
  apiError,
  apiSuccess,
  getWorkspaceErrorMessage,
  userMessages,
} from "@/lib/api-response";
import { requireCurrentWorkspace } from "@/lib/auth/current-workspace";
import { platformLabels } from "@/lib/labels";
import { prisma } from "@/lib/prisma";
import { splitCommaText } from "@/lib/validators/brand-profile";
import { workspaceOnboardingSchema } from "@/lib/validators/workspace-onboarding";

export const runtime = "nodejs";

const onboardingMemorySource = "品牌初始化问卷";

async function getTemporaryWorkspace() {
  const result = await requireCurrentWorkspace();
  return {
    workspace: result.data?.workspace ?? null,
    error: result.error,
  };
}

export async function POST(request: Request) {
  try {
    if (!process.env.DATABASE_URL) {
      return apiError(userMessages.databaseNotConfigured, {
        status: 500,
        scope: "workspaces/onboarding",
        error: new Error("DATABASE_URL is not configured"),
      });
    }

    const json = await request.json().catch(() => null);
    const parsed = workspaceOnboardingSchema.safeParse(json);

    if (!parsed.success) {
      return apiError("品牌初始化信息有误，请检查后重试。", {
        status: 400,
        issues: parsed.error.flatten().fieldErrors,
      });
    }

    const { workspace, error } = await getTemporaryWorkspace();

    if (!workspace) {
      return apiError(getWorkspaceErrorMessage(error), { status: 404 });
    }

    const values = parsed.data;
    const forbiddenWords = splitCommaText(values.forbiddenWords);
    const platformPreferenceLabels = values.platforms.map(
      (platform) => platformLabels[platform],
    );
    const platformPreferenceText = platformPreferenceLabels.join("，");
    const memoryInputs = [
      {
        type: MemoryType.BRAND_RULE,
        title: "品牌基础定位",
        content: `品牌/项目名称：${values.brandName}\n主要产品或服务：${values.productDescription}\n目标用户：${values.targetAudience}`,
        importance: 8,
      },
      {
        type: MemoryType.PLATFORM_INSIGHT,
        title: "主要发布平台",
        content: `主要发布平台：${platformPreferenceText}`,
        importance: 7,
      },
      {
        type: MemoryType.PREFERENCE,
        title: "品牌语气偏好",
        content: values.brandTone,
        importance: 8,
      },
      values.forbiddenWords?.trim()
        ? {
            type: MemoryType.COMPLIANCE_RULE,
            title: "禁止使用的表达",
            content: values.forbiddenWords.trim(),
            importance: 9,
          }
        : null,
      {
        type: MemoryType.CONTENT_RULE,
        title: "近期内容任务",
        content: values.currentContentTask,
        importance: 7,
      },
    ].filter((item): item is NonNullable<typeof item> => Boolean(item));

    await prisma.$transaction(async (tx) => {
      await tx.brandProfile.upsert({
        where: { workspaceId: workspace.id },
        create: {
          workspaceId: workspace.id,
          brandName: values.brandName,
          productDescription: values.productDescription,
          targetAudience: values.targetAudience,
          brandTone: values.brandTone,
          forbiddenWords,
          platformPreferences: values.platforms,
          description: values.productDescription,
          toneKeywords: splitCommaText(values.brandTone),
          targetAudiences: [values.targetAudience],
          recommendedPlatforms: platformPreferenceLabels,
          marketingSuggestions: [
            `近期优先完成：${values.currentContentTask}`,
          ],
        },
        update: {
          brandName: values.brandName,
          productDescription: values.productDescription,
          targetAudience: values.targetAudience,
          brandTone: values.brandTone,
          forbiddenWords,
          platformPreferences: values.platforms,
          description: values.productDescription,
          toneKeywords: splitCommaText(values.brandTone),
          targetAudiences: [values.targetAudience],
          recommendedPlatforms: platformPreferenceLabels,
          marketingSuggestions: [
            `近期优先完成：${values.currentContentTask}`,
          ],
        },
      });

      await tx.brandMemory.deleteMany({
        where: {
          workspaceId: workspace.id,
          source: onboardingMemorySource,
        },
      });

      await tx.brandMemory.createMany({
        data: memoryInputs.map((memory) => ({
          workspaceId: workspace.id,
          type: memory.type,
          title: memory.title,
          content: memory.content,
          source: onboardingMemorySource,
          importance: memory.importance,
          priority: memory.importance,
          isActive: true,
        })),
      });
    });

    const nextPath = `/content-studio?brief=${encodeURIComponent(
      values.currentContentTask,
    )}`;

    return apiSuccess(
      {
        message: "品牌初始化已完成。",
        nextPath,
      },
      "workspaces/onboarding",
      { workspaceId: workspace.id },
    );
  } catch (error) {
    return apiError("品牌初始化失败，请稍后重试。", {
      status: 500,
      scope: "workspaces/onboarding",
      error,
    });
  }
}
