import { redirect } from 'next/navigation';

import { createServerApiClient } from '../../../../shared/api/server-api';

export const dynamic = 'force-dynamic';

export default async function AlipayReturnPage({
  searchParams
}: {
  searchParams: Promise<{ out_trade_no?: string }>;
}) {
  const params = await searchParams;
  const orderNo = params.out_trade_no?.trim();
  let redirectHref = '/settings?payment=alipay_return';

  if (orderNo) {
    try {
      const response = await (await createServerApiClient()).syncAlipayOrder(orderNo);
      const workspaceId = response.data.order?.workspaceId;
      if (workspaceId) {
        redirectHref = `/settings?workspaceId=${encodeURIComponent(workspaceId)}&payment=alipay_return`;
      }
    } catch {
      redirectHref = `/settings?payment=alipay_return&orderNo=${encodeURIComponent(orderNo)}`;
    }
  }

  redirect(redirectHref);
}
