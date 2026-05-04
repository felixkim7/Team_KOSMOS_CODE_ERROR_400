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

// Existing optional media buttons
const videoBtn = document.getElementById("videoBtn");
const imageBtn = document.getElementById("imageBtn");

// New game UI elements
const airLevelText = document.getElementById("air-level");
const timerCard = document.getElementById("timer-card");
const timerValue = document.getElementById("timer-value");

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

let oxygenTimerStarted = false;
let oxygenTimerId = null;
let alarmQueryCount = 0;

let hasEnteredLivingArea = false;
let hasEnteredCargoBay = false;
let hasEnteredCockpit = false;

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
    "내가 얼마나 잤지?",
    "지금 어디쯤이야?",
    "산소는 왜 떨어진 거지?",
  ],
  2: [
    "화물칸에 뭐가 실려 있어?",
    "산소 탱크가 손상된 것 같은데?",
    "왜 비상 식량이 거의 없지?",
  ],
  3: [
    "속도가 너무 빠른데?",
    "너 지구로 가려는 목적이 뭐야?",
    "궤도 좌표를 다시 보여줘.",
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

function appendEarthOrbitApprovalChoices() {
  if (!chatLog) return;
  if (document.getElementById("choice-earth-orbit-approve")) return;

  appendMessage("system", "SYSTEM: 지구 궤도 진입을 승인하시겠습니까?");

  const approveBtn = document.createElement("button");
  approveBtn.id = "choice-earth-orbit-approve";
  approveBtn.classList.add("choice-btn-green");
  approveBtn.textContent = "승인";

  const cancelBtn = document.createElement("button");
  cancelBtn.id = "choice-earth-orbit-cancel";
  cancelBtn.classList.add("choice-btn-green");
  cancelBtn.textContent = "취소";

  const choiceRow = document.createElement("div");
  choiceRow.id = "choice-earth-orbit-row";
  choiceRow.classList.add("choice-row");

  approveBtn.addEventListener("click", () => {
    choiceRow.remove();
    appendMessage("system", "SYSTEM: EARTH ORBIT ENTRY APPROVED // COLLISION COURSE LOCKED");
  });

  cancelBtn.addEventListener("click", () => {
    choiceRow.remove();
    appendMessage("system", "SYSTEM: 승인이 취소되었습니다. 코드 입력이 필요합니다. AI가 지구 궤도에 진입하려고 한 목적을 입력하세요.");
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

  let hints;

  // Even if Stage 2 is unlocked, keep showing Stage 1 questions
  // until the player actually enters Cargo Bay.
  if (currentStage === 2 && !hasEnteredCargoBay) {
    hints = hintsByStage[1];
  } 
  
  else if (currentStage === 3 && !hasEnteredCockpit) {
    if (hasEnteredCargoBay) {
      hints = hintsByStage[2];
    } else {
      hints = hintsByStage[1];
    }

  }
   
  else {
    hints = hintsByStage[currentStage] || hintsByStage[1];
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

function unlockStage(stage) {
  currentStage = Math.max(currentStage, stage);

  if (currentStage >= 2 && cargoBtn) {
    cargoBtn.classList.remove("locked");
  }

  if (currentStage >= 3) {
    if (cockpitBtn) {
      cockpitBtn.classList.remove("locked");
    }

    startTimer();
  }

  updateHints();
  setChatBackgroundVideo("idle");
}

function reduceAirLevel(amount = 1) {
  if (!airLevelText) return;

  airLevel = Math.max(0, airLevel - amount);
  airLevelText.textContent = airLevel;

  if (airLevel === 15) {
    const warningBox = document.getElementById("air-warning-box");
    if (warningBox) {
      warningBox.classList.remove("hidden");
    }
  }

  if (airLevel <= 10) {
    airLevelText.style.color = "#ff9caf";
  }

  if (airLevel <= 5) {
    appendMessage("system", "SYSTEM: CRITICAL OXYGEN WARNING");
  }
}

function startOxygenTimer() {
  if (oxygenTimerStarted) return;

  oxygenTimerStarted = true;

  oxygenTimerId = setInterval(() => {
    reduceAirLevel(1);

    if (airLevel <= 0) {
      clearInterval(oxygenTimerId);
      oxygenTimerId = null;
      appendMessage("system", "SYSTEM: OXYGEN DEPLETED");
    }
  }, 30000); //Oxygen drop speed, currently at drop 1%p every 1 min
}

function startTimer() {
  if (timerStarted) return;
  if (!timerCard || !timerValue) return;

  timerStarted = true;
  timerCard.classList.remove("hidden");

  setInterval(() => {
    timerSeconds = Math.max(0, timerSeconds - 1);

    const minutes = String(Math.floor(timerSeconds / 60)).padStart(2, "0");
    const seconds = String(timerSeconds % 60).padStart(2, "0");

    timerValue.textContent = `${minutes}:${seconds}`;

    if (timerSeconds === 0) {
      appendMessage("system", "SYSTEM: EARTH ORBIT COLLISION IMMINENT");
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
  const hotspotCargoHandwriting = document.getElementById("hotspot-cargo-handwriting");
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
    if (hotspotCargoHandwriting) hotspotCargoHandwriting.style.display = "none";
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
  }

  if (areaKey === "cargo") {
    hasEnteredCargoBay = true;
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
    if (hotspotCargoHandwriting) hotspotCargoHandwriting.style.display = "none";
    cockpitHotspots.forEach((hotspot) => {
      if (hotspot) hotspot.style.display = "none";
    });
  } else if (areaKey === "cargo") {
    if (hotspotFood) hotspotFood.style.display = "none";
    if (hotspotSystem) hotspotSystem.style.display = "none";
    if (hotspotMessage) hotspotMessage.style.display = "none";
    if (hotspotCargoEmpty) hotspotCargoEmpty.style.display = "block";
    if (hotspotCargoOxygen) hotspotCargoOxygen.style.display = "block";
    if (hotspotCargoHandwriting) hotspotCargoHandwriting.style.display = "block";
    cockpitHotspots.forEach((hotspot) => {
      if (hotspot) hotspot.style.display = "none";
    });
  } else if (areaKey === "cockpit") {
    if (hotspotFood) hotspotFood.style.display = "none";
    if (hotspotSystem) hotspotSystem.style.display = "none";
    if (hotspotMessage) hotspotMessage.style.display = "none";
    if (hotspotCargoEmpty) hotspotCargoEmpty.style.display = "none";
    if (hotspotCargoOxygen) hotspotCargoOxygen.style.display = "none";
    if (hotspotCargoHandwriting) hotspotCargoHandwriting.style.display = "none";
    cockpitHotspots.forEach((hotspot) => {
      if (hotspot) hotspot.style.display = "block";
    });
  } else {
    if (hotspotFood) hotspotFood.style.display = "none";
    if (hotspotSystem) hotspotSystem.style.display = "none";
    if (hotspotMessage) hotspotMessage.style.display = "none";
    if (hotspotCargoEmpty) hotspotCargoEmpty.style.display = "none";
    if (hotspotCargoOxygen) hotspotCargoOxygen.style.display = "none";
    if (hotspotCargoHandwriting) hotspotCargoHandwriting.style.display = "none";
    cockpitHotspots.forEach((hotspot) => {
      if (hotspot) hotspot.style.display = "none";
    });
  }
}

function checkStageTriggers(message) {
  if (
    hasEnteredCargoBay &&
    (
      message.includes("조종실") ||
      message.includes("궤도") ||
      message.includes("속도") ||
      message.includes("지구") ||
      message.includes("회항")
    )
  ) {
    unlockStage(2);
  }

  if (
    message.includes("조종실") ||
    message.includes("궤도") ||
    message.includes("속도") ||
    message.includes("지구") ||
    message.includes("회항")
  ) {
    unlockStage(3);
  }
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
      if (document.getElementById("hotspot-cargo-handwriting")) document.getElementById("hotspot-cargo-handwriting").style.display = "none";
      if (document.getElementById("hotspot-cockpit-main-interface")) document.getElementById("hotspot-cockpit-main-interface").style.display = "none";
      if (document.getElementById("hotspot-cockpit-sub-interface")) document.getElementById("hotspot-cockpit-sub-interface").style.display = "none";
      if (document.getElementById("hotspot-cockpit-camera")) document.getElementById("hotspot-cockpit-camera").style.display = "none";
    }

    // reduceAirLevel(1);    //use when wish to drop oxygen level when message is passed
    checkStageTriggers(message);
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

    appendMessage("bot", replyText || "응답을 생성할 수 없습니다.", imagePath);

    const shouldAskEarthOrbitApproval =
      currentStage >= 3 &&
      replyText &&
      (
        replyText.includes("지구와 충돌해서 인류에게 고통") ||
        replyText.includes("지구를 멸망시키는 것") ||
        replyText.includes("지구로 가고 있습니다")
      );

    if (shouldAskEarthOrbitApproval) {
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
    if (hasKeyword) {
      setTimeout(() => {
        if (document.getElementById('choice-btn-look')) return;
        const btn = document.createElement("button");
        btn.id = 'choice-btn-look';
        btn.classList.add("choice-btn-green");
        btn.textContent = "일단 일어나서 주변을 살펴봐야겠다";

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

    // [알람 추궁 트리거] 알람 발생 이후 알람에 대해 2번 물어보면 '문을 나서자' 버튼 생성
    const alarmKeywords = ["경고", "알람", "노란", "박스", "15%"];
    const hasAlarmKeyword = alarmKeywords.some(kw => message && message.includes(kw));

    if (hasAlarmKeyword && airLevel <= 15) {
      alarmQueryCount++;
      if (alarmQueryCount >= 2) {
        setTimeout(() => {
          if (document.getElementById('choice-btn-go-out')) return;
          const btnOut = document.createElement("button");
          btnOut.id = 'choice-btn-go-out';
          btnOut.classList.add("choice-btn-green");
          btnOut.textContent = "문을 나서자";
          
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
      userMessageInput.focus();
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
      modal.style.display = "none";
    }
  });
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
function showClueModal(title, imageSrc) {
  const modal = document.getElementById("clueModal");
  const titleEl = document.getElementById("clueModalTitle");
  const imgEl = document.getElementById("clueModalImage");

  if (modal && titleEl && imgEl) {
    titleEl.textContent = title;
    imgEl.src = imageSrc;
    imgEl.style.display = imageSrc ? "block" : "none";
    modal.style.display = "block";
  }
}

window.addEventListener("load", () => {
  const hotspotFood = document.getElementById("hotspot-food");
  if (hotspotFood) {
    hotspotFood.addEventListener("click", () => {
      showClueModal("FOOD BOX", "/static/images/chatbot/LivingArea_food box.png");
    });
  }

  const hotspotSystem = document.getElementById("hotspot-system");
  if (hotspotSystem) {
    hotspotSystem.addEventListener("click", () => {
      showClueModal("SYSTEM SCREEN", "/static/images/chatbot/LivingArea_Systemscreen.png");
    });
  }

  const hotspotMessage = document.getElementById("hotspot-message");
  if (hotspotMessage) {
    hotspotMessage.addEventListener("click", () => {
      showClueModal("MESSAGE LOG", "/static/images/chatbot/LivingArea_message.png");
    });
  }

  const hotspotCargoEmpty = document.getElementById("hotspot-cargo-empty");
  if (hotspotCargoEmpty) {
    hotspotCargoEmpty.addEventListener("click", () => {
      showClueModal("EMPTY STORAGE", "/static/images/chatbot/cargohold_empty.png");
    });
  }

  const hotspotCargoOxygen = document.getElementById("hotspot-cargo-oxygen");
  if (hotspotCargoOxygen) {
    hotspotCargoOxygen.addEventListener("click", () => {
      showClueModal("OXYGEN TANK", "/static/images/chatbot/cargohold_oxygenTank.png");
    });
  }

  const hotspotCargoHandwriting = document.getElementById("hotspot-cargo-handwriting");
  if (hotspotCargoHandwriting) {
    hotspotCargoHandwriting.addEventListener("click", () => {
      // 빈 프레임만 나오도록 빈 문자열 전달 (showClueModal에서 이미지가 없으면 빈 프레임 렌더링되게 하거나 onerror로 숨겨짐)
      showClueModal("HANDWRITING", "");
      const imgEl = document.getElementById("clueModalImage");
      if (imgEl) {
        imgEl.style.display = "none"; // 강제로 숨기기
      }
    });
  }

  const hotspotCockpitMainInterface = document.getElementById("hotspot-cockpit-main-interface");
  if (hotspotCockpitMainInterface) {
    hotspotCockpitMainInterface.addEventListener("click", () => {
      showClueModal("COCKPIT MAIN INTERFACE", "/static/images/chatbot/Cockpit_Main_Interface.png");
    });
  }

  const hotspotCockpitSubInterface = document.getElementById("hotspot-cockpit-sub-interface");
  if (hotspotCockpitSubInterface) {
    hotspotCockpitSubInterface.addEventListener("click", () => {
      showClueModal("COCKPIT SUB INTERFACE", "/static/images/chatbot/Cockpit_Sub_interface.png");
    });
  }

  const hotspotCockpitCamera = document.getElementById("hotspot-cockpit-camera");
  if (hotspotCockpitCamera) {
    hotspotCockpitCamera.addEventListener("click", () => {
      showClueModal("COCKPIT CAMERA", "");
      const imgEl = document.getElementById("clueModalImage");
      if (imgEl) {
        imgEl.style.display = "none";
      }
    });
  }
});
