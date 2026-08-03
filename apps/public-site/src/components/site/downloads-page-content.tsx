"use client";

import {
  CloudDownloadOutlined,
  DeleteOutlined,
  EditOutlined,
  EyeInvisibleOutlined,
  EyeOutlined,
  FileTextOutlined,
  PlusOutlined,
  SettingOutlined,
} from "@ant-design/icons";
import {
  Button,
  Drawer,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Select,
  Space,
  Switch,
  Tag,
  Typography,
  message,
} from "antd";
import { useEffect, useState, useTransition } from "react";

import { ResourceDownloadButton } from "@/components/site/resource-download-button";
import type { DownloadAdminDraft, DownloadAdminItem, DownloadsPageData, SiteLanguage } from "@/types/site";

const { Paragraph, Text, Title } = Typography;
const { TextArea } = Input;

type AdminSession = {
  configured: boolean;
  authenticated: boolean;
};

const PLATFORM_OPTIONS = [
  { label: "Windows", value: "windows" },
  { label: "macOS", value: "macos" },
  { label: "Linux", value: "linux" },
  { label: "Cross-platform", value: "cross-platform" },
  { label: "Android", value: "android" },
  { label: "iOS", value: "ios" },
] as const;

const PACKAGE_OPTIONS = [
  { label: "EXE", value: "exe" },
  { label: "MSI", value: "msi" },
  { label: "ZIP", value: "zip" },
  { label: "DMG", value: "dmg" },
  { label: "PKG", value: "pkg" },
  { label: "AppImage", value: "appimage" },
  { label: "TAR.GZ", value: "tar.gz" },
  { label: "Other", value: "other" },
] as const;

