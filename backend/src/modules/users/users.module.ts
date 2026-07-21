import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UserAdminService } from './user-admin.service';
import { UserAdminController } from './user-admin.controller';
import { UsersController } from './users.controller';

@Module({
  controllers: [UsersController, UserAdminController],
  providers: [UsersService, UserAdminService],
  exports: [UsersService],
})
export class UsersModule {}
