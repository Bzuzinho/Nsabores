import { createHealthResponse } from '@nsabores/validation';

export function GET() {
  return Response.json(createHealthResponse('website'));
}
