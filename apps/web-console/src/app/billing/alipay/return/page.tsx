import { redirect } from 'next/navigation';

import { createServerApiClient } from '../../../../shared/api/server-api';

export const dynamic = 'force-dynamic';

type AlipayReturnSearchParams = Record<string, string | string[] | undefined>;

function firstSearchParam(value: string | string[] | undefined) {
  const firstValue = Array.isArray(value) ? value[0] : value;
  return typeof firstValue === 'string' ? firstValue.trim() : '';
}

export default async function AlipayReturnPage({
  searchParams
}: {
  searchParams: Promise<AlipayReturnSearchParams>;
}) {
  const params = await searchParams;
  const orderNo = firstSearchParam(params.out_trade_no);
  let redirectHref = '/purchase?payment=alipay_return';

  if (orderNo) {
    try {
      const response = await (await createServerApiClient()).syncAlipayOrder(orderNo);
      const workspaceId =
        response.data.workspaceId ??
        response.data.order?.workspaceId ??
        response.data.softwareCopilotOrder?.workspaceId;
      if (workspaceId) {
        redirectHref = `/purchase?workspaceId=${encodeURIComponent(workspaceId)}&payment=alipay_return`;
      }
    } catch {
      redirectHref = `/purchase?payment=alipay_return&orderNo=${encodeURIComponent(orderNo)}`;
    }
  }

  redirect(redirectHref);
}
