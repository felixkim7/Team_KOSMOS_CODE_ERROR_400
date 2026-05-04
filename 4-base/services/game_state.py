class GameState:
    """프롬프트에 주입할 현재 게임 상태 스냅샷."""

    AREA_LABELS = {
        "living": "생활 공간",
        "cargo": "화물칸",
        "cockpit": "조종실",
    }

    STORY_FLAG_LABELS = {
        "hasEnteredLivingArea": "생활 공간 방문",
        "hasEnteredCargoBay": "화물칸 방문",
        "hasEnteredCockpit": "조종실 진입",
        "hasOfferedNewMission": "새로운 임무 제안",
        "hasRevealedNewMission": "새로운 임무 공개",
        "hasOfferedCockpitEntry": "조종실 진입 선택지 제시",
        "awaitingOrbitReturnCode": "회항 코드 입력 대기",
        "earthOrbitChoiceShown": "승인/회항 선택지 제시",
    }

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
        self.stage = 1
        self.stage_label = self.STAGE_STATES[1]["label"]
        self.current_location = self.STAGE_STATES[1]["location"]
        self.visited_rooms = list(self.STAGE_STATES[1]["visited_rooms"])
        self.oxygen = 20
        self.is_emergency = self.STAGE_STATES[1]["is_emergency"]
        self.ai_suspicion_level = self.STAGE_STATES[1]["suspicion"]
        self.story_flags = {}

    def apply_stage(self, stage):
        """프론트엔드 currentStage에 맞춰 프롬프트용 상태를 갱신."""
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
        self.ai_suspicion_level = stage_state["suspicion"]
        self.is_emergency = stage_state["is_emergency"]

        return self

    def apply_frontend_state(self, visited_areas=None, story_flags=None):
        """프론트엔드가 보낸 실제 방문 구역과 스토리 플래그를 반영."""
        if isinstance(visited_areas, list):
            rooms = []
            for area in visited_areas:
                label = self.AREA_LABELS.get(area, area)
                if label and label not in rooms:
                    rooms.append(label)

            if rooms:
                self.visited_rooms = rooms
                self.current_location = rooms[-1]

        if isinstance(story_flags, dict):
            self.story_flags = {
                key: bool(value)
                for key, value in story_flags.items()
                if key in self.STORY_FLAG_LABELS
            }

        return self

    def get_summary(self):
        """프롬프트 주입용 상태 요약 생성."""
        active_flags = [
            self.STORY_FLAG_LABELS[key]
            for key, value in self.story_flags.items()
            if value
        ]

        return {
            "stage": self.stage,
            "stage_label": self.stage_label,
            "location": self.current_location,
            "visited_rooms": ", ".join(self.visited_rooms),
            "suspicion": self.ai_suspicion_level,
            "is_emergency": "예" if self.is_emergency else "아니오",
            "story_flags": ", ".join(active_flags) if active_flags else "없음",
        }
