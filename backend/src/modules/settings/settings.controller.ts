import { Body, Controller, Delete, Get, Put, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, AuthUser } from '../../common/decorators/current-user.decorator';
import { SettingsService } from './settings.service';
import { SetApiKeyDto } from './dto/set-api-key.dto';

// Settings (Claude API key) is Admin-only (PRD §6.2, §8.4). The full key is
// never returned — only configured/masked status (invariant I2).
@Controller('settings')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class SettingsController {
  constructor(private readonly settings: SettingsService) {}

  @Get('api-key')
  getStatus() {
    return this.settings.getStatus();
  }

  @Put('api-key')
  setApiKey(@Body() dto: SetApiKeyDto, @CurrentUser() actor: AuthUser) {
    return this.settings.setApiKey(dto.apiKey, actor.id);
  }

  @Delete('api-key')
  removeApiKey(@CurrentUser() actor: AuthUser) {
    return this.settings.removeApiKey(actor.id);
  }
}
