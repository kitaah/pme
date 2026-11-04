import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { loadConfiguration } from '../config/configuration';
import { APP_CONFIG, JwtStrategy } from './jwt.strategy';

@Module({
  imports: [PassportModule.register({ defaultStrategy: 'jwt' })],
  providers: [{ provide: APP_CONFIG, useFactory: () => loadConfiguration() }, JwtStrategy],
  exports: [APP_CONFIG],
})
export class AuthModule {}
