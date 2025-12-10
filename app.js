// =====================
// CONFIG
// =====================
const HISTORY_KEY = "mindscan_history_v2";
const PROFILE_KEY = "mindscan_profile_v1";

// Your deployed Cloudflare Worker (Gemini) URL
const COACH_API_URL = "https://dark-dream-6139.h23a1768.workers.dev/";

// =====================
// UTILITIES & STORAGE
// =====================
function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function saveProfile(profile) {
  localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
}

function loadProfile() {
  try {
    const p = JSON.parse(localStorage.getItem(PROFILE_KEY));
    return p || {};
  } catch {
    return {};
  }
}

function loadHistory() {
  try {
    const h = JSON.parse(localStorage.getItem(HISTORY_KEY));
    return Array.isArray(h) ? h : [];
  } catch {
    return [];
  }
}

function saveHistory(history) {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
}

// =====================
// PROFILE HANDLING
// =====================
const profileForm = document.getElementById("profileForm");
const saveProfileBtn = document.getElementById("saveProfileBtn");
const profileStatus = document.getElementById("profileStatus");

const existingProfile = loadProfile();
if (existingProfile && Object.keys(existingProfile).length) {
  Array.from(profileForm.elements).forEach((el) => {
    if (!el.name) return;
    if (existingProfile[el.name] != null) {
      el.value = existingProfile[el.name];
    }
  });
  profileStatus.textContent = "Profile loaded from this device.";
}

saveProfileBtn?.addEventListener("click", () => {
  const formData = new FormData(profileForm);
  const profile = {};
  for (const [key, val] of formData.entries()) {
    profile[key] = val.toString();
  }
  if (!profile.name || !profile.age || !profile.gender) {
    profileStatus.textContent = "Please fill in name, age and gender.";
    profileStatus.style.color = "#fecaca";
    return;
  }
  saveProfile(profile);
  profileStatus.textContent = "Profile saved. You can run MindScan now.";
  profileStatus.style.color = "#4ade80";
});

// =====================
// MAIN SCAN / ALGORITHM
// =====================
const scanForm = document.getElementById("scanForm");
const clearBtn = document.getElementById("clearBtn");

const resultCard = document.getElementById("resultCard");
const wellnessAvatar = document.getElementById("wellnessAvatar");
const avatarText = document.getElementById("avatarText");
const scoreBarInner = document.getElementById("scoreBarInner");
const scoreBarLabel = document.getElementById("scoreBarLabel");
const resultBadge = document.getElementById("resultBadge");
const resultLabel = document.getElementById("resultLabel");
const resultScore = document.getElementById("resultScore");
const resultMessage = document.getElementById("resultMessage");
const mindMap = document.getElementById("mindMap");
const actionPlanList = document.getElementById("actionPlanList");

const extraTipsBtn = document.getElementById("extraTipsBtn");
const extraTipsList = document.getElementById("extraTipsList");

let history = loadHistory();

// DASS-inspired scoring + lifestyle
function computeMindScanResult(values) {
  const MD_raw = values.q1 + values.q2 + values.q3; // mood/depression
  const AN_raw = values.q4 + values.q5 + values.q6; // anxiety
  const ST_raw = values.q7 + values.q8 + values.q9; // stress/tension

  const sleep_diff = 3 - values.sleep;
  const screen_diff = values.screen - 2;
  const move_diff = 1 - values.move;
  const support_diff = 1 - values.support;

  let MD =
    MD_raw +
    0.7 * sleep_diff +
    0.5 * screen_diff -
    0.7 * move_diff -
    0.8 * support_diff;
  let AN =
    AN_raw +
    0.5 * sleep_diff +
    0.8 * screen_diff -
    0.6 * move_diff;
  let ST =
    ST_raw +
    1.0 * sleep_diff +
    1.0 * screen_diff -
    0.5 * move_diff;

  // normalise to 0–12
  MD = clamp((MD / 9) * 12, 0, 12);
  AN = clamp((AN / 9) * 12, 0, 12);
  ST = clamp((ST / 9) * 12, 0, 12);

  const symptomIndex = (MD + AN + ST) / 3;
  const wellnessScore = clamp(12 - symptomIndex, 0, 12);

  let label;
  if (wellnessScore < 4) label = "Red – high stress risk";
  else if (wellnessScore < 8)
    label = "Yellow – mild to moderate stress";
  else label = "Green – doing okay";

  return {
    wellnessScore,
    label,
    MD,
    AN,
    ST,
    MD_raw,
    AN_raw,
    ST_raw,
    symptomIndex,
  };
}

