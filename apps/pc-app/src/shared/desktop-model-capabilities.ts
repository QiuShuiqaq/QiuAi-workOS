import type {
  ModelCapability,
  ModelCapabilityConfidence,
  ModelCapabilityMetadata,
  ModelCapabilitySource,
  ModelCatalogEntry,
  ModelProfile,
  ModelPurpose
} from './desktop-contract.js';

export interface ModelCapabilityClassification {
  capabilities: ModelCapability[];
  purpose: ModelPurpose;
  metadata: ModelCapabilityMetadata;
}

export const modelCapabilityMetadataSourceOptions: Array<{
  value: ModelCapabilitySource;
  label: string;
}> = [
  { value: 'verified', label: '测试验证' },
  { value: 'official_catalog', label: '内置目录' },
  { value: 'provider', label: '供应商声明' },
  { value: 'manual', label: '人工配置' },
  { value: 'name_inferred', label: '名称推断' },
  { value: 'unknown', label: '待确认' }
];

export const modelCapabilityConfidenceOptions: Array<{
  value: ModelCapabilityConfidence;
  label: string;
}> = [
  { value: 'verified', label: '已验证' },
  { value: 'high', label: '高' },
  { value: 'medium', label: '中' },
  { value: 'low', label: '低' },
  { value: 'unknown', label: '待确认' }
];

export const modelCapabilityOptions: Array<{
  value: ModelCapability;
  label: string;
  description: string;
}> = [
  { value: 'text', label: '文本', description: '文本输入，文本输出' },
  { value: 'reasoning_text', label: '深度推理文本', description: '复杂分析、规划、推理任务' },
  { value: 'vision_text', label: '图片理解', description: '图片输入，文本输出' },
  { value: 'video_text', label: '视频理解', description: '视频或视频帧输入，文本输出' },
  { value: 'embedding', label: '文本向量', description: '知识库检索、语义匹配' },
  { value: 'rerank', label: '重排模型', description: '检索结果重排' },
  { value: 'long_context', label: '长上下文', description: '长文档、长上下文输入，文本或 JSON 输出' },
  { value: 'vision_understanding', label: '多模态理解', description: '图片、文档或多模态输入，文本输出' },
  { value: 'video_understanding', label: '视频理解', description: '视频输入，文本或 JSON 输出' },
  { value: 'text_to_image', label: '文生图', description: '文本输入，图片输出' },
  { value: 'image_to_image', label: '图生图', description: '图片输入，图片输出' },
  { value: 'image_generation', label: '生成图片', description: '文本或参考图输入，图片输出' },
  { value: 'video_generation', label: '生成视频', description: '文本或参考图输入，视频输出' },
  { value: 'text_to_video', label: '文生视频', description: '文本输入，视频输出' },
  { value: 'image_to_video', label: '图生视频', description: '图片输入，视频输出' },
  { value: 'audio_to_text', label: '语音转文字', description: '音频输入，文本输出' },
  { value: 'text_to_audio', label: '文本转语音', description: '文本输入，音频输出' }
];

export function defaultCapabilitiesForPurpose(purpose: ModelPurpose): ModelCapability[] {
  if (purpose === 'reasoning') {
    return ['reasoning_text', 'text'];
  }

  if (purpose === 'document') {
    return ['long_context', 'text'];
  }

  if (purpose === 'vision') {
    return ['image_understanding', 'vision_text', 'text'];
  }

  if (purpose === 'embeddings') {
    return ['embedding'];
  }

  if (purpose === 'audio') {
    return ['audio_to_text'];
  }

  return ['text'];
}

const allowedModelCapabilities = new Set<ModelCapability>([
  ...modelCapabilityOptions.map((option) => option.value),
  'image_understanding',
  'image_editing'
]);

export function normalizeExplicitModelCapabilities(
  capabilities: ModelCapability[] | undefined
): ModelCapability[] {
  return [...new Set((capabilities ?? []).filter((item) => allowedModelCapabilities.has(item)))];
}

export function normalizeModelCapabilities(
  capabilities: ModelCapability[] | undefined,
  purpose: ModelPurpose
): ModelCapability[] {
  const normalized = normalizeExplicitModelCapabilities(capabilities);
  return normalized.length > 0 ? normalized : defaultCapabilitiesForPurpose(purpose);
}

export function readModelProfileCapabilities(profile: ModelProfile): ModelCapability[] {
  return normalizeModelCapabilities(
    [
      ...(profile.verifiedCapabilities ?? []),
      ...(profile.capabilities ?? [])
    ],
    profile.purpose
  );
}

export function readEffectiveModelProfileCapabilities(profile: ModelProfile): string[] {
  return [
    ...new Set([
      ...inferKnownModelCapabilitiesFromName(profile.modelName),
      ...readModelProfileCapabilities(profile)
    ].map(normalizeCapabilityToken))
  ];
}

