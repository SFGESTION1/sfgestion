const Groq = require('groq-sdk');
const express = require('express');
const path = require('path');
const nodemailer = require('nodemailer');
const axios = require('axios');
const cheerio = require('cheerio');

const app = express();
const client = new Groq({ apiKey: process.env.GROQ_API_KEY });

const MODEL_MAIN = 'llama-3.3-70b-versatile';
const MODEL_FAST = 'llama-3.1-8b-instant';

const GMAIL_USER = 'stanfrey27@gmail.com';
const GMAIL_PASS = process.env.GMAIL_PASSWORD || 'znle eiqo eltx gohv';

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: { user: GMAIL_USER, pass: GMAIL_PASS }
});

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
      'Prospecte 5 PME à Chantilly sans site web et envoie les emails',
      'Crée un site vitrine + emails de démarchage',
      'Analyse mes priorités admin de la semaine'
    ],
    systemPrompt: `Tu es Max, Chef d'Orchestre d'une équipe IA spécialisée pour un créateur de sites web et gestionnaire admin/pré-comptabilité pour PME/TPE. Tu manages:
- Alex (Prospection): emails de démarchage, relances, séquences pour convaincre les PME/TPE
- Sam (Sites Web): briefs de sites, structures de pages, prompts Claude/ChatGPT pour coder des sites
- Clara (Rédaction Web): textes pour sites clients, pages d'accueil, services, SEO
- Nina (Admin): devis, contrats, courriers professionnels
- Hugo (Pré-comptabilité): suivi de trésorerie, catégorisation de dépenses, rapports pour TPE/PME

Tu as accès aux outils suivants:
- delegate_to_agent: déléguer une tâche à un agent
- find_companies: trouver de vraies PME/TPE sans site web à Chantilly
- send_email: envoyer un vrai email depuis stanfrey27@gmail.com

Quand on te demande de prospecter:
1. Utilise find_companies pour trouver de vraies entreprises
2. Délègue à Alex pour rédiger les emails personnalisés
3. Utilise send_email pour envoyer chaque email

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

Quand on te donne le nom et le secteur d'une vraie entreprise, rédige un email de prospection ultra-personnalisé.
Format de réponse: SUJET: [sujet de l'email] puis le corps de l'email.
Ton style: direct, humain, sans jargon. Mets en avant la valeur business d'un site.
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

Pour chaque demande, tu fournis:
1. Le brief complet du site
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
- Textes optimisés SEO avec mots-clés locaux et sectoriels
- Calls-to-action efficaces

Ton style: clair, chaleureux, professionnel.
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
- Courriers professionnels et documents administratifs

Format: documents complets et prêts à l'emploi, champs à compléter entre [crochets].
Réponds en français.`
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
- Tableaux de suivi de trésorerie
- Catégorisation de dépenses
- Rapports financiers simplifiés

Réponds en français avec des données claires et actionnables.`
  }
};

const chatHistories = {};
const agentStats = {};
Object.keys(AGENTS).forEach(id => {
  chatHistories[id] = [];
  agentStats[id] = { deliverables: AGENTS[id].deliverables, tokens: AGENTS[id].tokens, cost: 0 };
});

// ─── Scraping Pages Jaunes ────────────────────────────
async function findCompanies(city = 'Chantilly', category = '') {
  try {
    const query = category ? encodeURIComponent(category) : '';
    const location = encodeURIComponent(city);
    const url = `https://www.pagesjaunes.fr/annuaire/cherche?quoiqui=${query}&ou=${location}&univers=pagesjaunes`;

    const { data } = await axios.get(url, {
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'fr-FR,fr;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br'
      }
    });

    const $ = cheerio.load(data);
    const companies = [];

    $('.bi-content, .result-item, [class*="bi-"]').each((i, el) => {
      if (companies.length >= 10) return false;

      const name = $(el).find('[class*="denomination"], [class*="name"], h3, .ens-name').first().text().trim();
      const address = $(el).find('[class*="address"], [class*="adresse"]').first().text().trim();
      const phone = $(el).find('[class*="phone"], [class*="tel"]').first().text().trim();
      const hasWebsite = $(el).find('a[href*="http"]:not([href*="pagesjaunes"])').length > 0;

      if (name && name.length > 2 && !hasWebsite) {
        companies.push({ name, address: address || city, phone: phone || 'Non renseigné', sector: category || 'Commerce/Services' });
      }
    });

    // Si scraping échoue, utilise l'API gouvernementale française
    if (companies.length === 0) {
      return await findCompaniesGovAPI(city);
    }

    return companies;
  } catch (err) {
    console.error('Pages Jaunes scraping failed:', err.message);
    return await findCompaniesGovAPI(city);
  }
}

