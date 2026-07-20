import type { PublicInvitationDetail } from '@qiuai/api-contract';
import { QiuApiError } from '@qiuai/api-client';

import { createServerApiClient } from '../../shared/api/server-api';
import { rethrowIfFrontendFallbackDisabled } from '../common/api-fallback';
import { buildFallbackPublicInvitation } from './fallback-data';

export interface InvitationPageData {
  invitation: PublicInvitationDetail;
  isApiFallback: boolean;
}

export async function loadInvitationPageData(token: string): Promise<InvitationPageData> {
  try {
    const response = await (await createServerApiClient()).getPublicInvitation(token);
    return {
      invitation: response.data,
      isApiFallback: false
    };
  } catch (error) {
    if (error instanceof QiuApiError && error.status === 404) {
      throw error;
    }

    rethrowIfFrontendFallbackDisabled(error);
    return {
      invitation: buildFallbackPublicInvitation(token),
      isApiFallback: true
    };
  }
}
