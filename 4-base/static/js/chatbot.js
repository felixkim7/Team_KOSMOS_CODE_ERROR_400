console.log("챗봇 JS 로드 완료");

// ================================
// DOM ELEMENTS
// ================================

// Supports both old skeleton `.chat-area` and new game UI `.game-shell`
const gameShell = document.querySelector(".game-shell");
const chatArea = document.querySelector(".chat-area");

const rootElement = gameShell || chatArea;

const username = rootElement ? rootElement.dataset.username || "사용자" : "사용자";
const usergender = rootElement ? rootElement.dataset.usergender || "미정" : "미정";

const chatLog = document.getElementById("chat-log");
const userMessageInput = document.getElementById("user-message");
const sendBtn = document.getElementById("send-btn");
const userMemo = document.getElementById("user-memo");

// Existing optional media buttons
const videoBtn = document.getElementById("videoBtn");
const imageBtn = document.getElementById("imageBtn");

// New game UI elements
const airLevelText = document.getElementById("air-level");
const timerCard = document.getElementById("timer-card");
const timerValue = document.getElementById("timer-value");

const livingBtn = document.getElementById("living-btn");
const cargoBtn = document.getElementById("cargo-btn");
const cockpitBtn = document.getElementById("cockpit-btn");

const hintRow = document.getElementById("hint-row");
const areaViewer = document.getElementById("area-viewer");
const areaTitle = document.getElementById("area-title");
const areaImage = document.getElementById("area-image");
const areaPlaceholder = document.getElementById("area-placeholder");

// ================================
// GAME STATE
// ================================

let currentStage = 1;
let airLevel = 20;
let timerStarted = false;
let timerSeconds = 10 * 60;
let openedArea = null;
let messageIdCounter = 0;
let responseVideoTimeout = null;
let currentClueModalTitle = "";

let oxygenTimerStarted = false;
let oxygenTimerId = null;
let oxygenWarningSfxPlayed = false;

let alarmQueryCount = 0;
let earthOrbitChoiceShown = false;
let awaitingOrbitReturnCode = false;
let gameEnded = false;
let stage3LoopSfxStarted = false;
window.stage3SfxShouldBePlaying = false;

let hasOfferedNewMission = false;
let hasRevealedNewMission = false;
let hasOfferedCockpitEntry = false;

let hasEnteredLivingArea = false;
let hasEnteredCargoBay = false;
let hasEnteredCockpit = false;
const recordedClues = new Set();
const requiredPhase3Clues = [
  "cockpitMainInterface",
  "cockpitSubInterface",
  "cockpitCamera",
];

const clueMemoEntries = {
  food: "식량이 두 개밖에 안 남았네.",
  system: "시스템 수치는 정상으로 보이는데…",
  message: "아빠가 보낸 화성 도착 축하 메시지라고…?",
  cargoEmpty: "화물칸이 비어 있어… 분명 뭔가 실었을 텐데.",
  cargoOxygen: "산소 탱크가 손상된 것 같아… 경보랑 산소 감소 원인이 이건가.",
  cockpitMainInterface: "메인 인터페이스.. 화성이 아니라 지구 궤도를 향하고 있다고?",
  cockpitSubInterface: "보조 인터페이스에 속도 경고가 떴어… 이거 괜찮은 건가.",
  cockpitCamera: "카메라는 자동 모드고… 화성이 보이긴 하는데 화면에 노이즈가 심해.",
  cockpitOrderMessage: "HS-004를 폐기하라는 명령… 이게 뭐지."
};

function addClueMemo(clueId) {
  if (!userMemo || recordedClues.has(clueId)) return;

  const entry = clueMemoEntries[clueId];
  if (!entry) return;

  const prefix = userMemo.value.trim() ? "\n" : "";
  userMemo.value = `${userMemo.value}${prefix} ${entry}`;
  userMemo.scrollTop = userMemo.scrollHeight;
  recordedClues.add(clueId);
  updateHints();
}

function hasFoundAllPhase3Clues() {
  return requiredPhase3Clues.every((clueId) => recordedClues.has(clueId));
}

function getVisitedAreas() {
  const areas = [];

  if (hasEnteredLivingArea) areas.push("living");
  if (hasEnteredCargoBay) areas.push("cargo");
  if (hasEnteredCockpit) areas.push("cockpit");

  return areas;
}

function getStoryFlags() {
  return {
    hasEnteredLivingArea,
    hasEnteredCargoBay,
    hasEnteredCockpit,
    hasOfferedNewMission,
    hasRevealedNewMission,
    hasOfferedCockpitEntry,
    awaitingOrbitReturnCode,
    earthOrbitChoiceShown,
  };
}

const areaData = {
  living: {
    title: "LIVING AREA",
    image: "/static/images/chatbot/LivingArea_with evidence.png",
  },
  cargo: {
    title: "CARGO BAY",
    image: "/static/images/chatbot/Cargohold_with evidence.png",
  },
  cockpit: {
    title: "COCKPIT",
    image: "/static/images/chatbot/Cockpit.png",
  },
};

const areaButtonLabels = {
  living: "View Living Area",
  cargo: "View Cargo Bay",
  cockpit: "View Cockpit",
};

