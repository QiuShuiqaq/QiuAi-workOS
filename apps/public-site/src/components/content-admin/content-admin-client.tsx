"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Button,
  Card,
  Form,
  Input,
  Modal,
  Popconfirm,
  Space,
  Spin,
  Switch,
  Table,
  Tabs,
  Tag,
  Typography,
  message,
} from "antd";

import type { StudioCollectionName, StudioContent, StudioLocalizedText } from "@/types/studio";

const { Paragraph, Text, Title } = Typography;
const { TextArea } = Input;

type CollectionRoute =
  | "metrics"
  | "trusted-logos"
  | "solutions"
  | "projects"
  | "case-studies"
  | "open-source"
  | "services"
  | "team"
  | "work-steps";

type PageRoute = "home" | "about" | "contact";

type StudioRecord = {
  id: string;
  slug?: string;
  sortOrder?: number;
  isVisible?: boolean;
  updatedAt?: string;
  [key: string]: unknown;
};

type EditorState =
  | {
      mode: "collection";
      route: CollectionRoute;
      title: string;
      recordId?: string;
      value: string;
    }
  | {
      mode: "page";
      route: PageRoute;
      title: string;
      value: string;
    }
  | null;

const collectionConfigs: Array<{
  route: CollectionRoute;
  contentKey: StudioCollectionName;
  label: string;
  description: string;
}> = [
  { route: "projects", contentKey: "projects", label: "项目", description: "产品化项目、Demo、技术栈与详情页内容。" },
  { route: "case-studies", contentKey: "caseStudies", label: "案例", description: "业务背景、痛点、方案、结果与商业价值。" },
  { route: "open-source", contentKey: "openSource", label: "开源", description: "开源作品集展示，不直接照搬 GitHub 列表。" },
  { route: "services", contentKey: "services", label: "服务", description: "企业 AI 服务模块、交付物和适用团队。" },
  { route: "team", contentKey: "team", label: "团队", description: "团队成员、角色、简介、链接与排序。" },
  { route: "metrics", contentKey: "metrics", label: "成果数据", description: "首页 Success Metrics 数据。" },
  { route: "trusted-logos", contentKey: "trustedLogos", label: "合作 Logo", description: "占位合作场景或真实授权合作方。" },
  { route: "solutions", contentKey: "solutions", label: "解决方案", description: "按业务问题组织的解决方案模块。" },
  { route: "work-steps", contentKey: "workSteps", label: "工作流程", description: "从诊断到上线再到持续优化的交付流程。" },
];

const pageConfigs: Array<{
  route: PageRoute;
  contentKey: PageRoute;
  label: string;
  description: string;
}> = [
  { route: "home", contentKey: "home", label: "首页", description: "Hero 文案与 CTA。" },
  { route: "about", contentKey: "about", label: "关于", description: "能力方向、技术栈与经验介绍。" },
  { route: "contact", contentKey: "contact", label: "联系", description: "邮箱、站点链接与合作说明。" },
];

function nowIso() {
  return new Date().toISOString();
}

function localized(zh: string, en: string): StudioLocalizedText {
  return { zh, en };
}

function stringify(value: unknown) {
  return JSON.stringify(value, null, 2);
}

function isLocalizedText(value: unknown): value is StudioLocalizedText {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as StudioLocalizedText).zh === "string" &&
    typeof (value as StudioLocalizedText).en === "string"
  );
}

function displayText(value: unknown) {
  if (typeof value === "string") {
    return value;
  }

  if (isLocalizedText(value)) {
    return value.zh || value.en;
  }

  return "";
}

function getRecordTitle(record: StudioRecord) {
  return (
    displayText(record.title) ||
    displayText(record.label) ||
    displayText(record.name) ||
    displayText(record.summary) ||
    record.slug ||
    record.id
  );
}

