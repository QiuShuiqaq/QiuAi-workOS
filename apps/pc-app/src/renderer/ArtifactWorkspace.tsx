import {
  CloseOutlined,
  DeleteOutlined,
  DownloadOutlined,
  EditOutlined,
  FileExcelOutlined,
  FileImageOutlined,
  FilePdfOutlined,
  FileTextOutlined,
  FileWordOutlined,
  FolderOpenOutlined,
  PlusOutlined,
  SaveOutlined,
  ThunderboltOutlined,
  VideoCameraOutlined
} from '@ant-design/icons';
import Button from 'antd/es/button';
import Empty from 'antd/es/empty';
import Input from 'antd/es/input';
import Select from 'antd/es/select';
import Space from 'antd/es/space';
import Tag from 'antd/es/tag';
import Tooltip from 'antd/es/tooltip';
import Typography from 'antd/es/typography';
import { useEffect, useMemo, useRef, useState } from 'react';

import type {
  DesktopToolInvocationRequest,
  DesktopToolInvocationResult
} from '../shared/desktop-api';
import type { DesktopArtifactSummary } from '../shared/desktop-contract';

export interface ArtifactSpreadsheetSheet {
  name: string;
  rows: string[][];
}

export interface ArtifactRevisionDraft {
  format: 'docx' | 'xlsx' | 'csv' | 'text';
  title: string;
  content?: string;
  sheets?: ArtifactSpreadsheetSheet[];
}

interface ArtifactWorkspaceProps {
  artifact: DesktopArtifactSummary;
  workspaceId: string;
  onClose: () => void;
  onOpenLocal: (targetPath?: string) => void;
  onSaveAs: () => void;
  onSaveRevision: (draft: ArtifactRevisionDraft) => Promise<void>;
  onAiRewrite?: (input: {
    selectedText: string;
    instruction: string;
    context: string;
  }) => Promise<string>;
  getPreviewUrl?: (path: string) => Promise<string>;
  desktopToolInvoker?: (
    request: DesktopToolInvocationRequest
  ) => Promise<DesktopToolInvocationResult>;
}

type ArtifactFormat = 'docx' | 'xlsx' | 'csv' | 'pdf' | 'image' | 'video' | 'text' | 'unknown';
type RewriteMode = 'polish' | 'concise' | 'formal' | 'expand';

const rewriteModeOptions: Array<{ value: RewriteMode; label: string; instruction: string }> = [
  { value: 'polish', label: '润色', instruction: '在保持原意的前提下，让表达更流畅、自然、清晰。' },
  { value: 'concise', label: '精简', instruction: '保留关键信息，删除重复表达，让内容更简洁。' },
  { value: 'formal', label: '更正式', instruction: '在保持原意的前提下，改成正式、专业的书面表达。' },
  { value: 'expand', label: '扩写', instruction: '围绕原意补充必要细节，但不要编造事实。' }
];