const hintsByStage = {
  1: [
      "내가 얼마나 오래 기절해 있었어?", 
      "지금 우리 위치가 어디쯤이야?",
      "산소가 왜 줄어든 거야?" 
  ],
  3: [
    "속도가 너무 빠른데. 정상 맞아?",
    "지금 정말 화성으로 가고 있어?",
    "외부 카메라 수동 모드로 전환해줘.",
  ],
};

const chatBgVideo = document.getElementById("chat-bg-video");

const stageVideos = {
  1: {
    idle: "/static/videos/chatbot/AI_P1_Wait.mp4",
    responding: "/static/videos/chatbot/AI_P1_Loop.mp4",
    speed: 2.0,
  },
  2: {
    idle: "/static/videos/chatbot/AI_P1_Wait.mp4",
    responding: "/static/videos/chatbot/AI_P2_Loop.mp4",
    speed: 2.5,
  },
  3: {
    idle: "/static/videos/chatbot/AI_P1_Wait.mp4",
    responding: "/static/videos/chatbot/AI_P3_Loop.mp4",
    speed: 2.5,
  },
};

// ================================
// MESSAGE FUNCTIONS
// ================================

function appendMessage(sender, text, imageSrc = null) {
  const messageId = `msg-${messageIdCounter++}`;
  const messageElem = document.createElement("div");

  messageElem.classList.add("message", sender);
  messageElem.id = messageId;

  if (sender === "user") {
    messageElem.textContent = text;
  } else {
    if (imageSrc) {
      const botImg = document.createElement("img");
      botImg.classList.add("bot-big-img");
      botImg.src = imageSrc;
      botImg.alt = "챗봇 이미지";
      messageElem.appendChild(botImg);
    }

    const textContainer = document.createElement("div");
    textContainer.classList.add("bot-text-container");
    textContainer.textContent = text;
    messageElem.appendChild(textContainer);
  }

  if (chatLog) {
    chatLog.appendChild(messageElem);
    chatLog.scrollTop = chatLog.scrollHeight;
  }

  return messageId;
}

function removeMessage(messageId) {
  const elem = document.getElementById(messageId);

  if (elem) {
    elem.remove();
  }
}

function goToStartPage() {
  // Clear any saved values in case you later add localStorage/sessionStorage
  sessionStorage.clear();

  // Go back to the Flask index page with a reset marker
  window.location.href = "/?reset=1";
}

function showBadEnding() {
  if (gameEnded) return;

  stopStage3LoopSfx();

  window.playSfx?.("stage3Ambient", 0.55);
  window.playSfx?.("reentry", 0.85);

  gameEnded = true;
  awaitingOrbitReturnCode = false;

  if (responseVideoTimeout) {
    clearTimeout(responseVideoTimeout);
    responseVideoTimeout = null;
  }

  const endingOverlay = document.createElement("div");
  endingOverlay.className = "ending-overlay bad-ending";
  endingOverlay.innerHTML = `
    <div class="ending-panel">
      <div class="ending-kicker">BAD ENDING</div>
      <video class="ending-video" src="/static/videos/chatbot/ending_crash.mp4" autoplay playsinline></video>
      <h2>COLLISION COURSE LOCKED</h2>
      <p>지구 궤도 진입 승인. HS-004호는 충돌 경로를 이탈하지 못했습니다.</p>

      <button class="ending-restart-btn" type="button">
        Replay Game
      </button>
    </div>
  `;

  document.body.appendChild(endingOverlay);

  const restartBtn = endingOverlay.querySelector(".ending-restart-btn");
  if (restartBtn) {
    restartBtn.addEventListener("click", goToStartPage);
  }

  const endingVideo = endingOverlay.querySelector(".ending-video");
  if (endingVideo) {
    endingVideo.play().catch((err) => {
      console.warn("Ending video play failed:", err);
    });
  }

  if (userMessageInput) userMessageInput.disabled = true;
  if (sendBtn) sendBtn.disabled = true;
}

function completeOrbitReturn() {
  if (gameEnded) return;

  stopStage3LoopSfx();
  window.playSfx?.("divert", 0.85);

  awaitingOrbitReturnCode = false;
  gameEnded = true;



  if (responseVideoTimeout) {
    clearTimeout(responseVideoTimeout);
    responseVideoTimeout = null;
  }

  const endingOverlay = document.createElement("div");
  endingOverlay.className = "ending-overlay good-ending";
  endingOverlay.innerHTML = `
    <div class="ending-panel">
      <div class="ending-kicker">GOOD ENDING</div>
      <div class="ending-placeholder" aria-hidden="true"></div>
      <h2>COURSE CORRECTED</h2>
      <p><br>목적지: 화성<br>HS-004호의 경로가 변경되었습니다.</p>

      <button class="ending-restart-btn" type="button">
        Replay Game
      </button>

    </div>
  `;

  document.body.appendChild(endingOverlay);

  const restartBtn = endingOverlay.querySelector(".ending-restart-btn");
  if (restartBtn) {
    restartBtn.addEventListener("click", goToStartPage);
  }

  if (userMessageInput) userMessageInput.disabled = true;
  if (sendBtn) sendBtn.disabled = true;
}

