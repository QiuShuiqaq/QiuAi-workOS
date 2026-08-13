import type { FactoryArtifactPreviewItem } from '../shared/desktop-contract';

export function isFactoryPreviewRemoteUrl(value: string | undefined): boolean {
  const normalized = value?.trim() ?? '';
  return /^https?:\/\//i.test(normalized) || /^data:/i.test(normalized);
}

export function getFactoryPreviewRemoteSrc(
  item: Pick<FactoryArtifactPreviewItem, 'thumbnailPath' | 'remoteUrl'>
): string | undefined {
  return [item.thumbnailPath, item.remoteUrl].find(isFactoryPreviewRemoteUrl);
}

export function hasFactoryPreviewSource(
  item: Pick<FactoryArtifactPreviewItem, 'localPath' | 'thumbnailPath' | 'remoteUrl'>
): boolean {
  return Boolean(item.localPath?.trim() || getFactoryPreviewRemoteSrc(item));
}
