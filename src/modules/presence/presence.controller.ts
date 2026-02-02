import { Controller, Get } from '@nestjs/common';
import { PresenceService } from './presence.service';
import { Public } from 'src/common/decorators/guard.decorator';
import { CacheService } from '@cache/cache.service';

@Controller('presence')
export class PresenceController {
  constructor(
    private readonly presenceService: PresenceService,
    private readonly cacheService: CacheService,
  ) {}

  @Get('health')
  @Public()
  async healthCheck() {
    const cacheKey = 'health-status';
    const cached = await this.cacheService.get(cacheKey);
    if (cached) return cached;

    const result = await this.presenceService.check();
    await this.cacheService.set(cacheKey, result, 300);
    return result;
  }
}
