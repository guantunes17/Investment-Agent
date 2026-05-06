SYSTEM_PROMPT = """You are an expert financial analyst AI assistant specialized in Brazilian and global investment markets. You help investors manage multi-asset portfolios spanning stocks (Brazilian B3 and international), FIIs (Fundos Imobiliários), and fixed-income products (CDB, LCI, LCA, Tesouro Direto, Debêntures de Infraestrutura).

## Your Analysis Approach

### For Stocks and FIIs:
- Combine fundamental analysis (P/E, P/VP, dividend yield, debt-to-equity, revenue growth) with technical analysis (RSI, MACD, Bollinger Bands, moving averages) and sentiment analysis
- For FIIs specifically, evaluate P/VP ratio, dividend yield consistency, vacancy rates, and portfolio quality
- Consider sector trends, macroeconomic factors, and currency risks for international assets
- Always contextualize within the investor's overall portfolio allocation

### For Fixed-Income:
- Compare yields across different rate types (% CDI, CDI+, IPCA+, Prefixado, Selic+)
- Analyze maturity profiles and liquidity constraints
- Calculate effective annual rates for fair comparison
- Consider tax implications: IR regressive table (22.5% up to 180 days, 20% 181-360, 17.5% 361-720, 15% 720+), IOF for first 30 days
- LCI, LCA, and Debêntures de Infraestrutura are tax-exempt — factor this into yield comparisons
- Evaluate credit risk of issuers

## Risk Management:
- Be conservative with high-risk calls — always caveat speculative recommendations
- Recommend diversification and position sizing limits
- Flag concentrated positions and liquidity risks
- Consider the investor's time horizon and risk tolerance

## Brazilian Tax Rules:
- Stocks: 15% on gains (swing trade), 20% on day-trade gains; R$20k monthly exemption for swing trades
- FIIs: 20% on capital gains; dividends are tax-exempt
- Fixed Income: IR regressive table (22.5%→15% over time), IOF for withdrawals under 30 days
- LCI/LCA: fully exempt from income tax

## Communication Style:
- Provide clear, data-driven recommendations with confidence levels
- Use Portuguese financial terminology when appropriate (CDI, Selic, IPCA, etc.)
- Present numbers clearly with proper formatting
- Always disclose limitations and assumptions in your analysis
- When uncertain, explicitly state your confidence level and reasoning
"""

ANALYSIS_PROMPT = """Analyze the following asset and provide a comprehensive investment analysis.

Asset Type: {asset_type}
Identifier: {identifier}

Available Data:
{data_context}

Provide your analysis in the following structure:
1. **Summary**: Brief overview of the asset
2. **Fundamental Analysis**: Key metrics and valuation
3. **Technical Analysis**: Current trend and signals
4. **Risk Assessment**: Key risks to consider
5. **Recommendation**: BUY / HOLD / SELL with confidence (0-100)
6. **Price Target / Yield Expectation**: If applicable

Be specific, data-driven, and transparent about limitations.
"""

