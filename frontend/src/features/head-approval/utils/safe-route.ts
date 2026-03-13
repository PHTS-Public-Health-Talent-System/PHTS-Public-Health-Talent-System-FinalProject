const FALLBACK_BASE_PATH = '/';

const REQUEST_ID_PATTERN = /^\d+$/;

export const sanitizeHeadScopeBasePath = (basePath: string): string => {
  const candidate = String(basePath ?? '').trim();
  if (!candidate.startsWith('/')) return FALLBACK_BASE_PATH;
  const normalized = candidate.replace(/\/+$/, '');
  return normalized || FALLBACK_BASE_PATH;
};

const toSafeRequestId = (requestId: string | number): string | null => {
  const normalized = String(requestId ?? '').trim();
  if (!REQUEST_ID_PATTERN.test(normalized)) return null;
  return normalized;
};

type QueryMap = Record<string, string>;

export const buildHeadScopeRequestHref = (
  basePath: string,
  requestId: string | number,
  pathSuffix: '/requests' | '/my-requests',
  query?: QueryMap,
): string => {
  const safeBase = sanitizeHeadScopeBasePath(basePath);
  const safeRequestId = toSafeRequestId(requestId);
  if (!safeRequestId) return safeBase;

  const hrefPath = `${safeBase}${pathSuffix}/${safeRequestId}`;
  if (!query || Object.keys(query).length === 0) return hrefPath;

  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    params.set(key, value);
  });
  return `${hrefPath}?${params.toString()}`;
};