function getEmptyRecord(route: CollectionRoute): StudioRecord {
  const id = `${route}-${Date.now()}`;
  const base = {
    id,
    sortOrder: 100,
    isVisible: true,
    updatedAt: nowIso(),
  };

  switch (route) {
    case "metrics":
      return {
        ...base,
        label: localized("新成果数据", "New Metric"),
        value: "1+",
        note: localized("这里填写说明", "Metric note"),
      };
    case "trusted-logos":
      return {
        ...base,
        name: localized("新合作场景", "New Scenario"),
        category: localized("场景分类", "Scenario category"),
      };
    case "solutions":
      return {
        ...base,
        iconKey: "ai",
        title: localized("新解决方案", "New Solution"),
        summary: localized("这里填写解决方案简介。", "Solution summary."),
        problems: [localized("这里填写客户问题。", "Customer problem.")],
        capabilities: [localized("这里填写交付能力。", "Capability.")],
        tags: ["AI"],
      };
    case "projects":
      return {
        ...base,
        slug: `project-${Date.now()}`,
        title: localized("新项目", "New Project"),
        subtitle: localized("项目副标题", "Project subtitle"),
        summary: localized("这里填写项目简介。", "Project summary."),
        problem: localized("这里填写解决的问题。", "Problem solved."),
        value: localized("这里填写业务价值。", "Business value."),
        architecture: localized("这里填写技术架构。", "Architecture."),
        techStack: ["Next.js", "AI"],
        coverImage: null,
        screenshots: [],
        demoUrl: null,
        githubUrl: null,
        status: localized("规划中", "Planned"),
        tags: ["AI"],
      };
    case "case-studies":
      return {
        ...base,
        slug: `case-${Date.now()}`,
        title: localized("新案例", "New Case Study"),
        industry: localized("行业 / 场景", "Industry / Scenario"),
        background: localized("这里填写项目背景。", "Background."),
        painPoints: [localized("这里填写客户痛点。", "Pain point.")],
        solution: localized("这里填写解决方案。", "Solution."),
        architecture: localized("这里填写系统架构。", "Architecture."),
        results: [localized("这里填写最终效果。", "Result.")],
        businessValue: localized("这里填写商业价值。", "Business value."),
        reusableCapabilities: [localized("这里填写可复用能力。", "Reusable capability.")],
        coverImage: null,
        screenshots: [],
        metrics: [],
        tags: ["AI"],
        isAnonymized: true,
      };
    case "open-source":
      return {
        ...base,
        slug: `open-source-${Date.now()}`,
        name: "New Open Source Project",
        summary: localized("这里填写开源项目简介。", "Open source summary."),
        techStack: ["TypeScript"],
        githubUrl: "https://github.com/QiuShuiqaq",
        demoUrl: null,
        starsLabel: "New",
        latestUpdate: "2026-07",
        status: localized("维护中", "Maintained"),
        tags: ["Open Source"],
      };
    case "services":
      return {
        ...base,
        slug: `service-${Date.now()}`,
        title: localized("新服务", "New Service"),
        summary: localized("这里填写服务简介。", "Service summary."),
        deliverables: [localized("交付物", "Deliverable")],
        fitFor: [localized("适用团队", "Fit for")],
        tags: ["AI"],
      };
    case "team":
      return {
        ...base,
        slug: `team-${Date.now()}`,
        name: localized("新成员", "New Member"),
        role: localized("角色名称", "Role"),
        summary: localized("这里填写团队成员或协作角色简介。", "Team member or collaborator summary."),
        avatarUrl: null,
        links: [],
        tags: ["Team"],
      };
    case "work-steps":
      return {
        ...base,
        title: localized("新流程", "New Step"),
        summary: localized("这里填写流程说明。", "Step summary."),
      };
  }
}

async function readApiError(response: Response) {
  const body = await response.json().catch(() => null);
  if (body?.error?.message) {
    return String(body.error.message);
  }

  if (typeof body?.error === "string") {
    return body.error;
  }

  return `请求失败：${response.status}`;
}

