import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { APP_CONFIG, JwtStrategy } from '@pme/common';
import { loadConfiguration } from '../config/configuration';

@Module({
  imports: [PassportModule.register({ defaultStrategy: 'jwt' })],
  providers: [{ provide: APP_CONFIG, useFactory: () => loadConfiguration() }, JwtStrategy],
  exports: [APP_CONFIG],
})
export class AuthModule {}
