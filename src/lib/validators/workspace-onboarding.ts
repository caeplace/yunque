import { Platform } from "@prisma/client";
import { z } from "zod";

export const workspaceOnboardingSchema = z.object({
  brandName: z
    .string()
    .trim()
    .min(1, "请填写品牌/项目名称。")
    .max(80, "品牌/项目名称不能超过 80 个字符。"),
  productDescription: z
    .string()
    .trim()
    .min(2, "请简单描述主要产品或服务。")
    .max(1200, "主要产品或服务不能超过 1200 个字符。"),
  targetAudience: z
    .string()
    .trim()
    .min(2, "请简单描述目标用户。")
    .max(1200, "目标用户不能超过 1200 个字符。"),
  platforms: z
    .array(z.nativeEnum(Platform))
    .min(1, "请至少选择一个主要发布平台。")
    .max(6, "主要发布平台最多选择 6 个。"),
  brandTone: z
    .string()
    .trim()
    .min(2, "请描述希望的品牌语气。")
    .max(600, "品牌语气不能超过 600 个字符。"),
  forbiddenWords: z
    .string()
    .trim()
    .max(600, "禁止表达不能超过 600 个字符。")
    .optional()
    .or(z.literal("")),
  currentContentTask: z
    .string()
    .trim()
    .min(2, "请写下近期最想完成的内容任务。")
    .max(800, "近期内容任务不能超过 800 个字符。"),
});

export type WorkspaceOnboardingValues = z.infer<
  typeof workspaceOnboardingSchema
>;