function buildInsights(current, historyArr) {
  let profileType = "Balanced pattern";
  const { MD, AN, ST } = current;
  const maxAxis = Math.max(MD, AN, ST);
  if (maxAxis === MD) profileType = "Low mood pattern";
  else if (maxAxis === AN) profileType = "Anxiety / worry pattern";
  else if (maxAxis === ST) profileType = "Overload / tension pattern";

  let riskBand = "low";
  if (current.symptomIndex >= 8) riskBand = "high";
  else if (current.symptomIndex >= 4) riskBand = "medium";

  // trend last 7 days
  const last7 = historyArr.slice(-7);
  const scores = last7.map((h) => h.symptomIndex);
  let trendText = "Not enough data for trend yet.";
  if (scores.length >= 4) {
    const mid = Math.floor(scores.length / 2);
    const firstAvg =
      scores.slice(0, mid).reduce((a, b) => a + b, 0) / mid;
    const lastAvg =
      scores.slice(mid).reduce((a, b) => a + b, 0) /
      (scores.length - mid);
    const diff = lastAvg - firstAvg;
    if (diff > 1) {
      trendText =
        "Your stress symptoms are rising compared to earlier this week.";
    } else if (diff < -1) {
      trendText =
        "Your pattern is improving compared to earlier this week.";
    } else {
      trendText =
        "Your level is fairly stable over the past few days.";
    }
  }

  // simple prediction
  let predictionText =
    "After one scan it’s still too early to predict tomorrow.";
  if (historyArr.length >= 3) {
    const last3 = historyArr.slice(-3).map((h) => h.symptomIndex);
    const first = last3[0];
    const last = last3[2];
    const trend = last - first;
    const predSymptom = clamp(last + 0.6 * trend, 0, 12);
    const _predWell = clamp(12 - predSymptom, 0, 12);
    if (trend > 0.8) {
      predictionText =
        "If nothing changes, tomorrow may feel a bit heavier. Small actions today can help soften it.";
    } else if (trend < -0.8) {
      predictionText =
        "If you keep your current habits, tomorrow is likely to feel slightly lighter than today.";
    } else {
      predictionText =
        "Your pattern is quite steady, tomorrow will likely feel similar to today unless something big changes.";
    }
  }

  let plan = [];
  if (profileType === "Low mood pattern") {
    plan = [
      "Keep a small daily routine: choose 1–3 simple tasks you can finish.",
      "Add at least one pleasant or meaningful activity (hobby, prayer, nature, music).",
      "Limit long isolation; try to speak with at least one person you trust.",
      "If this feeling continues for 2 weeks or gets worse, consider talking to a counsellor.",
    ];
  } else if (profileType === "Anxiety / worry pattern") {
    plan = [
      "Practise 4–4–4 breathing when your body feels tense.",
      "Reduce very stimulating content late at night (caffeine, horror videos, intense games).",
      "Write worries down and break them into small steps, focus only on the first step.",
      "If fear or panic stops daily activities, please seek professional support.",
    ];
  } else if (profileType === "Overload / tension pattern") {
    plan = [
      "Write down all your tasks, then highlight only the top 3 for today.",
      "Schedule short stretch or walk breaks every 60–90 minutes.",
      "Set a cut-off time at night to close your laptop and let your brain cool down.",
      "Ask for help to reprioritise work if deadlines feel impossible.",
    ];
  } else {
    plan = [
      "Keep the healthy habits that are already working for you.",
      "Notice which days feel easier and copy the same sleep, screen and study pattern.",
      "Use MindScan on tougher weeks to catch early signs of overload.",
    ];
  }

  return {
    profileType,
    riskBand,
    trendText,
    predictionText,
    plan,
  };
}

scanForm?.addEventListener("submit", (e) => {
  e.preventDefault();
  const data = new FormData(scanForm);
  const vals = {};
  for (let i = 1; i <= 9; i++) {
    vals[`q${i}`] = Number(data.get(`q${i}`));
  }
  vals.sleep = Number(data.get("sleep"));
  vals.screen = Number(data.get("screen"));
  vals.move = Number(data.get("move"));
  vals.support = Number(data.get("support"));

  const result = computeMindScanResult(vals);

  const today = new Date().toISOString().slice(0, 10);
  const entry = {
    date: today,
    wellness: result.wellnessScore,
    label: result.label,
    MD: result.MD,
    AN: result.AN,
    ST: result.ST,
    symptomIndex: result.symptomIndex,
  };
  history.push(entry);
  saveHistory(history);

  renderResult(result, history);
  renderHistory(history);
});