function splitLines(input?: string) {
  return (input ?? "")
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeDraft(values: Record<string, unknown>): DownloadAdminDraft {
  return {
    projectName: String(values.projectName ?? "").trim(),
    summaryZh: String(values.summaryZh ?? "").trim(),
    summaryEn: String(values.summaryEn ?? "").trim() || undefined,
    platform: values.platform as DownloadAdminDraft["platform"],
    packageType: values.packageType as DownloadAdminDraft["packageType"],
    version: String(values.version ?? "").trim(),
    githubRepo: String(values.githubRepo ?? "").trim(),
    releaseTag: String(values.releaseTag ?? "").trim(),
    appAssetName: String(values.appAssetName ?? "").trim(),
    pdfAssetName: String(values.pdfAssetName ?? "").trim() || null,
    notesZh: splitLines(String(values.notesZh ?? "")),
    notesEn: splitLines(String(values.notesEn ?? "")),
    isVisible: Boolean(values.isVisible ?? true),
    sortOrder: Number(values.sortOrder ?? 999),
  };
}

function toFormValues(item?: DownloadAdminItem | null) {
  if (!item) {
    return {
      projectName: "",
      summaryZh: "",
      summaryEn: "",
      platform: "windows",
      packageType: "exe",
      version: "",
      githubRepo: "QiuShuiqaq/QiuAi-workOS",
      releaseTag: "",
      appAssetName: "",
      pdfAssetName: "",
      notesZh: "",
      notesEn: "",
      isVisible: true,
      sortOrder: 999,
    };
  }

  return {
    projectName: item.projectName,
    summaryZh: item.summaryZh,
    summaryEn: item.summaryEn,
    platform:
      item.platformEn === "Windows"
        ? "windows"
        : item.platformEn === "macOS"
          ? "macos"
          : item.platformEn === "Linux"
            ? "linux"
            : item.platformEn === "Android"
              ? "android"
              : item.platformEn === "iOS"
                ? "ios"
                : "cross-platform",
    packageType: item.formatEn.toLowerCase() as DownloadAdminDraft["packageType"],
    version: item.version,
    githubRepo: item.githubRepo,
    releaseTag: item.releaseTag,
    appAssetName: item.appAssetName,
    pdfAssetName: item.pdfAssetName ?? "",
    notesZh: item.notesZh.join("\n"),
    notesEn: item.notesEn.join("\n"),
    isVisible: item.isVisible,
    sortOrder: item.sortOrder,
  };
}

async function readJson<T>(response: Response) {
  return (await response.json()) as T;
}

export function DownloadsPageContent({
  data,
  lang,
}: {
  data: DownloadsPageData;
  lang: SiteLanguage;
}) {
  const [downloadCounts, setDownloadCounts] = useState<Record<string, number>>({});
  const [adminSession, setAdminSession] = useState<AdminSession>({ configured: false, authenticated: false });
  const [adminItems, setAdminItems] = useState<DownloadAdminItem[]>([]);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<DownloadAdminItem | null>(null);
  const [authSecret, setAuthSecret] = useState("");
  const [isPending, startTransition] = useTransition();
  const [form] = Form.useForm();
  const [authMessageApi, authMessageContext] = message.useMessage();

  useEffect(() => {
    const slugs = data.items.map((item) => item.slug).join(",");
    if (!slugs) {
      return;
    }

    void fetch(`/api/site-stats?scope=downloads&slugs=${encodeURIComponent(slugs)}`)
      .then(async (response) => {
        if (!response.ok) {
          return null;
        }

        return (await response.json()) as Record<string, number>;
      })
      .then((payload) => {
        if (payload) {
          setDownloadCounts(payload);
        }
      })
      .catch(() => undefined);
  }, [data.items]);

  useEffect(() => {
    void fetch("/api/download-admin/session")
      .then((response) => readJson<AdminSession>(response))
      .then((payload) => {
        setAdminSession(payload);
        if (payload.authenticated) {
          return fetch("/api/download-admin/download-items");
        }

        return null;
      })
      .then(async (response) => {
        if (!response || !response.ok) {
          return;
        }

        const payload = await readJson<DownloadAdminItem[]>(response);
        setAdminItems(payload);
      })
      .catch(() => undefined);
  }, []);

  const visibleAdminItems = adminSession.authenticated ? adminItems : [];
  const items = adminSession.authenticated && adminItems.length ? adminItems.map((item) => item.publicItem) : data.items;

  const refreshAdminItems = async () => {
    const response = await fetch("/api/download-admin/download-items");
    if (!response.ok) {
      throw new Error("Failed to load admin items");
    }

    const payload = await readJson<DownloadAdminItem[]>(response);
    setAdminItems(payload);
  };

  const openCreateDrawer = () => {
    setEditingItem(null);
    form.setFieldsValue(toFormValues(null));
    setIsDrawerOpen(true);
  };

  const openEditDrawer = (item: DownloadAdminItem) => {
    setEditingItem(item);
    form.setFieldsValue(toFormValues(item));
    setIsDrawerOpen(true);
  };

  const submitAuth = () => {
    startTransition(() => {
      void fetch("/api/download-admin/auth", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ secret: authSecret }),
      })
        .then(async (response) => {
          if (!response.ok) {
            const payload = (await response.json().catch(() => null)) as { error?: string } | null;
            throw new Error(payload?.error || "Authentication failed");
          }

          setAdminSession({ configured: true, authenticated: true });
          setIsAuthOpen(false);
          setAuthSecret("");
          await refreshAdminItems();
          authMessageApi.success(lang === "zh" ? "已进入配置模式" : "Config mode enabled");
        })
        .catch((error: unknown) => {
          authMessageApi.error(error instanceof Error ? error.message : "Authentication failed");
        });
    });
  };

  const submitItem = async () => {
    const values = await form.validateFields();
    const payload = normalizeDraft(values);
    const endpoint = editingItem
      ? `/api/download-admin/download-items/${editingItem.id}`
      : "/api/download-admin/download-items";
    const method = editingItem ? "PATCH" : "POST";

    startTransition(() => {
      void fetch(endpoint, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      })
        .then(async (response) => {
          const json = (await response.json().catch(() => null)) as { error?: string } | DownloadAdminItem | null;
          if (!response.ok) {
            throw new Error((json as { error?: string } | null)?.error || "Save failed");
          }

          await refreshAdminItems();
          setIsDrawerOpen(false);
          setEditingItem(null);
          authMessageApi.success(lang === "zh" ? "下载项已保存" : "Download item saved");
        })
        .catch((error: unknown) => {
          authMessageApi.error(error instanceof Error ? error.message : "Save failed");
        });
    });
  };

  const deleteItem = (id: string) => {
    startTransition(() => {
      void fetch(`/api/download-admin/download-items/${id}`, {
        method: "DELETE",
      })
        .then(async (response) => {
          if (!response.ok) {
            const payload = (await response.json().catch(() => null)) as { error?: string } | null;
            throw new Error(payload?.error || "Delete failed");
          }

          await refreshAdminItems();
          authMessageApi.success(lang === "zh" ? "下载项已删除" : "Download item deleted");
        })
        .catch((error: unknown) => {
          authMessageApi.error(error instanceof Error ? error.message : "Delete failed");
        });
    });
  };

  const exitConfigMode = () => {
    startTransition(() => {
      void fetch("/api/download-admin/logout", { method: "POST" })
        .then(() => {
          setAdminSession((current) => ({ ...current, authenticated: false }));
          setAdminItems([]);
        })
        .catch(() => undefined);
    });
  };

  return (
    <>
      {authMessageContext}
      <Space direction="vertical" size={40} className="public-stack" style={{ width: "100%" }}>
        <section className="page-hero page-hero--downloads">
          <span className="site-kicker">{data.eyebrow}</span>
          <Title style={{ margin: 0, fontSize: "clamp(46px, 5vw, 72px)", lineHeight: 0.96 }}>{data.title}</Title>
          <Paragraph style={{ maxWidth: 860, margin: 0, fontSize: 18, lineHeight: 1.8, color: "var(--muted)" }}>
            {data.summary}
          </Paragraph>
          <div className="hero-note-row">
            {data.notes.map((note) => (
              <div key={note} className="hero-note-chip">
                <Text>{note}</Text>
              </div>
            ))}
          </div>
        </section>

        <section className="section-band section-band--wide">
          <div className="section-split">
            <div className="section-heading">
              <span className="site-kicker">{lang === "zh" ? "文件" : "Files"}</span>
              <Title level={2} style={{ margin: 0 }}>
                {lang === "zh" ? "下面是现在可下载的文件。" : "These are the files currently available."}
              </Title>
            </div>
            <div className="downloads-admin-heading">
              <Space size={10} wrap>
                {adminSession.authenticated ? (
                  <>
                    <Button icon={<PlusOutlined />} onClick={openCreateDrawer}>
                      {lang === "zh" ? "新增" : "Add"}
                    </Button>
                    <Button onClick={exitConfigMode}>{lang === "zh" ? "退出配置" : "Exit Config"}</Button>
                  </>
                ) : (
                  <Button
                    icon={<SettingOutlined />}
                    onDoubleClick={() => setIsAuthOpen(true)}
                    disabled={!adminSession.configured}
                  >
                    {lang === "zh" ? "配置" : "Config"}
                  </Button>
                )}
              </Space>
            </div>
            <Paragraph className="section-rail-copy" style={{ margin: 0 }}>
              {lang === "zh" ? "安装包和 PDF 分开提供，需要哪个就直接下载。" : "Packages and PDFs are listed separately."}
            </Paragraph>
          </div>

          <div className="downloads-grid">
            {items.map((item) => {
              const count = downloadCounts[item.slug] ?? 0;
              const adminItem = visibleAdminItems.find((entry) => entry.slug === item.slug) ?? null;

              return (
                <article key={item.slug} className="download-row">
                  <div className="download-row__stub">
                    <Text strong style={{ color: "var(--foreground-strong)", fontSize: 18 }}>
                      {item.platform}
                    </Text>
                    <Text>{item.format}</Text>
                    {adminItem ? (
                      <Tag color={adminItem.isVisible ? "green" : "default"}>
                        {adminItem.isVisible
                          ? lang === "zh"
                            ? "显示中"
                            : "Visible"
                          : lang === "zh"
                            ? "已隐藏"
                            : "Hidden"}
                      </Tag>
                    ) : null}
                  </div>

                  <div className="download-row__copy">
                    <Space direction="vertical" size={14} style={{ width: "100%" }}>
                      <div className="download-row__meta">
                        <Text>{item.version}</Text>
                        <Text>{item.fileSize}</Text>
                        <Text>{item.updatedAt}</Text>
                      </div>
                      <div className="download-row__title-row">
                        <Title level={4} style={{ margin: 0 }}>
                          {item.title}
                        </Title>
                        <Text className="download-row__file">{item.fileName}</Text>
                      </div>
                      <Paragraph style={{ margin: 0, color: "var(--muted)", lineHeight: 1.8 }}>{item.summary}</Paragraph>
                      {item.notes.length ? (
                        <div className="download-notes">
                          {item.notes.map((note) => (
                            <Text key={note}>{note}</Text>
                          ))}
                        </div>
                      ) : null}
                    </Space>
                  </div>

                  <div className="download-row__actions">
                    <div className="download-count-card">
                      <div className="download-count-icon" aria-hidden="true">
                        <span className="download-count-icon__bar download-count-icon__bar--short" />
                        <span className="download-count-icon__bar download-count-icon__bar--long" />
                        <span className="download-count-icon__bar download-count-icon__bar--mid" />
                      </div>
                      <div className="download-count-card__copy">
                        <Text strong>{lang === "zh" ? "下载数量" : "Downloads"}</Text>
                        <Text className="download-count-card__value">{count}</Text>
                      </div>
                    </div>

                    <div className="download-card-preview">
                      <CloudDownloadOutlined style={{ fontSize: 32, color: "var(--accent)" }} />
                      <Text strong>{lang === "zh" ? "安装包" : "Package"}</Text>
                      <Text style={{ color: "var(--muted)", textAlign: "center" }}>{item.fileName}</Text>
                    </div>

                    <div className="download-row__button-stack">
                      <ResourceDownloadButton
                        href={item.downloadPath}
                        lang={lang}
                        disabled={!item.downloadPath}
                        onTracked={() => {
                          setDownloadCounts((current) => ({
                            ...current,
                            [item.slug]: (current[item.slug] ?? 0) + 1,
                          }));
                        }}
                      />

                      {item.tutorialPdfName ? (
                        <Button
                          size="large"
                          icon={<FileTextOutlined />}
                          disabled={!item.tutorialPdfPath || isPending}
                          onClick={(event) => {
                            if (!item.tutorialPdfPath) {
                              return;
                            }

                            event.preventDefault();
                            setDownloadCounts((current) => ({
                              ...current,
                              [item.slug]: (current[item.slug] ?? 0) + 1,
                            }));
                            window.open(item.tutorialPdfPath, "_blank", "noopener,noreferrer");
                          }}
                        >
                          {!item.tutorialPdfPath
                            ? lang === "zh"
                              ? "PDF 即将提供"
                              : "PDF Coming Soon"
                            : lang === "zh"
                              ? "下载 PDF"
                              : "Download PDF"}
                        </Button>
                      ) : null}
                    </div>

                    {adminItem ? (
                      <div className="download-row__admin-bar">
                        <Button icon={<EditOutlined />} onClick={() => openEditDrawer(adminItem)}>
                          {lang === "zh" ? "编辑" : "Edit"}
                        </Button>
                        <Button icon={adminItem.isVisible ? <EyeInvisibleOutlined /> : <EyeOutlined />} onClick={() => {
                          setEditingItem(adminItem);
                          form.setFieldsValue({
                            ...toFormValues(adminItem),
                            isVisible: !adminItem.isVisible,
                          });
                          void submitItem();
                        }}>
                          {adminItem.isVisible ? (lang === "zh" ? "隐藏" : "Hide") : lang === "zh" ? "显示" : "Show"}
                        </Button>
                        <Popconfirm
                          title={lang === "zh" ? "确认删除这个下载项？" : "Delete this download item?"}
                          onConfirm={() => deleteItem(adminItem.id)}
                        >
                          <Button danger icon={<DeleteOutlined />}>
                            {lang === "zh" ? "删除" : "Delete"}
                          </Button>
                        </Popconfirm>
                      </div>
                    ) : null}
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      </Space>

      <Modal
        title={lang === "zh" ? "配置身份验证" : "Config Authentication"}
        open={isAuthOpen}
        onOk={submitAuth}
        onCancel={() => setIsAuthOpen(false)}
        confirmLoading={isPending}
        okText={lang === "zh" ? "验证" : "Verify"}
      >
        <Space direction="vertical" size={12} style={{ width: "100%" }}>
          <Paragraph style={{ margin: 0, color: "var(--muted)" }}>
            {lang === "zh" ? "双击进入后，输入你的管理员口令。" : "Double-click entry confirmed. Enter your admin secret."}
          </Paragraph>
          <Input.Password
            value={authSecret}
            onChange={(event) => setAuthSecret(event.target.value)}
            placeholder={lang === "zh" ? "管理员口令" : "Admin secret"}
          />
        </Space>
      </Modal>

      <Drawer
        title={editingItem ? (lang === "zh" ? "编辑下载项" : "Edit Download Item") : lang === "zh" ? "新增下载项" : "Add Download Item"}
        placement="right"
        width={460}
        open={isDrawerOpen}
        onClose={() => {
          setIsDrawerOpen(false);
          setEditingItem(null);
        }}
        extra={
          <Button type="primary" onClick={submitItem} loading={isPending}>
            {lang === "zh" ? "保存" : "Save"}
          </Button>
        }
      >
        <Form form={form} layout="vertical" initialValues={toFormValues(null)}>
          <Form.Item name="projectName" label={lang === "zh" ? "项目名" : "Project Name"} rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="summaryZh" label={lang === "zh" ? "简介" : "Summary"} rules={[{ required: true }]}>
            <TextArea rows={3} />
          </Form.Item>
          <Form.Item name="summaryEn" label={lang === "zh" ? "英文简介" : "English Summary"}>
            <TextArea rows={2} />
          </Form.Item>
          <div className="download-admin-form-grid">
            <Form.Item name="platform" label={lang === "zh" ? "系统" : "Platform"} rules={[{ required: true }]}>
              <Select options={PLATFORM_OPTIONS as unknown as { label: string; value: string }[]} />
            </Form.Item>
            <Form.Item name="packageType" label={lang === "zh" ? "安装包类型" : "Package Type"} rules={[{ required: true }]}>
              <Select options={PACKAGE_OPTIONS as unknown as { label: string; value: string }[]} />
            </Form.Item>
          </div>
          <div className="download-admin-form-grid">
            <Form.Item name="version" label="Version" rules={[{ required: true }]}>
              <Input />
            </Form.Item>
            <Form.Item name="releaseTag" label={lang === "zh" ? "Release Tag" : "Release Tag"} rules={[{ required: true }]}>
              <Input />
            </Form.Item>
          </div>
          <Form.Item name="githubRepo" label="GitHub Repo" rules={[{ required: true }]}>
            <Input placeholder="QiuShuiqaq/QiuAi-workOS" />
          </Form.Item>
          <Form.Item name="appAssetName" label={lang === "zh" ? "安装包文件名" : "App Asset File"} rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="pdfAssetName" label={lang === "zh" ? "PDF 文件名" : "PDF Asset File"}>
            <Input />
          </Form.Item>
          <Form.Item name="notesZh" label={lang === "zh" ? "说明要点" : "Notes"}>
            <TextArea rows={4} placeholder={lang === "zh" ? "每行一条" : "One item per line"} />
          </Form.Item>
          <Form.Item name="notesEn" label={lang === "zh" ? "英文说明要点" : "English Notes"}>
            <TextArea rows={3} placeholder={lang === "zh" ? "可留空，默认跟中文一致" : "Optional"} />
          </Form.Item>
          <div className="download-admin-form-grid">
            <Form.Item name="sortOrder" label={lang === "zh" ? "排序" : "Sort Order"}>
              <InputNumber min={1} max={9999} style={{ width: "100%" }} />
            </Form.Item>
            <Form.Item name="isVisible" label={lang === "zh" ? "公开显示" : "Visible"} valuePropName="checked">
              <Switch />
            </Form.Item>
          </div>
        </Form>
      </Drawer>
    </>
  );
}
