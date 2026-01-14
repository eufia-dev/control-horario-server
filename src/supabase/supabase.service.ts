import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class SupabaseService {
  private readonly logger = new Logger(SupabaseService.name);
  private adminClient: SupabaseClient<any, 'public', any, any, any>;

  constructor() {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY;

    if (!supabaseUrl || !supabaseSecretKey) {
      this.logger.error(
        'Faltan las variables de entorno SUPABASE_URL o SUPABASE_SECRET_KEY.',
      );
      throw new InternalServerErrorException(
        'Falta la configuración de Supabase en el servidor. Contacta con soporte.',
      );
    }

    this.adminClient = createClient<any, 'public', any>(
      supabaseUrl,
      supabaseSecretKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      },
    );
  }

  getAdminClient(): SupabaseClient<any, 'public', any, any, any> {
    return this.adminClient;
  }

  async updateUser(
    authId: string,
    params: {
      email?: string;
      password?: string;
      user_metadata?: Record<string, unknown>;
    },
  ): Promise<void> {
    const { error } = await this.adminClient.auth.admin.updateUserById(
      authId,
      params,
    );

    if (error) {
      this.logger.error(
        `Error al actualizar usuario de Supabase: ${error.message}`,
      );
      throw new InternalServerErrorException(
        'Error al actualizar el usuario de autenticación',
      );
    }
  }

  async deleteUser(authId: string): Promise<void> {
    const { error } = await this.adminClient.auth.admin.deleteUser(authId);

    if (error) {
      this.logger.error(
        `Error al eliminar usuario de Supabase: ${error.message}`,
      );
      throw new InternalServerErrorException(
        'Error al eliminar el usuario de autenticación',
      );
    }
  }

  async createUser(params: {
    email: string;
    password?: string;
    emailConfirm?: boolean;
    user_metadata?: Record<string, unknown>;
  }): Promise<{ id: string; email: string }> {
    const { data, error } = await this.adminClient.auth.admin.createUser({
      email: params.email,
      password: params.password,
      email_confirm: params.emailConfirm ?? true,
      user_metadata: params.user_metadata,
    });

    if (error || !data.user) {
      this.logger.error(
        `Error al crear usuario de Supabase: ${error?.message}`,
      );
      throw new InternalServerErrorException(
        'Error al crear el usuario de autenticación',
      );
    }

    return {
      id: data.user.id,
      email: data.user.email ?? params.email,
    };
  }

  async getUserMetadata(
    authId: string,
  ): Promise<Record<string, unknown> | null> {
    const { data, error } =
      await this.adminClient.auth.admin.getUserById(authId);

    if (error) {
      this.logger.error(
        `Error al obtener usuario de Supabase: ${error.message}`,
      );
      return null;
    }

    return data.user?.user_metadata ?? null;
  }
}
