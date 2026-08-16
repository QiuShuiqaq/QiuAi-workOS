import type {
  ListSoftwareCopilotsResponse,
  SoftwareCopilotProductSummary
} from '@qiuai/api-contract/software-copilot';

import { fetchSoftwareCopilots } from '../shared/desktop-sync-client.js';
import { getDesktopAppInfo } from './runtime-state.js';
import { loadRuntimeIdentity } from './runtime-store.js';

const fallbackProducts: SoftwareCopilotProductSummary[] = [
  product('photoshop-copilot', 'Photoshop 副驾', 'Photoshop', '设计修图', '图片处理、商品图优化、图层整理和设计文案辅助。', ['图片理解', '修图建议', '图层脚本'], 100),
  product('coreldraw-copilot', 'CorelDRAW 副驾', 'CorelDRAW', '矢量排版', '标牌、包装、文字排版和简单矢量绘制。', ['矢量绘制', '文字排版', '版面调整'], 110),
  product('excel-copilot', 'Excel 副驾', 'Excel', '办公数据', '表格清洗、公式生成、数据对比和报表整理。', ['公式生成', '数据清洗', '表格分析'], 120),
  product('ppt-copilot', 'PPT 副驾', 'PowerPoint', '演示汇报', '演示结构、页面文案、图表说明和版式调整。', ['大纲生成', '页面文案', '版式建议'], 130),
  product('cad-copilot', 'CAD 副驾', 'CAD', '工程绘图', '基础绘图、尺寸标注、图层规范和工程说明。', ['绘图指令', '尺寸标注', '图层规范'], 140),
  product('jianying-copilot', '剪映副驾', '剪映', '视频剪辑', '短视频脚本、剪辑节奏、字幕整理和成片检查。', ['脚本拆解', '字幕整理', '剪辑建议'], 150)
];

export async function listDesktopSoftwareCopilots(): Promise<ListSoftwareCopilotsResponse> {
  const appInfo = getDesktopAppInfo();
  const identity = loadRuntimeIdentity(appInfo.userDataPath);
  if (!identity.deviceToken || !identity.workspaceId || identity.workspaceId === 'workspace_pending_login') {
    return createFallbackResponse('workspace_pending_login');
  }

  return fetchSoftwareCopilots(appInfo.serverBaseUrl, identity.workspaceId, identity.deviceToken);
}

function createFallbackResponse(workspaceId: string): ListSoftwareCopilotsResponse {
  return {
    workspaceId,
    workspaceType: 'personal',
    data: fallbackProducts.map((fallbackProduct) => ({
      product: fallbackProduct,
      licenses: [],
      activeBindings: [],
      entitlement: {
        canPurchase: false,
        canUse: false,
        reason: '请先登录或绑定账号后再购买软件副驾。',
        seatLimit: 0,
        assignedSeatCount: 0,
        availableSeatCount: 0
      }
    }))
  };
}

function product(
  code: string,
  name: string,
  softwareName: string,
  category: string,
  description: string,
  capabilities: string[],
  sortOrder: number
): SoftwareCopilotProductSummary {
  return {
    code,
    name,
    softwareName,
    category,
    description,
    status: 'COMING_SOON',
    platforms: ['windows'],
    capabilities,
    personalMonthlyPriceCents: 990,
    personalAnnualPriceCents: 9900,
    enterpriseMonthlyUnitPriceCents: 990,
    enterpriseAnnualUnitPriceCents: 9900,
    currency: 'CNY',
    sortOrder
  };
}