function renderResult(r, historyArr) {
  if (!resultCard) return;
  resultCard.hidden = false;

  let emoji = "🙂";
  if (r.wellnessScore < 4) emoji = "😟";
  else if (r.wellnessScore < 8) emoji = "😐";
  else emoji = "😊";
  wellnessAvatar.textContent = emoji;
  avatarText.textContent =
    "Your latest check-in shows how your mood, anxiety and stress look today.";

  scoreBarInner.style.width = `${(r.wellnessScore / 12) * 100}%`;
  scoreBarLabel.textContent = `Wellness level: ${r.wellnessScore.toFixed(
    1
  )} / 12`;

  resultScore.textContent = `Score: ${r.wellnessScore.toFixed(1)}`;
  resultLabel.textContent = r.label;

  resultBadge.classList.remove("status-green", "status-yellow", "status-red");
  if (r.wellnessScore < 4) {
    resultBadge.classList.add("status-red");
    resultMessage.textContent =
      "Your stress level is high today. Slow down and give yourself more care. Use the action plan and consider talking to someone you trust.";
  } else if (r.wellnessScore < 8) {
    resultBadge.classList.add("status-yellow");
    resultMessage.textContent =
      "You show some signs of stress. This is a good time to adjust your habits and protect your energy.";
  } else {
    resultBadge.classList.add("status-green");
    resultMessage.textContent =
      "You are generally doing okay today. Keep the habits that work for you.";
  }

  const insight = buildInsights(r, historyArr);

  mindMap.innerHTML = `
    <div class="mindmap-section">
      <div class="mindmap-title">Central node: Today’s profile</div>
      <ul class="mindmap-branch">
        <li>Profile: <strong>${insight.profileType}</strong></li>
        <li>Risk level: <strong>${insight.riskBand.toUpperCase()}</strong></li>
        <li>Mood index (MD): ${r.MD.toFixed(1)}</li>
        <li>Anxiety index (AN): ${r.AN.toFixed(1)}</li>
        <li>Stress index (ST): ${r.ST.toFixed(1)}</li>
      </ul>
    </div>
    <div class="mindmap-section">
      <div class="mindmap-title">Branch: Recent pattern</div>
      <ul class="mindmap-branch">
        <li>${insight.trendText}</li>
      </ul>
    </div>
    <div class="mindmap-section">
      <div class="mindmap-title">Branch: Tomorrow outlook</div>
      <ul class="mindmap-branch">
        <li>${insight.predictionText}</li>
      </ul>
    </div>
  `;

  actionPlanList.innerHTML = "";
  insight.plan.forEach((text) => {
    const li = document.createElement("li");
    li.textContent = text;
    actionPlanList.appendChild(li);
  });
}

clearBtn?.addEventListener("click", () => {
  scanForm.reset();
});

// =====================
// EXTRA WELLNESS TIPS
// =====================
const tipsPool = [
  "Drink a full glass of water and stretch your shoulders and neck.",
  "Choose one small task and complete it fully before opening social media.",
  "Spend 5 minutes outside or near a window and notice what you can see and hear.",
  "Write down three things that went okay today, even if they are small.",
  "Reduce bright screen use 30 minutes before sleep and switch to a calm activity.",
  "Send a short supportive message to a friend, even just to say hi.",
];

extraTipsBtn?.addEventListener("click", () => {
  const tip = tipsPool[Math.floor(Math.random() * tipsPool.length)];
  extraTipsList.innerHTML = "";
  const li = document.createElement("li");
  li.textContent = tip;
  extraTipsList.appendChild(li);
});

// =====================
// HISTORY & WEEKLY CHART
// =====================
const toggleHistoryBtn = document.getElementById("toggleHistoryBtn");
const historyContent = document.getElementById("historyContent");
const historyList = document.getElementById("historyList");
const clearHistoryBtn = document.getElementById("clearHistory");
const weeklyChartCanvas = document.getElementById("weeklyChart");
let weeklyChartInstance = null;

function renderHistory(arr) {
  if (!historyList || !weeklyChartCanvas) return;

  historyList.innerHTML = "";
  arr
    .slice()
    .reverse()
    .forEach((item) => {
      const li = document.createElement("li");
      const left = document.createElement("span");
      const right = document.createElement("span");
      left.textContent = `${item.date} – ${item.label}`;
      right.textContent = `Score ${item.wellness.toFixed(1)}`;
      right.className = "history-score";
      li.appendChild(left);
      li.appendChild(right);
      historyList.appendChild(li);
    });

  const byDate = {};
  arr.forEach((h) => {
    if (!byDate[h.date]) byDate[h.date] = [];
    byDate[h.date].push(h.wellness);
  });

  const allDates = Object.keys(byDate).sort();
  const last7 = allDates.slice(-7);
  const labels = last7;
  const data = last7.map((d) => {
    const v = byDate[d];
    return (v.reduce((a, b) => a + b, 0) / v.length).toFixed(2);
  });

  if (weeklyChartInstance) weeklyChartInstance.destroy();
  weeklyChartInstance = new Chart(weeklyChartCanvas.getContext("2d"), {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label: "Wellness score",
          data,
          tension: 0.35,
          borderWidth: 2,
        },
      ],
    },
    options: {
      scales: {
        y: {
          suggestedMin: 0,
          suggestedMax: 12,
        },
      },
    },
  });
}

