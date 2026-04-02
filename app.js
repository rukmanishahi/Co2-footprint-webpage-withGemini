/* ============================================================
   CO₂ DAILY TRACKER — JAVASCRIPT
   Sections:
   1. Init (date + ticker)
   2. API key localStorage helpers
   3. analyseDay()  — API call
   4. showError()
   5. renderResults() — renders all result UI
   6. Event listeners
   ============================================================ */


// ── 1. INIT ──────────────────────────────────────────────────

// Set today's date in masthead
document.getElementById('todayDate').textContent = new Date().toLocaleDateString('en-IN', {
  weekday: 'long',
  year: 'numeric',
  month: 'long',
  day: 'numeric'
});

// Build the scrolling ticker
const tickerFacts = [
  "🌡️ The last decade was the hottest on record",
  "🌊 Sea levels are rising ~3.7mm per year globally",
  "🌲 18 million acres of forest are lost every year",
  "☀️ Solar power costs have dropped 90% in a decade",
  "🚗 Transport accounts for 16% of global emissions",
  "🥩 Meat and dairy cause 14.5% of global emissions",
  "💡 Switching to LEDs cuts lighting energy use by 75%",
  "🏠 Buildings are responsible for ~40% of energy use worldwide",
  "🔋 Electric vehicles emit 50–70% less CO₂ over their lifetime",
  "🌾 Eating plant-based one day per week saves ~530kg CO₂/year",
];

const tickerInner = document.getElementById('tickerInner');

// Duplicate facts for seamless infinite loop
[...tickerFacts, ...tickerFacts].forEach(fact => {
  const el = document.createElement('span');
  el.className = 'ticker-item';
  el.innerHTML = `<span class="ticker-dot">◆</span>${fact}`;
  tickerInner.appendChild(el);
});

// Chart.js instance — kept at module scope so we can destroy/recreate
let chartInstance = null;


// ── 2. API KEY — localStorage helpers ────────────────────────

const KEY_STORAGE  = 'co2tracker_apikey';
const apiKeyInput  = document.getElementById('apiKey');
const apiKeyStatus = document.getElementById('apiKeyStatus');

// Load saved key on page start
function loadSavedKey() {
  const saved = localStorage.getItem(KEY_STORAGE);
  if (saved) {
    apiKeyInput.value = saved;
    showKeyStatus('✓ Key loaded — you are good to go', 'saved');
  }
}

// Save key to localStorage
function saveKey() {
  const key = apiKeyInput.value.trim();
  if (!key) return;
  localStorage.setItem(KEY_STORAGE, key);
  showKeyStatus("✓ Key saved — won't need to paste it again", 'saved');
}

// Remove key from localStorage
function forgetKey() {
  localStorage.removeItem(KEY_STORAGE);
  apiKeyInput.value = '';
  showKeyStatus('Key removed from browser', 'forgotten');
}

// Show a small inline status message
function showKeyStatus(message, type) {
  apiKeyStatus.textContent = message;
  apiKeyStatus.style.color = type === 'saved' ? '#a9e8b8' : '#edaeb8';
  clearTimeout(apiKeyStatus._timer);
  apiKeyStatus._timer = setTimeout(() => { apiKeyStatus.textContent = ''; }, 3000);
}

// Auto-save whenever the user types a valid-looking key
apiKeyInput.addEventListener('input', () => {
  if (apiKeyInput.value.trim().length > 20) saveKey();
});

// Run on page load
loadSavedKey();


// ── 3. ANALYSE DAY ───────────────────────────────────────────

async function analyseDay() {
  const apiKey   = document.getElementById('apiKey').value.trim();
  const text     = document.getElementById('dayInput').value.trim();
  const errorBox = document.getElementById('errorBox');
  const btn      = document.getElementById('analyseBtn');

  // Reset error
  errorBox.style.display = 'none';

  // Basic validation
  if (!apiKey) {
    showError('Please enter your Gemini API key at the top.');
    return;
  }
  if (text.length < 20) {
    showError('Please describe your day in a bit more detail.');
    return;
  }

  // Loading state
  btn.classList.add('loading');
  btn.innerHTML = 'Analysing... <span class="btn-arrow">⏳</span>';
  document.getElementById('loadingSection').style.display = 'block';
  document.getElementById('resultsSection').style.display = 'none';
  document.getElementById('resultsSection').classList.remove('visible');

  // Prompt — instructs the model to return only raw JSON
  const prompt = `You are a carbon footprint analyst. The user will describe their day in plain English.

Your job:
1. Parse every activity mentioned (food, travel, home appliances, digital usage, shopping, etc.)
2. If quantities are vague or not stated, infer reasonable typical amounts
3. Calculate CO2 emissions for each activity using standard IPCC/IEA emission factors relevant to India
4. Return ONLY a raw JSON object — no markdown, no code fences, no explanation, no preamble, no sign-off

The JSON must follow this exact structure:
{
  "activities": [
    { "name": "string describing activity", "co2_kg": number }
  ],
  "total_co2_kg": number,
  "top_category": "string",
  "home_tips": [
    { "title": "short title", "body": "1-2 sentence tip", "icon": "single emoji" },
    { "title": "short title", "body": "1-2 sentence tip", "icon": "single emoji" },
    { "title": "short title", "body": "1-2 sentence tip", "icon": "single emoji" }
  ],
  "area_tips": [
    { "title": "short title", "body": "1-2 sentence tip", "icon": "single emoji" },
    { "title": "short title", "body": "1-2 sentence tip", "icon": "single emoji" },
    { "title": "short title", "body": "1-2 sentence tip", "icon": "single emoji" }
  ]
}

Rules:
- Respond with ONLY the JSON object, nothing else
- co2_kg values must be plain numbers, not strings
- Home tips must be specifically based on what the user actually did today
- Area tips should be practical local community actions relevant to India
- Do not mention any AI, model, tool, or assistant in the output

User's day: ${text}`;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.2 }
        })
      }
    );

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err?.error?.message || `HTTP ${response.status}`);
    }

    const data = await response.json();

    // Extract text from Gemini response structure
    const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

    // Strip any accidental markdown fences
    const cleanText = rawText.replace(/```json|```/g, '').trim();
    const parsed    = JSON.parse(cleanText);

    renderResults(parsed);

  } catch (error) {
    showError('Something went wrong: ' + error.message);
  } finally {
    btn.classList.remove('loading');
    btn.innerHTML = 'Analyse My Day <span class="btn-arrow">→</span>';
    document.getElementById('loadingSection').style.display = 'none';
  }
}


