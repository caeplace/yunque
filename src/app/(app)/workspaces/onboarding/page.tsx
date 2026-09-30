import { Platform } from "@prisma/client";
import { EmptyState } from "@/components/layout/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { WorkspaceOnboardingForm } from "@/components/workspaces/workspace-onboarding-form";
import { getBrandProfileData } from "@/services/db/current-workspace";

export const dynamic = "force-dynamic";

function getInitialPlatforms(value: unknown): Platform[] {
  const platformValues = new Set<string>(Object.values(Platform));

  if (!Array.isArray(value)) return [];

  return value
    .map(String)
    .filter((item): item is Platform => platformValues.has(item));
}

export default async function WorkspaceOnboardingPage() {
  const result = await getBrandProfileData();
  const data = result.data;

  if (!data) {
    return (
      <div className="space-y-6">
        <PageHeader
          eyebrow="Onboarding"
          title="品牌初始化"
          description="创建品牌空间后，先用轻量问卷沉淀基础上下文。"
        />
        <EmptyState
          title="暂无可用品牌空间"
          description={result.error ?? "请先创建一个品牌空间。"}
        />
      </div>
    );
  }

  const profile = data.brandProfile;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Onboarding"
        title="品牌初始化"
        description="先回答几个关键问题，让云雀知道这个品牌是谁、面向谁、近期要做什么。"
      />

      <WorkspaceOnboardingForm
        workspaceName={data.workspace.name}
        initialValues={{
          brandName: profile?.brandName ?? data.workspace.name,
          productDescription:
            profile?.productDescription ?? profile?.description ?? "",
          targetAudience:
            profile?.targetAudience ?? profile?.targetAudiences.join("，") ?? "",
          platforms: getInitialPlatforms(profile?.platformPreferences),
          brandTone: profile?.brandTone ?? profile?.toneKeywords.join("，") ?? "",
          forbiddenWords: profile?.forbiddenWords ?? [],
        }}
      />
    </div>
  );
}
