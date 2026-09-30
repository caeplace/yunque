import { cookies } from "next/headers";
import {
  apiError,
  apiSuccess,
  getWorkspaceErrorMessage,
  userMessages,
} from "@/lib/api-response";
import {
  currentWorkspaceCookieName,
  getCurrentWorkspaceContext,
} from "@/lib/auth/current-workspace";
import { prisma } from "@/lib/prisma";
import { redirectToPath } from "@/lib/redirect-response";
import { workspaceFormSchema } from "@/lib/validators/workspace";

export const runtime = "nodejs";

async function parseWorkspaceRequest(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";
  const isFormRequest =
    contentType.includes("application/x-www-form-urlencoded") ||
    contentType.includes("multipart/form-data");

  if (isFormRequest) {
    const formData = await request.formData();
    return {
      data: {
        name: String(formData.get("name") ?? ""),
        slug: String(formData.get("slug") ?? ""),
      },
      isFormRequest,
    };
  }

  return {
    data: await request.json().catch(() => null),
    isFormRequest,
  };
}

function slugify(value: string) {
  return (
    value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .replace(/-{2,}/g, "-") || "workspace"
  );
}

async function getUniqueSlug(base: string) {
  let slug = base;
  let index = 1;

  while (await prisma.workspace.findUnique({ where: { slug } })) {
    index += 1;
    slug = `${base}-${index}`;
  }

  return slug;
}

export async function POST(request: Request) {
  try {
    if (!process.env.DATABASE_URL) {
      return apiError(userMessages.databaseNotConfigured, {
        status: 500,
        scope: "workspaces/create",
        error: new Error("DATABASE_URL is not configured"),
      });
    }

    const current = await getCurrentWorkspaceContext();

    if (!current.data) {
      return apiError(getWorkspaceErrorMessage(current.error), {
        status: current.status,
      });
    }

    const { data, isFormRequest } = await parseWorkspaceRequest(request);
    const parsed = workspaceFormSchema.safeParse(data);

    if (!parsed.success) {
      return apiError("品牌空间信息有误，请检查名称和标识。", {
        status: 400,
        issues: parsed.error.flatten().fieldErrors,
      });
    }

    const values = parsed.data;
    const baseSlug = slugify(values.slug || values.name);
    const slug = await getUniqueSlug(baseSlug);
    const workspace = await prisma.workspace.create({
      data: {
        name: values.name,
        slug,
        ownerId: current.data.user.id,
      },
    });

    const cookieStore = await cookies();
    cookieStore.set(currentWorkspaceCookieName, workspace.id, {
      path: "/",
      sameSite: "lax",
      httpOnly: true,
    });

    if (isFormRequest) {
      return redirectToPath("/workspaces/onboarding");
    }

    return apiSuccess(
      {
        message: "品牌空间已创建。",
        workspace,
      },
      "workspaces/create",
      { workspaceId: workspace.id, userId: current.data.user.id },
    );
  } catch (error) {
    return apiError("品牌空间创建失败，请稍后重试。", {
      status: 500,
      scope: "workspaces/create",
      error,
    });
  }
}
