# Avaliação: OpenRouter — Software Engineer, Platform

**Data:** 2026-08-05
**Arquétipo:** Senior Platform / Infrastructure Engineer (LLM Infra)
**Score:** 1.5/5
**URL:** https://speedrun-talent-network.com/jobs/software-engineer-platform-openrouter-47c2bcd2
**PDF:** ❌ — Playwright indisponível; gere com `/career-ops pdf openrouter-platform`
**Legitimidade:** Tier 1 (legítima — a16z speedrun talent network, empresa real, salário explícito)
**Verificação:** não confirmado (sem Playwright)

---

> ⛔ **HARD STOP — WORK AUTHORIZATION**
> A vaga é explicitamente **"Remote (US)"** — trabalho remoto restrito a residentes/autorizados nos EUA. Felipe está baseado no Brasil, com autorização apenas em "Brazil" e `needs_sponsorship: true`. Não há indicativo de patrocínio de visto nesta vaga. **Score limitado a ≤ 2.0 por regra do sistema.** Recomendação: não aplicar.

---

## A) Resumo da Vaga

| Campo | Detalhe |
|-------|---------|
| **Empresa** | OpenRouter |
| **Título** | Software Engineer, Platform |
| **Arquétipo** | Senior Platform / Infrastructure Engineer |
| **Domínio** | LLM routing infrastructure (Cloudflare, GCP, Spanner, ClickHouse, Postgres) |
| **Função** | Build / Scale / Operate — IC hands-on |
| **Senioridade** | Senior (5+ anos de infra de produção exigidos) |
| **Remoto** | Remote (US) — **⛔ US-only** |
| **Compensação** | $215K–$285K + equity |
| **Tamanho do time** | Pequeno time de engenharia (menção a "small team") |
| **Fonte** | a16z speedrun talent network |
| **TL;DR** | Engenheiro sênior de plataforma para escalar a infra de roteamento de LLMs do OpenRouter (Cloudflare Edge + GCP + Spanner + ClickHouse) — exige residência/autorização nos EUA. |

---

## B) Match com o Currículo

### Mapeamento de Requisitos

| Requisito do JD | Evidência no cv.md | Match |
|----------------|-------------------|-------|
| 5+ anos em infra de produção (uptime, latência, custo) | 5 anos total como Full Stack Dev com componente de infra (Docker, K8s, GCP, CI/CD em múltiplas empresas) | ⚠️ Parcial — infra é componente, não foco principal |
| Cloud platforms: GCP, AWS, Azure | `cv.md`: "Google Cloud (GCP), AWS" em Skills; GCP mencionado em INSTOR, DoctorAssistant.ai | ✅ GCP/AWS confirmados; Azure ausente |
| Edge-first serverless: Cloudflare Workers | Não mencionado em nenhuma experiência | ❌ Gap significativo |
| Grandes bancos de dados: Postgres, Spanner | `cv.md`: PostgreSQL em todas as experiências; Spanner ausente | ⚠️ PostgreSQL ✅, Spanner ❌ |
| ClickHouse | Não mencionado | ❌ Gap |
| Full-stack TypeScript (mover entre camadas) | `cv.md`: TypeScript em todas as experiências, NestJS + React.js + Next.js | ✅ Forte match |
| Kubernetes | `cv.md`: "Kubernetes, Helm" em Skills; K8s em INSTOR e DoctorAssistant.ai | ✅ |
| CI/CD ownership | `cv.md`: GitHub Actions, GitLab Runners, Helm em múltiplas experiências | ✅ |
| Observability / on-call playbook | Não explicitado no CV — implied pela gestão de infra | ⚠️ Não comprovado |
| High agency, bias toward action | Trajetória como contratado autônomo, ownership end-to-end em múltiplos projetos | ✅ Inferível |
| AI-forward (usa coding agents, MCPs, LLMs) | `cv.md`: "Claude Code, GitHub Copilot" em Skills; OpenAI API em produção (DoctorAssistant.ai, INSTOR, NOZ) | ✅ |

### Gaps e Estratégia de Mitigação

| Gap | Severity | Mitigação |
|-----|----------|-----------|
| **Cloudflare Workers / Edge serverless** | 🔴 Hard — requisito explícito para a plataforma | Sem experiência documentada; não há mitigação rápida |
| **Cloud Spanner** | 🔴 Hard — tecnologia core da stack deles | Nunca mencionado; gap real de especialização |
| **ClickHouse** | 🟡 Soft — não listado em "must-have" mas usado no dia a dia | Pode ser aprendido; mencionar experiência com Elasticsearch como adjacente |
| **Azure** | 🟢 Nice-to-have | Não é bloqueador |
| **Observability / on-call** | 🟡 Soft | Pode referenciar ownership de CI/CD e infra como aproximação |
| **Foco em infra pura vs Full Stack** | 🟡 Contextual | O JD pede IC que "mova entre camadas quando necessário" — perfil full-stack pode ser framing positivo |

