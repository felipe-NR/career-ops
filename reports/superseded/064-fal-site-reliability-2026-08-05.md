# Avaliação: Fal — Software Engineer, Site Reliability

**Data:** 2026-08-05
**Arquétipo:** SRE / Platform Engineering (AI Infrastructure)
**Score:** 2.5/5
**URL:** https://speedrun-talent-network.com/jobs/software-engineer-site-reliability-fal-7fbe1d25
**PDF:** ❌ — Playwright indisponível; gere com `/career-ops pdf fal-site-reliability`
**Legitimidade:** Verificado — fal.ai é empresa real (Sequoia + Meritech, $602M em funding); a16z speedrun talent network é legítima
**Verificação:** não confirmado (sem Playwright)

---

## A) Resumo da Vaga

| Dimensão | Detalhe |
|----------|---------|
| **Arquétipo** | SRE / Platform Engineering (AI Infrastructure) |
| **Domain** | GPU inference infrastructure, reliability, observability |
| **Função** | Operar e escalar infraestrutura Kubernetes em produção |
| **Senioridade** | Senior (5+ anos explicitamente requeridos em SRE) |
| **Remoto** | Full Remote — Worldwide (listada como "Turkey" no speedrun, mas InferenceJobs confirma "Worldwide Remote"; fal já tem 2 funcionários no Brasil) |
| **Work Authorization** | ✅ Não exige patrocínio — worldwide remote, Brasil compatível |
| **Tamanho da empresa** | ~100 pessoas, crescimento 241% ao ano, Series C $125M (jul/2025, Meritech) + Series D (Sequoia) |
| **TL;DR** | SRE especializado para operar K8s de GPU inference em escala, com foco em networking profundo, observabilidade e GitOps |

**Sobre a Fal:** Plataforma de generative media inference (serverless GPU), fundada em 2021 por engenheiros ex-Coinbase e Amazon. $602.9M em funding total. HQ em San Francisco, time global em 11 países incluindo Brasil. Clientes servindo centenas de milhões de usuários.

---

## B) Match com o Currículo

### Mapeamento de Requisitos

| Requisito do JD | Presença no CV | Nível | Avaliação |
|----------------|---------------|-------|-----------|
| 5+ anos gerenciando sistemas críticos de produção | 5 anos total como Full Stack Dev com componentes infra | Desenvolvedor usando infra, não SRE especializado | ⚠️ Parcial |
| Kubernetes em escala + IaC (Terraform, Ansible) | K8s, Helm, Terraform em INSTOR e DoctorAssistant.ai | Uso de dev, não operação de cluster a nível SRE | ⚠️ Parcial |
| Linux networking profundo (CNI, VXLAN, BGP, DNS) | "Linux" listado em skills | Sem evidência de networking em profundidade | ❌ Gap crítico |
| CI/CD + GitOps (FluxCD, ArgoCD) | GitHub Actions, GitLab Runners — multiple roles | CI/CD presente; GitOps tools (FluxCD/ArgoCD) ausentes | ⚠️ Parcial |
| Python + Go ou Bash | Python ✅ (FastAPI, backend); Go/Bash ausentes do CV | Python forte; Go/Bash não evidenciados | ⚠️ Parcial |
| Monitoring/alerting (Prometheus, Grafana, Loki, Thanos, VictoriaMetrics, Datadog) | Ausente do CV | Stack de observabilidade não evidenciada | ❌ Gap crítico |
| SLOs, incident response, chaos engineering | Ausente do CV | Práticas SRE core não evidenciadas | ❌ Gap crítico |
| Comunicação técnica e decisões cross-team | NOZ: "acted as technical reference", treinou 2 engenheiros | Evidência clara de comunicação técnica | ✅ Match |

### Nice-to-haves

