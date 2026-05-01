# game_state.py

class GameState:
    def __init__(self):
        # 1. 위치 및 시간 상태
        self.current_location = "생활 공간"  # 초기 시작 위치
        self.turn_count = 0             # 진행된 대화 턴 수
        
        # 2. 생존 자원 상태
        self.oxygen = 100               # 산소 잔량 (%)
        self.is_emergency = False       # 비상 사태 여부
        
        # 3. 스토리 및 조사 상태
        self.discovered_clues = []      # 발견한 단서 리스트
        self.visited_rooms = ["생활 공간"]   # 방문했던 구역 기록
        self.ai_suspicion_level = 0     # AI에 대한 의심 수치 (0~100)

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
            "location": self.current_location,
            "oxygen": f"{self.oxygen}%",
            "clues": ", ".join(self.discovered_clues) if self.discovered_clues else "없음",
            "suspicion": self.ai_suspicion_level
        }