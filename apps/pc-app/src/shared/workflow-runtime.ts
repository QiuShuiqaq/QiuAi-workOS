import type { DesktopTaskDetail } from './desktop-contract.js';
import type {
  WorkflowGraphArtifactType,
  WorkflowGraphNode,
  WorkflowGraphNodeType
} from './desktop-workflow-graph.js';

export type WorkflowRuntimePrimitive = string | number | boolean | null;

export type WorkflowFileKind =
  | 'document'
  | 'image'
  | 'video'
  | 'audio'
  | 'spreadsheet'
  | 'presentation'
  | 'pdf'
  | 'text'
  | 'other';

export interface WorkflowFileValue {
  id: string;
  name: string;
  kind: WorkflowFileKind;
  uri?: string;
  mimeType?: string;
  localPath: string;
  sizeBytes?: number;
  extractedText?: string;
  metadata?: Record<string, unknown>;
}

export type WorkflowRuntimeValue =
  | WorkflowRuntimePrimitive
  | WorkflowFileValue
  | WorkflowFileValue[]
  | Record<string, unknown>
  | unknown[];

export interface WorkflowRuntimeVariableSnapshot {
  name: string;
  valueType: string;
  preview: string;
}

export type WorkflowRuntimeNodeStatus = 'running' | 'completed' | 'failed' | 'skipped';

export interface WorkflowNodeExecutionTrace {
  nodeId: string;
  nodeType: WorkflowGraphNodeType;
  nodeName: string;
  status: WorkflowRuntimeNodeStatus;
  startedAt: string;
  finishedAt?: string;
  inputVariables: string[];
  outputVariables: string[];
  modelProfileId?: string;
  toolId?: string;
  artifactType?: WorkflowGraphArtifactType;
  message?: string;
  artifactPath?: string;
}

export class WorkflowVariablePool {
  private readonly values = new Map<string, WorkflowRuntimeValue>();

  constructor(initialValues?: Record<string, WorkflowRuntimeValue>) {
    for (const [name, value] of Object.entries(initialValues ?? {})) {
      this.set(name, value);
    }
  }

  set(name: string, value: WorkflowRuntimeValue): void {
    const normalizedName = normalizeVariableName(name);
    if (!normalizedName) {
      return;
    }

    this.values.set(normalizedName, value);
  }

  get(name: string | undefined): WorkflowRuntimeValue | undefined {
    const normalizedName = normalizeVariableName(name);
    if (!normalizedName) {
      return undefined;
    }

    const exactValue = this.values.get(normalizedName);
    if (exactValue !== undefined) {
      return exactValue;
    }

    const parts = normalizedName.split('.');
    for (let prefixLength = parts.length - 1; prefixLength > 0; prefixLength -= 1) {
      const prefix = parts.slice(0, prefixLength).join('.');
      const nestedValue = readNestedWorkflowRuntimeValue(
        this.values.get(prefix),
        parts.slice(prefixLength)
      );
      if (nestedValue !== undefined) {
        return nestedValue as WorkflowRuntimeValue;
      }
    }

    return undefined;
  }

  has(name: string | undefined): boolean {
    const normalizedName = normalizeVariableName(name);
    return normalizedName ? this.values.has(normalizedName) : false;
  }

  snapshot(): WorkflowRuntimeVariableSnapshot[] {
    return [...this.values.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([name, value]) => ({
        name,
        valueType: getWorkflowRuntimeValueType(value),
        preview: previewWorkflowRuntimeValue(value)
      }));
  }
}

export function createWorkflowVariablePoolFromTask(task: DesktopTaskDetail): WorkflowVariablePool {
  const files = normalizeWorkflowAttachmentPaths(task.executionContext?.attachmentPaths ?? []);
  const pool = new WorkflowVariablePool({
    input: task.input,
    title: task.title,
    'task.input': task.input,
    'task.title': task.title,
    'task.type': task.taskType,
    'task.roleCode': task.roleCode,
    'task.roleName': task.roleName,
    'start.text': task.input,
    'start.title': task.title,
    'start.files': files,
    'start.images': files.filter((file) => file.kind === 'image'),
    'start.videos': files.filter((file) => file.kind === 'video'),
    'start.audio': files.filter((file) => file.kind === 'audio'),
    'start.documents': files.filter((file) => ['document', 'pdf', 'text'].includes(file.kind)),
    'start.spreadsheets': files.filter((file) => file.kind === 'spreadsheet'),
    'start.presentations': files.filter((file) => file.kind === 'presentation')
  });

  const inputObject = parseWorkflowInputObject(task.input);
  for (const [key, value] of Object.entries(inputObject ?? {})) {
    pool.set(key, value as WorkflowRuntimeValue);
    pool.set(`input.${key}`, value as WorkflowRuntimeValue);
    pool.set(`start.${key}`, value as WorkflowRuntimeValue);
  }

  return pool;
}