| Nice-to-have | Presença no CV | Avaliação |
|-------------|---------------|-----------|
| GPU/AI/ML workloads | Integração com OpenAI LLMs em DoctorAssistant e INSTOR | Nível aplicação, não infra de GPU | ⚠️ Tangencial |
| eBPF, XDP | Ausente | ❌ |
| Security tooling (Falco, Coroot, SIEM) | Ausente | ❌ |
| Bare metal K8s (Calico, Cilium, MetalLB) | Ausente | ❌ |
| Distributed storage (Ceph, Longhorn) | Ausente | ❌ |

### Análise de Gaps

| Gap | Classificação | Mitigação possível? |
|-----|--------------|---------------------|
| Linux networking profundo (VXLAN, BGP, CNI plugins) | **Hard blocker** — competência core de SRE de rede | Não há proof point adjacente. Demanda especialização real. |
| Stack de observabilidade (Prometheus, Grafana, Loki, Thanos) | **Hard blocker** — SRE sem observabilidade é deal-breaker | Sem evidência. Curva de aprendizado existe mas não há sinal no CV. |
| GitOps (FluxCD, ArgoCD) | **Hard blocker** — padrão de deploy moderno exigido | CI/CD existe; GitOps é diferente. Sem evidência. |
| Bash/Go para automação de tooling | Hard requirement (Python alternativo OK) | Python mitiga parcialmente. |
| SLOs, chaos engineering, incident response | **Hard blocker** — práticas SRE fundamentais | Não há prática ou proof point. |
| Experiência como SRE dedicado vs dev com infra | Mismatch de função | Não mitiga com framing — a especialização é diferente. |

**Resumo:** 3 dos 7 requisitos são hard blockers sem evidência adjacente no CV. O candidato usa ferramentas de infraestrutura como desenvolvedor, mas não opera infraestrutura como especialista SRE.

---

## C) Nível e Estratégia

### Nível detectado vs nível natural do candidato

- **JD pede:** SRE Senior com 5+ anos de operação de sistemas críticos, networking Linux profundo, observabilidade em escala
- **Nível natural do candidato nesse arquétipo:** Mid-Level DevOps/Infra (usa Docker, K8s, Terraform como dev) — não há sinal de SRE especializado

### Gap de função (não apenas de nível)

Este não é um caso de "downlevel" — é um **mismatch de função**. Felipe é Full Stack Developer que usa infra como ferramenta. SRE da Fal é um especialista de plataforma que opera infraestrutura como produto. São perfis diferentes, mesmo com overlap em tecnologias.

### Possibilidade de framing "sem mentir"

**Difícil.** O entrevistador técnico vai perguntar:
- "Descreva como você configurou monitoring e alerting em produção" → sem resposta forte no CV
- "Como você debugou um problema de networking entre pods no K8s?" → sem proof point
- "Qual foi o maior incidente que você gerenciou como responsável principal?" → não posicionado no CV

**Recomendação:** Não tentar framing agressivo. Esta vaga exige especialização que o candidato genuinamente não tem ainda.

---

## D) Remuneração e Demanda

### Dados de mercado coletados

| Fonte | Dado | Observação |
|-------|------|------------|
| Built In SF / RemoteFront | **$180K–$250K/ano** (USD) | Listagem SF In-Office — benchmark alto |
| speedrun/aplyr (Turkey/Worldwide) | Não divulgada | Possivelmente localizada para Turkey/global |
| Glassdoor SRE Senior (general) | $150K–$200K (USD, US market) | Referência de mercado |

### Análise para o candidato

- **Comp desconhecida para o remote worldwide:** A listagem Turkey/Worldwide não divulga faixa. A Fal possui política de "competitive salary and equity" + "visa sponsorship" para SF. Para remote worldwide, a faixa pode ser geo-ajustada.
- **Se USD-parity para remote:** R$ ~1.0M–1.4M/ano → muito acima do alvo de R$ 3.000–4.000/mês internacional
- **Se geo-adjusted (Turkey rates, ~40–60% de US):** Ainda potencialmente acima do alvo
- **Equity:** Fal tem valuations significativas (Series D, Sequoia). Equity pode ser material.
- **Benefícios mencionados:** Apenas "interesting work, learning, team events" — nenhum benefício formal detalhado para remote

