# Avaliação: Fal — Software Engineer, Distributed Systems

**Data:** 2026-08-05
**Arquétipo:** AI Platform / Infrastructure Engineer (Distributed Systems)
**Score:** 1.8/5
**URL:** https://speedrun-talent-network.com/jobs/software-engineer-distributed-systems-fal-0acf2909
**PDF:** ❌ — Playwright indisponível; gere com `/career-ops pdf fal-distributed-systems`
**Legitimidade:** Alta — fal.ai é startup real (a16z Speedrun backed), vaga ativa confirmada via Ashby oficial e múltiplos job boards
**Verificação:** não confirmado (sem Playwright)

---

## Resumo Executivo

**Recomendação: NÃO APLICAR.** Score 1.8/5 — abaixo do threshold mínimo de 3.5. Dois bloqueadores independentes: (1) mismatch geográfico crítico — vaga é Turkey-specific, não global-remote; (2) mismatch técnico fundamental — role exige engenharia de sistemas distribuídos em nível de infraestrutura (Rust, schedulers, GPU autoscaling), domínio completamente diferente do perfil de application developer do candidato.

---

## A) Resumo da Vaga

| Campo | Detalhe |
|-------|---------|
| **Empresa** | Fal (fal.ai) |
| **Cargo** | Software Engineer, Distributed Systems |
| **Arquétipo** | AI Platform / Infrastructure Engineer |
| **Domain** | Platform engineering — serverless GPU inference, orquestração de workloads de ML |
| **Função** | Build (infra de plataforma: routing, scheduling, GPU autoscaling) |
| **Senioridade** | Senior (5+ anos — esta é a listagem Turkey; a listagem SF exige 3+ anos) |
| **Remoto** | Remote — mas Turkey-specific (não global-agnostic) |
| **Time** | ~80 pessoas; empresa focada em SF + núcleo de engenharia na Turquia |
| **TL;DR** | Construir o core Python/Rust da plataforma de inference de GPU da Fal: routing, scheduling, autoscaling, profiling de performance a nível de CPU/memória |

**Nota de Localização (crítica):** O listing diz "Remote" mas a localização explícita é "Turkey". A Fal tem dois postings para este mesmo cargo: um em São Francisco (SF, 3+ anos, $180K-250K) e outro na Turquia (5+ anos, sem salary disclosure). Esta é a versão Turkey. Não é uma vaga global-agnostic — é remote dentro da Turquia. Felipe (Porto Alegre, Brasil) não se encaixa neste requisito geográfico.

---

## B) Match com o Currículo

### Requisitos vs CV

| Requisito do JD | Status | Evidência no CV |
|-----------------|--------|-----------------|
| 5+ anos em distributed compute / orchestration platforms em Python ou Rust | ⚠️ PARCIAL | Python/FastAPI presente, mas para APIs de aplicação — não engenharia de sistemas; Rust **ausente** do CV |
| Distributed systems fundamentals: consenso, scheduling, fault tolerance, capacity planning | ❌ GAP HARD | CV demonstra microservices em camada de aplicação (NestJS, FastAPI), não infraestrutura de sistemas distribuídos |
| Computational complexity e memory allocation (deep understanding) | ❌ GAP HARD | Não mencionado no CV |
| Track record de sistemas escaláveis em produção real | ⚠️ PARCIAL | K8s, Helm, Terraform (uso operacional, não construção de scheduler/runtime) |
| Observability para decisões de performance e confiabilidade | ⚠️ PARCIAL | CI/CD com GitHub Actions; observability não explicitada no CV |
| GPU autoscaling / workload orchestration | ❌ GAP HARD | Não mencionado |
| Profile e tune CPU/memory performance (low-level) | ❌ GAP HARD | Não mencionado |
| Rust (linguagem core da plataforma) | ❌ GAP HARD | Ausente do CV e do stack declarado |
| AI/ML inference infrastructure (nice to have) | ❌ GAP | Tem integração com OpenAI API (consumo), não infraestrutura de inferência |
| High-performance systems programming (async runtimes, zero-copy) | ❌ GAP | Não mencionado |
| Multi-tenant compute platforms | ❌ GAP | Não mencionado |
| GPU workload scheduling | ❌ GAP | Não mencionado |

