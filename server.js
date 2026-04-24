const express = require('express');
const cors = require('cors');

const app = express();
app.use(express.json());
app.use(cors({ origin: process.env.FRONTEND_URL || '*' }));

app.post('/analyze', async (req, res) => {
  const { system_description, framework } = req.body;

  if (!system_description?.trim()) {
    return res.status(400).json({ error: 'system_description is required' });
  }

  const prompt = `You are a senior security architect performing a formal threat model.

Analyze the following system and identify security threats using the ${framework || 'STRIDE+DREAD'} framework.

System description:
"""
${system_description}
"""

Return ONLY a valid JSON object with this exact structure (no markdown, no explanation):
{
  "threats": [
    {
      "name": "Short threat name",
      "stride_category": "One of: Spoofing, Tampering, Repudiation, Information Disclosure, Denial of Service, Elevation of Privilege",
      "severity": "One of: Critical, High, Medium, Low",
      "component": "Affected component or layer",
      "description": "2-3 sentence description of the threat and how it could be exploited",
      "mitigation": "Specific, actionable mitigation recommendation",
      "dread_score": 7,
      "dread": {
        "damage": 8,
        "reproducibility": 7,
        "exploitability": 6,
        "affected_users": 9,
        "discoverability": 7,
        "likelihood": 6
      }
    }
  ]
}

Rules:
- Identify 6-10 distinct threats
- Be specific to the described system, not generic
- DREAD scores are integers 1-10
- dread_score is the average of the 6 DREAD values
- Order threats by severity (Critical first)
- Return only the JSON object, nothing else`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4000,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    const data = await response.json();
    if (data.error) return res.status(500).json({ error: data.error.message });

    const text = data.content?.find(b => b.type === 'text')?.text || '';
    const clean = text.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(clean);

    res.json(parsed);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/health', (_, res) => res.json({ ok: true }));

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`ThreatLens API running on port ${PORT}`));