### Tendência de demanda

- SRE em AI inference é **alta demanda** com oferta baixa de candidatos realmente especializados
- Fal cresceu 241% em headcount — contratações aceleradas
- Mercado global de SRE para AI infra: altamente competitivo, salários em alta

---

## E) Plano de Personalização

> ⚠️ **Score abaixo de 3.5/5 — personalização de CV e aplicação NÃO recomendadas.** Se o candidato decidir aplicar mesmo assim (com ciência do mismatch), as sugestões abaixo servem como guia.

| # | Seção | Estado atual | Mudança proposta | Por que |
|---|-------|-------------|------------------|---------|
| 1 | Summary | "Senior Full Stack Developer" | Reescrever enfatizando "produção de sistemas cloud-native" e "ownership de infra K8s" | Aproximar do vocabulário SRE |
| 2 | INSTOR | "Docker e GitLab Runners" | Detalhar operação K8s: upgrades, namespaces, Helm releases, resource limits | Evidenciar profundidade de operação |
| 3 | DoctorAssistant | CI/CD com Terraform | Adicionar qualquer detalhe de monitoring/alerting implementado | Cobrir gap de observabilidade |
| 4 | Skills | Cloud, DevOps & Monitoring | Adicionar Prometheus/Grafana se realmente usou; Linux Networking se aplicável | Cobrir keywords do JD |
| 5 | Nova seção (opcional) | — | "Infraestrutura & Confiabilidade" separada de "Backend" | Posicionar como candidato infra-centric |

**LinkedIn (se aplicar):**
1. Headline: adicionar "Kubernetes · Infrastructure · Cloud-Native"
2. About: enfatizar operação de sistemas em produção
3. Skills: adicionar Prometheus, Grafana, GitOps se aplicável

---

## F) Plano de Entrevistas

> **Score abaixo de 3.5/5 — seção incluída apenas para referência caso o candidato prossiga.**

| # | Requisito do JD | História STAR+R | S | T | A | R | Reflection |
|---|----------------|-----------------|---|---|---|---|------------|
| 1 | K8s + IaC em produção | Robotics testing system — INSTOR | Sistema de testes precisava de infra repeatável | Deploy de app full-stack em K8s com Helm + Terraform no GCP | Configurou cluster, namespaces, Helm charts, GCP infra com Terraform, CI/CD com GitLab Runners | Sistema em produção, deploy automatizado | Aprendi que infra como código elimina "works on my machine"; documentar runbooks é tão importante quanto o código |
| 2 | CI/CD + automação | CI/CD em DoctorAssistant | 3 microserviços com deploys independentes necessitavam de pipeline confiável | Pipeline GitHub Actions do zero | Workflows de test → build → deploy por serviço, environments separados, rollback manual | Zero downtime nos deploys durante 12 meses | Próxima vez implementaria blue/green deploy desde o dia 1 |
| 3 | Comunicação técnica e decisões cross-team | NOZ — mentoria de 2 engenheiros | Time com pouco conhecimento de CI/CD e Clean Architecture | Treinar equipe e elevar padrão técnico sem parar entregas | Pair programming, code reviews, workshops internos, documentação de ADRs | 2 engenheiros autossuficientes em CI/CD; deploys passaram a ser automatizados | Percebi que multiplicar conhecimento > resolver você mesmo. Aprendi a calibrar ritmo de mentoria por engenheiro |

**Perguntas red-flag para preparar:**
- *"Você nunca trabalhou como SRE dedicado. Por que esta vaga?"* → Resposta honesta: "Minha experiência é em operação de sistemas em produção como dev. Tenho forte base em K8s e IaC; estou em transição deliberada para ops. Trago o ponto de vista do desenvolvedor que entende o que o SRE precisa suportar."
- *"Descreva um incidente grave que você foi responsável por resolver."* → Sem proof point forte no CV — ser honesto sobre o nível de exposição.

