import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import type {
  DesktopModelChatRequest,
  DesktopModelChatResponse
} from '../shared/desktop-api.js';
import { invokeOfficialModelRoute } from '../shared/desktop-sync-client.js';
import { isOfficialPointsModelProfile } from '../shared/desktop-model-credentials.js';
import { getDesktopAppInfo } from './runtime-state.js';
import { loadRuntimeIdentity } from './runtime-store.js';

export async function invokeOfficialModelChat(
  request: DesktopModelChatRequest
): Promise<DesktopModelChatResponse | undefined> {
  if (!isOfficialPointsModelProfile(request.profile)) {
    return undefined;
  }

  const appInfo = getDesktopAppInfo();
  const identity = loadRuntimeIdentity(appInfo.userDataPath);
  if (!identity.deviceToken || !identity.workspaceId || identity.workspaceId === 'workspace_pending_login') {
    throw new Error('请先绑定企业或个人账号后再使用官方通道。');
  }

  const response = await invokeOfficialModelRoute(
    appInfo.serverBaseUrl,
    identity.workspaceId,
    identity.deviceToken,
    request.profile,
    {
      messages: request.messages,
      timeoutMs: request.timeoutMs,
      taskKind: request.taskKind,
      imageGeneration: request.imageGeneration
        ? {
            prompt: request.imageGeneration.prompt,
            negativePrompt: request.imageGeneration.negativePrompt,
            sourceImageDataUrl: request.imageGeneration.sourceImagePath
              ? buildLocalImageDataUrl(request.imageGeneration.sourceImagePath)
              : undefined,
            size: request.imageGeneration.size,
            aspectRatio: request.imageGeneration.aspectRatio,
            responseFormat: request.imageGeneration.responseFormat,
            asyncMode: request.imageGeneration.asyncMode,
            providerJobId: request.imageGeneration.providerJobId
          }
        : undefined,
      videoGeneration: request.videoGeneration
        ? {
            prompt: request.videoGeneration.prompt,
            negativePrompt: request.videoGeneration.negativePrompt,
            sourceImageDataUrl: request.videoGeneration.sourceImagePath
              ? buildLocalImageDataUrl(request.videoGeneration.sourceImagePath)
              : undefined,
            durationSeconds: request.videoGeneration.durationSeconds,
            aspectRatio: request.videoGeneration.aspectRatio,
            responseFormat: request.videoGeneration.responseFormat
          }
        : undefined,
      visionInputs: request.visionInputs?.map((input) => ({
        imageDataUrl: buildLocalImageDataUrl(input.imagePath),
        mimeType: input.mimeType
      }))
    }
  );

  return {
    provider: response.data.provider,
    modelName: response.data.modelName,
    content: response.data.content,
    inputTokens: response.data.inputTokens,
    outputTokens: response.data.outputTokens,
    artifacts: response.data.artifacts
  };
}

function buildLocalImageDataUrl(filePath: string): string {
  if (!existsSync(filePath)) {
    throw new Error('图片文件不存在，请重新选择后再试。');
  }

  const mimeType = guessImageMimeType(filePath);
  return `data:${mimeType};base64,${readFileSync(filePath).toString('base64')}`;
}

function guessImageMimeType(filePath: string): string {
  const extname = path.extname(filePath).toLowerCase();
  if (extname === '.png') return 'image/png';
  if (extname === '.webp') return 'image/webp';
  if (extname === '.gif') return 'image/gif';
  return 'image/jpeg';
}