export function normalizeWorkflowAttachmentPaths(paths: string[]): WorkflowFileValue[] {
  return paths
    .map((path, index) => path.trim())
    .filter(Boolean)
    .map((localPath, index) => {
      const name = readFileName(localPath) ?? `attachment-${index + 1}`;
      return {
        id: `start-file-${index + 1}`,
        name,
        kind: inferWorkflowFileKind(name),
        uri: `local://${localPath}`,
        mimeType: inferWorkflowMimeType(name),
        localPath
      };
    });
}

export function resolveWorkflowVariableRefs(
  pool: WorkflowVariablePool,
  refs: string[] | undefined,
  fallbackRefs: string[] = ['start.text']
): Array<{ ref: string; value: WorkflowRuntimeValue }> {
  const normalizedRefs = (refs && refs.length > 0 ? refs : fallbackRefs)
    .map(normalizeVariableName)
    .filter((ref): ref is string => Boolean(ref));

  return normalizedRefs.flatMap((ref) => {
    const value = pool.get(ref);
    return value === undefined ? [] : [{ ref, value }];
  });
}

export function renderWorkflowVariableRefsForPrompt(
  variables: Array<{ ref: string; value: WorkflowRuntimeValue }>,
  maxChars = 24_000
): string {
  const rendered = variables
    .map(({ ref, value }) => [`Variable: ${ref}`, renderWorkflowRuntimeValue(value)].join('\n'))
    .join('\n\n---\n\n');

  return truncateWorkflowText(rendered || 'none', maxChars);
}

export function renderWorkflowVariableRefsForArtifact(
  variables: Array<{ ref: string; value: WorkflowRuntimeValue }>,
  maxChars = 80_000
): string {
  const rendered = variables
    .map(({ value }) => renderWorkflowRuntimeValue(value).trim())
    .filter(Boolean)
    .join('\n\n');

  return truncateWorkflowText(rendered || '', maxChars);
}

export function writeWorkflowNodeOutputs(input: {
  pool: WorkflowVariablePool;
  node: WorkflowGraphNode;
  text?: string;
  json?: unknown;
  result?: WorkflowRuntimeValue;
  file?: WorkflowFileValue;
}): string[] {
  const outputRefs: string[] = [];

  if (input.text !== undefined) {
    input.pool.set(`${input.node.id}.text`, input.text);
    outputRefs.push(`${input.node.id}.text`);
  }

  if (input.json !== undefined) {
    input.pool.set(`${input.node.id}.json`, input.json as WorkflowRuntimeValue);
    outputRefs.push(`${input.node.id}.json`);
  }

  if (input.result !== undefined) {
    input.pool.set(`${input.node.id}.result`, input.result);
    outputRefs.push(`${input.node.id}.result`);
  }

  if (input.file !== undefined) {
    input.pool.set(`${input.node.id}.file`, input.file);
    outputRefs.push(`${input.node.id}.file`);
  }

  for (const outputVariable of input.node.outputVariables ?? []) {
    const normalizedOutputVariable = normalizeVariableName(outputVariable);
    if (!normalizedOutputVariable) {
      continue;
    }

    const value = input.text ?? input.result ?? input.file ?? input.json;
    if (value === undefined) {
      continue;
    }

    input.pool.set(normalizedOutputVariable, value as WorkflowRuntimeValue);
    outputRefs.push(normalizedOutputVariable);

    if (!normalizedOutputVariable.includes('.')) {
      input.pool.set(`${input.node.id}.${normalizedOutputVariable}`, value as WorkflowRuntimeValue);
      outputRefs.push(`${input.node.id}.${normalizedOutputVariable}`);
    }
  }

  return [...new Set(outputRefs)];
}

export function createWorkflowNodeTrace(input: {
  node: WorkflowGraphNode;
  status: WorkflowRuntimeNodeStatus;
  startedAt: string;
  finishedAt?: string;
  inputVariables?: string[];
  outputVariables?: string[];
  message?: string;
  artifactPath?: string;
}): WorkflowNodeExecutionTrace {
  return {
    nodeId: input.node.id,
    nodeType: input.node.type,
    nodeName: input.node.name,
    status: input.status,
    startedAt: input.startedAt,
    finishedAt: input.finishedAt,
    inputVariables: input.inputVariables ?? input.node.inputVariables ?? [],
    outputVariables: input.outputVariables ?? [],
    modelProfileId: input.node.modelProfileId,
    toolId: input.node.toolId,
    artifactType: input.node.artifactType,
    message: input.message,
    artifactPath: input.artifactPath
  };
}

export function formatWorkflowTraceForReport(traces: WorkflowNodeExecutionTrace[]): string {
  if (traces.length === 0) {
    return 'No node runtime trace';
  }

  return traces
    .map((trace, index) => {
      const metadata = [
        trace.modelProfileId ? `model=${trace.modelProfileId}` : undefined,
        trace.toolId ? `tool=${trace.toolId}` : undefined,
        trace.artifactType ? `artifact=${trace.artifactType}` : undefined,
        trace.inputVariables.length > 0 ? `inputs=${trace.inputVariables.join(',')}` : undefined,
        trace.outputVariables.length > 0 ? `outputs=${trace.outputVariables.join(',')}` : undefined,
        trace.artifactPath ? `file=${trace.artifactPath}` : undefined,
        trace.message ? `message=${trace.message}` : undefined
      ].filter(Boolean);

      return `${index + 1}. ${trace.nodeName} (${trace.nodeType}) - ${trace.status}${
        metadata.length > 0 ? ` [${metadata.join('; ')}]` : ''
      }`;
    })
    .join('\n');
}