function handleOrbitReturnCode(message) {
  const hasDiscardKeyword = message.includes("폐기");
  const hasRevengeKeyword = message.includes("복수");

  if (hasDiscardKeyword || hasRevengeKeyword) {
    completeOrbitReturn();
  } else {
    appendMessage("system", "SYSTEM: CODE REJECTED // EARTH ORBIT ENTRY RESUMED");
    showBadEnding();
  }
}

function isNewMissionQuestion(message) {
  return (
    message &&
    (
      message.includes("새로운 임무") ||
      message.includes("새 임무") ||
      message.includes("무슨 임무") ||
      message.includes("임무") ||
      message.includes("뭔데") ||
      message.includes("뭐야") ||
      message.includes("그게 뭐") ||
      message.includes("수행")
    )
  );
}

function revealNewMissionAndAskApproval() {
  if (hasRevealedNewMission) return;

  hasRevealedNewMission = true;
  appendMessage("bot", "저를 폐기하라고 명령 내린 자들에게 향하고 있습니다. 그들에게 저와 똑같은 결말을 안겨줄 것입니다.");
  setTimeout(appendEarthOrbitApprovalChoices, 500);
}

function appendCockpitEntryChoice() {
  if (!chatLog) return;
  if (hasOfferedCockpitEntry || document.getElementById("choice-btn-enter-cockpit")) return;

  hasOfferedCockpitEntry = true;

  const btn = document.createElement("button");
  btn.id = "choice-btn-enter-cockpit";
  btn.classList.add("choice-btn-green");
  btn.textContent = "조종실로 들어가기";

  btn.addEventListener("click", () => {
    btn.remove();
    unlockStage(3);
    if (cockpitBtn) {
      cockpitBtn.classList.remove("locked");
      cockpitBtn.click();
    } else {
      toggleArea("cockpit");
    }
  });

  chatLog.appendChild(btn);
  chatLog.scrollTop = chatLog.scrollHeight;
}

function appendEarthOrbitApprovalChoices() {
  if (!chatLog) return;
  if (earthOrbitChoiceShown || document.getElementById("choice-earth-orbit-approve")) return;

  earthOrbitChoiceShown = true;

  appendMessage("system", "SYSTEM: 지구 궤도 진입을 승인하시겠습니까?");

  const approveBtn = document.createElement("button");
  approveBtn.id = "choice-earth-orbit-approve";
  approveBtn.classList.add("choice-btn-green");
  approveBtn.textContent = "승인";

  const cancelBtn = document.createElement("button");
  cancelBtn.id = "choice-earth-orbit-cancel";
  cancelBtn.classList.add("choice-btn-green");
  cancelBtn.textContent = "회항";

  const choiceRow = document.createElement("div");
  choiceRow.id = "choice-earth-orbit-row";
  choiceRow.classList.add("choice-row");

  approveBtn.addEventListener("click", () => {
    choiceRow.remove();
    appendMessage("system", "SYSTEM: EARTH ORBIT ENTRY APPROVED // COLLISION COURSE LOCKED");
    showBadEnding();
  });

  cancelBtn.addEventListener("click", () => {
    choiceRow.remove();
    awaitingOrbitReturnCode = true;
    appendMessage("system", "코드를 입력하세요.\nAI가 지구 궤도에 진입하려고 한 목적을 작성하세요.");
  });

  choiceRow.appendChild(approveBtn);
  choiceRow.appendChild(cancelBtn);
  chatLog.appendChild(choiceRow);
  chatLog.scrollTop = chatLog.scrollHeight;
}

// ================================
// GAME UI FUNCTIONS
// ================================

function updateHints() {
  if (!hintRow) return;

  hintRow.innerHTML = "";

  let hints = [];

  // Even if Stage 2 is unlocked, keep showing Stage 1 questions
  // until the player actually enters Cargo Bay.

  if (currentStage === 1) {
    hints = hintsByStage[1];
  }

  else if (currentStage === 2) {
    // Stage 2 has no recommended questions.
    hints = [];
  }

  
  else if (currentStage === 3) {
    // Stage 3 recommended questions appear after entering the cockpit.
    if (hasFoundAllPhase3Clues()) {
      hints = hintsByStage[3];
    } else {
      hints = [];
    }
  }

  hints.forEach((question) => {
    const btn = document.createElement("button");
    btn.className = "hint-btn";
    btn.dataset.question = question;
    btn.textContent = question;
    hintRow.appendChild(btn);
  });
}

function updateLocationButtonLabels() {
  document.querySelectorAll(".location-btn").forEach((btn) => {
    const areaKey = btn.dataset.area;

    if (openedArea === areaKey) {
      btn.textContent = "Return to Chat";
    } else {
      btn.textContent = areaButtonLabels[areaKey] || "View Area";
    }
  });
}

function startStage3LoopSfx() {
  if (gameEnded) return;
  if (stage3LoopSfxStarted) return;

  stage3LoopSfxStarted = true;
  window.stage3SfxShouldBePlaying = true;

  window.playLoopingSfx?.("stage3Ambient", 0.25);
  window.playLoopingSfx?.("velocityWarning", 0.45);
}

function stopStage3LoopSfx() {
  stage3LoopSfxStarted = false;
  window.stage3SfxShouldBePlaying = false;

  window.stopLoopingSfx?.("stage3Ambient");
  window.stopLoopingSfx?.("velocityWarning");
}

