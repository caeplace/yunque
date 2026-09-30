import { WorkspaceCreateForm } from "@/components/workspaces/workspace-create-form";
import { PageHeader } from "@/components/layout/page-header";

export const dynamic = "force-dynamic";

export default function NewWorkspacePage() {
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Workspace"
        title="创建品牌空间"
        description="先创建一个品牌空间，再用轻量问卷完成品牌初始化。后续素材、内容和日历都会按 workspace 隔离。"
      />

      <WorkspaceCreateForm />
    </div>
  );
}
