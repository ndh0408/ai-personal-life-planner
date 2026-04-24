import { Controller, Get, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { CurrentUser, type AuthUser } from '../../common/decorators/current-user.decorator';
import { UsersService } from './users.service';

@Controller()
@UseGuards(AuthGuard('jwt-access'))
export class UsersController {
  constructor(private readonly users: UsersService) {}

  /**
   * Both paths return the same payload — `/me` is the canonical short form used
   * by the mobile app; `/users/me` is kept as an alias for older integrations.
   */
  @Get('me')
  me(@CurrentUser() user: AuthUser) {
    return this.users.findById(user.id);
  }

  @Get('users/me')
  usersMe(@CurrentUser() user: AuthUser) {
    return this.users.findById(user.id);
  }
}