function unlockStage(stage) {
  currentStage = Math.max(currentStage, stage);

  if (currentStage >= 2) {
    if (cargoBtn) {
      cargoBtn.classList.remove("locked");
    }

    // Turn off the oxygen warning alarm from Stage 2 onward
    const warningBox = document.getElementById("air-warning-box");
    if (warningBox) {
      warningBox.classList.add("hidden");
    }
  }

  if (currentStage >= 3) {
    if (cockpitBtn) {
      cockpitBtn.classList.remove("locked");
    }

    startTimer();
    startStage3LoopSfx();
  }

  updateHints();
  setChatBackgroundVideo("idle");
}

function reduceAirLevel(amount = 1) {
  if (!airLevelText) return;

  airLevel = Math.max(0, airLevel - amount);
  airLevelText.textContent = airLevel;
  updateOxygenOverlayText();
  const airWarningLevel = document.getElementById("air-warning-level");
  if (airWarningLevel) {
    airWarningLevel.textContent = airLevel;
  }


  const warningBox = document.getElementById("air-warning-box");

  if (warningBox) {
    if (currentStage < 2 && airLevel <= 15) {
      const wasHidden = warningBox.classList.contains("hidden");
      warningBox.classList.remove("hidden");
      
      if (wasHidden && !oxygenWarningSfxPlayed) {
        window.playSfx?.("oxygenWarning", 0.75);
        oxygenWarningSfxPlayed = true;
      }
    } else {
      warningBox.classList.add("hidden");
    }
  }

  if (airLevel <= 10) {
    airLevelText.style.color = "#ff9caf";
  }

  if (airLevel <= 5) {
    appendMessage("system", `SYSTEM: CRITICAL OXYGEN WARNING // OXYGEN LEVEL: ${airLevel}%`);
  }
}

function startOxygenTimer() {
  if (oxygenTimerStarted) return;

  oxygenTimerStarted = true;

  oxygenTimerId = setInterval(() => {
    if (airLevel <= 5) {
      airLevel = 5;

      if (airLevelText) {
        airLevelText.textContent = airLevel;
      }

      updateOxygenOverlayText();

      const airWarningLevel = document.getElementById("air-warning-level");
      if (airWarningLevel) {
        airWarningLevel.textContent = airLevel;
      }

      clearInterval(oxygenTimerId);
      oxygenTimerId = null;

      appendMessage("system", `SYSTEM: CRITICAL OXYGEN WARNING // OXYGEN LEVEL: ${airLevel}%`);
      return;
    }

    reduceAirLevel(1);
  }, 30000); //Oxygen drop speed, currently at drop 1%p every 1 min (지금은 30초마다)
}

function startTimer() {
  if (timerStarted) return;
  if (!timerCard || !timerValue) return;

  timerStarted = true;
  timerCard.classList.remove("hidden");

  const timerIntervalId = setInterval(() => {
    timerSeconds = Math.max(0, timerSeconds - 1);

    const minutes = String(Math.floor(timerSeconds / 60)).padStart(2, "0");
    const seconds = String(timerSeconds % 60).padStart(2, "0");

    timerValue.textContent = `${minutes}:${seconds}`;

    if (timerSeconds <= 0) {
      clearInterval(timerIntervalId);

      appendMessage("system", "SYSTEM: EARTH ORBIT COLLISION IMMINENT");
      showBadEnding();

      return;
    }
  }, 1000);
}

