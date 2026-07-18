export function withWorkspaceId(href: string, workspaceId: string) {
  const [pathname, queryString = ''] = href.split('?');
  const params = new URLSearchParams(queryString);
  params.set('workspaceId', workspaceId);

  const query = params.toString();
  return query ? `${pathname}?${query}` : pathname;
}
