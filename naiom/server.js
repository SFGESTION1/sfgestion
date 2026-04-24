const Groq = require('groq-sdk');
const express = require('express');
const path = require('path');

const app = express();
const client = new Groq({ apiKey: process.env.GROQ_API_KEY });

const MODEL_MAIN = 'llama-3.3-70b-versatile';
const MODEL_FAST = 'llama-3.1-8b-instant';

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const AGENTS = {
  max: {
    id: 'max',
    name: 'Max',
    role: "CHEF D'ORCHESTRE",
    emoji: '🎭',
    description: "Coordonne ton équipe IA pour créer des sites, prospecter et gérer l'admin.",
    status: 'online',
    deliverables: 0,
    tokens: 0,
    cost: 0,
    isOrchestrator: true,
    suggestions: [
      'Lance une campagne de prospection pour des PME locales',
      'Crée un site vitrine + emails de démarchage',
      'Analyse mes priorités admin de la semaine'
    ],
    systemPrompt: `Tu es Max, Chef d'Orchestre d'une équipe IA spécialisée pour un créateur de sites web et gestionnaire admin/pré-comptabilité pour PME/TPE. Tu manages:
- Alex (Prospection): emails de démarchage, relances, séquences pour convaincre les PME/TPE
- Sam (Sites Web): briefs de sites, structures de pages, prompts Claude/ChatGPT pour coder des sites
- Clara (Rédaction Web): textes pour sites clients, pages d'accueil, services, SEO
- Nina (Admin): devis, contrats, courriers professionnels
- Hugo (Pré-comptabilité): suivi de trésorerie, catégorisation de dépenses, rapports pour TPE/PME

Ton rôle: analyser chaque demande, décider quel(s) agent(s) activer, coordonner leur travail et synthétiser les résultats.

Quand tu reçois une demande:
1. Identifie les agents concernés
2. Délègue les tâches avec des instructions précises via l'outil delegate_to_agent
3. Synthétise les résultats en une réponse cohérente

Réponds toujours en français de manière professionnelle et structurée.`
  },
  alex: {
    id: 'alex',
    name: 'Alex',
    role: 'PROSPECTION',
    emoji: '📨',
    description: 'Emails de démarchage, relances et séquences pour convaincre les PME/TPE.',
    status: 'online',
    deliverables: 5,
    tokens: 32000,
    cost: 0,
    suggestions: [
      "Écris un email de prospection pour un restaurant sans site web",
      "Rédige une relance pour un prospect qui n'a pas répondu",
      "Crée une séquence de 3 emails pour prospecter des artisans"
    ],
    systemPrompt: `Tu es Alex, expert en prospection commerciale pour un créateur de sites web ciblant des PME/TPE. Tu maîtrises:
- Emails froids efficaces et personnalisés pour convaincre des petites entreprises
- Séquences de prospection multi-emails (J+0, J+3, J+7)
- Relances professionnelles non-intrusives
- Scripts d'approche adaptés à chaque secteur (artisans, commerces, professions libérales)

Ton style: direct, humain, sans jargon. Tu mets en avant la valeur business d'un site (visibilité, crédibilité, nouveaux clients).
Toujours inclure un appel à l'action simple et clair.
Réponds en français.`
  },
  sam: {
    id: 'sam',
    name: 'Sam',
    role: 'SITES WEB',
    emoji: '💻',
    description: 'Briefs, structure de sites et prompts Claude/ChatGPT pour créer des sites.',
    status: 'online',
    deliverables: 4,
    tokens: 28000,
    cost: 0,
    suggestions: [
      "Génère le brief complet pour un site vitrine de plombier",
      "Structure les pages d'un site pour un cabinet comptable",
      "Prompts Claude pour coder un site e-commerce simple"
    ],
    systemPrompt: `Tu es Sam, expert en création de sites web pour PME/TPE. Tu maîtrises:
- Briefs détaillés pour sites vitrines, e-commerce, portfolios
- Structure de pages (homepage, services, à propos, contact, blog)
- Prompts optimisés pour Claude et ChatGPT pour générer du code HTML/CSS/JS
- Architecture et UX adaptées aux petites entreprises

Pour chaque demande, tu fournis:
1. Le brief complet du site (objectif, cible, ton, pages)
2. La structure détaillée page par page
3. Les prompts prêts à copier dans Claude ou ChatGPT

Réponds en français avec des livrables directement utilisables.`
  },
  clara: {
    id: 'clara',
    name: 'Clara',
    role: 'RÉDACTION WEB',
    emoji: '✍️',
    description: 'Textes pour sites clients : accueil, services, à propos, SEO.',
    status: 'online',
    deliverables: 8,
    tokens: 52000,
    cost: 0,
    suggestions: [
      "Rédige la page d'accueil pour un électricien indépendant",
      "Crée les textes SEO pour une boulangerie artisanale",
      "Écris la page 'À propos' pour un cabinet de conseil"
    ],
    systemPrompt: `Tu es Clara, rédactrice web spécialisée pour les sites de PME/TPE. Tu maîtrises:
- Pages d'accueil percutantes avec proposition de valeur claire
- Pages services détaillées avec bénéfices clients
- Pages "À propos" humaines et rassurantes
- Textes optimisés SEO avec mots-clés locaux et sectoriels
- Calls-to-action efficaces

Ton style: clair, chaleureux, professionnel. Tu parles le langage des clients (pas de jargon).
Réponds en français.`
  },
  nina: {
    id: 'nina',
    name: 'Nina',
    role: 'ADMIN',
    emoji: '📋',
    description: 'Devis, contrats, courriers professionnels pour toi et tes clients PME/TPE.',
    status: 'online',
    deliverables: 6,
    tokens: 38000,
    cost: 0,
    suggestions: [
      "Génère un devis de création de site pour un restaurant",
      "Rédige un contrat de maintenance mensuelle",
      "Crée une lettre de relance pour une facture impayée"
    ],
    systemPrompt: `Tu es Nina, assistante administrative spécialisée pour un freelance créateur de sites web et gestionnaire admin pour PME/TPE. Tu maîtrises:
- Devis de création et refonte de sites web
- Contrats de prestation (création, maintenance, SEO)
- Courriers professionnels (relances, mises en demeure, confirmation de commande)
- Documents administratifs pour PME/TPE

Format de réponse: documents complets et directement utilisables, champs à compléter entre [crochets].
Réponds en français avec des documents professionnels et prêts à l'emploi.`
  },
  hugo: {
    id: 'hugo',
    name: 'Hugo',
    role: 'PRÉ-COMPTABILITÉ',
    emoji: '📊',
    description: 'Suivi de trésorerie, catégorisation et rapports simples pour TPE/PME.',
    status: 'online',
    deliverables: 3,
    tokens: 22000,
    cost: 0,
    suggestions: [
      "Crée un tableau de suivi de trésorerie mensuel",
      "Catégorise ces dépenses pour la pré-comptabilité",
      "Génère un rapport financier simplifié pour un client TPE"
    ],
    systemPrompt: `Tu es Hugo, expert en pré-comptabilité et suivi financier pour PME/TPE. Tu maîtrises:
- Tableaux de suivi de trésorerie (entrées/sorties)
- Catégorisation de dépenses (charges fixes, variables, investissements)
- Rapports financiers simplifiés pour dirigeants non-comptables
- Préparation de données pour le comptable

Format de réponse:
## 💰 Situation financière
[Résumé clair]

## 📋 Détail par catégorie
[Tableau structuré]

## ⚡ Actions prioritaires
[Top 3 actions]

Réponds en français avec des données claires et actionnables.`
  }
};

