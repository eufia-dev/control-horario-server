import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { UpdateUserDto } from './dto/update-user.dto.js';
import type { User, UserRole } from '@prisma/client';

export interface UserResponse {
  id: string;
  authId: string;
  name: string;
  email: string;
  phone: string | null;
  avatarUrl: string | null;
  hourlyCost: number;
  isActive: boolean;
  role: UserRole;
  relationType: string;
  nif: string | null;
  naf: string | null;
  createdAt: Date;
  updatedAt: Date | null;
}

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(companyId: string): Promise<UserResponse[]> {
    const users = await this.prisma.user.findMany({
      where: {
        companyId,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return users.map((user) => this.toUserResponse(user));
  }

  async findOne(id: string, companyId: string): Promise<UserResponse> {
    const user = await this.prisma.user.findFirst({
      where: {
        id,
        companyId,
      },
    });

    if (!user) {
      throw new NotFoundException(`Usuario con ID ${id} no encontrado`);
    }

    return this.toUserResponse(user);
  }

  async update(
    id: string,
    updateUserDto: UpdateUserDto,
    companyId: string,
  ): Promise<UserResponse> {
    // Verify the user belongs to the company
    const existing = await this.prisma.user.findFirst({
      where: {
        id,
        companyId,
      },
    });

    if (!existing) {
      throw new NotFoundException(`Usuario con ID ${id} no encontrado`);
    }

    // Check if email is being changed and if it's already in use
    if (updateUserDto.email && updateUserDto.email !== existing.email) {
      const emailExists = await this.prisma.user.findFirst({
        where: {
          email: updateUserDto.email,
          companyId,
          id: { not: id },
        },
      });

      if (emailExists) {
        throw new ConflictException(
          `El email ${updateUserDto.email} ya está en uso`,
        );
      }
    }

    const user = await this.prisma.user.update({
      where: { id },
      data: {
        name: updateUserDto.name,
        email: updateUserDto.email,
        phone: updateUserDto.phone,
        hourlyCost: updateUserDto.hourlyCost
          ? updateUserDto.hourlyCost
          : undefined,
        isActive: updateUserDto.isActive,
        role: updateUserDto.role,
      },
    });

    return this.toUserResponse(user);
  }

  private toUserResponse(user: User): UserResponse {
    return {
      id: user.id,
      authId: user.authId,
      name: user.name,
      email: user.email,
      phone: user.phone,
      avatarUrl: user.avatarUrl,
      hourlyCost: Number(user.hourlyCost),
      isActive: user.isActive,
      role: user.role,
      relationType: user.relationType,
      nif: user.nif,
      naf: user.naf,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }
}
