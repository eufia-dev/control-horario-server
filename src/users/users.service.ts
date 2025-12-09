import {
  ConflictException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { SupabaseService } from '../supabase/supabase.service.js';
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
  private readonly logger = new Logger(UsersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly supabaseService: SupabaseService,
  ) {}

  async findAll(companyId: string): Promise<UserResponse[]> {
    try {
      const users = await this.prisma.user.findMany({
        where: {
          companyId,
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      return users.map((user) => this.toUserResponse(user));
    } catch (error) {
      this.logger.error(
        `Error al obtener usuarios de la empresa ${companyId}`,
        error instanceof Error ? error.stack : error,
      );
      throw new InternalServerErrorException(
        'Error al obtener la lista de usuarios',
      );
    }
  }

  async findOne(id: string, companyId: string): Promise<UserResponse> {
    try {
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
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      this.logger.error(
        `Error al obtener usuario ${id}`,
        error instanceof Error ? error.stack : error,
      );
      throw new InternalServerErrorException('Error al obtener el usuario');
    }
  }

  async update(
    id: string,
    updateUserDto: UpdateUserDto,
    companyId: string,
  ): Promise<UserResponse> {
    try {
      const existing = await this.prisma.user.findFirst({
        where: {
          id,
          companyId,
        },
      });

      if (!existing) {
        throw new NotFoundException(`Usuario con ID ${id} no encontrado`);
      }

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
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof ConflictException
      ) {
        throw error;
      }
      this.logger.error(
        `Error al actualizar usuario ${id}`,
        error instanceof Error ? error.stack : error,
      );
      throw new InternalServerErrorException('Error al actualizar el usuario');
    }
  }

  async delete(id: string, companyId: string): Promise<void> {
    try {
      const user = await this.prisma.user.findFirst({
        where: {
          id,
          companyId,
        },
      });

      if (!user) {
        throw new NotFoundException(`Usuario con ID ${id} no encontrado`);
      }

      if (user.role === 'OWNER') {
        throw new ForbiddenException(
          'No se puede eliminar al propietario de la empresa',
        );
      }

      await this.supabaseService.deleteUser(user.authId);

      await this.prisma.user.delete({
        where: { id },
      });
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof ForbiddenException ||
        error instanceof InternalServerErrorException
      ) {
        throw error;
      }
      this.logger.error(
        `Error al eliminar usuario ${id}`,
        error instanceof Error ? error.stack : error,
      );
      throw new InternalServerErrorException('Error al eliminar el usuario');
    }
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