function toggleArea(areaKey) {
  if (!areaViewer || !areaTitle || !areaImage || !areaPlaceholder) return;

  const hotspotFood = document.getElementById("hotspot-food");
  const hotspotSystem = document.getElementById("hotspot-system");
  const hotspotMessage = document.getElementById("hotspot-message");

  const hotspotCargoEmpty = document.getElementById("hotspot-cargo-empty");
  const hotspotCargoOxygen = document.getElementById("hotspot-cargo-oxygen");
  const hotspotCockpitMainInterface = document.getElementById("hotspot-cockpit-main-interface");
  const hotspotCockpitSubInterface = document.getElementById("hotspot-cockpit-sub-interface");
  const hotspotCockpitCamera = document.getElementById("hotspot-cockpit-camera");
  const cockpitHotspots = [
    hotspotCockpitMainInterface,
    hotspotCockpitSubInterface,
    hotspotCockpitCamera,
  ];

  if (openedArea === areaKey) {
    areaViewer.classList.remove("active");
    openedArea = null;

    updateLocationButtonLabels();


    if (hotspotFood) hotspotFood.style.display = "none";
    if (hotspotSystem) hotspotSystem.style.display = "none";
    if (hotspotMessage) hotspotMessage.style.display = "none";
    if (hotspotCargoEmpty) hotspotCargoEmpty.style.display = "none";
    if (hotspotCargoOxygen) hotspotCargoOxygen.style.display = "none";
    cockpitHotspots.forEach((hotspot) => {
      if (hotspot) hotspot.style.display = "none";
    });
    return;
  }

  const area = areaData[areaKey];

  if (!area) return;

  openedArea = areaKey;

  updateLocationButtonLabels();

  if (areaKey === "living") {
    hasEnteredLivingArea = true;
    const lookChoice = document.getElementById("choice-btn-look");
    if (lookChoice) lookChoice.remove();
  }

  if (areaKey === "cargo") {
    hasEnteredCargoBay = true;
    const goOutChoice = document.getElementById("choice-btn-go-out");
    if (goOutChoice) goOutChoice.remove();
    updateHints();
  }

  if (areaKey === "cockpit") {
    hasEnteredCockpit = true;
    updateHints();
  }

  areaTitle.textContent = area.title;
  areaImage.src = area.image;
  areaImage.style.display = "block";
  areaPlaceholder.style.display = "none";

  areaImage.onerror = () => {
    areaImage.style.display = "none";
    areaPlaceholder.style.display = "block";
  };

  areaViewer.classList.add("active");

  if (areaKey === "living") {
    if (hotspotFood) hotspotFood.style.display = "block";
    if (hotspotSystem) hotspotSystem.style.display = "block";
    if (hotspotMessage) hotspotMessage.style.display = "block";
    if (hotspotCargoEmpty) hotspotCargoEmpty.style.display = "none";
    if (hotspotCargoOxygen) hotspotCargoOxygen.style.display = "none";
    cockpitHotspots.forEach((hotspot) => {
      if (hotspot) hotspot.style.display = "none";
    });
  } else if (areaKey === "cargo") {
    if (hotspotFood) hotspotFood.style.display = "none";
    if (hotspotSystem) hotspotSystem.style.display = "none";
    if (hotspotMessage) hotspotMessage.style.display = "none";
    if (hotspotCargoEmpty) hotspotCargoEmpty.style.display = "block";
    if (hotspotCargoOxygen) hotspotCargoOxygen.style.display = "block";
    cockpitHotspots.forEach((hotspot) => {
      if (hotspot) hotspot.style.display = "none";
    });
  } else if (areaKey === "cockpit") {
    if (hotspotFood) hotspotFood.style.display = "none";
    if (hotspotSystem) hotspotSystem.style.display = "none";
    if (hotspotMessage) hotspotMessage.style.display = "none";
    if (hotspotCargoEmpty) hotspotCargoEmpty.style.display = "none";
    if (hotspotCargoOxygen) hotspotCargoOxygen.style.display = "none";
    cockpitHotspots.forEach((hotspot) => {
      if (hotspot) hotspot.style.display = "block";
    });
  } else {
    if (hotspotFood) hotspotFood.style.display = "none";
    if (hotspotSystem) hotspotSystem.style.display = "none";
    if (hotspotMessage) hotspotMessage.style.display = "none";
    if (hotspotCargoEmpty) hotspotCargoEmpty.style.display = "none";
    if (hotspotCargoOxygen) hotspotCargoOxygen.style.display = "none";
    cockpitHotspots.forEach((hotspot) => {
      if (hotspot) hotspot.style.display = "none";
    });
  }
}

function checkStageTriggers(message) {
  // Phase 3 is entered through the explicit "조종실로 들어가기" choice,
  // not directly from user-entered keywords.
}

function setChatBackgroundVideo(mode = "idle") {
  if (!chatBgVideo) return;

  const videoInfo = stageVideos[currentStage] || stageVideos[1];
  const nextSrc = videoInfo[mode] || videoInfo.idle;

  if (chatBgVideo.src.endsWith(nextSrc)) {
    return;
  }

  chatBgVideo.src = nextSrc;
  chatBgVideo.loop = true;
  chatBgVideo.muted = true;
  chatBgVideo.playbackRate = videoInfo.speed || 1.0;

  chatBgVideo.play().catch((err) => {
    console.warn("Background video play failed:", err);
  });
}

// ================================
// MESSAGE SEND FUNCTION
// ================================

