import {
  DeleteOutlined,
  FileImageOutlined,
  PlusOutlined,
  SaveOutlined,
  SnippetsOutlined,
  VideoCameraOutlined
} from '@ant-design/icons';
import Button from 'antd/es/button';
import Empty from 'antd/es/empty';
import Flex from 'antd/es/flex';
import Form from 'antd/es/form';
import Input from 'antd/es/input';
import message from 'antd/es/message';
import Modal from 'antd/es/modal';
import Popconfirm from 'antd/es/popconfirm';
import Space from 'antd/es/space';
import Tabs from 'antd/es/tabs';
import Tag from 'antd/es/tag';
import Typography from 'antd/es/typography';
import { useMemo, useState } from 'react';

export type MediaPromptTemplateKind = 'image' | 'video';

interface MediaPromptTemplate {
  id: string;
  kind: MediaPromptTemplateKind;
  title: string;
  category: string;
  content: string;
  createdAt?: string;
  updatedAt?: string;
}

interface MediaPromptTemplateFormValues {
  title: string;
  category?: string;
  content: string;
}

interface MediaPromptTemplatePickerProps {
  kind: MediaPromptTemplateKind;
  disabled?: boolean;
  onUseTemplate: (content: string) => void;
}

type MediaPromptTemplateSource = 'official' | 'custom';

const mediaPromptTemplateStorageKey = 'qiuai.pc.media-prompt-templates.v1';

