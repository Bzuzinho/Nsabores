import { Controller, Get } from '@nestjs/common';
import { createHealthResponse } from '@nsabores/validation';

@Controller('health')
export class HealthController {
  @Get()
  health() {
    return {
      ...createHealthResponse('api'),
      commit:
        process.env.RAILWAY_GIT_COMMIT_SHA ??
        process.env.GITHUB_SHA ??
        'unknown',
    };
  }
}
