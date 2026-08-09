import {
  CopyOutlined,
  DeleteOutlined,
  EditOutlined,
  MoonOutlined,
  PlusOutlined,
  SearchOutlined,
  SnippetsOutlined,
  StarOutlined
} from '@ant-design/icons';
import Button from 'antd/es/button';
import Empty from 'antd/es/empty';
import Flex from 'antd/es/flex';
import Form from 'antd/es/form';
import Input from 'antd/es/input';
import Modal from 'antd/es/modal';
import Popconfirm from 'antd/es/popconfirm';
import Select from 'antd/es/select';
import Space from 'antd/es/space';
import Tabs from 'antd/es/tabs';
import Tooltip from 'antd/es/tooltip';
import Typography from 'antd/es/typography';
import message from 'antd/es/message';
import { useMemo, useState } from 'react';

import {
  defaultPromptSnippets,
  promptSnippetCategoryOptions,
  type PromptSnippetCategory
} from './prompt-snippet-catalog';

type PromptSnippetBoardKey = 'default' | 'custom';

interface PromptSnippet {
  id: string;
  title: string;
  content: string;
  createdAt?: string;
  updatedAt?: string;
  category?: PromptSnippetCategory;
}

interface PromptSnippetFormValues {
  title: string;
  content: string;
}

const promptSnippetStorageKey = 'qiuai.pc.prompt-snippets.v1';
const promptSnippetDecorationVariants = ['star', 'moon', 'line', 'star-line'] as const;

