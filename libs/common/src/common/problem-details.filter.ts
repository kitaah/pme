import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { Request, Response } from 'express';

const TITLES: Record<number, string> = {
  400: 'Erreur de validation',
  401: 'Non authentifié',
  403: 'Accès refusé',
  404: 'Ressource introuvable',
  409: 'Conflit',
  429: 'Trop de requêtes',
  503: 'Service indisponible',
};

/**
 * Traduit toutes les erreurs en reponses RFC 9457 (Problem Details for HTTP APIs),
 * comme le GlobalExceptionHandler du projet Spring.
 */
@Catch()
export class ProblemDetailsFilter implements ExceptionFilter {
  private readonly logger = new Logger(ProblemDetailsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let detail = 'Une erreur interne est survenue';
    let errors: string[] | undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const body = exception.getResponse();
      const message = typeof body === 'string' ? body : (body as { message?: string | string[] }).message;
      if (Array.isArray(message)) {
        errors = message;
        detail = 'La requête ne respecte pas le format attendu';
      } else if (message) {
        detail = message;
      }
    } else {
      this.logger.error(exception instanceof Error ? exception.stack : String(exception));
    }

    response
      .status(status)
      .type('application/problem+json')
      .json({
        type: 'about:blank',
        title: TITLES[status] ?? 'Erreur interne',
        status,
        detail,
        instance: request.originalUrl,
        ...(errors ? { errors } : {}),
      });
  }
}
