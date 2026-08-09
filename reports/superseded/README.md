# Relatórios Substituídos

Avaliações duplicadas movidas para fora de `reports/` em 2026-08-05 durante uma
reconciliação de `verify-pipeline.mjs` (20 avisos: 8 pares duplicados + 12
relatórios órfãos).

Cada arquivo aqui é uma **reavaliação do mesmo posting** (URL idêntica) já
coberto por uma linha do tracker que aponta para outro relatório. Nenhum deles
tinha linha própria no tracker. Nada foi apagado — a linha do tracker é a fonte
de verdade e o relatório canônico permanece em `reports/`.

## Mapa: canônico ← substituído

| Empresa · Cargo | Canônico (tracker) | Substituído | Δ score |
|-|-|-|-|
| Stone · Sênior SWE Fullstack | 030 (4.2) — linha #30 | 058 (4.2) | 0 |
| Injective Labs · Front-End Developer | 033 (2.8) — linha #33 | 061 (2.5) | 0.3 |
| Material Security · Sr. SWE II | 094 (2.0) — linha #39 | 039 (1.5) | 0.5 |
| OpenRouter · SWE, Product | 040 (4.2) — linha #40 | 095 (2.0) | **2.2** |
| OP Labs · Sr. SWE, Protocol (Rust) | 041 (2.8) — linha #41 | 096 (2.8) | 0 |
| Turquoise Health · SWE II, AI | 042 (3.1) — linha #42 | 097 (2.0) | **1.1** |
| EngFlow · SWE Build Systems | 071 (1.5) — linha #71 | 043 (1.8) | 0.3 |
| Fal · SWE, Infrastructure | 098 (3.1) — linha #98 | 044 (3.2) | 0.1 |
| Anduril · Sr. SWE, PLM | 034 (2.8) — linha #34 | 062 (1.0) | **1.8** |
| Fal · SWE, Distributed Systems | 035 (3.6) — linha #35 | 063 (1.8) | **1.8** |
| Fal · SWE, Site Reliability | 036 (2.8) — linha #36 | 064 (2.5) | 0.3 |
| OpenRouter · SWE, Platform | 037 (3.8) — linha #37 | 065 (1.5) | **2.3** |

Os relatórios 058-071 e 094-098 foram gerados sem Playwright (`**Verificação:**
não confirmado`) e são sistematicamente mais pessimistas que a série 030-044.

## Divergências não resolvidas

Cinco pares divergem em ≥ 1.0 ponto. O score do tracker (coluna canônica) foi
mantido; a segunda opinião está preservada aqui e ainda não foi arbitrada:

- **OpenRouter · SWE, Product** — 4.2 vs 2.0. Maior divergência num cargo acima
  do piso de 3.2. Vale reler antes de aplicar.
- **OpenRouter · SWE, Platform** — 3.8 vs 1.5. Idem: canônico acima do piso,
  segunda opinião muito abaixo.
- **Fal · SWE, Distributed Systems** — 3.6 vs 1.8. Canônico acima do piso.
- **Anduril · Sr. SWE, PLM** — 2.8 vs 1.0. Decisão não muda (SKIP nas duas),
  mas `062` traz intel que `034` não tem: posting **fechado/expirado**
  (Dice: "no longer available", publicado 2026-05-15) e **presencial em Costa
  Mesa, CA** — não remoto como o Speedrun anunciava.
- **Turquoise Health · SWE II, AI** — 3.1 vs 2.0. Ambos abaixo do piso de 3.2.

## Notas de integridade

- `verify-pipeline.mjs` lê `reports/` de forma não-recursiva, então este
  subdiretório não é varrido — nem como duplicata, nem como órfão.
- `reports/*.md` está no `.gitignore`; esta movimentação é local, sem efeito
  no git.
- Nenhum PDF em `output/` estava associado aos relatórios substituídos.
