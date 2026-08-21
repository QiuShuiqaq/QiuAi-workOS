export type OfficialRouteKey =
  | 'official-text-1'
  | 'official-reasoning-1'
  | 'official-image-1'
  | 'official-image-2'
  | 'official-image-3'
  | 'official-image-4'
  | 'official-audio-1'
  | 'official-video-1'
  | 'official-video-2'
  | 'official-video-3';

export interface OfficialModelRouteSeed {
  routeKey: OfficialRouteKey;
  displayName: string;
  capability: 'TEXT' | 'REASONING' | 'IMAGE' | 'VIDEO' | 'AUDIO';
  status: 'ACTIVE' | 'DISABLED';
  pointPrice: number;
  providerId: string;
  providerName: string;
  modelName: string;
  apiBaseUrl: string;
  apiKeyEnvName: string;
  providerConfig: Record<string, unknown>;
  sortOrder: number;
}

export const officialModelRouteSeeds: OfficialModelRouteSeed[] = [
  {
    routeKey: 'official-text-1',
    displayName: '官方通道 · 文本线路一',
    capability: 'TEXT',
    status: 'ACTIVE',
    pointPrice: 1,
    providerId: 'deepseek',
    providerName: 'DeepSeek',
    modelName: 'deepseek-v4-flash',
    apiBaseUrl: 'https://api.deepseek.com',
    apiKeyEnvName: 'QIUAI_OFFICIAL_DEEPSEEK_API_KEY',
    providerConfig: {
      mode: 'openai_chat'
    },
    sortOrder: 10
  },
  {
    routeKey: 'official-reasoning-1',
    displayName: '官方通道 · 推理线路一',
    capability: 'REASONING',
    status: 'ACTIVE',
    pointPrice: 3,
    providerId: 'deepseek',
    providerName: 'DeepSeek',
    modelName: 'deepseek-v4-pro',
    apiBaseUrl: 'https://api.deepseek.com',
    apiKeyEnvName: 'QIUAI_OFFICIAL_DEEPSEEK_API_KEY',
    providerConfig: {
      mode: 'openai_chat'
    },
    sortOrder: 20
  },
  {
    routeKey: 'official-image-1',
    displayName: '官方通道 · 图片线路一',
    capability: 'IMAGE',
    status: 'ACTIVE',
    pointPrice: 12,
    providerId: 'grsai',
    providerName: 'GRSAI',
    modelName: 'gpt-image-2',
    apiBaseUrl: 'https://grsai.dakka.com.cn/v1',
    apiKeyEnvName: 'QIUAI_OFFICIAL_GRSAI_API_KEY',
    providerConfig: {
      mode: 'grsai_image',
      imageSize: {
        default: '1K',
        options: ['1K'],
        sendParameter: false
      },
      pricing: {
        imageSizePoints: {
          '1K': 12
        }
      }
    },
    sortOrder: 30
  },
  {
    routeKey: 'official-image-2',
    displayName: '官方通道 · 图片线路二',
    capability: 'IMAGE',
    status: 'ACTIVE',
    pointPrice: 20,
    providerId: 'grsai',
    providerName: 'GRSAI',
    modelName: 'gpt-image-2-vip',
    apiBaseUrl: 'https://grsai.dakka.com.cn/v1',
    apiKeyEnvName: 'QIUAI_OFFICIAL_GRSAI_API_KEY',
    providerConfig: {
      mode: 'grsai_image',
      imageSize: {
        default: '1K',
        options: ['1K', '2K', '4K'],
        sendParameter: true
      },
      pricing: {
        imageSizePoints: {
          '1K': 20,
          '2K': 30,
          '4K': 40
        }
      }
    },
    sortOrder: 40
  },
  {
    routeKey: 'official-image-3',
    displayName: '官方通道 · 图片线路三',
    capability: 'IMAGE',
    status: 'ACTIVE',
    pointPrice: 12,
    providerId: 'grsai',
    providerName: 'GRSAI',
    modelName: 'nano-banana-2',
    apiBaseUrl: 'https://grsai.dakka.com.cn/v1',
    apiKeyEnvName: 'QIUAI_OFFICIAL_GRSAI_API_KEY',
    providerConfig: {
      mode: 'grsai_image',
      imageSize: {
        default: '1K',
        options: ['1K', '2K', '4K'],
        sendParameter: true
      },
      pricing: {
        imageSizePoints: {
          '1K': 12,
          '2K': 18,
          '4K': 24
        }
      }
    },
    sortOrder: 50
  },
  {
    routeKey: 'official-image-4',
    displayName: '官方通道 · 图片线路四',
    capability: 'IMAGE',
    status: 'ACTIVE',
    pointPrice: 10,
    providerId: 'grsai',
    providerName: 'GRSAI',
    modelName: 'nano-banana-fast',
    apiBaseUrl: 'https://grsai.dakka.com.cn/v1',
    apiKeyEnvName: 'QIUAI_OFFICIAL_GRSAI_API_KEY',
    providerConfig: {
      mode: 'grsai_image',
      imageSize: {
        default: '1K',
        options: ['1K'],
        sendParameter: false
      },
      pricing: {
        imageSizePoints: {
          '1K': 10
        }
      }
    },
    sortOrder: 60
  },
  {
    routeKey: 'official-audio-1',
    displayName: '官方通道 · 口播线路一',
    capability: 'AUDIO',
    status: 'ACTIVE',
    pointPrice: 10,
    providerId: 'minimax',
    providerName: 'MiniMax',
    modelName: 'speech-02-turbo',
    apiBaseUrl: 'https://api.minimaxi.com/v1',
    apiKeyEnvName: 'QIUAI_OFFICIAL_MINIMAX_API_KEY',
    providerConfig: {
      mode: 'minimax_tts',
      voicePresets: {
        male_pro_1: 'Chinese (Mandarin)_Reliable_Executive',
        male_pro_2: 'Chinese (Mandarin)_News_Anchor',
        male_pro_3: 'Chinese (Mandarin)_Male_Announcer',
        male_pro_4: 'Chinese (Mandarin)_Sincere_Adult',
        female_pro_1: 'Chinese (Mandarin)_Sweet_Lady',
        female_pro_2: 'Chinese (Mandarin)_Mature_Woman',
        funny_1: 'Chinese (Mandarin)_Humorous_Elder',
        funny_2: 'Chinese (Mandarin)_Cute_Spirit'
      }
    },
    sortOrder: 65
  },
  {
    routeKey: 'official-video-1',
    displayName: '官方通道 · 视频线路一',
    capability: 'VIDEO',
    status: 'ACTIVE',
    pointPrice: 200,
    providerId: 'minimax',
    providerName: 'MiniMax',
    modelName: 'MiniMax-Hailuo-2.3-Fast',
    apiBaseUrl: 'https://api.minimaxi.com/v1',
    apiKeyEnvName: 'QIUAI_OFFICIAL_MINIMAX_API_KEY',
    providerConfig: {
      mode: 'minimax_video',
      pricing: {
        durationPoints: {
          '6': 200,
          '10': 280
        }
      }
    },
    sortOrder: 70
  },
  {
    routeKey: 'official-video-2',
    displayName: '官方通道 · 视频线路二',
    capability: 'VIDEO',
    status: 'ACTIVE',
    pointPrice: 300,
    providerId: 'minimax',
    providerName: 'MiniMax',
    modelName: 'MiniMax-Hailuo-2.3',
    apiBaseUrl: 'https://api.minimaxi.com/v1',
    apiKeyEnvName: 'QIUAI_OFFICIAL_MINIMAX_API_KEY',
    providerConfig: {
      mode: 'minimax_video',
      pricing: {
        durationPoints: {
          '6': 300,
          '10': 500
        }
      }
    },
    sortOrder: 80
  },
  {
    routeKey: 'official-video-3',
    displayName: '官方通道 · 视频线路三',
    capability: 'VIDEO',
    status: 'DISABLED',
    pointPrice: 0,
    providerId: 'minimax',
    providerName: 'MiniMax',
    modelName: 'MiniMax H3',
    apiBaseUrl: 'https://api.minimaxi.com/v1',
    apiKeyEnvName: 'QIUAI_OFFICIAL_MINIMAX_API_KEY',
    providerConfig: {
      mode: 'minimax_h3_video',
      disabledReason: 'MiniMax H3 uses a dedicated v2 API and is staged for a later adapter.'
    },
    sortOrder: 90
  }
];