---

## C) Nível e Estratégia

**Nível detectado no JD:** Senior IC com liderança técnica implícita ("set the bar and playbook")
**Nível natural de Felipe neste arquétipo:** Mid-to-Senior — Felipe tem a senioridade em anos (5+) e na stack TypeScript/Node.js, mas o foco da vaga é **infra especializada** (Cloudflare, Spanner, ClickHouse) onde ele não tem evidências documentadas.

> ⚠️ Mesmo sem o hard stop de work auth, o arquétipo "Platform / SRE" com foco em edge infra e distributed datastores não é o eixo principal de Felipe. O perfil dele é mais Full Stack com forte componente DevOps — a vaga quer alguém cuja identidade profissional seja infra, não alguém que também faz infra.

**Plano "vender senior sem mentir"** (hipotético, sem o hard stop):
- Destacar INSTOR: Kubernetes + Helm + GCP em produção para sistema de teleoperation robótica
- Destacar DoctorAssistant.ai: K8s + Terraform + GCP + Pub/Sub — infra de SaaS de saúde em produção
- Referenciar CI/CD ownership em ambas (não só configuração, mas arquitetura e manutenção)
- TypeScript full-stack é exatamente o que eles operam — framing positivo

**Plano "se me downlevelearem":** Irrelevante — hard stop impede candidatura.

---

## D) Remuneração e Demanda

| Item | Dado | Fonte |
|------|------|-------|
| **Faixa anunciada** | $215K–$285K + equity | JD (speedrun / OpenRouter careers) |
| **Mercado US (SWE Senior / Platform)** | $180K–$280K base nos EUA (tech companies Series B+) | Levels.fyi benchmark geral para platform SWEs |
| **Posicionamento da vaga** | No quartil superior do mercado US — equity adicional | Vaga de startup de alto crescimento (a16z backed) |
| **Equivalente BRL** | ~R$1.290.000–R$1.710.000/ano (câmbio ~6,0 BRL/USD) ≈ R$107K–R$142K/mês | Referência cambial apenas |
| **Meta do candidato** | R$3.000–4.000/mês (internacional remoto) | `config/profile.yml` |
| **Análise** | Compensação excepcional pelo padrão de mercado US — irrelevante por work auth | — |

> 💡 **Nota:** A compensação é excelente pelo padrão US (Tier 1 tech startup). O gap com o target do candidato não é relevante pois o hard stop de work auth já elimina a vaga.

---

## E) Plano de Personalização

> ⚠️ Seção gerada para referência futura. Não aplicar esta vaga.

| # | Seção | Estado atual | Mudança proposta | Por que |
|---|-------|-------------|------------------|---------|
| 1 | **Summary** | "Full Stack Developer" genérico | Reframing para "Platform Engineer with cloud-native expertise" com foco em GCP/K8s/CI-CD | Arquétipo da vaga é infra, não full-stack |
| 2 | **Skills — Cloud** | GCP, AWS listados genericamente | Destacar Kubernetes + Helm + Terraform + GCP Pub/Sub como bloco coeso | Mostrar profundidade de infra, não só presença |
| 3 | **INSTOR** | "Enhanced integration and deployment flow" | Expandir: arquitetura K8s, gestão de CI/CD com GitLab Runners, SLAs de uptime | Proof point mais próximo de "Platform Engineer" |
| 4 | **DoctorAssistant.ai** | Menciona microservices + DevOps | Destacar Terraform + GCP Pub/Sub + Redis como componentes de infra escalável | Demonstra experiência com datastores e messaging |
| 5 | **Novo skill (gap)** | Cloudflare Workers ausente | Projeto pessoal ou treinamento em Cloudflare Workers antes de aplicar | Gap hard-blocker; sem isso a candidatura fica fraca |

---

## F) Plano de Entrevistas

> ⚠️ Seção gerada para referência futura. Não aplicar esta vaga.

