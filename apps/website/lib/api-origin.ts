export function serverApiOrigin() {
  const configured = [
    process.env.API_ORIGIN,
    process.env.API_URL,
    process.env.NEXT_PUBLIC_API_URL,
  ].find((value) => value?.trim());
  return (configured?.trim() || 'http://localhost:4000').replace(/\/$/, '');
}