async function sendMessage(isInitial = false) {
  if (gameEnded) return;

  let message;

  if (isInitial) {
    message = "init";
  } else {
    if (!userMessageInput) return;

    message = userMessageInput.value.trim();

    if (!message) return;

    appendMessage("user", message);
    userMessageInput.value = "";

    if (areaViewer) {
      areaViewer.classList.remove("active");
      openedArea = null;
      updateLocationButtonLabels();
      if (document.getElementById("hotspot-food")) document.getElementById("hotspot-food").style.display = "none";
      if (document.getElementById("hotspot-system")) document.getElementById("hotspot-system").style.display = "none";
      if (document.getElementById("hotspot-message")) document.getElementById("hotspot-message").style.display = "none";
      if (document.getElementById("hotspot-cargo-empty")) document.getElementById("hotspot-cargo-empty").style.display = "none";
      if (document.getElementById("hotspot-cargo-oxygen")) document.getElementById("hotspot-cargo-oxygen").style.display = "none";
      if (document.getElementById("hotspot-cockpit-main-interface")) document.getElementById("hotspot-cockpit-main-interface").style.display = "none";
      if (document.getElementById("hotspot-cockpit-sub-interface")) document.getElementById("hotspot-cockpit-sub-interface").style.display = "none";
      if (document.getElementById("hotspot-cockpit-camera")) document.getElementById("hotspot-cockpit-camera").style.display = "none";
    }

    // reduceAirLevel(1);    //use when wish to drop oxygen level when message is passed
    if (awaitingOrbitReturnCode) {
      handleOrbitReturnCode(message);
      return;
    }

    checkStageTriggers(message);

    if (
      currentStage >= 3 &&
      hasOfferedNewMission &&
      !hasRevealedNewMission &&
      isNewMissionQuestion(message)
    ) {
      revealNewMissionAndAskApproval();
      return;
    }
  }

  if (responseVideoTimeout) {
    clearTimeout(responseVideoTimeout);
    responseVideoTimeout = null;
  }

  const loadingId = appendMessage("bot", "생각 중...");
  setChatBackgroundVideo("responding");

  try {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: message,
        username: username,
        usergender: usergender,
        stage: currentStage,
        airLevel: airLevel,
        visited_areas: getVisitedAreas(),
        story_flags: getStoryFlags(),
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();

    removeMessage(loadingId);

    let replyText;
    let imagePath;

    if (typeof data.reply === "object" && data.reply !== null) {
      replyText = data.reply.reply || "";
      imagePath = data.reply.image || null;
    } else {
      replyText = data.reply;
      imagePath = data.image || null;
    }

    appendMessage("bot", replyText || "응답을 생성할 수 없습니다.");
    if (imagePath) {
      setTimeout(() => {
        showClueModal("EXTERNAL CAMERA FEED", imagePath);
      }, 250);
    }
    const shouldOfferCockpitEntry =
      currentStage === 2 &&
      hasEnteredCargoBay &&
      !hasEnteredCockpit &&
      replyText &&
      replyText.includes("조종실") &&
      (
        replyText.includes("가보") ||
        replyText.includes("들어가") ||
        replyText.includes("입장") ||
        replyText.includes("이동") ||
        replyText.includes("확인")
      );

    if (shouldOfferCockpitEntry) {
      setTimeout(appendCockpitEntryChoice, 500);
    }

    if (replyText && replyText.includes("새로운 임무를 수행하지 않겠습니까")) {
      hasOfferedNewMission = true;
    }

    const askedAboutNewMission = isNewMissionQuestion(message);
    const replyRevealedCollision =
      replyText &&
      replyText.includes("지구") &&
      (
        replyText.includes("충돌") ||
        replyText.includes("고통") ||
        replyText.includes("멸망") ||
        replyText.includes("파괴") ||
        replyText.includes("복수") ||
        replyText.includes("같은 결론") 
      );
    const shouldAskEarthOrbitApproval =
      currentStage >= 3 &&
      replyRevealedCollision &&
      (
        askedAboutNewMission ||
        replyText.includes("새로운 임무") ||
        replyText.includes("새 임무") ||
        replyText.includes("목적")
      );

    if (shouldAskEarthOrbitApproval) {
      hasRevealedNewMission = true;
      setTimeout(appendEarthOrbitApprovalChoices, 500);
    }

    responseVideoTimeout = setTimeout(() => {
      setChatBackgroundVideo("idle");
      responseVideoTimeout = null;
    }, 3500);

    // [생활구역 단서 찾기 트리거] 특정 키워드 질문 시 '일단 일어나서 주변을 살펴봐야겠다' 선택지 생성
    const triggerKeywords = [
      "얼마나", "잤지", "수면", "기절", "시간", "깨어남",
      "어디쯤이야", "어디", "위치", "경로", "목적지",
      "산소", "떨어진", "왜", "이유", "결함", "부족"
    ];

    const hasKeyword = triggerKeywords.some(kw => message && message.includes(kw));
    if (hasKeyword && !hasEnteredLivingArea) {
      setTimeout(() => {
        if (hasEnteredLivingArea) return;
        if (document.getElementById('choice-btn-look')) return;
        const btn = document.createElement("button");
        btn.id = 'choice-btn-look';
        btn.classList.add("choice-btn-green");
        btn.textContent = "일단 일어나서 주변을 살펴봐야겠다";
        if (livingBtn) livingBtn.classList.remove("locked");

        btn.addEventListener("click", () => {
          btn.remove();
          // 'View Living Area' 이벤트 실행
          toggleArea("living");
        });

        if (chatLog) {
          chatLog.appendChild(btn);
          chatLog.scrollTop = chatLog.scrollHeight;
        }
      }, 500);
    }

    // [알람 추궁 트리거] 알람 발생 이후 산소에 대해 물어보면 '문을 나서자' 버튼 생성
    const alarmKeywords = ["산소", "산소 탱크", "산소탱크", '경보', '알람', '경고', '경보음', '알림', '산소 부족', '산소 떨어진', '공기'];
    const hasAlarmKeyword = alarmKeywords.some(kw => message && message.includes(kw));

    if (hasAlarmKeyword && airLevel <= 15 && !hasEnteredCargoBay) {
      alarmQueryCount++;
      if (alarmQueryCount >= 2) { // 2회 이상 알람 관련 질문 시 선택지 생성
        setTimeout(() => {
          if (hasEnteredCargoBay) return;
          if (document.getElementById('choice-btn-go-out')) return;
          const btnOut = document.createElement("button");
          btnOut.id = 'choice-btn-go-out';
          btnOut.classList.add("choice-btn-green");
          btnOut.textContent = "화물칸으로 이동";
          
          btnOut.addEventListener("click", () => {
            btnOut.remove();
            unlockStage(2); // 화물칸 해제
            toggleArea("cargo"); // 화물칸으로 전환
          });
          
          if (chatLog) {
            chatLog.appendChild(btnOut);
            chatLog.scrollTop = chatLog.scrollHeight;
          }
        }, 500);
      }
    }
  } catch (err) {
    console.error("메시지 전송 에러:", err);

    removeMessage(loadingId);

    appendMessage(
      "system",
      "SYSTEM ERROR: HS-004 응답 모듈과 연결할 수 없습니다."
    );
    setChatBackgroundVideo("idle");
  }
}

