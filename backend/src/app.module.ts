import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { AuditModule } from './modules/audit/audit.module';
import { UsersModule } from './modules/users/users.module';
import { AuthModule } from './modules/auth/auth.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuditModule,
    UsersModule,
    AuthModule,
    // Added as they are built:
    // CatalogueModule, SettingsModule, PurchaseOrderModule, AiExtractionModule,
    // MaterialModule, QrModule, ReceivingModule, DashboardModule
  ],
})
export class AppModule {}
