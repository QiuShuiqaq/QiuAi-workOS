import { KnowledgePageClient } from '../../features/knowledge/KnowledgePageClient';
import { loadKnowledgePageData } from '../../features/knowledge/load-knowledge-data';

export default async function KnowledgePage({
  searchParams
}: {
  searchParams?: Promise<{ workspaceId?: string }>;
}) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const { currentAccount, knowledgeBase, isApiFallback } = await loadKnowledgePageData(
    resolvedSearchParams?.workspaceId
  );

  return (
    <KnowledgePageClient
      currentAccount={currentAccount}
      knowledgeBase={knowledgeBase}
      isApiFallback={isApiFallback}
    />
  );
}