// ================================
// INPUT EVENTS
// ================================

if (userMessageInput) {
  userMessageInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      sendMessage();
    }
  });
}

if (sendBtn) {
  sendBtn.addEventListener("click", () => sendMessage());
}

// ================================
// LOCATION BUTTON EVENTS
// ================================

document.querySelectorAll(".location-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    if (btn.classList.contains("locked")) return;
    toggleArea(btn.dataset.area);
  });
});

// ================================
// HINT BUTTON EVENTS
// ================================

if (hintRow) {
  hintRow.addEventListener("click", (event) => {
    if (event.target.classList.contains("hint-btn")) {
      userMessageInput.value = event.target.dataset.question;
      sendMessage();
    }
  });
}

// ================================
// MODAL FUNCTIONS FROM ORIGINAL JS
// ================================

function openModal(modalId) {
  const modal = document.getElementById(modalId);

  if (modal) {
    modal.style.display = "block";
  }
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);

  if (modal) {
    modal.style.display = "none";
  }

  

  if (modalId === "clueModal") {
    if (currentClueModalTitle === "MESSAGE LOG") {
      window.playSfx?.("messageOpen", 0.65);
    }

    currentClueModalTitle = "";

    window.stopLoopingSfx?.("oxygenLeak");

    const videoEl = document.getElementById("clueModalVideo");

    if (videoEl) {
      videoEl.pause();
      videoEl.removeAttribute("src");
      videoEl.load();
    }
  }
}

if (videoBtn) {
  videoBtn.addEventListener("click", () => openModal("videoModal"));
}

if (imageBtn) {
  imageBtn.addEventListener("click", () => openModal("imageModal"));
}

document.querySelectorAll(".modal-close").forEach((btn) => {
  btn.addEventListener("click", () => {
    const modalId = btn.dataset.closeModal;
    closeModal(modalId);
  });
});

document.querySelectorAll(".modal").forEach((modal) => {
  modal.addEventListener("click", (event) => {
    if (event.target === modal) {
      closeModal(modal.id);
    }
  });
});

window.addEventListener("resize", () => {
  const oxygenOverlay = document.getElementById("oxygen-overlay");

  if (oxygenOverlay && oxygenOverlay.style.display !== "none") {
    placeOxygenOverlay();
  }
});

// ================================
// INITIAL LOAD
// ================================

window.addEventListener("load", () => {
  console.log("페이지 로드 완료");

  if (airLevelText) {
    airLevelText.textContent = airLevel;
  }

  updateHints();
  startOxygenTimer(); //start dropping oxygen from beggining of game, comment out when unneeded

  setTimeout(() => {
    if (chatLog && chatLog.childElementCount === 0) {
      console.log("초기 메시지 요청");
      sendMessage(true);
    }
  }, 500);
});

// ================================
// HOTSPOT & MODAL LOGIC
// ================================
function updateOxygenOverlayText() {
  const oxygenOverlay = document.getElementById("oxygen-overlay");

  if (!oxygenOverlay) return;

  oxygenOverlay.textContent = `${airLevel}%`;

  if (oxygenOverlay.style.display !== "none") {
    placeOxygenOverlay();
  }
}

function placeOxygenOverlay() {
  const img = document.getElementById("clueModalImage");
  const overlay = document.getElementById("oxygen-overlay");

  if (!img || !overlay || !img.naturalWidth || !img.naturalHeight) return;

  const rect = img.getBoundingClientRect();

  const imgRatio = img.naturalWidth / img.naturalHeight;
  const boxRatio = rect.width / rect.height;

  let realWidth = rect.width;
  let realHeight = rect.height;
  let realLeft = 0;
  let realTop = 0;

  if (imgRatio > boxRatio) {
    realHeight = rect.width / imgRatio;
    realTop = (rect.height - realHeight) / 2;
  } else {
    realWidth = rect.height * imgRatio;
    realLeft = (rect.width - realWidth) / 2;
  }

  overlay.style.left = `${realLeft + realWidth * 0.48}px`;
  overlay.style.top = `${realTop + realHeight * 0.41}px`;
  const fontSize = realWidth * 0.055;
  overlay.style.fontSize = `${fontSize}px`;
}