export function modelProfileSupportsRequiredCapabilities(
  profile: ModelProfile,
  requiredCapabilities: string[]
): boolean {
  const inferredCapabilities = inferKnownModelCapabilitiesFromName(profile.modelName).map(normalizeCapabilityToken);
  const capabilities = new Set(readEffectiveModelProfileCapabilities(profile));
  const required = [
    ...new Set(requiredCapabilities.map(normalizeCapabilityToken).filter(Boolean))
  ];
  if (required.length === 0) {
    return true;
  }

  const isAudioTranscriptionProfile =
    profile.purpose === 'audio' ||
    inferredCapabilities.includes('audio_to_text') ||
    capabilities.has('audio_to_text');
  if (isAudioTranscriptionProfile && !required.includes('audio_to_text')) {
    return false;
  }

  const strictGroups = [
    ['image_editing', 'image_to_image'],
    ['text_to_image', 'image_generation'],
    ['image_understanding', 'vision_understanding', 'vision_text'],
    ['video_generation', 'text_to_video', 'image_to_video'],
    ['video_understanding', 'video_text'],
    ['audio_to_text'],
    ['embedding'],
    ['rerank']
  ];
  const matchedStrictGroups = strictGroups.filter((group) =>
    group.some((capability) => required.includes(capability))
  );
  if (matchedStrictGroups.length > 0) {
    return matchedStrictGroups.some((group) =>
      group.some((capability) => capabilities.has(capability))
    );
  }

  return required.some((capability) => capabilities.has(capability));
}

export function primaryCapabilityForPurpose(purpose: ModelPurpose): ModelCapability {
  return defaultCapabilitiesForPurpose(purpose)[0] ?? 'text';
}

export function purposeForModelCapabilities(
  capabilities: ModelCapability[] | undefined,
  fallbackPurpose: ModelPurpose = 'general'
): ModelPurpose {
  const normalized = normalizeModelCapabilities(capabilities, fallbackPurpose);

  if (normalized.includes('embedding')) {
    return 'embeddings';
  }

  if (normalized.includes('audio_to_text') || normalized.includes('text_to_audio')) {
    return 'audio';
  }

  if (normalized.includes('long_context')) {
    return 'document';
  }

  if (
    normalized.includes('vision_text') ||
    normalized.includes('image_understanding') ||
    normalized.includes('video_text') ||
    normalized.includes('text_to_image') ||
    normalized.includes('image_to_image') ||
    normalized.includes('image_editing') ||
    normalized.includes('vision_understanding') ||
    normalized.includes('video_understanding') ||
    normalized.includes('image_generation') ||
    normalized.includes('video_generation') ||
    normalized.includes('text_to_video') ||
    normalized.includes('image_to_video')
  ) {
    return 'vision';
  }

  if (normalized.includes('reasoning_text')) {
    return 'reasoning';
  }

  return 'general';
}

export function modelCapabilityLabel(capability: ModelCapability): string {
  if (capability === 'image_understanding') return '图片理解';
  if (capability === 'image_editing') return '参考图编辑';
  return modelCapabilityOptions.find((option) => option.value === capability)?.label ?? capability;
}

export function modelCapabilitySummary(capabilities: ModelCapability[] | undefined, purpose: ModelPurpose): string {
  return normalizeModelCapabilities(capabilities, purpose).map(modelCapabilityLabel).join(' / ');
}

export function explicitModelCapabilitySummary(capabilities: ModelCapability[] | undefined): string {
  const normalized = normalizeExplicitModelCapabilities(capabilities);
  return normalized.length > 0 ? normalized.map(modelCapabilityLabel).join(' / ') : '待确认';
}

export function modelCapabilityMetadataSourceLabel(source: ModelCapabilitySource | undefined): string {
  return modelCapabilityMetadataSourceOptions.find((option) => option.value === source)?.label ?? '待确认';
}

export function modelCapabilityConfidenceLabel(confidence: ModelCapabilityConfidence | undefined): string {
  return modelCapabilityConfidenceOptions.find((option) => option.value === confidence)?.label ?? '待确认';
}

export function createModelCapabilityMetadata(input: {
  source: ModelCapabilitySource;
  confidence: ModelCapabilityConfidence;
  verifiedAt?: string;
  note?: string;
}): ModelCapabilityMetadata {
  return {
    source: input.source,
    confidence: input.confidence,
    verifiedAt: input.verifiedAt,
    note: input.note
  };
}

export function classifyModelCapabilitiesFromName(
  modelName: string,
  fallbackPurpose: ModelPurpose = 'general',
  options: {
    allowFallback?: boolean;
    source?: ModelCapabilitySource;
    note?: string;
  } = {}
): ModelCapabilityClassification {
  const capabilities = inferKnownModelCapabilitiesFromName(modelName);
  if (capabilities.length > 0) {
    const metadataSource = options.source ?? 'name_inferred';
    return {
      capabilities,
      purpose: purposeForModelCapabilities(capabilities, fallbackPurpose),
      metadata: createModelCapabilityMetadata({
        source: metadataSource,
        confidence: metadataSource === 'official_catalog' || metadataSource === 'provider' ? 'high' : 'medium',
        note: options.note
      })
    };
  }

  if (options.allowFallback) {
    const fallbackCapabilities = defaultCapabilitiesForPurpose(fallbackPurpose);
    return {
      capabilities: fallbackCapabilities,
      purpose: fallbackPurpose,
      metadata: createModelCapabilityMetadata({
        source: options.source ?? 'name_inferred',
        confidence: 'low',
        note: options.note ?? '未命中明确模型能力规则，按槽位用途兜底。'
      })
    };
  }

  return {
    capabilities: [],
    purpose: fallbackPurpose,
    metadata: createModelCapabilityMetadata({
      source: 'unknown',
      confidence: 'unknown',
      note: options.note ?? '供应商未声明能力，模型名称也未命中可靠规则，请人工确认。'
    })
  };
}