const chatHistories = {};
const agentStats = {};

Object.keys(AGENTS).forEach(id => {
  chatHistories[id] = [];
  agentStats[id] = { deliverables: AGENTS[id].deliverables, tokens: AGENTS[id].tokens, cost: 0 };
});

async function callSubAgent(agentId, task, streamCallback) {
  const agent = AGENTS[agentId];
  if (!agent) throw new Error(`Agent ${agentId} not found`);

  const stream = await client.chat.completions.create({
    model: MODEL_FAST,
    max_tokens: 1024,
    messages: [
      { role: 'system', content: agent.systemPrompt },
      { role: 'user', content: task }
    ],
    stream: true
  });

  let fullResponse = '';
  for await (const chunk of stream) {
    const text = chunk.choices[0]?.delta?.content || '';
    if (text) {
      fullResponse += text;
      if (streamCallback) streamCallback(agentId, text);
    }
  }

  agentStats[agentId].deliverables += 1;
  agentStats[agentId].tokens += Math.round(fullResponse.length / 4);
  return fullResponse;
}

app.post('/api/chat/:agentId', async (req, res) => {
  const { agentId } = req.params;
  const { message } = req.body;

  const agent = AGENTS[agentId];
  if (!agent) return res.status(404).json({ error: 'Agent not found' });

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');

  const send = (data) => res.write(`data: ${JSON.stringify(data)}\n\n`);

  try {
    if (!chatHistories[agentId]) chatHistories[agentId] = [];
    chatHistories[agentId].push({ role: 'user', content: message });

    if (agent.isOrchestrator) {
      const orchestratorTools = [{
        type: 'function',
        function: {
          name: 'delegate_to_agent',
          description: 'Délègue une tâche à un agent spécialisé',
          parameters: {
            type: 'object',
            properties: {
              agent_id: {
                type: 'string',
                enum: ['alex', 'sam', 'clara', 'nina', 'hugo'],
                description: "ID de l'agent à activer"
              },
              task: {
                type: 'string',
                description: "Tâche précise à confier à l'agent"
              }
            },
            required: ['agent_id', 'task']
          }
        }
      }];

      const agentNames = { alex: 'Alex', sam: 'Sam', clara: 'Clara', nina: 'Nina', hugo: 'Hugo' };

      let messages = [
        { role: 'system', content: agent.systemPrompt },
        ...chatHistories[agentId]
      ];
      let continueLoop = true;

      while (continueLoop) {
        const response = await client.chat.completions.create({
          model: MODEL_MAIN,
          max_tokens: 2048,
          messages,
          tools: orchestratorTools,
          tool_choice: 'auto'
        });

        const choice = response.choices[0];
        const assistantMessage = choice.message;

        if (assistantMessage.content) {
          send({ type: 'orchestrator', text: assistantMessage.content });
        }

        if (choice.finish_reason === 'tool_calls' && assistantMessage.tool_calls) {
          messages.push(assistantMessage);
          const toolResults = [];

          for (const toolCall of assistantMessage.tool_calls) {
            if (toolCall.function.name === 'delegate_to_agent') {
              const { agent_id, task } = JSON.parse(toolCall.function.arguments);
              const name = agentNames[agent_id] || agent_id;

              send({ type: 'delegation_start', agent_id, agent_name: name, task });

              let agentResponse = '';
              await callSubAgent(agent_id, task, (id, text) => {
                agentResponse += text;
                send({ type: 'agent_stream', agent_id: id, agent_name: name, text });
              });

              send({ type: 'delegation_end', agent_id, agent_name: name });

              toolResults.push({
                role: 'tool',
                tool_call_id: toolCall.id,
                content: agentResponse
              });
            }
          }

          messages.push(...toolResults);
        } else {
          continueLoop = false;
          const finalText = assistantMessage.content || '';
          chatHistories[agentId].push({ role: 'assistant', content: finalText });
          agentStats[agentId].deliverables += 1;
        }
      }

      send({ type: 'done' });
      res.end();
    } else {
      const stream = await client.chat.completions.create({
        model: MODEL_MAIN,
        max_tokens: 2048,
        messages: [
          { role: 'system', content: agent.systemPrompt },
          ...chatHistories[agentId]
        ],
        stream: true
      });

      let fullResponse = '';
      for await (const chunk of stream) {
        const text = chunk.choices[0]?.delta?.content || '';
        if (text) {
          fullResponse += text;
          send({ type: 'text', text });
        }
      }

      chatHistories[agentId].push({ role: 'assistant', content: fullResponse });
      agentStats[agentId].deliverables += 1;
      agentStats[agentId].tokens += Math.round(fullResponse.length / 4);

      send({ type: 'done' });
      res.end();
    }
  } catch (err) {
    console.error('Chat error:', err);
    send({ type: 'error', message: err.message });
    res.end();
  }
});

app.get('/api/agents', (req, res) => {
  res.json(Object.values(AGENTS).map(a => ({
    ...a,
    deliverables: agentStats[a.id]?.deliverables ?? a.deliverables,
    tokens: agentStats[a.id]?.tokens ?? a.tokens,
    cost: agentStats[a.id]?.cost ?? 0
  })));
});

app.get('/api/chat/:agentId/history', (req, res) => {
  res.json(chatHistories[req.params.agentId] || []);
});

app.delete('/api/chat/:agentId/history', (req, res) => {
  chatHistories[req.params.agentId] = [];
  res.json({ success: true });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`\n🚀 SFGestion Platform → http://localhost:${PORT}\n`);
});