---

## G) Legitimidade (Block G)

| Sinal | Avaliação |
|-------|-----------|
| Empresa verificável | ✅ fal.ai — site, LinkedIn, Crunchbase confirmados |
| Funding real | ✅ $602.9M total; Series C $125M (Meritech, jul/2025); Series D (Sequoia) confirmados |
| Postagem em rede legítima | ✅ a16z speedrun talent network — rede conhecida de portfólio a16z |
| JD consistente | ✅ Mesma JD em múltiplos boards (Built In SF, RemoteFront, aplyr, InferenceJobs) |
| Contato claro | ✅ Redireciona para careers page própria da Fal |
| Red flags de legitimidade | Nenhum |

**Tier: Verificado** — postagem legítima de empresa sólida.

---

## Risk Summary

| Risco | Severidade | Detalhe |
|-------|-----------|---------|
| Mismatch de especialização (SRE vs Full Stack) | 🔴 Alto | A vaga requer SRE especializado; o candidato é Full Stack Dev com experiência em infra. Gaps fundamentais em networking, observabilidade e GitOps. |
| 3 hard blockers sem cobertura | 🔴 Alto | Linux networking profundo, monitoring stack (Prometheus/Grafana/Loki/Thanos), e GitOps (FluxCD/ArgoCD) são exigidos e ausentes do CV. |
| Fora do North Star | 🟡 Médio | SRE não é arquétipo-alvo. Aplicar dilui foco na busca. |
| Comp para remote worldwide desconhecida | 🟡 Médio | Pode ser geo-adjusted — pode ser muito abaixo do benchmark SF de $180K–$250K. |

**Veredicto: NÃO APLICAR.** O mismatch é de especialização, não apenas de nível. Mesmo com framing agressivo, o candidato chegaria ao processo técnico sem poder responder às perguntas-chave de networking e observabilidade.

---

## Keywords extraídas (ATS)

`Site Reliability Engineering`, `SRE`, `Kubernetes`, `Terraform`, `Ansible`, `CI/CD`, `GitOps`, `FluxCD`, `ArgoCD`, `Prometheus`, `Grafana`, `Loki`, `Thanos`, `VictoriaMetrics`, `Datadog`, `SLO`, `Incident Response`, `Chaos Engineering`, `Linux Networking`, `CNI plugins`, `VXLAN`, `BGP`, `eBPF`, `Python`, `Go`, `Bash`, `GPU infrastructure`, `AI inference`, `generative media`, `Kubernetes cluster lifecycle`, `service mesh`

---

## Machine Summary

```yaml
company: "Fal"
role: "Software Engineer, Site Reliability"
archetype: "SRE / Platform Engineering (AI Infrastructure)"
score: 2.5
date: "2026-08-05"
status: "Evaluated"
location: "Worldwide Remote (primary Turkey office)"
work_auth: "OK — worldwide remote; fal já tem 2 funcionários no Brasil"
comp_range: "Não divulgada (Turkey listing); SF listing: $180K-$250K USD/ano"
red_flags:
  - "Gap crítico: Linux networking profundo (VXLAN, BGP, CNI) — ausente no CV"
  - "Gap crítico: stack de observabilidade (Prometheus, Grafana, Loki, Thanos) — ausente no CV"
  - "Gap crítico: GitOps (FluxCD, ArgoCD) — ausente no CV"
  - "Mismatch de função: SRE especializado vs Full Stack Developer com experiência de infra"
  - "5+ anos como SRE dedicado requeridos vs 5 anos como Full Stack Dev"
verdict: "Não aplicar — mismatch de especialização; infra skills presentes em profundidade de dev, não de SRE especializado"
```
