import { InvitationAcceptPageClient } from '../../../features/invitations/InvitationAcceptPageClient';
import { loadInvitationPageData } from '../../../features/invitations/load-invitation-data';

export default async function InvitationPage({
  params
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const { invitation, isApiFallback } = await loadInvitationPageData(token);

  return <InvitationAcceptPageClient token={token} invitation={invitation} isApiFallback={isApiFallback} />;
}