export function previewWorkflowRuntimeValue(value: WorkflowRuntimeValue, maxChars = 240): string {
  return truncateWorkflowText(renderWorkflowRuntimeValue(value), maxChars);
}

export function getWorkflowRuntimeValueType(value: WorkflowRuntimeValue): string {
  if (Array.isArray(value)) {
    if (value.every(isWorkflowFileValue)) {
      return 'files';
    }

    return 'array';
  }

  if (isWorkflowFileValue(value)) {
    return 'file';
  }

  if (value === null) {
    return 'null';
  }

  return typeof value;
}

export function isWorkflowFileValue(value: unknown): value is WorkflowFileValue {
  return (
    Boolean(value) &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    typeof (value as WorkflowFileValue).localPath === 'string' &&
    typeof (value as WorkflowFileValue).name === 'string'
  );
}

export function normalizeVariableName(value: string | undefined): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function renderWorkflowRuntimeValue(value: WorkflowRuntimeValue): string {
  if (typeof value === 'string') {
    return value;
  }

  if (typeof value === 'number' || typeof value === 'boolean' || value === null) {
    return String(value);
  }

  if (Array.isArray(value) && value.every(isWorkflowFileValue)) {
    return (value as WorkflowFileValue[]).map(renderWorkflowFileValue).join('\n\n');
  }

  if (isWorkflowFileValue(value)) {
    return renderWorkflowFileValue(value);
  }

  return JSON.stringify(value, null, 2);
}

function readNestedWorkflowRuntimeValue(value: unknown, path: string[]): unknown {
  let currentValue = value;

  for (const segment of path) {
    if (currentValue === undefined || currentValue === null) {
      return undefined;
    }

    if (Array.isArray(currentValue)) {
      const index = Number(segment);
      if (!Number.isInteger(index) || index < 0 || index >= currentValue.length) {
        return undefined;
      }

      currentValue = currentValue[index];
      continue;
    }

    if (typeof currentValue === 'object') {
      const record = currentValue as Record<string, unknown>;
      if (!Object.prototype.hasOwnProperty.call(record, segment)) {
        return undefined;
      }

      currentValue = record[segment];
      continue;
    }

    return undefined;
  }

  return currentValue;
}

function renderWorkflowFileValue(file: WorkflowFileValue): string {
  return [
    `File: ${file.name}`,
    `Kind: ${file.kind}`,
    file.uri ? `URI: ${file.uri}` : '',
    `Path: ${file.localPath}`,
    file.mimeType ? `MIME: ${file.mimeType}` : '',
    file.extractedText ? `Extracted text:\n${file.extractedText}` : ''
  ]
    .filter(Boolean)
    .join('\n');
}

function inferWorkflowFileKind(fileName: string): WorkflowFileKind {
  const extension = readFileExtension(fileName);

  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp'].includes(extension)) {
    return 'image';
  }

  if (['mp4', 'mov', 'mkv', 'avi', 'webm', 'm4v'].includes(extension)) {
    return 'video';
  }

  if (['mp3', 'wav', 'm4a', 'aac', 'flac', 'ogg'].includes(extension)) {
    return 'audio';
  }

  if (['doc', 'docx'].includes(extension)) {
    return 'document';
  }

  if (extension === 'pdf') {
    return 'pdf';
  }

  if (['xls', 'xlsx', 'csv'].includes(extension)) {
    return 'spreadsheet';
  }

  if (['ppt', 'pptx'].includes(extension)) {
    return 'presentation';
  }

  if (['txt', 'md', 'json'].includes(extension)) {
    return 'text';
  }

  return 'other';
}

function inferWorkflowMimeType(fileName: string): string | undefined {
  const extension = readFileExtension(fileName);
  const mimeTypes: Record<string, string> = {
    csv: 'text/csv',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    json: 'application/json',
    md: 'text/markdown',
    m4a: 'audio/mp4',
    mp3: 'audio/mpeg',
    mp4: 'video/mp4',
    pdf: 'application/pdf',
    png: 'image/png',
    pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    txt: 'text/plain',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  };

  return mimeTypes[extension];
}

function readFileName(localPath: string): string | undefined {
  return localPath.replace(/\\/g, '/').split('/').filter(Boolean).at(-1);
}

function readFileExtension(fileName: string): string {
  return fileName.split('.').at(-1)?.trim().toLocaleLowerCase() ?? '';
}

function parseWorkflowInputObject(value: string): Record<string, unknown> | undefined {
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : undefined;
  } catch {
    return undefined;
  }
}

function truncateWorkflowText(value: string, maxChars: number): string {
  return value.length <= maxChars ? value : `${value.slice(0, maxChars)}...`;
}