toggleHistoryBtn?.addEventListener("click", () => {
  const hidden = historyContent.hidden;
  historyContent.hidden = !hidden;
  toggleHistoryBtn.textContent = hidden ? "Hide history" : "Show history";
});

clearHistoryBtn?.addEventListener("click", () => {
  if (!confirm("Clear all previous scans?")) return;
  history = [];
  saveHistory(history);
  renderHistory(history);
});

if (history.length) {
  renderHistory(history);
}

// =====================
// BREATHING 4–4–4
// =====================
const breathingFab = document.getElementById("breathingFab");
const breathingPanel = document.getElementById("breathingPanel");
const closeBreathing = document.getElementById("closeBreathing");
const breathingToggle = document.getElementById("breathingToggle");
const breathingCircle = document.getElementById("breathingCircle");
const breathingInstruction = document.getElementById("breathingInstruction");
const breathingCounter = document.getElementById("breathingCounter");

let breathingTimer = null;
let breathingPhaseTimer = null;

function stopBreathing() {
  breathingCircle.classList.remove("breathing-active");
  breathingInstruction.textContent =
    "Tap “Start” to begin one minute of guided breathing.";
  breathingCounter.textContent = "Ready";
  breathingToggle.textContent = "Start";
  if (breathingTimer) {
    clearTimeout(breathingTimer);
    breathingTimer = null;
  }
  if (breathingPhaseTimer) {
    clearInterval(breathingPhaseTimer);
    breathingPhaseTimer = null;
  }
}

breathingFab?.addEventListener("click", () => {
  breathingPanel.hidden = !breathingPanel.hidden;
});

closeBreathing?.addEventListener("click", () => {
  stopBreathing();
  breathingPanel.hidden = true;
});

breathingToggle?.addEventListener("click", () => {
  if (breathingTimer) {
    stopBreathing();
    return;
  }

  breathingCircle.classList.add("breathing-active");
  breathingToggle.textContent = "Stop";

  let total = 60;
  let phase = "inhale";
  let phaseTime = 4;
  let count = 4;

  breathingInstruction.textContent = "Inhale 4 seconds";
  breathingCounter.textContent = "4";

  breathingPhaseTimer = setInterval(() => {
    phaseTime--;
    total--;
    count--;

    if (count >= 0) breathingCounter.textContent = String(count);

    if (phaseTime <= 0) {
      phaseTime = 4;
      count = 4;
      if (phase === "inhale") {
        phase = "hold";
        breathingInstruction.textContent = "Hold 4 seconds";
      } else if (phase === "hold") {
        phase = "exhale";
        breathingInstruction.textContent = "Exhale 4 seconds";
      } else {
        phase = "inhale";
        breathingInstruction.textContent = "Inhale 4 seconds";
      }
    }

    if (total <= 0) {
      stopBreathing();
    }
  }, 1000);

  breathingTimer = setTimeout(stopBreathing, 65000);
});

// =====================
// WELLNESS COACH (Gemini via Worker)
// =====================
const coachFab = document.getElementById("coachFab");
const coachPanel = document.getElementById("coachPanel");
const closeCoach = document.getElementById("closeCoach");
const coachMessages = document.getElementById("coachMessages");
const coachForm = document.getElementById("coachForm");
const coachInput = document.getElementById("coachInput");

let coachHistory = [];

function pushMessage(role, text) {
  const div = document.createElement("div");
  div.className = "msg " + (role === "user" ? "msg-user" : "msg-bot");
  div.textContent = (role === "user" ? "You: " : "Coach: ") + text;
  coachMessages.appendChild(div);
  coachMessages.scrollTop = coachMessages.scrollHeight;
}

coachFab?.addEventListener("click", () => {
  coachPanel.hidden = !coachPanel.hidden;
});

closeCoach?.addEventListener("click", () => {
  coachPanel.hidden = true;
});

coachForm?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const text = coachInput.value.trim();
  if (!text) return;

  pushMessage("user", text);
  coachHistory.push({ role: "user", content: text });
  coachInput.value = "";

  pushMessage("assistant", "Thinking…");
  const loading = coachMessages.lastChild;

  try {
    const latest = history[history.length - 1] || null;
    const profile = loadProfile();

    const res = await fetch(COACH_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        question: text,
        chatHistory: coachHistory,
        latestScan: latest,
        profile,
      }),
    });

    const json = await res.json();
    const ans = json.answer || "Sorry, I could not generate a reply.";
    coachHistory.push({ role: "assistant", content: ans });
    loading.textContent = "Coach: " + ans;
  } catch (err) {
    loading.textContent =
      "Coach: Sorry, there was a problem contacting the wellness coach.";
  }
});

