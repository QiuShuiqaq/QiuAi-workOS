import type { Metadata } from "next";

import { ContentAdminClient } from "@/components/content-admin/content-admin-client";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "qiuaihub 内容管理后台",
};

export default function ContentAdminPage() {
  return <ContentAdminClient />;
}
