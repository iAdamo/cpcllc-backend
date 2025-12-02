import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtService } from '@modules/jwt/jwt.service';
import { JwtController } from '@modules/jwt/jwt.controller';
import { JwtStrategy } from '@modules/jwt/jwt.strategy';
import { UsersModule } from '@modules/users.module';
import { WebSocketModule } from '@modules/websocket.module';
import { MongooseModule } from '@nestjs/mongoose';
import { User, UserSchema } from '@schemas/user.schema';

@Module({
  imports: [
    WebSocketModule,
    UsersModule,
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
        signOptions: { expiresIn: '90d' },
      }),
      inject: [ConfigService],
    }),
    MongooseModule.forFeature([{ name: User.name, schema: UserSchema }]),
  ],
  providers: [JwtService, JwtStrategy],
  controllers: [JwtController],
  exports: [JwtService],
})
export class AuthModule {}
