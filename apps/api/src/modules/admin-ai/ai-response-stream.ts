import type { SwaggerCustomizer } from '@nestia/core';
import { HttpException } from '@nestjs/common';
import type { FastifyReply } from 'fastify';
import type { AiChatState, AiStreamSink } from './admin-ai.dto.js';

export function describeAiStream({ route }: SwaggerCustomizer.IProps): void {
  route.tags = ['Administração / Assistente IA streaming'];
  route.responses = {
    '200': {
      description:
        'SSE data JSON: text deltas, authoritative state, error, done. EOF without done requires GET reconciliation.',
      content: { 'text/event-stream': { schema: { type: 'string' } } },
    },
  };
}

export async function streamAiResponse(
  reply: FastifyReply,
  operation: (send: AiStreamSink) => Promise<AiChatState>,
): Promise<void> {
  let started = false;
  const send: AiStreamSink = (event) => {
    if (reply.raw.destroyed || reply.raw.writableEnded) return;
    if (!started) {
      reply.hijack();
      for (const [name, value] of Object.entries(reply.getHeaders())) {
        if (value !== undefined) reply.raw.setHeader(name, value);
      }
      reply.raw.writeHead(200, {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-store, no-transform',
        'X-Accel-Buffering': 'no',
      });
      started = true;
    }
    // Slow/disconnected readers must not block finalization of an approved write.
    if (reply.raw.writableLength > 1_048_576) {
      reply.raw.destroy();
      return;
    }
    reply.raw.write(`data: ${JSON.stringify(event)}\n\n`);
  };
  const heartbeat = setInterval(() => {
    if (
      started &&
      !reply.raw.destroyed &&
      !reply.raw.writableEnded &&
      reply.raw.writableLength < 1024
    )
      reply.raw.write(': keepalive\n\n');
  }, 15_000).unref();
  try {
    const state = await operation(send);
    send({ type: 'state', state });
    send({ type: 'done' });
  } catch (error) {
    if (!started) throw error;
    send({
      type: 'error',
      message:
        error instanceof HttpException && error.getStatus() < 500
          ? error.message
          : 'Resposta interrompida. Atualize a conversa antes de tentar novamente.',
    });
  } finally {
    clearInterval(heartbeat);
    if (started && !reply.raw.destroyed) reply.raw.end();
  }
}
