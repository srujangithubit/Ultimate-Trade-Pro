const DEFAULT_CORS_ALLOWLIST = [
  'https://tradepro.com',
  'http://localhost:3002',
  'http://localhost:3000',
];

export function getCorsOrigins(): string[] {
  const raw =
    process.env.CORS_ORIGIN_ALLOWLIST ?? process.env.FRONTEND_URL ?? '';

  const parsed = raw
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);

  if (parsed.length > 0) {
    return parsed;
  }

  return DEFAULT_CORS_ALLOWLIST;
}