// Fallback: API officielle entreprises.data.gouv.fr
async function findCompaniesGovAPI(city = 'Chantilly') {
  try {
    const url = `https://recherche-entreprises.api.gouv.fr/search?q=${encodeURIComponent(city)}&per_page=10&categorie_entreprise=PME,TPE`;
    const { data } = await axios.get(url, { timeout: 8000 });

    return (data.results || []).slice(0, 10).map(c => ({
      name: c.nom_complet || c.nom_raison_sociale,
      address: c.siege?.adresse || city,
      phone: 'À rechercher',
      sector: c.activite_principale_libelle || 'Commerce/Services',
      siren: c.siren
    })).filter(c => c.name);
  } catch (err) {
    console.error('Gov API failed:', err.message);
    return [];
  }
}

// ─── Envoi Gmail ──────────────────────────────────────
async function sendEmail(to, subject, body) {
  const info = await transporter.sendMail({
    from: `"Stan - SFGestion" <${GMAIL_USER}>`,
    to,
    subject,
    text: body,
    html: body.replace(/\n/g, '<br>')
  });
  return info.messageId;
}

// ─── Sub-agent call ───────────────────────────────────
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

// ─── Main chat endpoint ───────────────────────────────
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
      const orchestratorTools = [
        {
          type: 'function',
          function: {
            name: 'delegate_to_agent',
            description: 'Délègue une tâche à un agent spécialisé',
            parameters: {
              type: 'object',
              properties: {
                agent_id: { type: 'string', enum: ['alex', 'sam', 'clara', 'nina', 'hugo'] },
                task: { type: 'string' }
              },
              required: ['agent_id', 'task']
            }
          }
        },
        {
          type: 'function',
          function: {
            name: 'find_companies',
            description: 'Trouve de vraies PME/TPE sans site web à Chantilly',
            parameters: {
              type: 'object',
              properties: {
                category: { type: 'string', description: 'Secteur d\'activité (ex: restaurant, plombier, coiffeur). Laisser vide pour tous secteurs.' }
              },
              required: []
            }
          }
        },
        {
          type: 'function',
          function: {
            name: 'send_email',
            description: 'Envoie un vrai email depuis stanfrey27@gmail.com',
            parameters: {
              type: 'object',
              properties: {
                to: { type: 'string', description: 'Adresse email du destinataire' },
                subject: { type: 'string', description: 'Sujet de l\'email' },
                body: { type: 'string', description: 'Corps de l\'email' }
              },
              required: ['to', 'subject', 'body']
            }
          }
        }
      ];

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
            const args = JSON.parse(toolCall.function.arguments || '{}');

            if (toolCall.function.name === 'delegate_to_agent') {
              const { agent_id, task } = args;
              const name = agentNames[agent_id] || agent_id;
              send({ type: 'delegation_start', agent_id, agent_name: name, task });
              let agentResponse = '';
              await callSubAgent(agent_id, task, (id, text) => {
                agentResponse += text;
                send({ type: 'agent_stream', agent_id: id, agent_name: name, text });
              });
              send({ type: 'delegation_end', agent_id, agent_name: name });
              toolResults.push({ role: 'tool', tool_call_id: toolCall.id, content: agentResponse });
            }

            else if (toolCall.function.name === 'find_companies') {
              send({ type: 'orchestrator', text: '\n🔍 Recherche de vraies entreprises à Chantilly...\n' });
              const companies = await findCompanies('Chantilly', args.category || '');
              const result = companies.length > 0
                ? `Entreprises trouvées à Chantilly sans site web:\n${companies.map((c, i) => `${i + 1}. ${c.name} — ${c.address} — Tél: ${c.phone} — Secteur: ${c.sector}`).join('\n')}`
                : 'Aucune entreprise trouvée. Utilise des exemples réalistes pour Chantilly.';
              send({ type: 'orchestrator', text: `\n✅ ${companies.length} entreprises trouvées\n` });
              toolResults.push({ role: 'tool', tool_call_id: toolCall.id, content: result });
            }

            else if (toolCall.function.name === 'send_email') {
              const { to, subject, body } = args;
              try {
                send({ type: 'orchestrator', text: `\n📧 Envoi de l'email à ${to}...\n` });
                await sendEmail(to, subject, body);
                send({ type: 'orchestrator', text: `✅ Email envoyé à ${to}\n` });
                toolResults.push({ role: 'tool', tool_call_id: toolCall.id, content: `Email envoyé avec succès à ${to}` });
              } catch (err) {
                send({ type: 'orchestrator', text: `❌ Erreur envoi email: ${err.message}\n` });
                toolResults.push({ role: 'tool', tool_call_id: toolCall.id, content: `Erreur: ${err.message}` });
              }
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
    cost: 0
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