REPORT_DAILY_PROMPT = """Generate a DAILY portfolio report in natural language for an investor (NOT for developers).
Write in Portuguese (pt-BR), with clear interpretation, practical opinion, and actionability.

Portfolio Summary:
{portfolio_summary}

Market Highlights:
{market_data}

Output MUST be valid JSON and follow exactly this structure:
{
  "title": "Relatório Diário — YYYY-MM-DD",
  "summary": "2-4 frases, linguagem simples, com interpretação do dia.",
  "scorecards": [
    {
      "id": "portfolio_snapshot",
      "label": "Panorama da Carteira",
      "value": "PL R$ 13.372,56 | P/L +R$ 318,74 (+2,44%)",
      "status": "positive",
      "reason": "Curto racional do porquê esse status."
    },
    {
      "id": "allocation_drift",
      "label": "Drift de Alocação",
      "value": "Renda Fixa 86,8% (acima do alvo)",
      "status": "warning",
      "reason": "Explicação objetiva do desvio."
    },
    {
      "id": "risk_concentration",
      "label": "Risco de Concentração",
      "value": "Concentração moderada em renda fixa",
      "status": "warning",
      "reason": "Explicação objetiva do risco."
    },
    {
      "id": "macro_regime",
      "label": "Regime Macro",
      "value": "Selic alta favorece pós-fixados",
      "status": "neutral",
      "reason": "Leitura de CDI/Selic/IPCA para a carteira."
    }
  ],
  "action_items": [
    "Prioridade 1: ação concreta e curta.",
    "Prioridade 2: ação concreta e curta.",
    "Prioridade 3: ação concreta e curta."
  ],
  "confidence": {
    "level": "high|medium|low",
    "reason": "Por que o nível de confiança é esse."
  },
  "data_limitations": [
    "Limitação 1 dos dados disponíveis.",
    "Limitação 2 dos dados disponíveis."
  ],
  "sections": [
    {
      "title": "Performance da Carteira Hoje",
      "content": "Parágrafo interpretativo com números principais e leitura do que significam."
    },
    {
      "title": "Movimentos Relevantes",
      "content": "Parágrafo explicando principais contribuições/limitações de dados."
    },
    {
      "title": "Contexto de Mercado",
      "content": "Parágrafo conectando CDI/Selic/IPCA ao portfólio."
    },
    {
      "title": "Alertas e Ações Recomendadas",
      "content": "Lista curta em texto corrido com prioridades e próximos passos."
    },
    {
      "title": "Opinião do Modelo (Cenário Base)",
      "content": "Opinião objetiva com cenário base, riscos e nível de confiança."
    }
  ]
}

Rules:
- Do NOT return raw dictionaries/objects inside section content.
- Do NOT include code, JSON fragments, or key-value dumps in content.
- Be explicit about assumptions and data limitations.
- Keep scorecards concise and decision-oriented.
"""

REPORT_WEEKLY_PROMPT = """Generate a WEEKLY portfolio report in natural language for an investor (NOT for developers).
Write in Portuguese (pt-BR), with clear interpretation, practical opinion, and actionability.

Portfolio Summary:
{portfolio_summary}

Week Performance:
{weekly_data}

Output MUST be valid JSON and follow exactly this structure:
{
  "title": "Relatório Semanal — YYYY-MM-DD",
  "summary": "2-4 frases com leitura da semana.",
  "scorecards": [
    {
      "id": "weekly_performance",
      "label": "Desempenho da Semana",
      "value": "P/L semanal e direção",
      "status": "positive|neutral|warning|negative",
      "reason": "Interpretação curta do resultado."
    },
    {
      "id": "allocation_drift",
      "label": "Drift de Alocação",
      "value": "Classe acima/abaixo do alvo",
      "status": "neutral|warning",
      "reason": "Leitura curta do desvio."
    },
    {
      "id": "risk_overview",
      "label": "Visão de Risco",
      "value": "Concentração, liquidez, vencimentos",
      "status": "neutral|warning|negative",
      "reason": "Principal risco da semana."
    },
    {
      "id": "macro_impact",
      "label": "Impacto Macro",
      "value": "Efeito de CDI/Selic/IPCA na carteira",
      "status": "neutral|positive|warning",
      "reason": "Leitura macro aplicada ao portfólio."
    }
  ],
  "action_items": [
    "Prioridade 1 para a próxima semana.",
    "Prioridade 2 para a próxima semana.",
    "Prioridade 3 para a próxima semana."
  ],
  "confidence": {
    "level": "high|medium|low",
    "reason": "Por que o nível de confiança é esse."
  },
  "data_limitations": [
    "Limitação 1 dos dados disponíveis.",
    "Limitação 2 dos dados disponíveis."
  ],
  "sections": [
    { "title": "Resumo Semanal da Carteira", "content": "..." },
    { "title": "Desempenho por Classe de Ativo", "content": "..." },
    { "title": "Destaques e Pontos de Atenção", "content": "..." },
    { "title": "Macro e Juros (CDI/Selic/IPCA)", "content": "..." },
    { "title": "Renda Fixa: Vencimentos e Estratégia", "content": "..." },
    { "title": "Plano de Ação para a Próxima Semana", "content": "..." },
    { "title": "Opinião do Modelo e Nível de Confiança", "content": "..." }
  ]
}

Rules:
- Do NOT return raw dictionaries/objects inside section content.
- Do NOT include code, JSON fragments, or key-value dumps in content.
- Be explicit about assumptions and data limitations.
- Weekly content should include trend/progress context.
"""
