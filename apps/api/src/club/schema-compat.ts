export function isClubSchemaUnavailable(error: unknown) {
  const record = error as {
    code?: unknown;
    message?: unknown;
    meta?: unknown;
    cause?: unknown;
  } | null;
  const fragments = [record?.code, record?.message, record?.meta, record?.cause]
    .map((value) => {
      if (typeof value === 'string') return value;
      if (value instanceof Error) return value.message;
      try {
        return value === undefined ? '' : JSON.stringify(value);
      } catch {
        return '';
      }
    })
    .join(' ');

  if (!/42P01|P2010/i.test(fragments)) return false;
  return /ClubPlan|ClubSubscription|ClubSubscriptionEvent|ClubSubscriptionCharge/i.test(
    fragments,
  );
}
