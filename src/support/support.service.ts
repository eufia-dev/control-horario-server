import { Injectable, NotFoundException } from '@nestjs/common';
import { EmailService } from '../email/email.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { BugReportDto } from './dto/bug-report.dto.js';
import { ContactMessageDto } from './dto/contact-message.dto.js';
import type { JwtPayload } from '../auth/interfaces/jwt-payload.interface.js';

@Injectable()
export class SupportService {
  constructor(
    private readonly emailService: EmailService,
    private readonly prisma: PrismaService,
  ) {}

  async submitBugReport(
    userPayload: JwtPayload,
    bugReport: BugReportDto,
  ): Promise<{ message: string }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userPayload.sub },
      select: { name: true, email: true },
    });

    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    const userName = user.name;
    const userEmail = user.email;

    const severityUpper =
      bugReport.severity.charAt(0).toUpperCase() + bugReport.severity.slice(1);
    const categoryUpper =
      bugReport.category.charAt(0).toUpperCase() + bugReport.category.slice(1);
    const subject = `[Bug Report] [${severityUpper}] - [${categoryUpper}] - ${bugReport.page}`;

    const textLines = [
      'Nuevo reporte de error recibido',
      '',
      '--- Información del Usuario ---',
      `Nombre: ${userName}`,
      `Email: ${userEmail}`,
      `ID de Usuario: ${userPayload.sub}`,
      `ID de Compañía: ${userPayload.companyId}`,
      `Rol: ${userPayload.role}`,
      '',
      '--- Detalles del Error ---',
      `Página/URL: ${bugReport.page}`,
      `Fecha y Hora: ${bugReport.occurredAt}`,
      `Categoría: ${bugReport.category}`,
      `Severidad: ${bugReport.severity}`,
      '',
      '--- Descripción ---',
      bugReport.description,
    ];

    if (bugReport.stepsToReproduce) {
      textLines.push(
        '',
        '--- Pasos para Reproducir ---',
        bugReport.stepsToReproduce,
      );
    }

    const text = textLines.join('\n');

    const html = `
      <h2>Nuevo reporte de error recibido</h2>
      
      <h3>Información del Usuario</h3>
      <ul>
        <li><strong>Nombre:</strong> ${this.escapeHtml(userName)}</li>
        <li><strong>Email:</strong> ${this.escapeHtml(userEmail)}</li>
        <li><strong>ID de Usuario:</strong> ${this.escapeHtml(userPayload.sub)}</li>
        <li><strong>ID de Compañía:</strong> ${this.escapeHtml(userPayload.companyId)}</li>
        <li><strong>Rol:</strong> ${this.escapeHtml(userPayload.role)}</li>
      </ul>
      
      <h3>Detalles del Error</h3>
      <ul>
        <li><strong>Página/URL:</strong> ${this.escapeHtml(bugReport.page)}</li>
        <li><strong>Fecha y Hora:</strong> ${this.escapeHtml(bugReport.occurredAt)}</li>
        <li><strong>Categoría:</strong> ${this.escapeHtml(bugReport.category)}</li>
        <li><strong>Severidad:</strong> ${this.escapeHtml(bugReport.severity)}</li>
      </ul>
      
      <h3>Descripción</h3>
      <p>${this.escapeHtml(bugReport.description).replace(/\n/g, '<br>')}</p>
      
      ${
        bugReport.stepsToReproduce
          ? `
      <h3>Pasos para Reproducir</h3>
      <p>${this.escapeHtml(bugReport.stepsToReproduce).replace(/\n/g, '<br>')}</p>
      `
          : ''
      }
    `;

    await this.emailService.sendEmail(subject, text, html);

    return { message: 'Reporte enviado exitosamente' };
  }

  async submitContactMessage(
    userPayload: JwtPayload,
    contactMessage: ContactMessageDto,
  ): Promise<{ message: string }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userPayload.sub },
      select: { name: true, email: true },
    });

    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    const userName = user.name;
    const userEmail = user.email;

    const subject = `[Support Request] ${contactMessage.subject}`;

    const text = [
      'Nuevo mensaje de soporte recibido',
      '',
      '--- Información del Usuario ---',
      `Nombre: ${userName}`,
      `Email: ${userEmail}`,
      `ID de Usuario: ${userPayload.sub}`,
      `ID de Compañía: ${userPayload.companyId}`,
      `Rol: ${userPayload.role}`,
      '',
      '--- Asunto ---',
      contactMessage.subject,
      '',
      '--- Mensaje ---',
      contactMessage.message,
    ].join('\n');

    const html = `
      <h2>Nuevo mensaje de soporte recibido</h2>
      
      <h3>Información del Usuario</h3>
      <ul>
        <li><strong>Nombre:</strong> ${this.escapeHtml(userName)}</li>
        <li><strong>Email:</strong> ${this.escapeHtml(userEmail)}</li>
        <li><strong>ID de Usuario:</strong> ${this.escapeHtml(userPayload.sub)}</li>
        <li><strong>ID de Compañía:</strong> ${this.escapeHtml(userPayload.companyId)}</li>
        <li><strong>Rol:</strong> ${this.escapeHtml(userPayload.role)}</li>
      </ul>
      
      <h3>Asunto</h3>
      <p>${this.escapeHtml(contactMessage.subject)}</p>
      
      <h3>Mensaje</h3>
      <p>${this.escapeHtml(contactMessage.message).replace(/\n/g, '<br>')}</p>
    `;

    await this.emailService.sendEmail(subject, text, html);

    return { message: 'Mensaje enviado exitosamente' };
  }

  private escapeHtml(text: string): string {
    const map: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;',
    };
    return text.replace(/[&<>"']/g, (m) => map[m]);
  }
}
