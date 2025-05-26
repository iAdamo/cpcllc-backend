import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtService } from '@modules/jwt/jwt.service';
import { JwtController } from '@modules/jwt/jwt.controller';
import { JwtStrategy } from '@modules/jwt/jwt.strategy';
import { UsersModule } from '@modules/users.module';
import { ServicesModule } from '@modules/services.module';

@Module({
  imports: [
    UsersModule,
    PassportModule,
    ServicesModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
        signOptions: { expiresIn: '90d' },
      }),
      inject: [ConfigService],
    }),
  ],
  providers: [JwtService, JwtStrategy],
  controllers: [JwtController],
  exports: [JwtService],
})
export class AuthModule {}