export function readModelCatalogEntryEffectiveCapabilities(model: ModelCatalogEntry): ModelCapability[] {
  return normalizeExplicitModelCapabilities([
    ...(model.verifiedCapabilities ?? []),
    ...(model.capabilities ?? []),
    ...inferKnownModelCapabilitiesFromName(model.id),
    ...(model.label ? inferKnownModelCapabilitiesFromName(model.label) : [])
  ]);
}

export function inferModelCapabilitiesFromName(
  modelName: string,
  fallbackPurpose: ModelPurpose = 'general'
): ModelCapability[] {
  const knownCapabilities = inferKnownModelCapabilitiesFromName(modelName);
  return knownCapabilities.length > 0 ? knownCapabilities : defaultCapabilitiesForPurpose(fallbackPurpose);
}

export function inferKnownModelCapabilitiesFromName(modelName: string): ModelCapability[] {
  const normalizedName = modelName.trim().toLowerCase();

  if (!normalizedName) {
    return [];
  }

  if (matchesAny(normalizedName, ['embedding', 'embeddings', 'bge-m3', 'text-embedding'])) {
    return ['embedding'];
  }

  if (matchesAny(normalizedName, ['rerank', 'reranker'])) {
    return ['rerank'];
  }

  if (matchesAny(normalizedName, ['long', '128k', '200k', '1m', 'context', 'document', 'doc'])) {
    return ['long_context', 'text'];
  }

  if (matchesAny(normalizedName, ['whisper', 'asr', 'speech-to-text', 'audio-transcription'])) {
    return ['audio_to_text'];
  }

  if (matchesAny(normalizedName, ['tts', 'text-to-speech', 'speech-synthesis'])) {
    return ['text_to_audio'];
  }

  if (matchesAny(normalizedName, ['image-to-image', 'img2img', 'inpaint', 'edit-image', 'image-edit', 'edit_image'])) {
    return ['image_generation', 'image_to_image', 'image_editing'];
  }

  if (matchesAny(normalizedName, ['veo', 'kling', 'pika', 'hailuo', 'runway', 'sora', 'seedance', 'text-to-video', 'image-to-video', 't2v', 'i2v', 'wanx-video'])) {
    return ['video_generation', 'text_to_video', 'image_to_video'];
  }

  if (matchesAny(normalizedName, ['gpt-image', 'image-generation', 'dall-e', 'imagen', 'flux', 'stable-diffusion', 'wanx', 'text-to-image', 'cogview', 'seedream', 'midjourney', 'nano-banana'])) {
    return ['image_generation', 'text_to_image', 'image_to_image', 'image_editing'];
  }

  if (matchesAny(normalizedName, ['video', 'videounderstanding'])) {
    return ['video_understanding', 'video_text', 'vision_text', 'text'];
  }

  if (matchesAny(normalizedName, ['vision', 'vl', 'gpt-4o', 'gemini', 'qwen-vl', 'glm-4v', 'minimax-vl'])) {
    return ['image_understanding', 'vision_understanding', 'vision_text', 'text'];
  }

  if (
    matchesAny(normalizedName, [
      'reason',
      'reasoner',
      'thinking',
      'deepseek-r1',
      'deepseek-v4-pro',
      'o1',
      'o3',
      'r1'
    ])
  ) {
    return ['reasoning_text', 'text'];
  }

  if (
    matchesAny(normalizedName, [
      'deepseek-chat',
      'deepseek-v3',
      'deepseek-v4',
      'qwen-plus',
      'qwen-max',
      'qwen-turbo',
      'qwen2.5',
      'gpt-3.5',
      'gpt-4',
      'gpt-5',
      'claude',
      'gemini-pro',
      'glm',
      'kimi',
      'moonshot',
      'hunyuan',
      'ernie',
      'yi-',
      'abab',
      'minimax',
      'doubao'
    ])
  ) {
    return ['text'];
  }

  return [];
}

function matchesAny(value: string, tokens: string[]): boolean {
  return tokens.some((token) => value.includes(token));
}

function isDedicatedAudioTranscriptionModelName(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  return matchesAny(normalized, ['whisper', 'asr', 'speech-to-text', 'audio-transcription', 'paraformer']);
}

function normalizeCapabilityToken(value: string): string {
  return value.trim().toLowerCase().replace(/[-\s]+/g, '_');
}