export function ContentAdminClient() {
  const [messageApi, contextHolder] = message.useMessage();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  const [configured, setConfigured] = useState(true);
  const [content, setContent] = useState<StudioContent | null>(null);
  const [editor, setEditor] = useState<EditorState>(null);
  const [form] = Form.useForm<{ secret: string }>();

  const collectionsByRoute = useMemo(
    () => new Map(collectionConfigs.map((item) => [item.route, item] as const)),
    [],
  );

  const loadContent = useCallback(async () => {
    const response = await fetch("/api/content-admin/studio-content", { cache: "no-store" });
    if (!response.ok) {
      throw new Error(await readApiError(response));
    }

    setContent((await response.json()) as StudioContent);
  }, []);

  const refreshSession = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/content-admin/session", { cache: "no-store" });
      const session = (await response.json()) as { configured: boolean; authenticated: boolean };
      setConfigured(session.configured);
      setAuthenticated(session.authenticated);
      if (session.authenticated) {
        await loadContent();
      }
    } catch (error) {
      messageApi.error(error instanceof Error ? error.message : "加载后台状态失败");
    } finally {
      setLoading(false);
    }
  }, [loadContent, messageApi]);

  useEffect(() => {
    void refreshSession();
  }, [refreshSession]);

  const handleLogin = async ({ secret }: { secret: string }) => {
    setSaving(true);
    try {
      const response = await fetch("/api/content-admin/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ secret }),
      });

      if (!response.ok) {
        throw new Error(await readApiError(response));
      }

      setAuthenticated(true);
      form.resetFields();
      await loadContent();
      messageApi.success("已进入内容管理后台");
    } catch (error) {
      messageApi.error(error instanceof Error ? error.message : "登录失败");
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    await fetch("/api/content-admin/logout", { method: "POST" });
    setAuthenticated(false);
    setContent(null);
  };

  const openCollectionEditor = (route: CollectionRoute, record?: StudioRecord) => {
    const config = collectionsByRoute.get(route);
    setEditor({
      mode: "collection",
      route,
      title: record ? `编辑${config?.label ?? "内容"}` : `新增${config?.label ?? "内容"}`,
      recordId: record?.id,
      value: stringify(record ?? getEmptyRecord(route)),
    });
  };

  const openPageEditor = (route: PageRoute, value: unknown, title: string) => {
    setEditor({
      mode: "page",
      route,
      title,
      value: stringify(value),
    });
  };

  const saveEditor = async () => {
    if (!editor) {
      return;
    }

    let payload: unknown;
    try {
      payload = JSON.parse(editor.value);
    } catch {
      messageApi.error("JSON 格式错误，请检查逗号、引号和括号。");
      return;
    }

    setSaving(true);
    try {
      const isCollection = editor.mode === "collection";
      const method = isCollection ? (editor.recordId ? "PATCH" : "POST") : "PATCH";
      const url =
        editor.mode === "collection"
          ? `/api/content-admin/${editor.route}${editor.recordId ? `/${editor.recordId}` : ""}`
          : `/api/content-admin/${editor.route}`;

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(await readApiError(response));
      }

      await loadContent();
      setEditor(null);
      messageApi.success("已保存");
    } catch (error) {
      messageApi.error(error instanceof Error ? error.message : "保存失败");
    } finally {
      setSaving(false);
    }
  };

  const deleteRecord = async (route: CollectionRoute, id: string) => {
    setSaving(true);
    try {
      const response = await fetch(`/api/content-admin/${route}/${id}`, { method: "DELETE" });
      if (!response.ok) {
        throw new Error(await readApiError(response));
      }

      await loadContent();
      messageApi.success("已删除");
    } catch (error) {
      messageApi.error(error instanceof Error ? error.message : "删除失败");
    } finally {
      setSaving(false);
    }
  };

  const toggleVisible = async (route: CollectionRoute, record: StudioRecord, isVisible: boolean) => {
    const next = {
      ...record,
      isVisible,
    };

    setSaving(true);
    try {
      const response = await fetch(`/api/content-admin/${route}/${record.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(next),
      });

      if (!response.ok) {
        throw new Error(await readApiError(response));
      }

      await loadContent();
      messageApi.success(isVisible ? "已显示" : "已隐藏");
    } catch (error) {
      messageApi.error(error instanceof Error ? error.message : "更新状态失败");
    } finally {
      setSaving(false);
    }
  };

  const patchRecord = async (route: CollectionRoute, record: StudioRecord) => {
    const response = await fetch(`/api/content-admin/${route}/${record.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(record),
    });

    if (!response.ok) {
      throw new Error(await readApiError(response));
    }
  };

  const moveRecord = async (config: (typeof collectionConfigs)[number], record: StudioRecord, direction: "up" | "down") => {
    if (!content) {
      return;
    }

    const items = ((content[config.contentKey] ?? []) as unknown as StudioRecord[]).slice().sort((left, right) => {
      return (left.sortOrder ?? 0) - (right.sortOrder ?? 0);
    });
    const currentIndex = items.findIndex((item) => item.id === record.id);
    const targetIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
    const target = items[targetIndex];

    if (currentIndex < 0 || !target) {
      return;
    }

    const currentSortOrder = record.sortOrder ?? currentIndex + 1;
    const targetSortOrder = target.sortOrder ?? targetIndex + 1;

    setSaving(true);
    try {
      await Promise.all([
        patchRecord(config.route, { ...record, sortOrder: targetSortOrder }),
        patchRecord(config.route, { ...target, sortOrder: currentSortOrder }),
      ]);
      await loadContent();
      messageApi.success("排序已更新");
    } catch (error) {
      messageApi.error(error instanceof Error ? error.message : "排序失败");
    } finally {
      setSaving(false);
    }
  };

  const renderCollection = (config: (typeof collectionConfigs)[number]) => {
    const items = content ? ((content[config.contentKey] ?? []) as unknown as StudioRecord[]) : [];
    const columns = [
      {
        title: "标题",
        dataIndex: "id",
        render: (_: unknown, record: StudioRecord) => (
          <Space direction="vertical" size={2}>
            <Text strong>{getRecordTitle(record)}</Text>
            <Text type="secondary">{record.slug ?? record.id}</Text>
          </Space>
        ),
      },
      {
        title: "排序",
        dataIndex: "sortOrder",
        width: 90,
      },
      {
        title: "显示",
        dataIndex: "isVisible",
        width: 100,
        render: (_: unknown, record: StudioRecord) => (
          <Switch
            size="small"
            checked={record.isVisible !== false}
            loading={saving}
            onChange={(checked) => void toggleVisible(config.route, record, checked)}
          />
        ),
      },
      {
        title: "更新时间",
        dataIndex: "updatedAt",
        width: 190,
        render: (value: string | undefined) => <Text type="secondary">{value ? value.slice(0, 19).replace("T", " ") : "-"}</Text>,
      },
      {
        title: "操作",
        key: "actions",
        width: 260,
        render: (_: unknown, record: StudioRecord) => {
          const recordIndex = items.findIndex((item) => item.id === record.id);
          return (
            <Space wrap>
              <Button size="small" disabled={saving || recordIndex <= 0} onClick={() => void moveRecord(config, record, "up")}>
                上移
              </Button>
              <Button
                size="small"
                disabled={saving || recordIndex < 0 || recordIndex >= items.length - 1}
                onClick={() => void moveRecord(config, record, "down")}
              >
                下移
              </Button>
              <Button size="small" onClick={() => openCollectionEditor(config.route, record)}>
                编辑
              </Button>
              <Popconfirm
                title="确认删除？"
                description="删除后会从 JSON 内容中移除。"
                okText="删除"
                cancelText="取消"
                onConfirm={() => void deleteRecord(config.route, record.id)}
              >
                <Button size="small" danger>
                  删除
                </Button>
              </Popconfirm>
            </Space>
          );
        },
      },
    ];

    return (
      <Card
        title={config.label}
        extra={
          <Button type="primary" onClick={() => openCollectionEditor(config.route)}>
            新增
          </Button>
        }
      >
        <Paragraph type="secondary">{config.description}</Paragraph>
        <Table
          rowKey="id"
          size="middle"
          columns={columns}
          dataSource={items}
          pagination={{ pageSize: 8, showSizeChanger: false }}
          scroll={{ x: 760 }}
        />
      </Card>
    );
  };

  const renderPageSection = (config: (typeof pageConfigs)[number]) => {
    const value = content?.[config.contentKey];

    return (
      <Card
        title={config.label}
        extra={
          <Button onClick={() => openPageEditor(config.route, value, `编辑${config.label}`)} disabled={!value}>
            编辑
          </Button>
        }
      >
        <Paragraph type="secondary">{config.description}</Paragraph>
        <pre className="content-admin-preview">{stringify(value)}</pre>
      </Card>
    );
  };

  if (loading) {
    return (
      <main className="content-admin-page content-admin-page--center">
        {contextHolder}
        <Spin size="large" />
      </main>
    );
  }

  if (!authenticated) {
    return (
      <main className="content-admin-page content-admin-page--center">
        {contextHolder}
        <Card className="content-admin-login-card">
          <Space direction="vertical" size={18} style={{ width: "100%" }}>
            <div>
              <Title level={2}>内容管理后台</Title>
              <Paragraph type="secondary">
                输入开发者密码后，可以维护 qiuaihub 企业官网的项目、案例、服务和首页内容。
              </Paragraph>
            </div>
            {!configured ? (
              <Tag color="error">服务端未配置 DOWNLOAD_ADMIN_SECRET_HASH，暂时无法登录。</Tag>
            ) : null}
            <Form form={form} layout="vertical" onFinish={(values) => void handleLogin(values)}>
              <input type="text" name="username" autoComplete="username" value="content-admin" hidden readOnly />
              <Form.Item name="secret" label="开发者密码" rules={[{ required: true, message: "请输入开发者密码" }]}>
                <Input.Password autoComplete="current-password" placeholder="输入开发者密码" />
              </Form.Item>
              <Button type="primary" htmlType="submit" loading={saving} block disabled={!configured}>
                进入后台
              </Button>
            </Form>
          </Space>
        </Card>
      </main>
    );
  }

  return (
    <main className="content-admin-page">
      {contextHolder}
      <section className="content-admin-hero">
        <div>
          <span>CONTENT ADMIN</span>
          <Title level={1}>qiuaihub 内容管理</Title>
          <Paragraph>按内容类型独立维护公开站数据，保存后公开页面会读取最新 JSON 内容。</Paragraph>
        </div>
        <Space wrap>
          <Button onClick={() => void loadContent()}>刷新</Button>
          <Button onClick={() => void handleLogout()}>退出</Button>
        </Space>
      </section>

      <Tabs
        className="content-admin-tabs"
        items={[
          {
            key: "pages",
            label: "页面配置",
            children: <div className="content-admin-grid">{pageConfigs.map((config) => renderPageSection(config))}</div>,
          },
          ...collectionConfigs.map((config) => ({
            key: config.route,
            label: config.label,
            children: renderCollection(config),
          })),
        ]}
      />

      <Modal
        title={editor?.title}
        open={Boolean(editor)}
        width={920}
        okText="保存"
        cancelText="取消"
        confirmLoading={saving}
        onOk={() => void saveEditor()}
        onCancel={() => setEditor(null)}
      >
        <Paragraph type="secondary">
          当前版本使用结构化 JSON 编辑单条内容；字段已经按内容类型拆分，保存时会经过服务端 schema 校验。
        </Paragraph>
        <TextArea
          className="content-admin-json-editor"
          value={editor?.value ?? ""}
          onChange={(event) => setEditor((current) => (current ? { ...current, value: event.target.value } : current))}
          autoSize={{ minRows: 18, maxRows: 28 }}
        />
      </Modal>
    </main>
  );
}