export default function ArtifactWorkspace({
  artifact,
  workspaceId,
  onClose,
  onOpenLocal,
  onSaveAs,
  onSaveRevision,
  onAiRewrite,
  getPreviewUrl,
  desktopToolInvoker
}: ArtifactWorkspaceProps) {
  const [loading, setLoading] = useState(false);
  const [loadNotice, setLoadNotice] = useState('');
  const [documentText, setDocumentText] = useState('');
  const [sheets, setSheets] = useState<ArtifactSpreadsheetSheet[]>([]);
  const [activeSheetIndex, setActiveSheetIndex] = useState(0);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [rewriting, setRewriting] = useState(false);
  const [rewriteMode, setRewriteMode] = useState<RewriteMode>('polish');
  const [selection, setSelection] = useState({ start: 0, end: 0 });
  const [previewSourceUrl, setPreviewSourceUrl] = useState('');
  const editorRef = useRef<HTMLTextAreaElement | null>(null);

  const format = useMemo(() => detectArtifactFormat(artifact), [artifact]);
  const isEditable = format === 'docx' || format === 'xlsx' || format === 'csv' || format === 'text';
  const selectedText =
    format === 'docx' || format === 'text'
      ? documentText.slice(selection.start, selection.end).trim()
      : '';
  const selectedSheet = sheets[activeSheetIndex] ?? sheets[0];

  useEffect(() => {
    let cancelled = false;

    async function loadPreviewData() {
      setLoading(true);
      setLoadNotice('');
      setDirty(false);
      setDocumentText(artifact.content ?? '');
      setSheets([]);
      setActiveSheetIndex(0);
      setSelection({ start: 0, end: 0 });
      setPreviewSourceUrl(artifact.remoteUrl ?? '');

      try {
        if (artifact.localPath && getPreviewUrl) {
          try {
            const localPreviewUrl = await getPreviewUrl(artifact.localPath);
            if (!cancelled) {
              setPreviewSourceUrl(localPreviewUrl);
            }
          } catch {
            if (!cancelled) {
              setPreviewSourceUrl(toArtifactSourceUrl(artifact.localPath));
            }
          }
        }

        if (format === 'xlsx' && artifact.localPath && desktopToolInvoker) {
          const result = await desktopToolInvoker({
            workspaceId,
            toolId: 'office-document',
            action: 'spreadsheet.read_xlsx',
            input: { path: artifact.localPath }
          });
          if (result.ok) {
            const nextSheets = readSpreadsheetSheets(result.output?.sheets);
            if (!cancelled) {
              setSheets(nextSheets);
            }
          } else if (!cancelled) {
            setLoadNotice(result.message ?? 'Excel内容读取失败，当前显示产物摘要。');
          }
        } else if (
          (format === 'docx' || format === 'text' || format === 'csv') &&
          artifact.localPath &&
          desktopToolInvoker
        ) {
          const result = await desktopToolInvoker({
            workspaceId,
            toolId: 'office-document',
            action: 'document.extract_text',
            input: { path: artifact.localPath, maxChars: 80_000 }
          });
          if (result.ok && !cancelled) {
            const extractedText = readToolText(result.output);
            if (format === 'csv') {
              setSheets(parseSpreadsheetFallback(extractedText || artifact.content));
            } else {
              setDocumentText(extractedText || artifact.content);
            }
          } else if (!cancelled) {
            if (format === 'csv') {
              setSheets(parseSpreadsheetFallback(artifact.content));
            }
            setLoadNotice(result.message ?? '文件内容读取失败，当前显示产物摘要。');
          }
        } else if (format === 'xlsx' || format === 'csv') {
          const nextSheets = parseSpreadsheetFallback(artifact.content);
          if (!cancelled) {
            setSheets(nextSheets);
          }
        }
      } catch (error) {
        if (!cancelled) {
          setLoadNotice(error instanceof Error ? error.message : '产物预览加载失败。');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadPreviewData();
    return () => {
      cancelled = true;
    };
  }, [artifact, desktopToolInvoker, format, getPreviewUrl, workspaceId]);

  async function saveRevision() {
    if (!isEditable || saving) {
      return;
    }

    setSaving(true);
    try {
      await onSaveRevision({
        format: format === 'docx' || format === 'xlsx' || format === 'csv' ? format : 'text',
        title: artifact.title,
        content: format === 'xlsx' || format === 'csv' ? undefined : documentText,
        sheets: format === 'xlsx' || format === 'csv' ? sheets : undefined
      });
      setDirty(false);
      setLoadNotice('');
    } catch (error) {
      setLoadNotice(error instanceof Error ? error.message : '产物修订保存失败。');
    } finally {
      setSaving(false);
    }
  }

  async function rewriteSelection() {
    if (!selectedText || !onAiRewrite || rewriting) {
      return;
    }

    const option = rewriteModeOptions.find((item) => item.value === rewriteMode) ?? rewriteModeOptions[0];
    setRewriting(true);
    try {
      const rewritten = await onAiRewrite({
        selectedText,
        instruction: option.instruction,
        context: documentText
      });
      const nextText = `${documentText.slice(0, selection.start)}${rewritten}${documentText.slice(selection.end)}`;
      setDocumentText(nextText);
      setDirty(true);
      requestAnimationFrame(() => {
        const nextCursor = selection.start + rewritten.length;
        editorRef.current?.focus();
        editorRef.current?.setSelectionRange(nextCursor, nextCursor);
        setSelection({ start: nextCursor, end: nextCursor });
      });
      setLoadNotice('');
    } catch (error) {
      setLoadNotice(error instanceof Error ? error.message : 'AI重写失败。');
    } finally {
      setRewriting(false);
    }
  }

  function updateCell(rowIndex: number, columnIndex: number, value: string) {
    setSheets((current) =>
      current.map((sheet, sheetIndex) =>
        sheetIndex === activeSheetIndex
          ? {
              ...sheet,
              rows: sheet.rows.map((row, currentRowIndex) =>
                currentRowIndex === rowIndex
                  ? Array.from(
                      { length: Math.max(row.length, columnIndex + 1) },
                      (_, currentColumnIndex) =>
                        currentColumnIndex === columnIndex ? value : row[currentColumnIndex] ?? ''
                    )
                  : row
              )
            }
          : sheet
      )
    );
    setDirty(true);
  }

  function addRow() {
    setSheets((current) =>
      current.map((sheet, sheetIndex) =>
        sheetIndex === activeSheetIndex
          ? { ...sheet, rows: [...sheet.rows, Array.from({ length: getColumnCount(sheet.rows) }, () => '')] }
          : sheet
      )
    );
    setDirty(true);
  }

  function addColumn() {
    setSheets((current) =>
      current.map((sheet, sheetIndex) =>
        sheetIndex === activeSheetIndex
          ? { ...sheet, rows: sheet.rows.map((row) => [...row, '']) }
          : sheet
      )
    );
    setDirty(true);
  }

  function deleteRow(rowIndex: number) {
    if (!selectedSheet || selectedSheet.rows.length <= 1) {
      return;
    }

    setSheets((current) =>
      current.map((sheet, sheetIndex) =>
        sheetIndex === activeSheetIndex
          ? { ...sheet, rows: sheet.rows.filter((_, currentRowIndex) => currentRowIndex !== rowIndex) }
          : sheet
      )
    );
    setDirty(true);
  }

  const sourceUrl = previewSourceUrl || toArtifactSourceUrl(artifact.remoteUrl ?? artifact.localPath);
  const displayTitle = artifact.title || '产物';

  return (
    <aside className="artifact-workspace" aria-label="产物预览工作区">
      <header className="artifact-workspace-header">
        <Space size={10} className="artifact-workspace-title">
          <span className={`artifact-workspace-icon ${artifactTone(format)}`}>
            {renderArtifactIcon(format)}
          </span>
          <span className="artifact-workspace-title-main">
            <Typography.Text strong ellipsis title={displayTitle}>
              {displayTitle}
            </Typography.Text>
            <Typography.Text type="secondary">
              {artifactFormatLabel(format)}
              {dirty ? ' · 有未保存修改' : ''}
            </Typography.Text>
          </span>
        </Space>
        <Space size={4}>
          {isEditable ? (
            <Button
              size="small"
              type={dirty ? 'primary' : 'default'}
              icon={<SaveOutlined />}
              loading={saving}
              onClick={() => void saveRevision()}
            >
              保存
            </Button>
          ) : null}
          {artifact.localPath ? (
            <Tooltip title="打开本地文件">
              <Button
                size="small"
                icon={<FolderOpenOutlined />}
                aria-label="打开本地文件"
                onClick={() => onOpenLocal(artifact.localPath)}
              />
            </Tooltip>
          ) : null}
          <Tooltip title="另存文件">
            <Button
              size="small"
              icon={<DownloadOutlined />}
              aria-label="另存文件"
              onClick={onSaveAs}
            />
          </Tooltip>
          <Tooltip title="关闭预览">
            <Button
              size="small"
              icon={<CloseOutlined />}
              aria-label="关闭预览"
              onClick={onClose}
            />
          </Tooltip>
        </Space>
      </header>

      {loadNotice ? <div className="artifact-workspace-notice">{loadNotice}</div> : null}

      <div className="artifact-workspace-body">
        {loading ? (
          <div className="artifact-workspace-loading">正在准备产物预览...</div>
        ) : (
          renderPreview()
        )}
      </div>
    </aside>
  );

  function renderPreview() {
    if (format === 'image' && sourceUrl) {
      return (
        <div className="artifact-media-preview">
          <img src={sourceUrl} alt={displayTitle} />
        </div>
      );
    }

    if (format === 'video' && sourceUrl) {
      return (
        <div className="artifact-media-preview artifact-video-preview">
          <video src={sourceUrl} controls preload="metadata" />
        </div>
      );
    }

    if (format === 'pdf' && sourceUrl) {
      return <iframe className="artifact-pdf-preview" src={sourceUrl} title={displayTitle} />;
    }

    if (format === 'xlsx' || format === 'csv') {
      return renderSpreadsheetPreview();
    }

    if (format === 'docx' || format === 'text') {
      return renderDocumentPreview();
    }

    return (
      <div className="artifact-workspace-empty">
        <Empty image={renderArtifactIcon(format)} description="当前格式暂不支持内置预览" />
        <Typography.Text type="secondary">
          可以使用右上角按钮打开本地文件或另存文件。
        </Typography.Text>
      </div>
    );
  }

  function renderDocumentPreview() {
    const hasSelection = selection.end > selection.start;
    return (
      <div className="artifact-document-preview">
        <div className="artifact-editor-toolbar">
          <Typography.Text type="secondary">
            {format === 'docx' ? '文档编辑' : '文本编辑'}
          </Typography.Text>
          {hasSelection && onAiRewrite ? (
            <Space size={6}>
              <Select
                size="small"
                value={rewriteMode}
                options={rewriteModeOptions.map(({ value, label }) => ({ value, label }))}
                onChange={setRewriteMode}
              />
              <Button
                size="small"
                icon={<ThunderboltOutlined />}
                loading={rewriting}
                onClick={() => void rewriteSelection()}
              >
                AI重写选中内容
              </Button>
            </Space>
          ) : (
            <Typography.Text type="secondary">选择文字后可调用AI重写</Typography.Text>
          )}
        </div>
        <Input.TextArea
          ref={editorRef}
          className="artifact-document-editor"
          value={documentText}
          onChange={(event) => {
            setDocumentText(event.target.value);
            setDirty(true);
          }}
          onSelect={(event) => {
            const target = event.currentTarget;
            setSelection({ start: target.selectionStart, end: target.selectionEnd });
          }}
          placeholder="当前产物没有可编辑正文。"
          autoSize={false}
        />
      </div>
    );
  }

  function renderSpreadsheetPreview() {
    if (!selectedSheet) {
      return (
        <div className="artifact-workspace-empty">
          <Empty description="没有可展示的表格内容" />
        </div>
      );
    }

    const columnCount = getColumnCount(selectedSheet.rows);
    return (
      <div className="artifact-spreadsheet-preview">
        <div className="artifact-editor-toolbar">
          <Space size={8}>
            <Typography.Text type="secondary">表格编辑</Typography.Text>
            <Select
              size="small"
              value={activeSheetIndex}
              options={sheets.map((sheet, index) => ({ value: index, label: sheet.name }))}
              onChange={setActiveSheetIndex}
            />
          </Space>
          <Space size={4}>
            <Button size="small" icon={<PlusOutlined />} onClick={addRow}>
              添加行
            </Button>
            <Button size="small" icon={<PlusOutlined />} onClick={addColumn}>
              添加列
            </Button>
          </Space>
        </div>
        <div className="artifact-spreadsheet-scroll">
          <table className="artifact-spreadsheet-table">
            <tbody>
              {selectedSheet.rows.map((row, rowIndex) => (
                <tr key={`row-${rowIndex}`}>
                  <th>
                    <span>{rowIndex + 1}</span>
                    <Tooltip title="删除行">
                      <button
                        type="button"
                        className="artifact-spreadsheet-delete"
                        aria-label={`删除第 ${rowIndex + 1} 行`}
                        onClick={() => deleteRow(rowIndex)}
                      >
                        <DeleteOutlined />
                      </button>
                    </Tooltip>
                  </th>
                  {Array.from({ length: columnCount }, (_, columnIndex) => (
                    <td key={`cell-${rowIndex}-${columnIndex}`}>
                      <input
                        value={row[columnIndex] ?? ''}
                        aria-label={`${rowIndex + 1}行${columnIndex + 1}列`}
                        onChange={(event) => updateCell(rowIndex, columnIndex, event.target.value)}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }
}

function detectArtifactFormat(artifact: DesktopArtifactSummary): ArtifactFormat {
  const explicitFormat = artifact.format?.trim().toLowerCase();
  const fileName = artifact.localPath ?? artifact.title;
  const extension = fileName.split(/[?#]/)[0]?.split('.').pop()?.toLowerCase() ?? '';

  if (explicitFormat === 'doc' || explicitFormat === 'docx') return 'docx';
  if (explicitFormat === 'xls' || explicitFormat === 'xlsx') return 'xlsx';
  if (explicitFormat === 'csv') return 'csv';
  if (explicitFormat === 'pdf') return 'pdf';
  if (explicitFormat === 'image') return 'image';
  if (explicitFormat === 'video') return 'video';
  if (['doc', 'docx'].includes(extension)) return 'docx';
  if (['xls', 'xlsx'].includes(extension)) return 'xlsx';
  if (extension === 'csv') return 'csv';
  if (extension === 'pdf') return 'pdf';
  if (['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp'].includes(extension)) return 'image';
  if (['mp4', 'webm', 'mov', 'm4v'].includes(extension)) return 'video';
  if (['txt', 'md', 'markdown', 'json', 'jsonl', 'log'].includes(extension)) return 'text';
  if (artifact.type === 'image') return 'image';
  if (artifact.type === 'video') return 'video';
  if (artifact.type === 'text' || artifact.type === 'report') return 'text';
  return 'unknown';
}

function artifactFormatLabel(format: ArtifactFormat): string {
  const labels: Record<ArtifactFormat, string> = {
    docx: 'Word 文档',
    xlsx: 'Excel 工作簿',
    csv: 'CSV 表格',
    pdf: 'PDF 文档',
    image: '图片',
    video: '视频',
    text: '文本',
    unknown: '文件'
  };
  return labels[format];
}

function artifactTone(format: ArtifactFormat): string {
  if (format === 'xlsx' || format === 'csv') return 'excel';
  if (format === 'docx') return 'word';
  if (format === 'pdf') return 'pdf';
  if (format === 'image') return 'image';
  if (format === 'video') return 'video';
  return 'file';
}

function renderArtifactIcon(format: ArtifactFormat) {
  if (format === 'xlsx' || format === 'csv') return <FileExcelOutlined />;
  if (format === 'docx') return <FileWordOutlined />;
  if (format === 'pdf') return <FilePdfOutlined />;
  if (format === 'image') return <FileImageOutlined />;
  if (format === 'video') return <VideoCameraOutlined />;
  return <FileTextOutlined />;
}

function toArtifactSourceUrl(value?: string): string {
  const normalized = value?.trim();
  if (!normalized) return '';
  if (/^(https?:|data:|file:)/i.test(normalized)) return normalized;
  return `file:///${normalized.replace(/\\/g, '/').replace(/^\/+/, '')}`;
}

function readToolText(output?: Record<string, unknown>): string {
  return typeof output?.text === 'string' ? output.text : '';
}

function readSpreadsheetSheets(value: unknown): ArtifactSpreadsheetSheet[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => {
      if (!item || typeof item !== 'object') return undefined;
      const record = item as Record<string, unknown>;
      const rows = Array.isArray(record.rows)
        ? record.rows
            .filter((row): row is unknown[] => Array.isArray(row))
            .map((row) => row.map((cell) => String(cell ?? '')))
        : [];
      return rows.length > 0
        ? { name: typeof record.name === 'string' ? record.name : 'Sheet1', rows }
        : undefined;
    })
    .filter((item): item is ArtifactSpreadsheetSheet => Boolean(item));
}

function parseSpreadsheetFallback(content: string): ArtifactSpreadsheetSheet[] {
  const normalized = content.trim();
  if (!normalized) return [{ name: 'Sheet1', rows: [['内容'], ['']] }];

  try {
    const parsed = JSON.parse(normalized) as unknown;
    const parsedSheets = readSpreadsheetSheets(
      Array.isArray(parsed)
        ? [{ name: 'Sheet1', rows: parsed }]
        : parsed && typeof parsed === 'object'
          ? (parsed as Record<string, unknown>).sheets
          : undefined
    );
    if (parsedSheets.length > 0) return parsedSheets;
  } catch {
    // Fall through to simple CSV or markdown parsing.
  }

  const rows = normalized
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => line.split(line.includes('\t') ? '\t' : ',').map((cell) => cell.trim()));
  return [{ name: 'Sheet1', rows: rows.length > 0 ? rows : [['内容'], ['']] }];
}

function getColumnCount(rows: string[][]): number {
  return Math.max(1, ...rows.map((row) => row.length));
}