const officialMediaPromptTemplates: MediaPromptTemplate[] = [
  {
    id: 'official-image-ecommerce-main',
    kind: 'image',
    title: '电商白底主图',
    category: '电商商品',
    content: [
      '比例：1:1',
      '语言：中文',
      '以用户上传的商品图片作为严格参考，生成一张高质量电商白底商品主图。',
      '商品必须居中完整展示，占画面约 70%，保持原始外观、颜色、材质、比例、Logo、包装文字、纹理和关键结构。',
      '使用柔和棚拍光、自然接触阴影、干净边缘、真实商业摄影质感，背景为纯白或极浅灰白。',
      '不要添加促销文字、水印、价格、虚假认证、多余配件、错误 Logo、乱码文字、人物、夸张反光或与原商品不一致的结构。'
    ].join('\n')
  },
  {
    id: 'official-image-ecommerce-scene',
    kind: 'image',
    title: '商品生活场景图',
    category: '电商商品',
    content: [
      '比例：4:5',
      '语言：中文',
      '以用户上传的商品图片作为参考，生成真实可信的生活方式场景商品图。',
      '根据商品用途选择自然家庭、办公、户外、厨房、浴室或旅行场景；道具数量克制，只用于说明使用环境。',
      '商品必须保持原始颜色、结构、材质、Logo 和关键细节，始终是视觉中心，不被人物或道具遮挡。',
      '画面采用自然窗光或柔和商业布光，背景轻微虚化，整体干净、明亮、真实，适合详情页或社媒首图。',
      '不要生成无法验证的功效、错误文字、水印、夸张滤镜、过度装饰或输入图中不存在的配件。'
    ].join('\n')
  },
  {
    id: 'official-image-brand-poster',
    kind: 'image',
    title: '品牌宣传海报',
    category: '海报宣传',
    content: [
      '比例：3:4',
      '语言：中文',
      '生成一张现代商业品牌海报视觉，主体清晰、层级明确、适合后期加标题和卖点文案。',
      '画面主体可以是上传商品、品牌物料或指定对象；保持真实外观和关键信息，背景使用低饱和纯色、浅纹理或简洁空间。',
      '构图留出清晰排版区，不要让图像模型直接生成正文、价格、二维码或复杂文字。',
      '光线稳定、质感高级、色彩不超过 2-3 个主色，整体干净、可信、适合官网、展板、公众号或小红书使用。',
      '不要出现乱码文字、水印、错误 Logo、无关品牌、廉价光效、过度渐变或虚假认证。'
    ].join('\n')
  },
  {
    id: 'official-image-portrait',
    kind: 'image',
    title: '职业人像写真',
    category: '人像写真',
    content: [
      '比例：3:4',
      '语言：中文',
      '根据用户上传的人像参考，生成自然、真实、专业的职业形象照。',
      '保留人物五官特征、脸型、发型、年龄感和气质，不改变身份识别特征；服装为简洁商务或轻商务风格。',
      '背景使用办公室、纯色影棚或浅景深城市环境，光线柔和，肤色自然，面部清晰，姿态放松且可信。',
      '输出适合头像、简历、企业官网和社交账号使用。',
      '不要过度磨皮、改变五官、生成奇怪手指、夸张滤镜、低俗姿态、水印、乱码文字或不合适服装。'
    ].join('\n')
  },
  {
    id: 'official-image-anime-character',
    kind: 'image',
    title: '动漫角色立绘',
    category: '动漫插画',
    content: [
      '比例：2:3',
      '语言：中文',
      '生成一张完整动漫角色立绘，适合角色设定、网文封面、漫画前期概念或游戏角色草案。',
      '角色要有清晰的人设：年龄感、性格气质、服装层次、配色逻辑、发型、饰品和标志性元素。',
      '采用精致二次元插画风格，线条干净，色彩协调，面部表情自然，姿态有记忆点，背景简洁不抢主体。',
      '如果用户提供参考图，只参考角色特征和风格方向，不复制受版权保护的具体角色。',
      '不要生成低清、崩坏五官、多余肢体、错误手指、乱码文字、水印、过度暴露或侵权角色复刻。'
    ].join('\n')
  },
  {
    id: 'official-image-game-concept',
    kind: 'image',
    title: '游戏概念原画',
    category: '游戏资产',
    content: [
      '比例：16:9',
      '语言：中文',
      '生成一张游戏概念原画，用于展示角色、怪物、场景、道具或卡牌视觉方向。',
      '画面要有明确世界观、材质、光源和空间层次；主体轮廓清楚，设计细节服务于玩法或叙事，不堆砌无意义装饰。',
      '风格可以是写实幻想、赛博科幻、国风奇幻、暗黑地牢或轻量卡通，但整体要统一。',
      '如果是角色或怪物，强调剪影辨识度、装备逻辑和动作姿态；如果是场景，强调前中后景、氛围和可探索感。',
      '不要生成水印、乱码 UI、重复肢体、错乱透视、过暗看不清、杂乱细节或已有 IP 的直接复刻。'
    ].join('\n')
  },
  {
    id: 'official-image-ui-icon',
    kind: 'image',
    title: 'UI 图标插画',
    category: '图标 UI',
    content: [
      '比例：1:1',
      '语言：中文',
      '生成一枚清晰、现代、可用于应用功能入口的 UI 图标或小插画。',
      '图形语义要明确，主体居中，边缘干净，结构简单，缩小到 64px 仍能辨认。',
      '使用轻 3D、扁平矢量、玻璃拟态或简洁线性风格均可，但必须保持统一光源和统一透视。',
      '背景透明感或浅色底均可，留出安全边距，适合放在按钮、卡片、PPT 或小程序界面中。',
      '不要生成文字、水印、复杂纹理、过多小零件、低对比度主体、错误阴影或多个相互竞争的主体。'
    ].join('\n')
  },
  {
    id: 'official-image-industrial-product',
    kind: 'image',
    title: '工业产品概念图',
    category: '工业产品',
    content: [
      '比例：16:9',
      '语言：中文',
      '生成一张工业产品或消费电子产品概念效果图，强调结构合理、材质可信、可用于方案预览。',
      '主体可以是设备、零部件、包装、外观造型或产品组合；线条要清晰，比例稳定，功能分区符合常识。',
      '使用高质量 3D 渲染、柔和环境光、真实金属/塑料/玻璃/橡胶材质，背景为干净影棚或简洁使用环境。',
      '可展示正面、45 度角或爆炸示意感，但不能让结构变得不可制造。',
      '不要生成虚假品牌、错误接口、无法生产的悬浮结构、乱码文字、水印、过度科幻光效或结构错乱。'
    ].join('\n')
  },
  {
    id: 'official-video-product-showcase',
    kind: 'video',
    title: '商品展示短视频',
    category: '产品展示',
    content: [
      '比例：9:16',
      '时长：6 秒',
      '语言：中文',
      '以用户上传的商品图片作为严格参考，生成一段电商商品展示短视频。',
      '镜头从商品正面缓慢推进到 45 度侧角，商品始终完整清晰，保持原始颜色、材质、Logo、结构和关键细节。',
      '背景为干净棚拍或浅色商业场景，柔和主光和自然接触阴影，画面稳定，有轻微景深变化。',
      '不要出现文字、水印、价格、促销贴纸、错误 Logo、多余配件、人物遮挡、商品变形、跳帧、闪烁或不真实功能。'
    ].join('\n')
  },
  {
    id: 'official-video-social-ad',
    kind: 'video',
    title: '广告社媒视频',
    category: '广告社媒',
    content: [
      '比例：9:16',
      '时长：6 秒',
      '语言：中文',
      '生成一段适合抖音、小红书、视频号信息流投放的产品氛围广告短视频。',
      '前 1 秒用清晰主体和轻微动势吸引注意，中间展示使用场景或质感细节，最后保持画面干净方便后期加字幕和 CTA。',
      '画面节奏轻快但不混乱，光线明亮，色彩有品牌感，商品或核心对象始终可识别。',
      '如果上传了参考图，必须保持主体身份、颜色、材质和结构一致。',
      '不要直接生成中文广告词、价格、平台标识、水印、夸张疗效、低俗内容、闪烁画面、错误结构或无关品牌。'
    ].join('\n')
  },
  {
    id: 'official-video-digital-talking',
    kind: 'video',
    title: '数字人口播镜头',
    category: '数字口播',
    content: [
      '比例：9:16',
      '时长：6 秒',
      '语言：中文',
      '生成一段可用于数字人口播开场的镜头，人物面对镜头，自然微笑，轻微点头或手势，表达专业、可信、亲和。',
      '人物形象稳定，面部清晰，眼神看向镜头，口型可以轻微变化但不要夸张；背景为办公室、直播间或干净虚拟背景。',
      '镜头为半身中景，稳定轻推或轻微横移，光线柔和，肤色自然，服装整洁。',
      '画面留出字幕安全区，适合后期叠加口播字幕。',
      '不要生成怪异表情、嘴部撕裂、手指畸形、水印、乱码文字、过度美颜、低俗动作或身份明显变化。'
    ].join('\n')
  },
  {
    id: 'official-video-cinematic-camera',
    kind: 'video',
    title: '电影感运镜',
    category: '运镜镜头',
    content: [
      '比例：16:9',
      '时长：6 秒',
      '语言：中文',
      '生成一段电影感短镜头，强调稳定运镜、真实光影、空间层次和情绪氛围。',
      '镜头从前景缓慢推进到主体，或围绕主体做小幅环绕，运动平滑，不突然变焦，不切换场景。',
      '画面包含清晰前景、中景、背景，光线有方向性，色彩克制，主体轮廓明确。',
      '适合品牌片、宣传片、短剧气氛镜头或视频开头素材。',
      '不要生成剧烈抖动、跳帧、闪烁、文字、水印、画面融化、主体变形、无意义粒子或不合逻辑空间。'
    ].join('\n')
  },
  {
    id: 'official-video-scene-story',
    kind: 'video',
    title: '短剧情绪场景',
    category: '短剧氛围',
    content: [
      '比例：9:16',
      '时长：6 秒',
      '语言：中文',
      '生成一段短剧情绪场景视频，画面有明确人物状态、环境氛围和可继续剪辑的叙事感。',
      '人物动作简单自然，例如回头、停顿、拿起物品、走入画面或看向窗外；动作要连贯，不做复杂打斗或多人交互。',
      '环境要服务情绪：办公室压力、雨夜街头、家庭温暖、店铺忙碌、户外清晨等，光线和色彩匹配情绪。',
      '镜头稳定，保留字幕区域，适合做短剧片段、账号素材或分镜草稿。',
      '不要生成台词文字、水印、夸张表情、人物身份变化、手部畸形、突然换场、低俗内容或暴力血腥。'
    ].join('\n')
  },
  {
    id: 'official-video-brand-opening',
    kind: 'video',
    title: '品牌片开场',
    category: '品牌大片',
    content: [
      '比例：16:9',
      '时长：6 秒',
      '语言：中文',
      '生成一段品牌宣传片开场镜头，画面高级、稳定、干净，适合作为企业官网、发布会或招商视频开头。',
      '主体可以是产品、办公空间、生产现场、城市建筑、团队背影或抽象品牌场景；构图要有秩序和留白。',
      '镜头采用缓慢推进、轻微上升或平滑横移，光线真实，色彩克制，整体表达专业、可靠、有未来感。',
      '如果有上传参考图，保持参考对象的身份、材质、外观和空间关系。',
      '不要直接生成品牌口号、乱码文字、水印、过度炫光、廉价粒子、快速剪辑、画面闪烁或主体变形。'
    ].join('\n')
  }
];

