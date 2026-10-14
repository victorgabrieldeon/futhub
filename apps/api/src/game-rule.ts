import { type ArgumentsHost, BadRequestException, Catch } from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';

/**
 * Regra do jogo que o próprio jogador resolve (saldo, limite por jogador, elenco cheio).
 * Casos de uso continuam sem depender do Nest; o filtro global responde 400 com a mensagem
 * para o bot explicar o motivo em vez de um erro interno.
 */
export class GameRuleError extends Error {
  override readonly name = 'GameRuleError';
}

@Catch(GameRuleError)
export class GameRuleFilter extends BaseExceptionFilter {
  override catch(error: GameRuleError, host: ArgumentsHost): void {
    super.catch(new BadRequestException(error.message), host);
  }
}
