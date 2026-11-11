import { ArgumentsHost, BadRequestException, ForbiddenException, HttpException, Logger } from '@nestjs/common';
import { ProblemDetailsFilter } from './problem-details.filter';

describe('ProblemDetailsFilter', () => {
  let filter: ProblemDetailsFilter;
  let json: jest.Mock;
  let type: jest.Mock;
  let status: jest.Mock;
  let host: ArgumentsHost;

  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    filter = new ProblemDetailsFilter();
    json = jest.fn();
    type = jest.fn().mockReturnValue({ json });
    status = jest.fn().mockReturnValue({ type });
    host = {
      switchToHttp: () => ({
        getResponse: () => ({ status }),
        getRequest: () => ({ originalUrl: '/api/v1/listings' }),
      }),
    } as unknown as ArgumentsHost;
  });

  afterEach(() => jest.restoreAllMocks());

  it('renvoie une reponse RFC 9457 pour une erreur HTTP', () => {
    filter.catch(new ForbiddenException('Rôle insuffisant'), host);

    expect(status).toHaveBeenCalledWith(403);
    expect(type).toHaveBeenCalledWith('application/problem+json');
    expect(json).toHaveBeenCalledWith({
      type: 'about:blank',
      title: 'Accès refusé',
      status: 403,
      detail: 'Rôle insuffisant',
      instance: '/api/v1/listings',
    });
  });

  it('liste les erreurs de validation quand le message est un tableau', () => {
    filter.catch(new BadRequestException(['le titre est obligatoire', 'l état est invalide']), host);

    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Erreur de validation',
        detail: 'La requête ne respecte pas le format attendu',
        errors: ['le titre est obligatoire', 'l état est invalide'],
      }),
    );
  });

  it('accepte une reponse d erreur sous forme de simple chaine', () => {
    filter.catch(new HttpException('Trop de requêtes', 429), host);

    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Trop de requêtes', detail: 'Trop de requêtes' }),
    );
  });

  it('garde le detail par defaut quand l erreur HTTP n a pas de message', () => {
    filter.catch(new HttpException({}, 404), host);

    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Ressource introuvable', detail: 'Une erreur interne est survenue' }),
    );
  });

  it('utilise un titre generique pour un statut inconnu', () => {
    filter.catch(new HttpException('Je suis une théière', 418), host);

    expect(json).toHaveBeenCalledWith(expect.objectContaining({ title: 'Erreur interne', status: 418 }));
  });

  it('masque les details d une erreur inattendue et la journalise', () => {
    filter.catch(new Error('mot de passe de la base : secret'), host);

    expect(status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ status: 500, detail: 'Une erreur interne est survenue' }),
    );
    expect(Logger.prototype.error).toHaveBeenCalledTimes(1);
  });

  it('journalise aussi une valeur levee qui n est pas une Error', () => {
    filter.catch('boom', host);

    expect(Logger.prototype.error).toHaveBeenCalledWith('boom');
    expect(status).toHaveBeenCalledWith(500);
  });
});
