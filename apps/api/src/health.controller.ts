import { Controller, Get } from '@nestjs/common';
import { createHealthResponse } from '@nsabores/validation';

@Controller('health')
export class HealthController {
  @Get()
  health() {
    return createHealthResponse('api');
  }
}
