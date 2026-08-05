export type ServerToolActionStatus =
  | 'ready'
  | 'disabled'
  | 'missing_config'
  | 'missing_dependency'
  | 'unavailable'
  | 'experimental';

export type ServerToolActionCategory = 'web' | 'document' | 'file' | 'video' | 'integration';
export type ServerToolActionFieldType = 'text' | 'number' | 'textarea' | 'boolean';
export type ServerToolValueType =
  | 'text'
  | 'json'
  | 'table'
  | 'file'
  | 'files'
  | 'image'
  | 'images'
  | 'video'
  | 'videos'
  | 'artifact'
  | 'artifact[]'
  | 'number'
  | 'boolean';

export interface ServerToolPackageDefinition {
  id: string;
  name: string;
  category: ServerToolActionCategory;
  description: string;
}

export interface ServerToolActionDefinition {
  packageId: string;
  actionId: string;
  name: string;
  category: ServerToolActionCategory;
  description: string;
  input: Array<{ key: string; label: string; type: ServerToolValueType; required?: boolean; description?: string }>;
  output: Array<{ key: string; label: string; type: ServerToolValueType; required?: boolean; description?: string }>;
  defaultInput: Record<string, unknown>;
  uiFields: Array<{
    key: string;
    label: string;
    placeholder?: string;
    type?: ServerToolActionFieldType;
    format?: 'text' | 'json';
  }>;
  requiredConfig: string[];
  requiredDependencies: string[];
  artifactFormat?: 'md' | 'docx' | 'xlsx' | 'csv' | 'pptx' | 'png' | 'jpg' | 'pdf' | 'mp4' | 'zip';
  maturity: 'stable' | 'experimental';
}

export interface ServerToolActionCatalog {
  packages: ServerToolPackageDefinition[];
  actions: ServerToolActionDefinition[];
}

export const serverToolPackages: ServerToolPackageDefinition[] = [
  { id: 'web-search', name: '网页工具', category: 'web', description: '网页搜索和网页正文读取。' },
  { id: 'office-document', name: '办公文档', category: 'document', description: '读取文档文本，生成 Word、Excel、CSV 和 PPT。' },
  { id: 'local-filesystem', name: '本地文件', category: 'file', description: '读取、写入和列出本地授权文件。' },
  { id: 'video-processing', name: '视频处理', category: 'video', description: '读取视频信息、抽取关键帧和导出剪辑视频。' },
  { id: 'browser-automation', name: 'RPA 浏览器', category: 'integration', description: '在 PC 本机打开网页、执行基础点击填表和页面文本提取。' },
  { id: 'http-request', name: 'HTTP 接口', category: 'integration', description: '调用外部 HTTP API。' },
  { id: 'mcp', name: 'MCP 工具', category: 'integration', description: '调用本地或远程 MCP 工具。' }
];

