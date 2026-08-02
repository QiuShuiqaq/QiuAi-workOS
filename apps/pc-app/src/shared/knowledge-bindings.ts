import type { KnowledgeBindingSource } from './desktop-contract.js';

export const enterpriseKnowledgeBindingId = 'kb-enterprise-current';
export const localPdfKnowledgeBindingId = 'kb-local-pdf';

const enterpriseKnowledgeAliases = new Set([
  enterpriseKnowledgeBindingId,
  'workspace_library',
  'server_summary',
  'kb-workspace-library',
  'kb-server-summary'
]);

const localPdfKnowledgeAliases = new Set([
  localPdfKnowledgeBindingId,
  'local_file',
  'local_folder',
  'kb-local-file',
  'kb-local-folder'
]);

export function normalizeKnowledgeBindingId(value: string): string {
  if (enterpriseKnowledgeAliases.has(value)) {
    return enterpriseKnowledgeBindingId;
  }

  if (localPdfKnowledgeAliases.has(value)) {
    return localPdfKnowledgeBindingId;
  }

  return value;
}

export function knowledgeBindingSourceFromId(bindingId: string): KnowledgeBindingSource {
  const normalizedId = normalizeKnowledgeBindingId(bindingId);
  return normalizedId === localPdfKnowledgeBindingId ? 'local_file' : 'workspace_library';
}

export function knowledgeBindingIdFromSource(source: KnowledgeBindingSource): string {
  return normalizeKnowledgeBindingId(source);
}

export function isEnterpriseKnowledgeBindingId(bindingId: string): boolean {
  return normalizeKnowledgeBindingId(bindingId) === enterpriseKnowledgeBindingId;
}

export function isLocalPdfKnowledgeBindingId(bindingId: string): boolean {
  return normalizeKnowledgeBindingId(bindingId) === localPdfKnowledgeBindingId;
}
