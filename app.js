// MindScan Lite - Web Version

const form = document.getElementById("scanForm");
const clearBtn = document.getElementById("clearBtn");

const resultCard = document.getElementById("resultCard");
const resultBadge = document.getElementById("resultBadge");
const resultLabel = document.getElementById("resultLabel");
const resultScore = document.getElementById("resultScore");
const resultMessage = document.getElementById("resultMessage");
const suggestionList = document.getElementById("suggestionList");

const historyList = document.getElementById("historyList");
const clearHistoryBtn = document.getElementById("clearHistory");

const STORAGE_KEY = "mindscan_history_v1";

function loadHistory() {
  try {
    const data = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

function saveHistory(history) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
}

function interpretScore(score) {
  // You can adjust these ranges if you want
  if (score >= 9) {
    return {
      status: "green",
      label: "Green - doing okay",
      message: "You seem to be in a relatively good state overall. Keep maintaining your healthy behaviors, and continue to monitor your stress.",
      suggestions: [
        "Maintain your sleep schedule and keep your good habits.",
        "Plan short breaks during study or work to prevent burnout.",
        "Use your current stable mood to organise or plan your tasks calmly."
      ]
    };
  } else if (score >= 5) {
    return {
      status: "yellow",
      label: "Yellow - mild stress warning",
      message: "You show some signs of stress or imbalance. It is a good time to slow down a bit and give yourself more care.",
      suggestions: [
        "Take a proper break today, for example a short walk or light stretching.",
        "Reduce screen time before sleep and aim for better sleep quality tonight.",
        "Talk to a friend or family member about how you feel, even briefly."
      ]
    };
  } else {
    return {
      status: "red",
      label: "Red - high stress risk",
      message: "Your answers suggest a high level of stress or low mood. It is important to rest and, if possible, talk to someone you trust.",
      suggestions: [
        "Pause heavy tasks for a while, focus on basic needs such as sleep, food, and hydration.",
        "Use a calming method such as breathing exercise, grounding, or prayer.",
        "If this feeling continues for many days, consider reaching out to a counsellor or mental health professional."
      ]
    };
  }
}

function computeScore(values) {
  const sleep = Number(values.sleep);
  const energy = Number(values.energy);
  const motivation = Number(values.motivation);
  const stress = Number(values.stress);
  const screen = Number(values.screen);
  const mood = Number(values.mood);

  // Positive indicators
  const sleepPts = sleep;
  const energyPts = energy;
  const motivationPts = motivation;
  const moodPts = mood;

  // Negative indicators
  const stressPenalty = stress;
  let screenPenalty = 0;
  if (screen === 2) screenPenalty = 1;
  if (screen === 3) screenPenalty = 2;

  const raw = (sleepPts + energyPts + motivationPts + moodPts) - (stressPenalty + screenPenalty);

  // Keep minimum zero
  return Math.max(0, raw);
}

function renderResult(score, interpretation) {
  resultCard.hidden = false;

  // Clear previous classes
  resultBadge.classList.remove("status-green", "status-yellow", "status-red");

  if (interpretation.status === "green") {
    resultBadge.classList.add("status-green");
  } else if (interpretation.status === "yellow") {
    resultBadge.classList.add("status-yellow");
  } else {
    resultBadge.classList.add("status-red");
  }

  resultLabel.textContent = interpretation.label;
  resultScore.textContent = "Score: " + score.toFixed(1);
  resultMessage.textContent = interpretation.message;

  suggestionList.innerHTML = "";
  interpretation.suggestions.forEach(s => {
    const li = document.createElement("li");
    li.textContent = s;
    suggestionList.appendChild(li);
  });
}

function renderHistory() {
  const history = loadHistory();

  historyList.innerHTML = "";
  if (!history.length) {
    const li = document.createElement("li");
    li.textContent = "No previous scans yet.";
    historyList.appendChild(li);
    return;
  }

  history
    .slice()
    .reverse()
    .forEach(item => {
      const li = document.createElement("li");
      const left = document.createElement("span");
      const right = document.createElement("span");
      left.textContent = item.date + " - " + item.label;
      right.textContent = "Score " + item.score.toFixed(1);
      right.className = "history-score";
      li.appendChild(left);
      li.appendChild(right);
      historyList.appendChild(li);
    });
}

form.addEventListener("submit", (e) => {
  e.preventDefault();

  const formData = new FormData(form);
  const values = {
    sleep: formData.get("sleep"),
    energy: formData.get("energy"),
    motivation: formData.get("motivation"),
    stress: formData.get("stress"),
    screen: formData.get("screen"),
    mood: formData.get("mood")
  };

  const score = computeScore(values);
  const interpretation = interpretScore(score);
  renderResult(score, interpretation);

  // Save to history with date
  const today = new Date();
  const dateStr = today.toISOString().slice(0, 10);

  const history = loadHistory();
  history.push({
    date: dateStr,
    score,
    label: interpretation.label
  });
  saveHistory(history);
  renderHistory();
});

clearBtn.addEventListener("click", () => {
  form.reset();
  resultCard.hidden = true;
});

clearHistoryBtn.addEventListener("click", () => {
  if (confirm("Clear all saved scan history from this browser?")) {
    localStorage.removeItem(STORAGE_KEY);
    renderHistory();
  }
});

// Initial load
renderHistory();
