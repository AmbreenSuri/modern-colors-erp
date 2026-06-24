import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, Role, User } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

const BCRYPT_ROUNDS = 10;

// Shape returned to clients — never includes passwordHash.
export type SafeUser = Omit<User, 'passwordHash'>;

const safeSelect = {
  id: true,
  email: true,
  name: true,
  role: true,
  active: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.UserSelect;

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async create(dto: CreateUserDto, actorId?: string): Promise<SafeUser> {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existing) {
      throw new ConflictException('A user with this email already exists');
    }

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        name: dto.name,
        role: dto.role,
        active: dto.active ?? true,
        passwordHash,
      },
      select: safeSelect,
    });

    await this.audit.log({
      entityType: 'User',
      entityId: user.id,
      action: 'USER_CREATED',
      actorId,
      after: { email: user.email, role: user.role },
    });

    return user;
  }

  findAll(): Promise<SafeUser[]> {
    return this.prisma.user.findMany({
      select: safeSelect,
      orderBy: { createdAt: 'asc' },
    });
  }

  async findById(id: string): Promise<SafeUser> {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: safeSelect,
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  /** Internal: includes passwordHash, for auth only. */
  findByEmailWithHash(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { email } });
  }

  async update(
    id: string,
    dto: UpdateUserDto,
    actorId?: string,
  ): Promise<SafeUser> {
    await this.findById(id); // 404 if missing

    const data: Prisma.UserUpdateInput = {
      email: dto.email,
      name: dto.name,
      role: dto.role,
      active: dto.active,
    };
    if (dto.password) {
      data.passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
    }

    const user = await this.prisma.user.update({
      where: { id },
      data,
      select: safeSelect,
    });

    await this.audit.log({
      entityType: 'User',
      entityId: id,
      action: 'USER_UPDATED',
      actorId,
      after: { email: user.email, role: user.role, active: user.active },
    });

    return user;
  }

  async deactivate(id: string, actorId?: string): Promise<SafeUser> {
    await this.findById(id);
    const user = await this.prisma.user.update({
      where: { id },
      data: { active: false },
      select: safeSelect,
    });
    await this.audit.log({
      entityType: 'User',
      entityId: id,
      action: 'USER_DEACTIVATED',
      actorId,
    });
    return user;
  }

  /** Used by seed: create the initial admin only if no users exist yet. */
  async ensureSeedAdmin(input: {
    email: string;
    name: string;
    password: string;
  }): Promise<{ created: boolean; user: SafeUser }> {
    const count = await this.prisma.user.count();
    if (count > 0) {
      const existing = await this.prisma.user.findUnique({
        where: { email: input.email },
        select: safeSelect,
      });
      return { created: false, user: existing ?? (await this.findAll())[0] };
    }
    const user = await this.create(
      { ...input, role: Role.ADMIN, active: true },
      undefined,
    );
    return { created: true, user };
  }
}
