import { EmptyState } from "@/components/layout/empty-state";
import { BrandInterviewOnboarding } from "@/components/workspaces/brand-interview-onboarding";
import { getBrandProfileData } from "@/services/db/current-workspace";

export const dynamic = "force-dynamic";

export default async function WorkspaceOnboardingPage() {
  const result = await getBrandProfileData();
  const data = result.data;

  if (!data) {
    return (
      <div className="mx-auto flex min-h-[calc(100vh-80px)] w-full max-w-3xl items-center px-4 py-8">
        <EmptyState
          title="暂无可用品牌空间"
          description={result.error ?? "请先创建一个品牌空间。"}
        />
      </div>
    );
  }

  return <BrandInterviewOnboarding />;
}
