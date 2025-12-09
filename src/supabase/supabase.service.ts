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
}