### Matches Reais

| Asset | Evidência |
|-------|-----------|
| Python | FastAPI (DoctorAssistant.ai, INSTOR) |
| Kubernetes / Docker / Helm | DoctorAssistant.ai, INSTOR — múltiplos deployments |
| Terraform, GCP, AWS | DoctorAssistant.ai, INSTOR |
| Microservices architecture | Padrão recorrente em todas as posições |
| Integração com LLMs | OpenAI API em DoctorAssistant.ai e NOZ |

### Análise de Gaps

**Gaps são em sua maioria HARD BLOCKERS, não nice-to-haves:**

1. **Rust (hard blocker):** Core da plataforma é Python/Rust. Felipe não tem Rust. Não há experiência adjacente que cubra isso em curto prazo.
2. **Distributed systems infrastructure (hard blocker):** O JD pede quem construiu schedulers, roteadores, sistemas de consensus — não quem orquestrou containers via K8s como usuário.
3. **GPU/ML inference infrastructure (hard blocker):** O produto da Fal é exatamente isso. Experiência de consumir a API da OpenAI não é equivalente.
4. **Low-level performance (hard blocker):** Profiling de CPU/memória não está no CV e não tem transferência direta da experiência atual.

**Mitigação possível:** Nenhuma de curto prazo. Este não é um gap de keywords — é um gap de domínio e especialidade de múltiplos anos.

---

## C) Nível e Estratégia

**Nível detectado no JD:** Senior / Staff (Turkey posting exige 5+ anos em distributed compute/orchestration em Python/Rust)

**Nível natural do candidato para ESTE arquétipo:** Junior-to-Mid em infraestrutura distribuída (tem 5 anos de experiência, mas em application development, não systems engineering)

**Conclusão:** O candidato não deveria tentar "vender" essa posição. O gap não é de framing — é de domínio. Tentativas de forçar match (ex: "minha experiência com K8s é equivalente") seriam rejeitadas imediatamente por um entrevistador de sistemas distribuídos.

**Se insistir em aplicar:** Seria necessário anos de transição focada (contribuições a projetos de sistemas distribuídos em Rust, trabalho com ML serving frameworks como vLLM/TGI, estudo profundo de sistemas de consensus como Raft/Paxos). Não é uma posição para candidatura imediata.

---

## D) Remuneração e Demanda

### Dados Salariais

| Fonte | Cargo / Local | Faixa |
|-------|---------------|-------|
| Greenhouse / Ashby (Fal oficial) | Software Engineer, Distributed Systems — San Francisco | $180.000–$250.000/ano + equity + benefícios (Mid, Senior e Staff) |
| inferencejobs.com | Software Engineer, Distributed Systems — Türkiye | Sem disclosure (local market rates) |
| Indeed | Staff Software Engineer — EUA | ~$239.842/ano |

### Análise de Comp para a Vaga Turkey

A listagem da Turquia **não divulga salário**. A Fal claramente opera com duas faixas: US ($180K-250K) e mercado local turco (sem disclosure). Para engenheiros sênior de sistemas distribuídos na Turquia, o mercado indica USD $40.000–$80.000/ano dependendo da empresa e nível de senioridade.

**Comparação com target do candidato:**
- Target internacional do candidato: R$3.000–4.000/mês (~USD $600–800/mês ou ~USD 7.200–9.600/ano)
- Mesmo em local rates turcos ($40K-80K/ano), seria muito acima do target de comp do candidato

**Conclusão:** A comp da versão Turkey provavelmente seria razoável se o candidato tivesse o fit técnico — mas o mismatch técnico torna este ponto irrelevante.

