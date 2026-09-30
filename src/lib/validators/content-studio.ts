import { ContentType, Platform } from "@prisma/client";
import { z } from "zod";

export const contentOutputLanguageSchema = z
  .enum(["ZH_CN", "EN_WITH_ZH"])
  .default("ZH_CN");

export const contentGenerationFormSchema = z.object({
  platform: z.nativeEnum(Platform),
  contentType: z.nativeEnum(ContentType),
  marketingGoal: z.string().trim().min(2, "请填写营销目标。").max(1200),
  selectedAssets: z.array(z.string().min(1)).max(12).default([]),
  tone: z.string().trim().max(120).default(""),
  numberOfVariants: z.coerce.number().int().min(1).max(5).default(3),
  outputLanguage: contentOutputLanguageSchema,
  extraInstructions: z.string().trim().max(1000).default(""),
});

export const generatedContentVariantSchema = z.object({
  title: z.string().trim().min(1).max(240),
  hook: z.string().trim().min(1).max(800),
  body: z.string().trim().min(1).max(8000),
  hashtags: z.array(z.string().trim().min(1).max(80)).max(16).default([]),
  cta: z.string().trim().min(1).max(800),
  visualSuggestion: z.string().trim().min(1).max(1500),
  platformNotes: z.string().trim().min(1).max(1500),
});

export const complianceCheckResultSchema = z.object({
  riskLevel: z.enum(["low", "medium", "high"]),
  issues: z
    .array(
      z.object({
        text: z.string().trim().min(1).max(500),
        reason: z.string().trim().min(1).max(1000),
        suggestion: z.string().trim().min(1).max(1000),
      }),
    )
    .max(20)
    .default([]),
  overallSuggestion: z.string().trim().min(1).max(1500),
});

export const generatedContentVariantWithComplianceSchema =
  generatedContentVariantSchema.extend({
    complianceCheck: complianceCheckResultSchema.optional(),
  });

export const contentTaskContextSchema = z
  .object({
    taskId: z.string().trim().min(1).max(120),
    rootPrompt: z.string().trim().min(1).max(1200),
    turnPrompt: z.string().trim().min(1).max(1200),
    turnIndex: z.coerce.number().int().min(1).max(50),
    modificationHistory: z
      .array(
        z.object({
          prompt: z.string().trim().min(1).max(1200),
          createdAt: z.string().trim().min(1).max(80),
        }),
      )
      .max(20)
      .default([]),
  })
  .optional();

export const saveGeneratedContentSchema = contentGenerationFormSchema.extend({
  variant: generatedContentVariantWithComplianceSchema,
  taskContext: contentTaskContextSchema,
});

export const updateGeneratedContentSchema = z.object({
  title: z.string().trim().min(1, "请填写标题。").max(160),
  body: z.string().trim().min(1, "请填写正文。").max(5000),
});

export const addGeneratedContentToCalendarSchema = z.object({
  scheduledAt: z.string().trim().min(1, "请选择排期时间。"),
  notes: z.string().trim().max(1000).default(""),
  ownerName: z.string().trim().max(80).default(""),
});

export type ContentGenerationFormValues = z.infer<
  typeof contentGenerationFormSchema
>;
export type ContentOutputLanguage = z.infer<typeof contentOutputLanguageSchema>;
export type GeneratedContentVariantValues = z.infer<
  typeof generatedContentVariantWithComplianceSchema
>;
