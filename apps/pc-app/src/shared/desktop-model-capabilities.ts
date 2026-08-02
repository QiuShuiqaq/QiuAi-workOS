import type { ModelCapability, ModelProfile, ModelPurpose } from './desktop-contract.js';

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

export function normalizeModelCapabilities(
  capabilities: ModelCapability[] | undefined,
  purpose: ModelPurpose
): ModelCapability[] {
  const allowed = new Set<ModelCapability>([
    ...modelCapabilityOptions.map((option) => option.value),
    'image_understanding',
    'image_editing'
  ]);
  const normalized = [...new Set((capabilities ?? []).filter((item) => allowed.has(item)))];
  return normalized.length > 0 ? normalized : defaultCapabilitiesForPurpose(purpose);
}

export function readModelProfileCapabilities(profile: ModelProfile): ModelCapability[] {
  return normalizeModelCapabilities(profile.capabilities, profile.purpose);
}

export function readEffectiveModelProfileCapabilities(profile: ModelProfile): string[] {
  return [
    ...new Set([
      ...inferModelCapabilitiesFromName(profile.modelName, profile.purpose),
      ...readModelProfileCapabilities(profile)
    ].map(normalizeCapabilityToken))
  ];
}

export function modelProfileSupportsRequiredCapabilities(
  profile: ModelProfile,
  requiredCapabilities: string[]
): boolean {
  const capabilities = new Set(readEffectiveModelProfileCapabilities(profile));
  const required = [
    ...new Set(requiredCapabilities.map(normalizeCapabilityToken).filter(Boolean))
  ];
  if (required.length === 0) {
    return true;
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

export function inferModelCapabilitiesFromName(
  modelName: string,
  fallbackPurpose: ModelPurpose = 'general'
): ModelCapability[] {
  const normalizedName = modelName.trim().toLowerCase();

  if (!normalizedName) {
    return defaultCapabilitiesForPurpose(fallbackPurpose);
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

  if (matchesAny(normalizedName, ['gpt-image', 'image-generation', 'dall-e', 'imagen', 'flux', 'stable-diffusion', 'wanx', 'text-to-image', 'cogview', 'seedream', 'midjourney', 'nano-banana'])) {
    return ['image_generation', 'text_to_image', 'image_to_image', 'image_editing'];
  }

  if (matchesAny(normalizedName, ['veo', 'kling', 'pika', 'hailuo', 'runway', 'sora', 'seedance', 'text-to-video', 'image-to-video'])) {
    return ['video_generation', 'text_to_video', 'image_to_video'];
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

  return defaultCapabilitiesForPurpose(fallbackPurpose);
}

function matchesAny(value: string, tokens: string[]): boolean {
  return tokens.some((token) => value.includes(token));
}

function normalizeCapabilityToken(value: string): string {
  return value.trim().toLowerCase().replace(/[-\s]+/g, '_');
}
