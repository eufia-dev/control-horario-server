import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { UpdateUserDto } from './dto/update-user.dto.js';
import { type user } from '../../generated/prisma/client.js';
import { Decimal } from '../../generated/prisma/internal/prismaNamespace.js';

export interface UserResponse {
  id: string;
  name: string;
  email: string;
  hourlyCost: number;
  isActive: boolean;
  createdAt: Date;
  isAdmin: boolean;
}

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(organizationId: string): Promise<UserResponse[]> {
    const users = await this.prisma.user.findMany({
      where: {
        organization_id: organizationId,
      },
      orderBy: {
        created_at: 'desc',
      },
    });

    return users.map((user) => this.toUserResponse(user));
  }

  async findOne(id: string, organizationId: string): Promise<UserResponse> {
    const user = await this.prisma.user.findFirst({
      where: {
        id,
        organization_id: organizationId,
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
    organizationId: string,
  ): Promise<UserResponse> {
    // Verify the user belongs to the organization
    const existing = await this.prisma.user.findFirst({
      where: {
        id,
        organization_id: organizationId,
      },
    });

    if (!existing) {
      throw new NotFoundException(`Usuario con ID ${id} no encontrado`);
    }

    // Check if email is being changed and if it's already in use
    if (updateUserDto.email !== existing.email) {
      const emailExists = await this.prisma.user.findFirst({
        where: {
          email: updateUserDto.email,
          organization_id: organizationId,
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
        hourly_cost: new Decimal(updateUserDto.hourlyCost),
        is_active: updateUserDto.isActive,
        is_admin: updateUserDto.isAdmin,
      },
    });

    return this.toUserResponse(user);
  }

  private toUserResponse(user: user): UserResponse {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      hourlyCost: Number(user.hourly_cost),
      isActive: user.is_active,
      createdAt: user.created_at,
      isAdmin: user.is_admin,
    };
  }
}