// ── 4. SHOW ERROR ─────────────────────────────────────────────

function showError(message) {
  const box = document.getElementById('errorBox');
  box.textContent = '⚠ ' + message;
  box.style.display = 'block';
}


// ── 5. RENDER RESULTS ─────────────────────────────────────────

function renderResults(data) {
  const total = parseFloat(data.total_co2_kg) || 0;

  // -- Total number
  document.getElementById('totalNumber').textContent = total.toFixed(1);

  // -- Verdict badge
  const badge = document.getElementById('verdictBadge');
  badge.className = 'verdict-badge';
  if (total < 5) {
    badge.classList.add('verdict-green');
    badge.textContent = '✓ Low Impact Day';
  } else if (total <= 15) {
    badge.classList.add('verdict-amber');
    badge.textContent = '⚡ Moderate Impact';
  } else {
    badge.classList.add('verdict-red');
    badge.textContent = '▲ High Impact Day';
  }

  // -- Comparison line
  const kmEquivalent      = Math.round(total / 0.21);
  const burgersEquivalent = (total / 2.5).toFixed(1);
  document.getElementById('comparisonLine').textContent =
    `That's roughly equivalent to driving ${kmEquivalent} km, or eating ${burgersEquivalent} beef burgers.`;

  // -- Donut chart
  const activities = data.activities || [];
  const labels     = activities.map(a => a.name);
  const values     = activities.map(a => parseFloat(a.co2_kg) || 0);
  const palette    = [
    '#ddd4f5', '#f5d4d4', '#d4f0e0', '#f5ead4', '#c4b8ed',
    '#edaeb8', '#a9e8b8', '#edcc8c', '#b8a9e8', '#e8b8b8'
  ];

  if (chartInstance) chartInstance.destroy();

  const ctx = document.getElementById('donutChart').getContext('2d');
  chartInstance = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data: values,
        backgroundColor: palette.slice(0, values.length),
        borderColor: '#0d0d0d',
        borderWidth: 2,
        hoverOffset: 6
      }]
    },
    options: {
      cutout: '62%',
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            font: { family: "'DM Mono', monospace", size: 10 },
            padding: 12,
            boxWidth: 12
          }
        },
        tooltip: {
          callbacks: {
            label: ctx => ` ${ctx.parsed.toFixed(2)} kg CO₂`
          }
        }
      }
    }
  });

  // -- Activity breakdown cards
  const breakdownGrid = document.getElementById('breakdownGrid');
  breakdownGrid.innerHTML = '';
  activities.forEach(activity => {
    const card = document.createElement('div');
    card.className = 'breakdown-item';
    card.innerHTML = `
      <span class="bi-name">${activity.name}</span>
      <div>
        <span class="bi-val">${parseFloat(activity.co2_kg).toFixed(2)}</span>
        <span class="bi-unit">kg CO₂</span>
      </div>`;
    breakdownGrid.appendChild(card);
  });

  // -- At-home tip cards
  const homeTipsContainer = document.getElementById('homeTips');
  homeTipsContainer.innerHTML = '';
  (data.home_tips || []).forEach(tip => {
    const card = document.createElement('div');
    card.className = 'tip-card home-tip';
    card.innerHTML = `
      <span class="tip-icon">${tip.icon || '🌱'}</span>
      <h3 class="tip-title">${tip.title}</h3>
      <p class="tip-body">${tip.body}</p>`;
    homeTipsContainer.appendChild(card);
  });

  // -- Local area tip cards
  const areaTipsContainer = document.getElementById('areaTips');
  areaTipsContainer.innerHTML = '';
  (data.area_tips || []).forEach(tip => {
    const card = document.createElement('div');
    card.className = 'tip-card area-tip';
    card.innerHTML = `
      <span class="tip-icon">${tip.icon || '🌍'}</span>
      <h3 class="tip-title">${tip.title}</h3>
      <p class="tip-body">${tip.body}</p>`;
    areaTipsContainer.appendChild(card);
  });

  // -- Show results with fade-in animation
  const resultsSection = document.getElementById('resultsSection');
  resultsSection.style.display = 'block';
  requestAnimationFrame(() => requestAnimationFrame(() => {
    resultsSection.classList.add('visible');
    resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }));
}


// ── 6. EVENT LISTENERS ────────────────────────────────────────

// Ctrl + Enter shortcut to submit
document.getElementById('dayInput').addEventListener('keydown', e => {
  if (e.ctrlKey && e.key === 'Enter') analyseDay();
});

// Forget key button
document.getElementById('forgetKeyBtn').addEventListener('click', forgetKey);