| # | Requisito do JD | História STAR+R | S | T | A | R | Reflection |
|---|----------------|-----------------|---|---|---|---|------------|
| 1 | Infra de produção em GCP | Arquitetura K8s no DoctorAssistant.ai | SaaS médica com alta demanda de uptime | Implantar K8s + Helm + Terraform em produção | Projetou namespace isolation, HPA, CI/CD automatizado | Sistema com zero downtime em produção durante crescimento | Terraform como IaC desde o início teria sido mais fácil do que migrar depois |
| 2 | Escalar datastores | PostgreSQL em múltiplas empresas (NOZ, DoctorAssistant.ai) | Aplicações com carga crescente | Manter DB performático sem DBA dedicado | Query optimization, indexing strategy, monitoramento | Sistemas estáveis, sem incidentes de DB documentados | Ferramenta de observability dedicada (ex: pganalyze) teria ajudado mais cedo |
| 3 | CI/CD ownership | GitLab Runners no INSTOR | Sistema de teleoperation robótica em produção | Estabilizar pipeline lento e com falhas frequentes | Redesenhou stages, adicionou cache de imagens Docker, paralelizou testes | Redução de tempo de pipeline (sem métrica exata documentada) | Documentar SLOs de pipeline desde o início para medir impacto |
| 4 | TypeScript full-stack | NestJS + Next.js em múltiplas empresas | Múltiplos projetos de SaaS e produto | Manter coerência de stack em times menores | Padronizou estrutura de módulos NestJS, types compartilhados com frontend | Entregas mais rápidas, menos bugs de integração front/back | Monorepo teria simplificado ainda mais o compartilhamento de types |
| 5 | High agency / ownership | NOZ — arquitetura de novo projeto do zero | Time sem arquiteto designado | Liderar decisões técnicas sem mandato formal | Propôs e implementou Clean Architecture + CMS integration | Time adotou padrões, 2 engenheiros treinados em Clean Arch + TDD | Documento de ADR (Architecture Decision Record) teria facilitado onboarding futuro |

---

## G) Legitimidade da Vaga (Block G)

| Sinal | Avaliação |
|-------|-----------|
| **Fonte** | a16z speedrun talent network — rede legítima de recrutamento |
| **Empresa** | OpenRouter — empresa real, bem conhecida no ecossistema de AI/LLMs, backed by a16z |
| **Compensação** | Explicitamente declarada ($215K–$285K + equity) — não é vaga fantasma |
| **JD** | Detalhado, técnico, específico sobre stack (Cloudflare, Spanner, ClickHouse) |
| **Red flags** | Nenhum sinal de fraude ou ilegitimidade |
| **Veredicto** | ✅ **Tier 1 — Vaga legítima** |

---

## Resumo de Riscos

| Risco | Nível | Detalhe |
|-------|-------|---------|
| ⛔ Work Authorization | **CRÍTICO** | "Remote (US)" — sem autorização para trabalhar nos EUA; patrocínio não mencionado |
| 🟡 Arquétipo mismatch | **Moderado** | Vaga é Platform/SRE especializado; Felipe é Full Stack com componente DevOps |
| 🟡 Gaps de stack | **Moderado** | Cloudflare Workers e Cloud Spanner são gaps hard; ClickHouse é gap soft |
| 🟢 Stack TypeScript | **Baixo** | Forte alinhamento no TypeScript full-stack |
| 🟢 GCP / K8s | **Baixo** | Comprovados em múltiplos projetos |

---

## Machine Summary

```yaml
report: "065"
company: "OpenRouter"
role: "Software Engineer, Platform"
archetype: "Senior Platform / Infrastructure Engineer"
score: 1.5
score_rationale: "Hard stop por work auth (Remote US-only; candidato baseado no Brasil sem autorização). Stack overlap parcialmente forte (GCP, K8s, TypeScript, PostgreSQL) mas gaps críticos em Cloudflare Workers e Cloud Spanner. Arquétipo da vaga é infra pura, não Full Stack."
hard_stop: true
hard_stop_reason: "Remote (US) — US work authorization required; candidate is Brazil-only, no sponsorship indicated"
work_auth: "HARD STOP — US-only remote; Brazil-based candidate not eligible"
compensation_usd: "$215K–$285K + equity"
compensation_tier: "Tier 1 (top US market)"
location_policy: "Remote (US) — HARD STOP"
legitimacy: "Tier 1"
verification: "unconfirmed (batch mode — no Playwright)"
apply_recommendation: "NÃO APLICAR"
pdf: false
date: "2026-08-05"
```

---

## Keywords Extraídas (ATS)

`platform engineering`, `infrastructure`, `Cloudflare Workers`, `Google Cloud`, `GCP`, `Spanner`, `ClickHouse`, `PostgreSQL`, `TypeScript`, `Kubernetes`, `edge serverless`, `LLM routing`, `observability`, `on-call`, `CI/CD`, `reliability`, `latency optimization`, `cost optimization`, `Vercel`, `production infrastructure`
