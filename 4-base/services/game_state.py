# game_state.py

class GameState:
    STAGE_STATES = {
        1: {
            "label": "Phase 1 - 신뢰",
            "location": "생활 공간",
            "visited_rooms": ["생활 공간"],
            "suspicion": 0,
            "is_emergency": False,
        },
        2: {
            "label": "Phase 2 - 의심",
            "location": "화물칸",
            "visited_rooms": ["생활 공간", "화물칸"],
            "suspicion": 45,
            "is_emergency": True,
        },
        3: {
            "label": "Phase 3 - 적대",
            "location": "조종실",
            "visited_rooms": ["생활 공간", "화물칸", "조종실"],
            "suspicion": 85,
            "is_emergency": True,
        },
    }

    def __init__(self):
        # 1. 위치 및 시간 상태
        self.current_location = "생활 공간"  # 초기 시작 위치
        self.turn_count = 0             # 진행된 대화 턴 수
        self.stage = 1
        self.stage_label = self.STAGE_STATES[1]["label"]
        
        # 2. 생존 자원 상태
        self.oxygen = 20               # 산소 잔량 (%)
        self.is_emergency = False       # 비상 사태 여부
        
        # 3. 스토리 및 조사 상태
        self.discovered_clues = []      # 발견한 단서 리스트
        self.visited_rooms = ["생활 공간"]   # 방문했던 구역 기록
        self.ai_suspicion_level = 0     # AI에 대한 의심 수치 (0~100)

    def apply_stage(self, stage):
        """프론트엔드 currentStage에 맞춰 게임 상태를 갱신"""
        try:
            stage = int(stage)
        except (TypeError, ValueError):
            stage = 1

        stage = max(1, min(stage, 3))
        stage_state = self.STAGE_STATES[stage]

        self.stage = stage
        self.stage_label = stage_state["label"]
        self.current_location = stage_state["location"]
        self.visited_rooms = list(stage_state["visited_rooms"])
        self.ai_suspicion_level = max(self.ai_suspicion_level, stage_state["suspicion"])
        self.is_emergency = stage_state["is_emergency"]

        return self

    def update_turn(self):
        """매 대화마다 상태 업데이트"""
        pass
        
    def add_clue(self, clue):
        """새로운 단서 발견 시 추가"""
        if clue not in self.discovered_clues:
            self.discovered_clues.append(clue)
            # 특정 단서를 찾으면 의심 수치 상승
            self.ai_suspicion_level += 15

    def get_summary(self):
        """프롬프트 주입용 상태 요약 텍스트 생성"""
        return {
            "stage": self.stage,
            "stage_label": self.stage_label,
            "location": self.current_location,
            "visited_rooms": ", ".join(self.visited_rooms),
            "oxygen": f"{self.oxygen}%",
            "clues": ", ".join(self.discovered_clues) if self.discovered_clues else "없음",
            "suspicion": self.ai_suspicion_level,
            "is_emergency": "예" if self.is_emergency else "아니오",
        }