function createPromptSnippetId() {
  return `snippet_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function normalizePromptSnippet(value: unknown): PromptSnippet | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;
  const title = typeof record.title === 'string' ? record.title.trim() : '';
  const content = typeof record.content === 'string' ? record.content.trim() : '';
  if (!title || !content) {
    return null;
  }

  const now = new Date().toISOString();
  return {
    id: typeof record.id === 'string' && record.id.trim() ? record.id : createPromptSnippetId(),
    title,
    content,
    createdAt: typeof record.createdAt === 'string' ? record.createdAt : now,
    updatedAt: typeof record.updatedAt === 'string' ? record.updatedAt : now
  };
}

function readPromptSnippets(): PromptSnippet[] {
  if (typeof window === 'undefined') {
    return [];
  }

  try {
    const rawValue = window.localStorage.getItem(promptSnippetStorageKey);
    if (!rawValue) {
      return [];
    }

    const parsed = JSON.parse(rawValue);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .map(normalizePromptSnippet)
      .filter((snippet): snippet is PromptSnippet => Boolean(snippet))
      .sort((left, right) => (right.updatedAt ?? '').localeCompare(left.updatedAt ?? ''));
  } catch {
    return [];
  }
}

function writePromptSnippets(snippets: PromptSnippet[]) {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.setItem(promptSnippetStorageKey, JSON.stringify(snippets));
  } catch {
    message.error('标签库保存失败，请检查本机存储空间。');
  }
}

function formatPromptSnippetTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return new Intl.DateTimeFormat('zh-CN', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date);
}

export function PromptSnippetBoard() {
  const [snippets, setSnippets] = useState<PromptSnippet[]>(() => readPromptSnippets());
  const [activeBoard, setActiveBoard] = useState<PromptSnippetBoardKey>('default');
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'all' | PromptSnippetCategory>('all');
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingSnippetId, setEditingSnippetId] = useState('');
  const [form] = Form.useForm<PromptSnippetFormValues>();

  const filteredCustomSnippets = useMemo(() => {
    const query = searchQuery.trim().toLocaleLowerCase();
    if (!query) {
      return snippets;
    }

    return snippets.filter(
      (snippet) =>
        snippet.title.toLocaleLowerCase().includes(query) ||
        snippet.content.toLocaleLowerCase().includes(query)
    );
  }, [searchQuery, snippets]);

  const filteredDefaultSnippets = useMemo(() => {
    const query = searchQuery.trim().toLocaleLowerCase();
    return defaultPromptSnippets.filter((snippet) => {
      const matchesCategory = categoryFilter === 'all' || snippet.category === categoryFilter;
      const matchesQuery =
        !query ||
        snippet.title.toLocaleLowerCase().includes(query) ||
        snippet.content.toLocaleLowerCase().includes(query);
      return matchesCategory && matchesQuery;
    });
  }, [categoryFilter, searchQuery]);

  const isDefaultBoard = activeBoard === 'default';
  const visibleSnippets = isDefaultBoard ? filteredDefaultSnippets : filteredCustomSnippets;

  function openCreateEditor() {
    setEditingSnippetId('');
    form.setFieldsValue({
      title: '',
      content: ''
    });
    setEditorOpen(true);
  }

  function openEditEditor(snippet: PromptSnippet) {
    setEditingSnippetId(snippet.id);
    form.setFieldsValue({
      title: snippet.title,
      content: snippet.content
    });
    setEditorOpen(true);
  }

  function closeEditor() {
    setEditorOpen(false);
    setEditingSnippetId('');
    form.resetFields();
  }

  function saveSnippet(values: PromptSnippetFormValues) {
    const title = values.title.trim();
    const content = values.content.trim();
    const now = new Date().toISOString();

    if (editingSnippetId) {
      const nextSnippets = snippets
        .map((snippet) =>
          snippet.id === editingSnippetId
            ? {
                ...snippet,
                title,
                content,
                updatedAt: now
              }
            : snippet
        )
        .sort((left, right) => (right.updatedAt ?? '').localeCompare(left.updatedAt ?? ''));
      setSnippets(nextSnippets);
      writePromptSnippets(nextSnippets);
      message.success('标签内容已更新。');
    } else {
      const nextSnippets = [
        {
          id: createPromptSnippetId(),
          title,
          content,
          createdAt: now,
          updatedAt: now
        },
        ...snippets
      ];
      setSnippets(nextSnippets);
      writePromptSnippets(nextSnippets);
      message.success('标签已保存。');
    }

    closeEditor();
  }

  async function copySnippetContent(content: string) {
    try {
      await navigator.clipboard.writeText(content);
      message.success('正文已复制。');
    } catch {
      message.error('复制失败，请检查系统剪贴板权限。');
    }
  }

  function removeSnippet(snippetId: string) {
    const nextSnippets = snippets.filter((snippet) => snippet.id !== snippetId);
    setSnippets(nextSnippets);
    writePromptSnippets(nextSnippets);
    message.success('标签已删除。');
  }

  return (
    <div className="prompt-snippet-page">
      <Flex align="center" justify="space-between" gap={16} wrap="wrap" className="prompt-snippet-toolbar">
        <div>
          <Typography.Title level={3} className="page-title">
            <Space size={8}>
              <SnippetsOutlined className="prompt-snippet-title-icon" />
              <span>标签库</span>
            </Space>
          </Typography.Title>
          <Typography.Text type="secondary">
            {isDefaultBoard
              ? '内置整理的中文提示词示例，直接复制后再按任务修改'
              : '保存你常用的提示词和文本，方便以后快速复制使用'}
          </Typography.Text>
        </div>
        <Space wrap>
          <Input
            allowClear
            prefix={<SearchOutlined />}
            placeholder="搜索标题或正文"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            style={{ width: 220 }}
          />
          {isDefaultBoard ? (
            <Select
              aria-label="默认标签分类"
              value={categoryFilter}
              options={promptSnippetCategoryOptions}
              onChange={(value) => setCategoryFilter(value)}
              style={{ width: 120 }}
            />
          ) : (
            <Button type="primary" icon={<PlusOutlined />} onClick={openCreateEditor}>
              新建标签
            </Button>
          )}
        </Space>
      </Flex>

      <Tabs
        className="prompt-snippet-view-tabs"
        activeKey={activeBoard}
        onChange={(key) => setActiveBoard(key as PromptSnippetBoardKey)}
        items={[
          {
            key: 'default',
            label: (
              <span>
                <StarOutlined />
                默认标签
              </span>
            )
          },
          {
            key: 'custom',
            label: (
              <span>
                <EditOutlined />
                我的标签
              </span>
            )
          }
        ]}
      />

      {visibleSnippets.length > 0 ? (
        <div className="prompt-snippet-card-grid">
          {visibleSnippets.map((snippet, index) => {
            const decoration = promptSnippetDecorationVariants[index % promptSnippetDecorationVariants.length];
            return (
              <article key={snippet.id} className={`prompt-snippet-card prompt-snippet-card-${decoration}`}>
                <div className="prompt-snippet-decoration" aria-hidden="true">
                  {decoration === 'star' || decoration === 'star-line' ? <StarOutlined /> : null}
                  {decoration === 'moon' ? <MoonOutlined /> : null}
                  {decoration === 'line' || decoration === 'star-line' ? (
                    <span className="prompt-snippet-decoration-line" />
                  ) : null}
                </div>
                <div className="prompt-snippet-card-header">
                  <div className="prompt-snippet-card-title-row">
                    <Typography.Text strong className="prompt-snippet-card-title">
                      {snippet.title}
                    </Typography.Text>
                  </div>
                  <div className="prompt-snippet-card-meta-row">
                    {snippet.category ? (
                      <span className="prompt-snippet-category">{snippet.category}</span>
                    ) : null}
                    <Tooltip title="复制正文">
                      <Button
                        type="text"
                        size="small"
                        aria-label="复制正文"
                        icon={<CopyOutlined />}
                        onClick={() => void copySnippetContent(snippet.content)}
                      />
                    </Tooltip>
                  </div>
                </div>
                <Typography.Paragraph className="prompt-snippet-card-content">
                  {snippet.content}
                </Typography.Paragraph>
                <div className="prompt-snippet-card-footer">
                  <Typography.Text type="secondary">
                    {isDefaultBoard ? '内置精选' : formatPromptSnippetTime(snippet.updatedAt ?? '')}
                  </Typography.Text>
                  {isDefaultBoard ? (
                    <Typography.Text type="secondary">仅供复制</Typography.Text>
                  ) : (
                    <Space size={2}>
                      <Tooltip title="编辑">
                        <Button
                          type="text"
                          size="small"
                          aria-label="编辑标签"
                          icon={<EditOutlined />}
                          onClick={() => openEditEditor(snippet)}
                        />
                      </Tooltip>
                      <Popconfirm
                        title="删除这个标签？"
                        description="删除后无法恢复。"
                        okText="删除"
                        cancelText="取消"
                        onConfirm={() => removeSnippet(snippet.id)}
                      >
                        <Tooltip title="删除">
                          <Button
                            type="text"
                            size="small"
                            danger
                            aria-label="删除标签"
                            icon={<DeleteOutlined />}
                          />
                        </Tooltip>
                      </Popconfirm>
                    </Space>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="prompt-snippet-empty">
          <Empty
            image={<SnippetsOutlined className="prompt-snippet-empty-icon" />}
            description={
              searchQuery.trim()
                ? '没有找到匹配的文本'
                : isDefaultBoard
                  ? '当前分类没有默认标签'
                  : '还没有保存任何标签'
            }
          >
            {!searchQuery.trim() && !isDefaultBoard ? (
              <Button type="primary" icon={<PlusOutlined />} onClick={openCreateEditor}>
                新建第一条标签
              </Button>
            ) : null}
          </Empty>
        </div>
      )}

      <Modal
        open={editorOpen}
        title={editingSnippetId ? '编辑标签' : '新建文本'}
        okText="保存"
        cancelText="取消"
        width={680}
        destroyOnHidden
        onCancel={closeEditor}
        onOk={() => form.submit()}
      >
        <Form form={form} layout="vertical" onFinish={saveSnippet}>
          <Form.Item
            name="title"
            label="标题"
            rules={[
              { required: true, message: '请输入标题' },
              { max: 80, message: '标题不能超过 80 个字符' }
            ]}
          >
            <Input placeholder="例如：商品图高级质感风格" maxLength={80} showCount />
          </Form.Item>
          <Form.Item
            name="content"
            label="正文"
            rules={[
              { required: true, message: '请输入正文内容' },
              { max: 12000, message: '正文不能超过 12000 个字符' }
            ]}
          >
            <Input.TextArea
              rows={12}
              showCount
              maxLength={12000}
              placeholder="输入提示词、文案、脚本或其他常用文本"
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