export const serverToolActions: ServerToolActionDefinition[] = [
  {
    packageId: 'web-search',
    actionId: 'web.search',
    name: '网页搜索',
    category: 'web',
    description: '根据关键词搜索网页并返回标题、链接和摘要。',
    input: [
      { key: 'query', label: '搜索词', type: 'text', required: true },
      { key: 'maxResults', label: '结果数量', type: 'number' }
    ],
    output: [
      { key: 'results', label: '搜索结果', type: 'json' },
      { key: 'text', label: '摘要文本', type: 'text' }
    ],
    defaultInput: { query: '{{start.text}}', maxResults: 5 },
    uiFields: [
      { key: 'query', label: '搜索词', placeholder: '{{start.text}}' },
      { key: 'maxResults', label: '结果数量', type: 'number' }
    ],
    requiredConfig: [],
    requiredDependencies: [],
    maturity: 'stable'
  },
  {
    packageId: 'web-search',
    actionId: 'web.fetch_url',
    name: '读取网页正文',
    category: 'web',
    description: '读取公开网页正文并返回可供 LLM 使用的文本。',
    input: [
      { key: 'url', label: 'URL', type: 'text', required: true },
      { key: 'maxChars', label: '最大字符数', type: 'number' }
    ],
    output: [
      { key: 'text', label: '网页正文', type: 'text' },
      { key: 'url', label: 'URL', type: 'text' }
    ],
    defaultInput: { url: 'https://example.com', maxChars: 12000 },
    uiFields: [
      { key: 'url', label: 'URL', placeholder: 'https://example.com' },
      { key: 'maxChars', label: '最大字符', type: 'number' }
    ],
    requiredConfig: [],
    requiredDependencies: [],
    maturity: 'stable'
  },
  {
    packageId: 'office-document',
    actionId: 'document.extract_text',
    name: '读取文档文本',
    category: 'document',
    description: '从 Word、PDF、TXT 等文档中提取文本。',
    input: [
      { key: 'path', label: '文件路径', type: 'file', required: true },
      { key: 'maxChars', label: '最大字符数', type: 'number' }
    ],
    output: [
      { key: 'text', label: '文档文本', type: 'text' },
      { key: 'metadata', label: '文档信息', type: 'json' }
    ],
    defaultInput: { path: '$start.files.0.localPath', maxChars: 30000 },
    uiFields: [
      { key: 'path', label: '文件路径', placeholder: '$start.files.0.localPath' },
      { key: 'maxChars', label: '最大字符', type: 'number' }
    ],
    requiredConfig: [],
    requiredDependencies: [],
    maturity: 'stable'
  },
  {
    packageId: 'office-document',
    actionId: 'office.write_docx_document',
    name: '生成 Word',
    category: 'document',
    description: '把结构化正文写成 docx 文件。',
    input: [
      { key: 'content', label: '正文', type: 'text', required: true },
      { key: 'fileName', label: '文件名', type: 'text' }
    ],
    output: [{ key: 'artifact', label: 'Word 文件', type: 'artifact' }],
    defaultInput: { title: '{{task.title}}', folder: 'documents', fileName: '{{task.title}}', content: '{{runtime.previous_text}}' },
    uiFields: [
      { key: 'title', label: '标题' },
      { key: 'folder', label: '目录' },
      { key: 'fileName', label: '文件名' },
      { key: 'content', label: '内容', type: 'textarea', format: 'text', placeholder: '{{runtime.previous_text}}' }
    ],
    requiredConfig: [],
    requiredDependencies: [],
    artifactFormat: 'docx',
    maturity: 'stable'
  },
  {
    packageId: 'office-document',
    actionId: 'office.write_markdown_document',
    name: '生成 Markdown',
    category: 'document',
    description: '把正文写成本地 Markdown 文件。',
    input: [
      { key: 'content', label: '正文', type: 'text', required: true },
      { key: 'fileName', label: '文件名', type: 'text' }
    ],
    output: [{ key: 'artifact', label: 'Markdown 文件', type: 'artifact' }],
    defaultInput: { title: '{{task.title}}', folder: 'documents', fileName: '{{task.title}}', content: '{{runtime.previous_text}}' },
    uiFields: [
      { key: 'title', label: '标题' },
      { key: 'folder', label: '目录' },
      { key: 'fileName', label: '文件名' },
      { key: 'content', label: '内容', type: 'textarea', format: 'text', placeholder: '{{runtime.previous_text}}' }
    ],
    requiredConfig: [],
    requiredDependencies: [],
    artifactFormat: 'md',
    maturity: 'stable'
  },
  {
    packageId: 'office-document',
    actionId: 'spreadsheet.write_xlsx',
    name: '生成 Excel',
    category: 'document',
    description: '把二维数组或对象数组写成 xlsx 文件。',
    input: [
      { key: 'sheets', label: 'Sheets', type: 'json' },
      { key: 'rows', label: '表格行', type: 'table' },
      { key: 'content', label: '表格内容', type: 'text' },
      { key: 'fileName', label: '文件名', type: 'text' }
    ],
    output: [{ key: 'artifact', label: 'Excel 文件', type: 'artifact' }],
    defaultInput: { title: '{{task.title}}', folder: 'spreadsheets', fileName: '{{task.title}}', content: '{{runtime.previous_text}}' },
    uiFields: [
      { key: 'title', label: '标题' },
      { key: 'folder', label: '目录' },
      { key: 'fileName', label: '文件名' },
      { key: 'content', label: '内容', type: 'textarea', format: 'text', placeholder: '{{runtime.previous_text}}' },
      { key: 'sheets', label: 'Sheets JSON', type: 'textarea', format: 'json', placeholder: '[{"name":"Sheet1","rows":[["项目","内容"]]}]' },
      { key: 'rows', label: '行数据 JSON', type: 'textarea', format: 'json', placeholder: '[["项目","内容"],["结果","{{runtime.previous_text}}"]]' }
    ],
    requiredConfig: [],
    requiredDependencies: [],
    artifactFormat: 'xlsx',
    maturity: 'stable'
  },
  {
    packageId: 'office-document',
    actionId: 'spreadsheet.write_csv',
    name: '生成 CSV',
    category: 'document',
    description: '把二维数组或对象数组写成 csv 文件。',
    input: [
      { key: 'rows', label: '表格行', type: 'table' },
      { key: 'content', label: '表格内容', type: 'text' },
      { key: 'fileName', label: '文件名', type: 'text' }
    ],
    output: [{ key: 'artifact', label: 'CSV 文件', type: 'artifact' }],
    defaultInput: { title: '{{task.title}}', folder: 'spreadsheets', fileName: '{{task.title}}', content: '{{runtime.previous_text}}' },
    uiFields: [
      { key: 'title', label: '标题' },
      { key: 'folder', label: '目录' },
      { key: 'fileName', label: '文件名' },
      { key: 'content', label: '内容', type: 'textarea', format: 'text', placeholder: '{{runtime.previous_text}}' },
      { key: 'rows', label: '行数据 JSON', type: 'textarea', format: 'json', placeholder: '[["项目","内容"],["结果","{{runtime.previous_text}}"]]' }
    ],
    requiredConfig: [],
    requiredDependencies: [],
    artifactFormat: 'csv',
    maturity: 'stable'
  },
  {
    packageId: 'office-document',
    actionId: 'presentation.write_pptx',
    name: '生成 PPT',
    category: 'document',
    description: '根据幻灯片 JSON 生成 pptx 文件。',
    input: [
      { key: 'slides', label: '幻灯片', type: 'json' },
      { key: 'content', label: '演示内容', type: 'text' }
    ],
    output: [{ key: 'artifact', label: 'PPT 文件', type: 'artifact' }],
    defaultInput: { title: '{{task.title}}', folder: 'presentations', fileName: '{{task.title}}', content: '{{runtime.previous_text}}' },
    uiFields: [
      { key: 'title', label: '标题' },
      { key: 'folder', label: '目录' },
      { key: 'fileName', label: '文件名' },
      { key: 'content', label: '内容', type: 'textarea', format: 'text', placeholder: '{{runtime.previous_text}}' },
      { key: 'slides', label: '幻灯片 JSON', type: 'textarea', format: 'json', placeholder: '[{"title":"标题","bullets":["要点"]}]' }
    ],
    requiredConfig: [],
    requiredDependencies: [],
    artifactFormat: 'pptx',
    maturity: 'experimental'
  },
  {
    packageId: 'local-filesystem',
    actionId: 'filesystem.read_text_file',
    name: '读取文本文件',
    category: 'file',
    description: '读取授权路径内的文本文件内容。',
    input: [
      { key: 'path', label: '路径', type: 'file', required: true },
      { key: 'maxChars', label: '最大字符数', type: 'number' }
    ],
    output: [{ key: 'text', label: '文本内容', type: 'text' }],
    defaultInput: { path: '$start.files.0.localPath', maxChars: 30000 },
    uiFields: [
      { key: 'path', label: '路径', placeholder: '$start.files.0.localPath' },
      { key: 'maxChars', label: '最大字符', type: 'number' }
    ],
    requiredConfig: [],
    requiredDependencies: [],
    maturity: 'stable'
  },
  {
    packageId: 'local-filesystem',
    actionId: 'filesystem.write_text_file',
    name: '写入文本文件',
    category: 'file',
    description: '把文本写入本地产物目录。',
    input: [{ key: 'content', label: '内容', type: 'text', required: true }],
    output: [{ key: 'artifact', label: '文本文件', type: 'artifact' }],
    defaultInput: { folder: 'reports', fileName: '{{task.title}}', content: '{{runtime.previous_text}}' },
    uiFields: [
      { key: 'folder', label: '目录' },
      { key: 'fileName', label: '文件名' },
      { key: 'content', label: '内容', type: 'textarea', placeholder: '{{runtime.previous_text}}' }
    ],
    requiredConfig: [],
    requiredDependencies: [],
    maturity: 'stable'
  },
  {
    packageId: 'local-filesystem',
    actionId: 'filesystem.list_directory',
    name: '列出文件夹',
    category: 'file',
    description: '列出授权路径内的文件夹条目。',
    input: [{ key: 'path', label: '目录路径', type: 'file', required: true }],
    output: [{ key: 'entries', label: '文件列表', type: 'json' }],
    defaultInput: { path: '$start.files.0.localPath' },
    uiFields: [{ key: 'path', label: '目录路径' }],
    requiredConfig: [],
    requiredDependencies: [],
    maturity: 'stable'
  },
  {
    packageId: 'local-filesystem',
    actionId: 'filesystem.download_remote_file',
    name: '下载远程文件',
    category: 'file',
    description: '把模型或工具返回的远程图片、视频等文件保存到本地工作区产物目录。',
    input: [
      { key: 'url', label: '远程文件 URL', type: 'text', required: true },
      { key: 'folder', label: '目录', type: 'text' },
      { key: 'fileName', label: '文件名', type: 'text' },
      { key: 'mediaKind', label: '媒体类型', type: 'text' }
    ],
    output: [
      { key: 'localPath', label: '本地文件路径', type: 'file' },
      { key: 'sourceUrl', label: '来源 URL', type: 'text' },
      { key: 'sizeBytes', label: '文件大小', type: 'number' }
    ],
    defaultInput: {
      url: '{{runtime.remote_url}}',
      folder: 'remote-assets',
      fileName: '{{task.title}}',
      mediaKind: 'file'
    },
    uiFields: [
      { key: 'url', label: '远程文件 URL', placeholder: '{{runtime.remote_url}}' },
      { key: 'folder', label: '目录' },
      { key: 'fileName', label: '文件名' },
      { key: 'mediaKind', label: '媒体类型' }
    ],
    requiredConfig: [],
    requiredDependencies: [],
    maturity: 'stable'
  },
  {
    packageId: 'local-filesystem',
    actionId: 'filesystem.package_zip',
    name: '打包 ZIP',
    category: 'file',
    description: '把一组本地文件和可选 manifest 打包成本地 ZIP 产物。',
    input: [
      { key: 'files', label: '文件列表', type: 'files', required: true },
      { key: 'manifest', label: '清单 JSON', type: 'json' },
      { key: 'fileName', label: '文件名', type: 'text' }
    ],
    output: [{ key: 'artifact', label: 'ZIP 文件', type: 'artifact' }],
    defaultInput: {
      folder: 'packages',
      fileName: '{{task.title}}',
      files: '$runtime.previous_files',
      manifest: {}
    },
    uiFields: [
      { key: 'folder', label: '目录' },
      { key: 'fileName', label: '文件名' },
      { key: 'files', label: '文件列表 JSON', type: 'textarea', format: 'json', placeholder: '[{"localPath":"C:/path/image.png"}]' },
      { key: 'manifest', label: '清单 JSON', type: 'textarea', format: 'json', placeholder: '{"task":"{{task.title}}"}' }
    ],
    requiredConfig: [],
    requiredDependencies: [],
    artifactFormat: 'zip',
    maturity: 'stable'
  },
  {
    packageId: 'video-processing',
    actionId: 'video.probe',
    name: '读取视频信息',
    category: 'video',
    description: '读取视频文件大小、路径等基础信息。',
    input: [{ key: 'videoPath', label: '视频路径', type: 'video', required: true }],
    output: [{ key: 'metadata', label: '视频信息', type: 'json' }],
    defaultInput: { videoPath: '$runtime.current_item.localPath' },
    uiFields: [{ key: 'videoPath', label: '视频路径', placeholder: '$runtime.current_item.localPath' }],
    requiredConfig: [],
    requiredDependencies: ['ffprobe'],
    maturity: 'stable'
  },
  {
    packageId: 'video-processing',
    actionId: 'video.extract_frames',
    name: '抽取关键帧',
    category: 'video',
    description: '用 FFmpeg 从视频中按间隔抽取图片帧。',
    input: [
      { key: 'videoPath', label: '视频路径', type: 'video', required: true },
      { key: 'frameIntervalSeconds', label: '抽帧间隔秒', type: 'number' },
      { key: 'maxFrames', label: '最多帧数', type: 'number' }
    ],
    output: [
      { key: 'frames', label: '关键帧', type: 'images' },
      { key: 'folderPath', label: '输出目录', type: 'file' }
    ],
    defaultInput: { videoPath: '$runtime.current_item.localPath', frameIntervalSeconds: 5, maxFrames: 12, folder: 'frames', fileName: '{{task.title}}' },
    uiFields: [
      { key: 'videoPath', label: '视频路径', placeholder: '$runtime.current_item.localPath' },
      { key: 'frameIntervalSeconds', label: '抽帧间隔秒', type: 'number' },
      { key: 'maxFrames', label: '最多帧数', type: 'number' },
      { key: 'folder', label: '保存目录' },
      { key: 'fileName', label: '文件名' }
    ],
    requiredConfig: [],
    requiredDependencies: ['ffmpeg'],
    maturity: 'stable'
  },
  {
    packageId: 'video-processing',
    actionId: 'video.extract_audio',
    name: '抽取音频',
    category: 'video',
    description: '用 FFmpeg 从视频中抽取音轨，生成适合语音转文字的音频文件。',
    input: [
      { key: 'videoPath', label: '视频路径', type: 'video', required: true },
      { key: 'audioFormat', label: '音频格式', type: 'text' }
    ],
    output: [
      { key: 'artifact', label: '音频文件', type: 'artifact' },
      { key: 'localPath', label: '本地路径', type: 'file' }
    ],
    defaultInput: { videoPath: '$runtime.current_item.localPath', audioFormat: 'm4a', folder: 'audios', fileName: '{{task.title}}' },
    uiFields: [
      { key: 'videoPath', label: '视频路径', placeholder: '$runtime.current_item.localPath' },
      { key: 'audioFormat', label: '音频格式', placeholder: 'm4a / mp3 / wav' },
      { key: 'folder', label: '保存目录' },
      { key: 'fileName', label: '文件名' }
    ],
    requiredConfig: [],
    requiredDependencies: ['ffmpeg'],
    maturity: 'stable'
  },
  {
    packageId: 'video-processing',
    actionId: 'video.compose_clips',
    name: '导出剪辑视频',
    category: 'video',
    description: '根据 cutPlan 把原视频剪辑成新的 MP4 文件。',
    input: [
      { key: 'videoPath', label: '视频路径', type: 'video', required: true },
      { key: 'cutPlan', label: '剪辑方案', type: 'json', required: true }
    ],
    output: [{ key: 'artifact', label: 'MP4 文件', type: 'artifact' }],
    defaultInput: { videoPath: '$runtime.current_item.localPath', cutPlan: [{ start: 0, end: 15 }], folder: 'videos', fileName: '{{task.title}}' },
    uiFields: [
      { key: 'videoPath', label: '视频路径', placeholder: '$runtime.current_item.localPath' },
      { key: 'cutPlan', label: '剪辑方案 JSON', type: 'textarea', format: 'json', placeholder: '[{"start":0,"end":15}]' },
      { key: 'folder', label: '保存目录' },
      { key: 'fileName', label: '文件名' }
    ],
    requiredConfig: [],
    requiredDependencies: ['ffmpeg'],
    artifactFormat: 'mp4',
    maturity: 'stable'
  },
  {
    packageId: 'video-processing',
    actionId: 'video.export_mp4',
    name: '导出 MP4',
    category: 'video',
    description: '根据输入视频和剪辑片段导出 MP4 文件。',
    input: [
      { key: 'videoPath', label: '视频路径', type: 'video', required: true },
      { key: 'cutPlan', label: '剪辑方案', type: 'json' }
    ],
    output: [{ key: 'artifact', label: 'MP4 文件', type: 'artifact' }],
    defaultInput: { videoPath: '$runtime.current_item.localPath', cutPlan: [{ start: 0, end: 15 }], folder: 'videos', fileName: '{{task.title}}' },
    uiFields: [
      { key: 'videoPath', label: '视频路径', placeholder: '$runtime.current_item.localPath' },
      { key: 'cutPlan', label: '剪辑方案 JSON', type: 'textarea', format: 'json', placeholder: '[{"start":0,"end":15}]' },
      { key: 'folder', label: '保存目录' },
      { key: 'fileName', label: '文件名' }
    ],
    requiredConfig: [],
    requiredDependencies: ['ffmpeg'],
    artifactFormat: 'mp4',
    maturity: 'stable'
  },
  {
    packageId: 'browser-automation',
    actionId: 'browser.open_url',
    name: '打开网页',
    category: 'integration',
    description: '在 PC 本机 RPA 浏览器中打开网页，支持用户手动登录或确认。',
    input: [
      { key: 'url', label: 'URL', type: 'text', required: true },
      { key: 'waitForUserSeconds', label: '人工停留秒数', type: 'number' }
    ],
    output: [
      { key: 'url', label: '当前 URL', type: 'text' },
      { key: 'title', label: '页面标题', type: 'text' }
    ],
    defaultInput: { url: 'https://example.com', waitForUserSeconds: 1, show: true, closeAfter: false },
    uiFields: [
      { key: 'url', label: 'URL' },
      { key: 'waitForUserSeconds', label: '人工停留秒数', type: 'number' },
      { key: 'show', label: '显示浏览器', type: 'boolean' },
      { key: 'closeAfter', label: '完成后关闭', type: 'boolean' }
    ],
    requiredConfig: [],
    requiredDependencies: [],
    maturity: 'experimental'
  },
  {
    packageId: 'browser-automation',
    actionId: 'browser.extract_text',
    name: '提取网页文本',
    category: 'integration',
    description: '打开网页并提取当前页面标题、正文和链接，用于招聘、销售等页面信息整理。',
    input: [
      { key: 'url', label: 'URL', type: 'text', required: true },
      { key: 'waitForUserSeconds', label: '人工停留秒数', type: 'number' },
      { key: 'maxChars', label: '最大字符数', type: 'number' }
    ],
    output: [
      { key: 'text', label: '页面文本', type: 'text' },
      { key: 'links', label: '页面链接', type: 'json' }
    ],
    defaultInput: { url: 'https://example.com', waitForUserSeconds: 1, maxChars: 50000, show: true, closeAfter: false },
    uiFields: [
      { key: 'url', label: 'URL' },
      { key: 'waitForUserSeconds', label: '人工停留秒数', type: 'number' },
      { key: 'maxChars', label: '最大字符数', type: 'number' },
      { key: 'show', label: '显示浏览器', type: 'boolean' },
      { key: 'closeAfter', label: '完成后关闭', type: 'boolean' }
    ],
    requiredConfig: [],
    requiredDependencies: [],
    maturity: 'experimental'
  },
  {
    packageId: 'browser-automation',
    actionId: 'browser.run_steps',
    name: '执行网页步骤',
    category: 'integration',
    description: '按步骤执行 navigate、wait、fill、click、extract_text，用于低成本网页 RPA。',
    input: [
      { key: 'steps', label: '步骤 JSON', type: 'json', required: true },
      { key: 'timeoutMs', label: '超时毫秒', type: 'number' }
    ],
    output: [
      { key: 'outputs', label: '步骤结果', type: 'json' },
      { key: 'text', label: '提取文本', type: 'text' }
    ],
    defaultInput: {
      steps: [
        { type: 'navigate', url: 'https://example.com' },
        { type: 'extract_text' }
      ],
      timeoutMs: 30000,
      show: true,
      closeAfter: false
    },
    uiFields: [
      { key: 'steps', label: '步骤 JSON', type: 'textarea', format: 'json' },
      { key: 'timeoutMs', label: '超时毫秒', type: 'number' },
      { key: 'show', label: '显示浏览器', type: 'boolean' },
      { key: 'closeAfter', label: '完成后关闭', type: 'boolean' }
    ],
    requiredConfig: [],
    requiredDependencies: [],
    maturity: 'experimental'
  },
  {
    packageId: 'http-request',
    actionId: 'http.request',
    name: 'HTTP 请求',
    category: 'integration',
    description: '调用外部 HTTP API 并返回响应文本或 JSON。',
    input: [
      { key: 'method', label: '方法', type: 'text' },
      { key: 'url', label: 'URL', type: 'text', required: true },
      { key: 'headers', label: '请求头', type: 'json' },
      { key: 'body', label: '请求体', type: 'text' }
    ],
    output: [
      { key: 'response', label: '响应', type: 'json' },
      { key: 'text', label: '响应文本', type: 'text' }
    ],
    defaultInput: { method: 'GET', url: 'https://api.example.com', headers: {}, body: '', maxChars: 24000, timeoutMs: 30000, allowPrivateNetwork: false },
    uiFields: [
      { key: 'method', label: '方法' },
      { key: 'url', label: 'URL' },
      { key: 'headers', label: '请求头 JSON', type: 'textarea', format: 'json', placeholder: '{"Authorization":"Bearer ..."}' },
      { key: 'body', label: '请求体', type: 'textarea', format: 'text' },
      { key: 'maxChars', label: '最大字符', type: 'number' },
      { key: 'timeoutMs', label: '超时毫秒', type: 'number' },
      { key: 'allowPrivateNetwork', label: '允许内网', type: 'boolean' }
    ],
    requiredConfig: [],
    requiredDependencies: [],
    maturity: 'stable'
  },
  {
    packageId: 'mcp',
    actionId: 'mcp.call',
    name: '调用 MCP 工具',
    category: 'integration',
    description: '调用 MCP 服务中的指定工具。',
    input: [
      { key: 'endpoint', label: '服务地址', type: 'text', required: true },
      { key: 'toolName', label: '工具名', type: 'text', required: true },
      { key: 'arguments', label: '参数', type: 'json' }
    ],
    output: [
      { key: 'response', label: '响应', type: 'json' },
      { key: 'text', label: '响应文本', type: 'text' }
    ],
    defaultInput: { endpoint: 'http://127.0.0.1:3001/mcp', toolName: '', arguments: {}, headers: {}, timeoutMs: 30000, allowPrivateNetwork: true },
    uiFields: [
      { key: 'endpoint', label: '服务地址' },
      { key: 'toolName', label: '工具名' },
      { key: 'arguments', label: '参数 JSON', type: 'textarea', format: 'json', placeholder: '{"query":"{{start.text}}"}' },
      { key: 'headers', label: '请求头 JSON', type: 'textarea', format: 'json' },
      { key: 'timeoutMs', label: '超时毫秒', type: 'number' },
      { key: 'allowPrivateNetwork', label: '允许内网', type: 'boolean' }
    ],
    requiredConfig: ['endpoint', 'toolName'],
    requiredDependencies: [],
    maturity: 'stable'
  }
];

export const serverToolActionIds = new Set(serverToolActions.map((action) => action.actionId));
export const serverToolPackageIds = new Set(serverToolPackages.map((toolPackage) => toolPackage.id));

export function listServerToolActionCatalog(): ServerToolActionCatalog {
  return {
    packages: serverToolPackages,
    actions: serverToolActions
  };
}

export function getServerToolAction(actionId: string): ServerToolActionDefinition | undefined {
  return serverToolActions.find((action) => action.actionId === actionId);
}
