# FutHub Admin

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

A equipe de conteúdo seleciona jogadores, ajusta arte e dados do card e salva ou exporta o resultado em uma sessão de trabalho.

## Product Purpose

Administrar o acervo de futebol e produzir cards de jogadores a partir dos registros existentes. No Studio de Cards, concluir uma edição significa conferir a prévia, resolver pendências dos arquivos e salvar a imagem no jogador ou exportar um arquivo.

## Operating Context

O Studio é uma área do admin. A pessoa escolhe um card do catálogo, trabalha com conteúdo, foto, aparência e camadas, compara versões e pode tratar a imagem antes de salvar ou exportar.

## Capabilities and Constraints

- O redesenho do Studio de Cards preserva o fluxo atual completo: seleção, prévia, edição, camadas, histórico, tratamento de imagem, exportação e salvamento.
- Rascunhos e snapshots locais não são publicação no banco; salvar a imagem do jogador é uma ação separada.
- A exportação em qualidade final depende dos requisitos de foto padronizada e, para saídas com card, escudo SVG.
- O app é React com Vite e consome dados por API; manter os dados reais e os estados de carregamento, vazio e erro.

## Brand Commitments

FutHub é o nome do produto. Nomes de jogadores, times, coleções, imagens e atributos vêm do acervo, sem criar estatísticas ou jogadores fictícios para a interface em produção.

## Evidence on Hand

- Fluxo e interface existentes: `src/features/studio/studio.tsx` e `src/features/studio/studio-model.ts`.
- Renderização da arte: `src/features/studio/card-design.ts` e `src/features/studio/card-model.ts`.

## Product Principles

- Deixar claro o que está salvo localmente e o que foi persistido no jogador.
- Tornar a arte e seus requisitos de qualidade verificáveis durante a edição.
- Preservar acesso direto às ferramentas sem esconder tarefas frequentes.
