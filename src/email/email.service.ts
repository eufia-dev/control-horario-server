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

interface CheckInReminderEmailPayload {
  to: string;
  userName: string;
  type: 'start' | 'end';
  scheduledTime: string;
}

interface RunningTimerReminderPayload {
  to: string;
  userName: string;
  timerDurationHours: number;
}

interface AbsenceRequestNotificationPayload {
  to: string;
  adminName: string;
  userName: string;
  companyName: string;
  absenceType: string;
  startDate: string;
  endDate: string;
  workdaysCount: number;
  notes: string | null;
  absenceId: string;
}

interface AbsenceReviewNotificationPayload {
  to: string;
  userName: string;
  companyName: string;
  absenceType: string;
  startDate: string;
  endDate: string;
  status: 'APPROVED' | 'REJECTED';
  reviewerName: string;
  notes: string | null;
}

interface JoinRequestNotificationPayload {
  to: string;
  adminName: string;
  requesterName: string;
  requesterEmail: string;
  companyName: string;
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

  async sendCheckInReminderEmail(
    payload: CheckInReminderEmailPayload,
  ): Promise<void> {
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

  async sendLongRunningTimerReminder(
    payload: RunningTimerReminderPayload,
  ): Promise<void> {
    const from = process.env.SMTP_USER ?? '';
    const transporter = this.getTransporter();

    const frontendUrl = process.env.FRONTEND_ORIGIN?.replace(/\/$/, '') || '';

    const subject = 'Recordatorio: Temporizador activo prolongado';

    const hours = Math.floor(payload.timerDurationHours);
    const minutes = Math.floor((payload.timerDurationHours % 1) * 60);
    const durationText =
      hours > 0
        ? `${hours} ${hours === 1 ? 'hora' : 'horas'}${minutes > 0 ? ` y ${minutes} minutos` : ''}`
        : `${minutes} minutos`;

    const message = `Tienes un temporizador activo que lleva corriendo ${durationText}. Por favor, verifica que hayas registrado correctamente tu tiempo de trabajo.`;

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

  async sendAbsenceRequestNotification(
    payload: AbsenceRequestNotificationPayload,
  ): Promise<void> {
    const from = process.env.SMTP_USER ?? '';
    const transporter = this.getTransporter();

    const frontendUrl = process.env.FRONTEND_ORIGIN?.replace(/\/$/, '') || '';

    const subject = `Nueva solicitud de ausencia - ${payload.companyName}`;

    const text = [
      `Hola ${payload.adminName},`,
      '',
      `${payload.userName} ha solicitado una ausencia:`,
      `Tipo: ${payload.absenceType}`,
      `Fecha de inicio: ${payload.startDate}`,
      `Fecha de fin: ${payload.endDate}`,
      `Días laborables: ${payload.workdaysCount}`,
      ...(payload.notes ? [`Notas: ${payload.notes}`] : []),
      '',
      frontendUrl
        ? `Accede a la plataforma para revisar la solicitud: ${frontendUrl}`
        : 'Accede a la plataforma para revisar la solicitud.',
      '',
      'Saludos cordiales,',
      'Equipo Eufia',
    ].join('\n');

    const html = `
      <p>Hola <strong>${payload.adminName}</strong>,</p>
      <p><strong>${payload.userName}</strong> ha solicitado una ausencia:</p>
      <ul>
        <li><strong>Tipo:</strong> ${payload.absenceType}</li>
        <li><strong>Fecha de inicio:</strong> ${payload.startDate}</li>
        <li><strong>Fecha de fin:</strong> ${payload.endDate}</li>
        <li><strong>Días laborables:</strong> ${payload.workdaysCount}</li>
        ${payload.notes ? `<li><strong>Notas:</strong> ${payload.notes}</li>` : ''}
      </ul>
      <p>${
        frontendUrl
          ? `<a href="${frontendUrl}">Accede a la plataforma para revisar la solicitud</a>.`
          : 'Accede a la plataforma para revisar la solicitud.'
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
        `No se pudo enviar el correo de notificación de ausencia. Detalle: ${message}`,
      );
    }
  }

  async sendAbsenceReviewNotification(
    payload: AbsenceReviewNotificationPayload,
  ): Promise<void> {
    const from = process.env.SMTP_USER ?? '';
    const transporter = this.getTransporter();

    const frontendUrl = process.env.FRONTEND_ORIGIN?.replace(/\/$/, '') || '';

    const statusText = payload.status === 'APPROVED' ? 'aprobada' : 'rechazada';
    const subject = `Solicitud de ausencia ${statusText} - ${payload.companyName}`;

    const text = [
      `Hola ${payload.userName},`,
      '',
      `Tu solicitud de ausencia ha sido ${statusText}:`,
      `Tipo: ${payload.absenceType}`,
      `Fecha de inicio: ${payload.startDate}`,
      `Fecha de fin: ${payload.endDate}`,
      `Revisada por: ${payload.reviewerName}`,
      ...(payload.notes ? [`Notas: ${payload.notes}`] : []),
      '',
      frontendUrl
        ? `Accede a la plataforma para ver más detalles: ${frontendUrl}`
        : 'Accede a la plataforma para ver más detalles.',
      '',
      'Saludos cordiales,',
      'Equipo Eufia',
    ].join('\n');

    const html = `
      <p>Hola <strong>${payload.userName}</strong>,</p>
      <p>Tu solicitud de ausencia ha sido <strong>${statusText}</strong>:</p>
      <ul>
        <li><strong>Tipo:</strong> ${payload.absenceType}</li>
        <li><strong>Fecha de inicio:</strong> ${payload.startDate}</li>
        <li><strong>Fecha de fin:</strong> ${payload.endDate}</li>
        <li><strong>Revisada por:</strong> ${payload.reviewerName}</li>
        ${payload.notes ? `<li><strong>Notas:</strong> ${payload.notes}</li>` : ''}
      </ul>
      <p>${
        frontendUrl
          ? `<a href="${frontendUrl}">Accede a la plataforma para ver más detalles</a>.`
          : 'Accede a la plataforma para ver más detalles.'
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
        `No se pudo enviar el correo de notificación de revisión de ausencia. Detalle: ${message}`,
      );
    }
  }

  async sendJoinRequestNotification(
    payload: JoinRequestNotificationPayload,
  ): Promise<void> {
    const from = process.env.SMTP_USER ?? '';
    const transporter = this.getTransporter();

    const frontendUrl = process.env.FRONTEND_ORIGIN?.replace(/\/$/, '') || '';

    const subject = `Nueva solicitud de acceso - ${payload.companyName}`;

    const text = [
      `Hola ${payload.adminName},`,
      '',
      `${payload.requesterName} ha solicitado unirse a ${payload.companyName}:`,
      `Nombre: ${payload.requesterName}`,
      `Email: ${payload.requesterEmail}`,
      '',
      frontendUrl
        ? `Accede a la plataforma para revisar la solicitud: ${frontendUrl}`
        : 'Accede a la plataforma para revisar la solicitud.',
      '',
      'Saludos cordiales,',
      'Equipo Eufia',
    ].join('\n');

    const html = `
      <p>Hola <strong>${payload.adminName}</strong>,</p>
      <p><strong>${payload.requesterName}</strong> ha solicitado unirse a <strong>${payload.companyName}</strong>:</p>
      <ul>
        <li><strong>Nombre:</strong> ${payload.requesterName}</li>
        <li><strong>Email:</strong> ${payload.requesterEmail}</li>
      </ul>
      <p>${
        frontendUrl
          ? `<a href="${frontendUrl}">Accede a la plataforma para revisar la solicitud</a>.`
          : 'Accede a la plataforma para revisar la solicitud.'
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
        `No se pudo enviar el correo de notificación de solicitud de acceso. Detalle: ${message}`,
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
