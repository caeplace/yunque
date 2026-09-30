"use client";

import { type FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast-provider";
import { getApiErrorMessage, parseApiPayload } from "@/lib/client-api";

type NoticeState = {
  type: "success" | "error";
  message: string;
} | null;

export function WorkspaceCreateForm() {
  const router = useRouter();
  const { showToast } = useToast();
  const [notice, setNotice] = useState<NoticeState>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function notify(type: "success" | "error", title: string, message: string) {
    setNotice({ type, message });
    showToast({ type, title, description: message });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice(null);

    const formData = new FormData(event.currentTarget);
    const values = {
      name: String(formData.get("name") ?? "").trim(),
      slug: String(formData.get("slug") ?? "").trim(),
    };

    if (values.name.length < 2) {
      notify("error", "创建失败", "请填写至少 2 个字符的品牌空间名称。");
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/workspaces", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const payload = await parseApiPayload(response);

      if (!response.ok) {
        throw new Error(getApiErrorMessage(payload, "创建品牌空间失败。"));
      }

      const message = "品牌空间已创建，接下来完成轻量品牌初始化。";
      notify("success", "创建成功", message);
      router.push("/workspaces/onboarding");
      router.refresh();
    } catch (error) {
      const message = error instanceof Error ? error.message : "创建品牌空间失败。";
      notify("error", "创建失败", message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <CardTitle>创建品牌空间</CardTitle>
        <CardDescription>
          Workspace 是品牌数据的隔离边界。创建后先用轻量问卷初始化品牌上下文。
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          action="/api/workspaces"
          className="space-y-5"
          method="post"
          onSubmit={handleSubmit}
        >
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

          <label className="space-y-2 text-sm font-medium">
            品牌空间名称
            <Input
              name="name"
              placeholder="例如：青柠生活馆"
              required
              minLength={2}
              maxLength={80}
            />
          </label>

          <label className="space-y-2 text-sm font-medium">
            URL 标识，可选
            <Input
              name="slug"
              placeholder="例如：qingning-life"
              pattern="[a-z0-9]+(-[a-z0-9]+)*"
              minLength={3}
              maxLength={60}
            />
            <p className="text-xs text-muted-foreground">
              只能使用小写字母、数字和连字符；留空会自动生成。
            </p>
          </label>

          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Plus className="size-4" />
            )}
            {isSubmitting ? "正在创建..." : "创建并初始化品牌"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