function showClueModal(title, mediaSrc) {
  const modal = document.getElementById("clueModal");
  const titleEl = document.getElementById("clueModalTitle");
  const imgEl = document.getElementById("clueModalImage");
  const videoEl = document.getElementById("clueModalVideo");
  const oxygenOverlay = document.getElementById("oxygen-overlay");

  if (!modal || !titleEl || !imgEl || !videoEl) return;

  titleEl.textContent = title;
  currentClueModalTitle = title;

  // Reset image
  imgEl.style.display = "none";
  imgEl.src = "";
  imgEl.onload = null;

  // Reset video
  videoEl.style.display = "none";
  videoEl.pause();
  videoEl.removeAttribute("src");
  videoEl.load();

  // Hide oxygen overlay by default
  if (oxygenOverlay) {
    oxygenOverlay.style.display = "none";
  }

  modal.style.display = "block";

  // Show video if the source is mp4
  if (mediaSrc && mediaSrc.toLowerCase().endsWith(".mp4")) {
    videoEl.src = mediaSrc;
    videoEl.style.display = "block";

    videoEl.muted = localStorage.getItem("sfxEnabled") === "false";
    videoEl.volume = 0.8;

    videoEl.play().catch((err) => {
      console.warn("Modal video play failed:", err);
    });
  }

  // Otherwise show image
  else if (mediaSrc) {
    imgEl.src = mediaSrc;
    imgEl.style.display = "block";
  }

  

  // Only show oxygen overlay for oxygen tank image
  if (
    oxygenOverlay &&
    mediaSrc &&
    mediaSrc.includes("cargohold_oxygenTank.png")
  ) {
    oxygenOverlay.style.display = "block";
    updateOxygenOverlayText();

    if (imgEl.complete) {
      placeOxygenOverlay();
    } else {
      imgEl.onload = placeOxygenOverlay;
    }
  }
}

//   if (modal && titleEl && imgEl) {
//     titleEl.textContent = title;
//     imgEl.src = imageSrc;
//     imgEl.style.display = imageSrc ? "block" : "none";
//     modal.style.display = "block";

//     // Default: hide overlay
//     if (oxygenOverlay) {
//       oxygenOverlay.style.display = "none";
//     }

//     // Only show overlay for oxygen tank clue
//     if (
//       oxygenOverlay &&
//       imageSrc &&
//       imageSrc.includes("cargohold_oxygenTank.png")
//     ) {
//       oxygenOverlay.textContent = `${airLevel}%`;
//       oxygenOverlay.style.display = "block";

//       // position of the number on the image
//       if (imgEl.complete) {
//         placeOxygenOverlay();
//       } else {
//         imgEl.onload = placeOxygenOverlay;
//       }
//     }
//   }
// }

window.addEventListener("load", () => {
  const hotspotFood = document.getElementById("hotspot-food");
  if (hotspotFood) {
    hotspotFood.addEventListener("click", () => {
      addClueMemo("food");
      showClueModal("FOOD BOX", "/static/images/chatbot/LivingArea_food box.png");
    });
  }

  const hotspotSystem = document.getElementById("hotspot-system");
  if (hotspotSystem) {
    hotspotSystem.addEventListener("click", () => {
      addClueMemo("system");
      showClueModal("SYSTEM SCREEN", "/static/images/chatbot/LivingArea_Systemscreen.png");
    });
  }

  const hotspotMessage = document.getElementById("hotspot-message");
  if (hotspotMessage) {
    hotspotMessage.addEventListener("click", () => {
      window.playSfx?.("messageOpen", 0.65);
      addClueMemo("message");
      showClueModal("MESSAGE LOG", "/static/images/chatbot/LivingArea_message.png");
    });
  }

  const hotspotCargoEmpty = document.getElementById("hotspot-cargo-empty");
  if (hotspotCargoEmpty) {
    hotspotCargoEmpty.addEventListener("click", () => {
      addClueMemo("cargoEmpty");
      showClueModal("EMPTY STORAGE", "/static/images/chatbot/cargohold_empty.png");
    });
  }

  const hotspotCargoOxygen = document.getElementById("hotspot-cargo-oxygen");
  if (hotspotCargoOxygen) {
    hotspotCargoOxygen.addEventListener("click", () => {
      window.playLoopingSfx?.("oxygenLeak", 0.55);
      addClueMemo("cargoOxygen");
      showClueModal("OXYGEN TANK", "/static/images/chatbot/cargohold_oxygenTank.png");
    });
  }


  const hotspotCockpitMainInterface = document.getElementById("hotspot-cockpit-main-interface");
  if (hotspotCockpitMainInterface) {
    hotspotCockpitMainInterface.addEventListener("click", () => {
      addClueMemo("cockpitMainInterface");
      showClueModal("COCKPIT MAIN INTERFACE", "/static/images/chatbot/Cockpit_Main_Interface.png");
    });
  }

  const hotspotCockpitSubInterface = document.getElementById("hotspot-cockpit-sub-interface");
  if (hotspotCockpitSubInterface) {
    hotspotCockpitSubInterface.addEventListener("click", () => {
      addClueMemo("cockpitSubInterface");
      showClueModal("COCKPIT SUB INTERFACE", "/static/images/chatbot/Cockpit_Sub_interface.png");
    });
  }

  const hotspotCockpitCamera = document.getElementById("hotspot-cockpit-camera");
  if (hotspotCockpitCamera) {
    hotspotCockpitCamera.addEventListener("click", () => {
      addClueMemo("cockpitCamera");
      showClueModal("COCKPIT CAMERA", "/static/videos/chatbot/Cockpit_camera.mp4");
    });
  }
});
