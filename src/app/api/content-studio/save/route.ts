import { ContentStatus, Prisma } from "@prisma/client";
import {
  apiError,
  apiSuccess,
  getWorkspaceErrorMessage,
  userMessages,
} from "@/lib/api-response";
import { requireCurrentWorkspace } from "@/lib/auth/current-workspace";
import { contentTypeLabels, platformLabels } from "@/lib/labels";
import { prisma } from "@/lib/prisma";
import { saveGeneratedContentSchema } from "@/lib/validators/content-studio";
import { getConfiguredAiModel } from "@/services/ai";

export const runtime = "nodejs";

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
        scope: "content-studio/save",
        error: new Error("DATABASE_URL is not configured"),
      });
    }

    const json = await request.json().catch(() => null);
    const parsed = saveGeneratedContentSchema.safeParse(json);

    if (!parsed.success) {
      return apiError("保存内容的信息有误，请重新生成或检查后再保存。", {
        status: 400,
        issues: parsed.error.flatten().fieldErrors,
      });
    }

    const { workspace, error } = await getTemporaryWorkspace();

    if (!workspace) {
      return apiError(getWorkspaceErrorMessage(error), { status: 404 });
    }

    const values = parsed.data;
    const validAssets =
      values.selectedAssets.length > 0
        ? await prisma.asset.findMany({
            where: {
              workspaceId: workspace.id,
              id: { in: values.selectedAssets },
            },
            select: { id: true },
          })
        : [];
    const variant = values.variant;

    const content = await prisma.generatedContent.create({
      data: {
        workspaceId: workspace.id,
        title: variant.title,
        type: values.contentType,
        status: ContentStatus.DRAFT,
        platforms: [values.platform],
        prompt:
          values.taskContext?.turnPrompt || values.extraInstructions || null,
        brief: values.taskContext?.rootPrompt || values.marketingGoal,
        body: `${variant.hook}\n\n${variant.body}`,
        hashtags: variant.hashtags,
        callToAction: variant.cta,
        model: getConfiguredAiModel(),
        metadata: {
          hook: variant.hook,
          visualSuggestion: variant.visualSuggestion,
          platformNotes: variant.platformNotes,
          marketingGoal: values.marketingGoal,
          tone: values.tone,
          platformLabel: platformLabels[values.platform],
          contentTypeLabel: contentTypeLabels[values.contentType],
          outputLanguage: values.outputLanguage,
          source: "content-studio",
          ...(values.taskContext
            ? {
                task: {
                  id: values.taskContext.taskId,
                  rootPrompt: values.taskContext.rootPrompt,
                  turnPrompt: values.taskContext.turnPrompt,
                  turnIndex: values.taskContext.turnIndex,
                  modificationHistory: values.taskContext.modificationHistory,
                },
              }
            : {}),
        },
        riskNotes: variant.complianceCheck ?? Prisma.JsonNull,
        assets:
          validAssets.length > 0
            ? {
                connect: validAssets.map((asset) => ({ id: asset.id })),
              }
            : undefined,
      },
      include: {
        assets: {
          select: {
            id: true,
            title: true,
            fileName: true,
          },
        },
      },
    });

    return apiSuccess(
      {
        message: "内容已保存到内容库。",
        content: {
          id: content.id,
          title: content.title,
          assetCount: content.assets.length,
          updatedAt: content.updatedAt.toISOString(),
        },
      },
      "content-studio/save",
      {
        workspaceId: workspace.id,
        contentId: content.id,
        assetCount: content.assets.length,
      },
    );
  } catch (error) {
    return apiError("内容保存失败，请稍后重试。", {
      status: 500,
      scope: "content-studio/save",
      error,
    });
  }
}