---

## E) Plano de Personalização

**Não aplicável.** Score abaixo do threshold de 3.5 e dois hard blockers independentes (geográfico + técnico). Não há customização de CV que transforme um application developer em um distributed systems / infrastructure engineer com expertise em Rust e GPU scheduling.

Se o candidato quiser acompanhar a Fal para oportunidades mais alinhadas ao seu perfil no futuro:
- **Software Engineer, Full Stack (Serverless)** — SF Office — potencialmente mais alinhado com stack atual
- **Software Engineer, Growth** — SF Office — potencialmente aplicável com stack atual

---

## F) Plano de Entrevistas

**Não aplicável.** Não recomendado avançar para entrevistas. A decisão de não aplicar deve ser tomada antes desta etapa.

---

## G) Rascunhos de Candidatura

**Não aplicável** (score abaixo de 4.5 e recomendação de não aplicar).

---

## Bloco G — Legitimidade da Vaga

| Sinal | Status |
|-------|--------|
| Empresa verificável | ✅ fal.ai — startup real, fundada ~2022, produto ativo em produção |
| Financiamento | ✅ a16z Speedrun accelerator (portfólio confirmado), séries de investimento documentadas |
| Página de carreiras oficial | ✅ jobs.ashbyhq.com/fal-ai — 30 vagas abertas confirmadas |
| Vaga listada no portal oficial | ✅ Ashby mostra "Software Engineer, Distributed Systems — Remote — Full time" |
| Plataforma de origem | ✅ speedrun-talent-network.com — rede de talentos legítima do a16z Speedrun |
| Outros job boards | ✅ inferencejobs.com, Aplyr, Simplify, Trabajo.org — vaga consistente |
| Salary disclose | ⚠️ Apenas para versão SF ($180K-250K); versão Turkey sem disclosure |
| Red flags de fraude | ❌ Nenhum |

**Veredicto de Legitimidade: Alta.** Vaga real de empresa real. Speedrun Talent Network é a rede de recrutamento legítima do programa a16z Speedrun. A ausência de salary disclosure para o posting Turkey é prática comum, não red flag.

---

## Resumo de Riscos

| Risco | Severidade | Probabilidade |
|-------|------------|---------------|
| Rejeição imediata por ausência de Rust | 🔴 Crítico | Alta |
| Rejeição por ausência de experiência em sistemas distribuídos a nível de infra | 🔴 Crítico | Alta |
| Requisito geográfico Turkey (não global-remote) | 🔴 Crítico | Alta |
| Entrevista técnica cobre scheduling/consensus/GPU — domínios ausentes no CV | 🔴 Crítico | Alta |

---

## Keywords Extraídas (ATS)

`distributed systems`, `Python`, `Rust`, `request routing`, `AI workload orchestration`, `GPU autoscaling`, `scheduling`, `fault tolerance`, `consensus`, `capacity planning`, `observability`, `low latency`, `high throughput`, `memory allocation`, `computational complexity`, `ML inference`, `async runtimes`, `zero-copy`, `multi-tenant`, `serverless GPU`, `large scale file storage`, `queueing`, `performance profiling`

---

## Machine Summary

```yaml
report: "063"
company: "Fal"
role: "Software Engineer, Distributed Systems"
archetype: "AI Platform / Infrastructure Engineer"
score: 1.8
recommendation: "NÃO APLICAR"
blockers:
  - "Requisito geográfico Turkey-specific — não global-remote"
  - "Rust ausente do stack do candidato (linguagem core da plataforma)"
  - "Gap de domínio fundamental: systems/infra engineering vs application development"
  - "GPU/ML inference infrastructure — ausente no CV"
location_flag: "Turkey-specific (não Brazil-compatible)"
sponsorship_needed: false
comp_disclosed: false
comp_sf_ref: "$180K–$250K USD (versão San Francisco)"
legitimacy: "Alta"
date: "2026-08-05"
```
