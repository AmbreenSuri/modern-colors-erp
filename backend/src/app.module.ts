import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { validateEnv } from './config/env.validation';
import { AuditModule } from './modules/audit/audit.module';
import { UsersModule } from './modules/users/users.module';
import { AuthModule } from './modules/auth/auth.module';
import { CatalogueModule } from './modules/catalogue/catalogue.module';
import { SettingsModule } from './modules/settings/settings.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    PrismaModule,
    AuditModule,
    UsersModule,
    AuthModule,
    CatalogueModule,
    SettingsModule,
    // Added as they are built:
    // PurchaseOrderModule, AiExtractionModule,
    // MaterialModule, QrModule, ReceivingModule, DashboardModule
  ],
})
export class AppModule {}
