import { Module } from '@nestjs/common';
import { AuthController, MeController } from './auth.controller';
import { AuthService } from './auth.service';
import { AccountLockoutService } from './account-lockout.service';

@Module({
  controllers: [AuthController, MeController],
  providers: [AuthService, AccountLockoutService],
  exports: [AuthService, AccountLockoutService],
})
export class AuthModule {}