function mediaKindLabel(kind: MediaPromptTemplateKind) {
  return kind === 'image' ? '生图' : '生视频';
}

function mediaKindIcon(kind: MediaPromptTemplateKind) {
  return kind === 'image' ? <FileImageOutlined /> : <VideoCameraOutlined />;
}

function createMediaPromptTemplateId(kind: MediaPromptTemplateKind) {
  return `media_prompt_${kind}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function normalizeMediaPromptTemplate(value: unknown): MediaPromptTemplate | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;
  const kind = record.kind === 'image' || record.kind === 'video' ? record.kind : undefined;
  const title = typeof record.title === 'string' ? record.title.trim() : '';
  const content = typeof record.content === 'string' ? record.content.trim() : '';
  if (!kind || !title || !content) {
    return null;
  }

  const now = new Date().toISOString();
  return {
    id: typeof record.id === 'string' && record.id.trim()
      ? record.id
      : createMediaPromptTemplateId(kind),
    kind,
    title,
    category: typeof record.category === 'string' && record.category.trim()
      ? record.category.trim()
      : mediaKindLabel(kind),
    content,
    createdAt: typeof record.createdAt === 'string' ? record.createdAt : now,
    updatedAt: typeof record.updatedAt === 'string' ? record.updatedAt : now
  };
}

function sortMediaPromptTemplates(templates: MediaPromptTemplate[]) {
  return [...templates].sort((left, right) => (right.updatedAt ?? '').localeCompare(left.updatedAt ?? ''));
}

function readCustomMediaPromptTemplates(): MediaPromptTemplate[] {
  if (typeof window === 'undefined') {
    return [];
  }

  try {
    const rawValue = window.localStorage.getItem(mediaPromptTemplateStorageKey);
    if (!rawValue) {
      return [];
    }

    const parsed = JSON.parse(rawValue);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return sortMediaPromptTemplates(
      parsed
        .map(normalizeMediaPromptTemplate)
        .filter((template): template is MediaPromptTemplate => Boolean(template))
    );
  } catch {
    return [];
  }
}

function writeCustomMediaPromptTemplates(templates: MediaPromptTemplate[]) {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(mediaPromptTemplateStorageKey, JSON.stringify(templates));
}

function createBlankTemplate(kind: MediaPromptTemplateKind): MediaPromptTemplateFormValues {
  return {
    title: '',
    category: mediaKindLabel(kind),
    content: ''
  };
}

export function MediaPromptTemplatePicker({
  kind,
  disabled,
  onUseTemplate
}: MediaPromptTemplatePickerProps) {
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<MediaPromptTemplateSource>('official');
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [customTemplates, setCustomTemplates] = useState<MediaPromptTemplate[]>(() =>
    readCustomMediaPromptTemplates()
  );
  const [form] = Form.useForm<MediaPromptTemplateFormValues>();

  const officialTemplates = useMemo(
    () => officialMediaPromptTemplates.filter((template) => template.kind === kind),
    [kind]
  );
  const customKindTemplates = useMemo(
    () => customTemplates.filter((template) => template.kind === kind),
    [customTemplates, kind]
  );
  const activeTemplates = activeTab === 'official' ? officialTemplates : customKindTemplates;
  const selectedCustomTemplate = customKindTemplates.find((template) => template.id === selectedTemplateId);

  function fillTemplateForm(template: MediaPromptTemplate | undefined) {
    setSelectedTemplateId(template?.id ?? '');
    form.setFieldsValue(
      template
        ? {
            title: template.title,
            category: template.category,
            content: template.content
          }
        : createBlankTemplate(kind)
    );
  }

  function openPicker() {
    const initialTemplate = officialTemplates[0] ?? customKindTemplates[0];
    const initialTab: MediaPromptTemplateSource = officialTemplates.length > 0 ? 'official' : 'custom';
    setActiveTab(initialTab);
    fillTemplateForm(initialTemplate);
    setOpen(true);
  }

  function changeTab(key: string) {
    const nextTab = key === 'custom' ? 'custom' : 'official';
    setActiveTab(nextTab);
    fillTemplateForm(nextTab === 'official' ? officialTemplates[0] : customKindTemplates[0]);
  }

  function startCreateCustomTemplate() {
    setActiveTab('custom');
    setSelectedTemplateId('');
    form.setFieldsValue(createBlankTemplate(kind));
  }

  async function saveCustomTemplate(copyAsNew: boolean) {
    const values = await form.validateFields();
    const title = values.title.trim();
    const content = values.content.trim();
    const category = values.category?.trim() || mediaKindLabel(kind);
    const now = new Date().toISOString();
    const shouldUpdateCurrent = !copyAsNew && activeTab === 'custom' && Boolean(selectedCustomTemplate);
    const nextTemplates = shouldUpdateCurrent
      ? customTemplates.map((template) =>
          template.id === selectedCustomTemplate?.id
            ? {
                ...template,
                title,
                category,
                content,
                updatedAt: now
              }
            : template
        )
      : [
          {
            id: createMediaPromptTemplateId(kind),
            kind,
            title,
            category,
            content,
            createdAt: now,
            updatedAt: now
          },
          ...customTemplates
        ];
    const sortedTemplates = sortMediaPromptTemplates(nextTemplates);

    try {
      writeCustomMediaPromptTemplates(sortedTemplates);
      setCustomTemplates(sortedTemplates);
      setActiveTab('custom');
      const savedTemplate = shouldUpdateCurrent
        ? sortedTemplates.find((template) => template.id === selectedCustomTemplate?.id)
        : sortedTemplates[0];
      fillTemplateForm(savedTemplate);
      message.success(shouldUpdateCurrent ? '模板已更新。' : '模板已保存到我的模板。');
    } catch {
      message.error('模板保存失败，请检查本机存储空间。');
    }
  }

  function deleteCustomTemplate() {
    if (!selectedCustomTemplate) {
      return;
    }

    const nextTemplates = customTemplates.filter((template) => template.id !== selectedCustomTemplate.id);
    try {
      writeCustomMediaPromptTemplates(nextTemplates);
      setCustomTemplates(nextTemplates);
      const nextSelectedTemplate = nextTemplates.find((template) => template.kind === kind);
      fillTemplateForm(nextSelectedTemplate);
      message.success('模板已删除。');
    } catch {
      message.error('模板删除失败，请检查本机存储空间。');
    }
  }

  function useCurrentTemplate() {
    const content = String(form.getFieldValue('content') ?? '').trim();
    if (!content) {
      message.warning('请先填写提示词内容。');
      return;
    }

    onUseTemplate(content);
    setOpen(false);
    message.success('提示词已填入输入框。');
  }

  return (
    <>
      <Button icon={<SnippetsOutlined />} disabled={disabled} onClick={openPicker}>
        提示词模板
      </Button>
      <Modal
        open={open}
        title={
          <Space size={8}>
            {mediaKindIcon(kind)}
            <span>{mediaKindLabel(kind)}提示词模板</span>
          </Space>
        }
        width={920}
        destroyOnHidden
        onCancel={() => setOpen(false)}
        footer={
          <Flex align="center" justify="space-between" gap={12} wrap="wrap">
            <Button icon={<PlusOutlined />} onClick={startCreateCustomTemplate}>
              新建模板
            </Button>
            <Space size={8} wrap>
              {activeTab === 'custom' && selectedCustomTemplate ? (
                <Popconfirm
                  title="删除这个模板？"
                  description="删除后无法恢复。"
                  okText="删除"
                  cancelText="取消"
                  okButtonProps={{ danger: true }}
                  onConfirm={deleteCustomTemplate}
                >
                  <Button danger icon={<DeleteOutlined />}>
                    删除
                  </Button>
                </Popconfirm>
              ) : null}
              {activeTab === 'custom' && selectedCustomTemplate ? (
                <Button icon={<SaveOutlined />} onClick={() => void saveCustomTemplate(false)}>
                  保存修改
                </Button>
              ) : null}
              <Button onClick={() => void saveCustomTemplate(true)}>
                保存到我的模板
              </Button>
              <Button type="primary" onClick={useCurrentTemplate}>
                使用模板
              </Button>
            </Space>
          </Flex>
        }
      >
        <div className="media-prompt-template-picker">
          <aside className="media-prompt-template-list-panel">
            <Tabs
              activeKey={activeTab}
              onChange={changeTab}
              items={[
                { key: 'official', label: '官方模板' },
                { key: 'custom', label: '我的模板' }
              ]}
            />
            {activeTemplates.length > 0 ? (
              <div className="media-prompt-template-list">
                {activeTemplates.map((template) => (
                  <button
                    key={template.id}
                    type="button"
                    className={[
                      'media-prompt-template-item',
                      selectedTemplateId === template.id ? 'selected' : ''
                    ].filter(Boolean).join(' ')}
                    onClick={() => fillTemplateForm(template)}
                  >
                    <span className="media-prompt-template-item-title">{template.title}</span>
                    <span className="media-prompt-template-item-meta">
                      <Tag>{template.category}</Tag>
                      <Typography.Text type="secondary" ellipsis>
                        {template.content.split('\n').find(Boolean)}
                      </Typography.Text>
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="media-prompt-template-empty">
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="还没有我的模板">
                  <Button size="small" type="primary" icon={<PlusOutlined />} onClick={startCreateCustomTemplate}>
                    新建模板
                  </Button>
                </Empty>
              </div>
            )}
          </aside>
          <Form form={form} layout="vertical" className="media-prompt-template-editor">
            <Form.Item
              name="title"
              label="标题"
              rules={[
                { required: true, message: '请输入标题' },
                { max: 60, message: '标题不能超过 60 个字符' }
              ]}
            >
              <Input maxLength={60} showCount placeholder="例如：商品白底主图" />
            </Form.Item>
            <Form.Item
              name="category"
              label="分类"
              rules={[{ max: 24, message: '分类不能超过 24 个字符' }]}
            >
              <Input maxLength={24} placeholder={mediaKindLabel(kind)} />
            </Form.Item>
            <Form.Item
              name="content"
              label="提示词"
              rules={[
                { required: true, message: '请输入提示词' },
                { max: 8000, message: '提示词不能超过 8000 个字符' }
              ]}
            >
              <Input.TextArea
                autoSize={{ minRows: 14, maxRows: 22 }}
                placeholder="写清比例、语言、主体、场景、镜头、风格和不要出现的内容。"
              />
            </Form.Item>
          </Form>
        </div>
      </Modal>
    </>
  );
}
