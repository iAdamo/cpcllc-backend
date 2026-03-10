import { Controller, Get } from '@nestjs/common';
import { Public } from 'src/common/decorators/guard.decorator';
import { CacheService } from '@cache/cache.service';
import { AppConfigService } from './app-config.service';

@Controller('app')
export class AppConfigController {
  constructor(
    private readonly cacheService: CacheService,
    private readonly appConfigService: AppConfigService,
  ) {}

  @Get('config')
  async getConfig() {
    return this.appConfigService.getConfig();
  }

  @Get('health')
  @Public()
  async healthCheck() {
    const cacheKey = 'health';
    const cached = await this.cacheService.get(cacheKey);
    if (cached) return cached;

    const result = await this.appConfigService.check();
    await this.cacheService.set(cacheKey, result, 300);
    return result;
  }
}
