/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
import { Injectable, InternalServerErrorException } from '@nestjs/common';
import type { UserRole } from '@prisma/client';
import * as nodemailer from 'nodemailer';
import type { Transporter, SentMessageInfo } from 'nodemailer';

interface InviteEmailPayload {
  to: string;
  companyName: string;
  token: string;
  role: UserRole;
  expiresAt: Date;
}

interface ReminderEmailPayload {
  to: string;
  userName: string;
  type: 'start' | 'end';
  scheduledTime: string;
}

@Injectable()
export class EmailService {
  private transporter?: Transporter<SentMessageInfo>;

  private getTransporter(): Transporter<SentMessageInfo> {
    if (this.transporter) {
      return this.transporter;
    }

    const host = process.env.SMTP_HOST;
    const port = process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : null;
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;

    if (!host || !port || !user || !pass) {
      throw new InternalServerErrorException(
        'Configuración SMTP incompleta. Define SMTP_HOST, SMTP_PORT, SMTP_USER y SMTP_PASS.',
      );
    }

    const transporter = nodemailer.createTransport<SentMessageInfo>({
      host,
      port,
      secure: true,
      auth: { user, pass },
    }) as Transporter<SentMessageInfo>;

    this.transporter = transporter;

    return this.transporter;
  }

  async sendInviteEmail(payload: InviteEmailPayload): Promise<void> {
    const from = process.env.SMTP_USER ?? '';
    const transporter = this.getTransporter();

    const frontendUrl = process.env.FRONTEND_ORIGIN?.replace(/\/$/, '');
    if (!frontendUrl) {
      throw new InternalServerErrorException(
        'No está configurada la URL base para las invitaciones. Contacta con el administrador.',
      );
    }

    const inviteLink = `${frontendUrl}/invite/${payload.token}`;

    const subject = `Invitación a Control Horario - ${payload.companyName}`;
    const formattedExpiry = payload.expiresAt.toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    const text = [
      'Has recibido una invitación para acceder a la aplicación Control Horario de Eufia.',
      `Empresa: ${payload.companyName}.`,
      `Acepta la invitación aquí: ${inviteLink}`,
      'Cuando crees tu cuenta, usa este mismo correo electrónico para completar el registro.',
      `Invitación válida hasta el ${formattedExpiry}.`,
      '',
      'Saludos cordiales,',
      'Equipo Eufia',
    ].join('\n'); // use plain text for clients without HTML

    const html = `
      <p>Hola,</p>
      <p>Has recibido una invitación para acceder a la aplicación <strong>Control Horario</strong> de Eufia.</p>
      <p>Empresa: <strong>${payload.companyName}</strong></p>
      <p><a href="${inviteLink}">Haz clic aquí para aceptar la invitación</a>.</p>
      <p>Cuando crees tu cuenta, usa este mismo correo electrónico para completar el registro.</p>
      <p>Invitación válida hasta el <strong>${formattedExpiry}</strong>.</p>
      <p>Saludos cordiales,<br/>Equipo Eufia</p>
    `;

    try {
      await transporter.sendMail({
        from,
        to: payload.to,
        subject,
        text,
        html,
      });
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : JSON.stringify(error);
      throw new InternalServerErrorException(
        `No se pudo enviar el correo de invitación. Detalle: ${message}`,
      );
    }
  }

  async sendReminderEmail(payload: ReminderEmailPayload): Promise<void> {
    const from = process.env.SMTP_USER ?? '';
    const transporter = this.getTransporter();

    const frontendUrl = process.env.FRONTEND_ORIGIN?.replace(/\/$/, '') || '';

    const subject =
      payload.type === 'start'
        ? 'Recordatorio: Inicio de jornada'
        : 'Recordatorio: Fin de jornada';

    const message =
      payload.type === 'start'
        ? `Según tu horario deberías haber empezado a trabajar a las ${payload.scheduledTime}. No olvides registrar tu entrada.`
        : `Tu jornada terminaba a las ${payload.scheduledTime} y aún tienes un temporizador activo. No olvides registrar tu salida.`;

    const text = [
      `Hola ${payload.userName},`,
      message,
      frontendUrl
        ? `Accede a la plataforma para gestionar tu tiempo: ${frontendUrl}`
        : 'Accede a la plataforma para gestionar tu tiempo.',
      '',
      'Saludos cordiales,',
      'Equipo Eufia',
    ].join('\n');

    const html = `
      <p>Hola <strong>${payload.userName}</strong>,</p>
      <p>${message}</p>
      <p>${
        frontendUrl
          ? `<a href="${frontendUrl}">Accede a la plataforma para gestionar tu tiempo</a>.`
          : 'Accede a la plataforma para gestionar tu tiempo.'
      }</p>
      <p>Saludos cordiales,<br/>Equipo Eufia</p>
    `;

    try {
      await transporter.sendMail({
        from,
        to: payload.to,
        subject,
        text,
        html,
      });
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : JSON.stringify(error);
      throw new InternalServerErrorException(
        `No se pudo enviar el correo de recordatorio. Detalle: ${message}`,
      );
    }
  }

  async sendEmail(
    subject: string,
    text: string,
    html: string,
    to?: string,
  ): Promise<void> {
    const from = process.env.SMTP_USER ?? '';
    const toAddress = to ?? process.env.SMTP_USER ?? '';
    const transporter = this.getTransporter();

    try {
      await transporter.sendMail({
        from,
        to: toAddress,
        subject,
        text,
        html,
      });
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : JSON.stringify(error);
      throw new InternalServerErrorException(
        `No se pudo enviar el correo. Detalle: ${message}`,
      );
    }
  }
}
