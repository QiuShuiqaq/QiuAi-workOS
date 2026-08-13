export const roleTemplateOutputCategories = [
  '图片生成',
  '视频生成',
  '视频质检',
  '文档处理',
  '演示 Demo',
  '其他产物'
] as const;

export type RoleTemplateOutputCategory = (typeof roleTemplateOutputCategories)[number];

type RoleTemplateOutputCategoryInput = {
  applicationType?: string | null;
  templateId?: string;
  name?: string;
  outputFormat?: string | null;
  dependencyManifest?: unknown;
  dependencyManifestFactory?: unknown;
};

function readRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function readFactoryKind(value: unknown): string {
  const record = readRecord(value);
  if (!record) {
    return '';
  }

  const factory = readRecord(record.factory) ?? record;
  return typeof factory.kind === 'string' ? factory.kind.trim().toLowerCase() : '';
}

export function resolveRoleTemplateOutputCategory(
  input: RoleTemplateOutputCategoryInput
): RoleTemplateOutputCategory | undefined {
  if (
    input.applicationType &&
    input.applicationType.toLowerCase() !== 'digital_factory'
  ) {
    return undefined;
  }

  const factoryKind =
    readFactoryKind(input.dependencyManifest) ||
    readFactoryKind(input.dependencyManifestFactory);

  if (factoryKind.includes('image') || factoryKind.includes('picture')) {
    return '图片生成';
  }

  if (factoryKind.includes('medical_case_video_screening') || factoryKind.includes('video_screening')) {
    return '视频质检';
  }

  if (factoryKind.includes('video')) {
    return '视频生成';
  }

  if (factoryKind.includes('academic_project_demo') || factoryKind.includes('demo')) {
    return '演示 Demo';
  }

  const text = [
    input.templateId,
    input.name,
    input.outputFormat,
    factoryKind
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  if (/(图片|图像|image|picture|png|jpg|jpeg|webp)/i.test(text)) {
    return '图片生成';
  }

  if (/(视频质检|质检视频|video_screening|medical_case_video_screening)/i.test(text)) {
    return '视频质检';
  }

  if (/(视频|video|mp4|剪辑)/i.test(text)) {
    return '视频生成';
  }

  if (/(demo|演示|展示页面)/i.test(text)) {
    return '演示 Demo';
  }

  if (/(文档|document|word|excel|xlsx|markdown|txt)/i.test(text)) {
    return '文档处理';
  }

  return '其他产物';
}
