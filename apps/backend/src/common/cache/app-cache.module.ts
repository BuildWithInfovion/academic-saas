import { Global, Module } from '@nestjs/common';
import { AppCacheService } from './app-cache.service';

/**
 * @Global — AppCacheService is injectable everywhere without importing this module explicitly.
 */
@Global()
@Module({
  providers: [AppCacheService],
  exports: [AppCacheService],
})
export class AppCacheModule {}
