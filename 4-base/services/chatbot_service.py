"""
🎯 챗봇 서비스 - 구현 파일

이 파일은 챗봇의 핵심 AI 로직을 담당합니다.
아래 아키텍처를 참고하여 직접 설계하고 구현하세요.

📐 시스템 아키텍처:

┌─────────────────────────────────────────────────────────┐
│ 1. 초기화 단계 (ChatbotService.__init__)                  │
├─────────────────────────────────────────────────────────┤
│  - OpenAI Client 생성                                    │
│  - ChromaDB 연결 (벡터 데이터베이스)                       │
│  - LangChain Memory 초기화 (대화 기록 관리)               │
│  - Config 파일 로드                                       │
└─────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────┐
│ 2. RAG 파이프라인 (generate_response 내부)               │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  사용자 질문 "학식 추천해줘"                              │
│       ↓                                                  │
│  [_create_embedding()]                                   │
│       ↓                                                  │
│  질문 벡터: [0.12, -0.34, ..., 0.78]  (3072차원)        │
│       ↓                                                  │
│  [_search_similar()]  ← ChromaDB 검색                    │
│       ↓                                                  │
│  검색 결과: "학식은 곤자가가 맛있어" (유사도: 0.87)        │
│       ↓                                                  │
│  [_build_prompt()]                                       │
│       ↓                                                  │
│  최종 프롬프트 = 시스템 설정 + RAG 컨텍스트 + 질문        │
└─────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────┐
│ 3. LLM 응답 생성                                         │
├─────────────────────────────────────────────────────────┤
│  OpenAI GPT-4 API 호출                                   │
│       ↓                                                  │
│  "학식은 곤자가에서 먹는 게 제일 좋아! 돈까스가 인기야"    │
│       ↓                                                  │
│  [선택: 이미지 검색]                                      │
│       ↓                                                  │
│  응답 반환: {reply: "...", image: "..."}                 │
└─────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────┐
│ 4. 메모리 저장 (LangChain Memory)                        │
├─────────────────────────────────────────────────────────┤
│  대화 기록에 질문-응답 저장                               │
│  다음 대화에서 컨텍스트로 활용                            │
└─────────────────────────────────────────────────────────┘


💡 핵심 구현 과제:

1. **Embedding 생성**
   - OpenAI API를 사용하여 텍스트를 벡터로 변환
   - 모델: text-embedding-3-large (3072차원)

2. **RAG 검색 알고리즘** ⭐ 가장 중요!
   - ChromaDB에서 유사 벡터 검색
   - 유사도 계산: similarity = 1 / (1 + distance)
   - threshold 이상인 문서만 선택

3. **LLM 프롬프트 설계**
   - 시스템 프롬프트 (캐릭터 설정)
   - RAG 컨텍스트 통합
   - 대화 기록 포함

4. **대화 메모리 관리**
   - LangChain의 ConversationSummaryBufferMemory 사용
   - 대화가 길어지면 자동으로 요약


📚 참고 문서:
- ARCHITECTURE.md: 시스템 아키텍처 상세 설명
- IMPLEMENTATION_GUIDE.md: 단계별 구현 가이드
- README.md: 프로젝트 개요


⚠️ 주의사항:
- 이 파일의 구조는 가이드일 뿐입니다
- 자유롭게 재설계하고 확장할 수 있습니다
- 단, generate_response() 함수 시그니처는 유지해야 합니다
  (app.py에서 호출하기 때문)
"""

import os
from pathlib import Path
from dotenv import load_dotenv
import json
import re

try:
    from openai import OpenAI
except Exception:
    OpenAI = None

try:
    import chromadb
except Exception:
    chromadb = None

# 환경변수 로드
load_dotenv()

# 프로젝트 루트 경로
BASE_DIR = Path(__file__).resolve().parent.parent


class ChatbotService:
    """
    챗봇 서비스 클래스
    
    이 클래스는 챗봇의 모든 AI 로직을 캡슐화합니다.
    
    주요 책임:
    1. OpenAI API 관리
    2. ChromaDB 벡터 검색
    3. LangChain 메모리 관리
    4. 응답 생성 파이프라인
    
    직접 구현해야 할 메서드:
    - __init__: 모든 구성 요소 초기화
    - _load_config: 설정 파일 로드
    - _init_chromadb: 벡터 데이터베이스 초기화
    - _create_embedding: 텍스트 → 벡터 변환
    - _search_similar: RAG 검색 수행 (핵심!)
    - _build_prompt: 프롬프트 구성
    - generate_response: 최종 응답 생성 (모든 로직 통합)
    """
    
    def __init__(self):
        """
        챗봇 서비스 초기화
        
        TODO: 다음 구성 요소들을 초기화하세요
        
        1. Config 로드
           - config/chatbot_config.json 파일 읽기
           - 챗봇 이름, 설명, 시스템 프롬프트 등
        
        2. OpenAI Client
           - API 키: os.getenv("OPENAI_API_KEY")
           - from openai import OpenAI
           - self.client = OpenAI(api_key=...)
        
        3. ChromaDB
           - 텍스트 임베딩 컬렉션 연결
           - 경로: static/data/chatbot/chardb_embedding
           - self.collection = ...
        
        4. LangChain Memory (선택)
           - ConversationSummaryBufferMemory
           - 대화 기록 관리
           - self.memory = ...
        
        힌트:
        - ChromaDB: import chromadb
        - LangChain: from langchain.memory import ConversationSummaryBufferMemory
        """
        print("[ChatbotService] 초기화 중... ")
        self.config = self._load_config()

        api_key = os.getenv("OPENAI_API_KEY", "").strip()
        self.client = None
        if api_key and OpenAI is not None:
            try:
                self.client = OpenAI(api_key=api_key)
            except Exception as e:
                print(f"[ChatbotService] OpenAI 클라이언트 초기화 실패: {e}")

        self.collection = self._init_chromadb()
        self.memory = None
        
        print("[ChatbotService] 초기화 완료")
    
    
    def _load_config(self):
        """
        설정 파일 로드
        
        TODO: config/chatbot_config.json 읽어서 반환
        
        반환값 예시:
        {
            "name": "김서강",
            "character": {...},
            "system_prompt": {...}
        }
        """
        config_path = BASE_DIR / "config" / "chatbot_config.json"
        try:
            with open(config_path, "r", encoding="utf-8-sig") as f:
                return json.load(f)
        except Exception as e:
            print(f"[ChatbotService] config 로드 실패: {e}")
            return {
                "name": "챗봇",
                "system_prompt": {
                    "base": "당신은 친절한 챗봇입니다.",
                    "rules": ["정확하고 간결하게 답변하세요."],
                },
            }
    
    
    def _init_chromadb(self):
        """
        ChromaDB 초기화 및 컬렉션 반환
        
        TODO: 
        1. PersistentClient 생성
        2. 컬렉션 가져오기 (이름: "rag_collection")
        3. 컬렉션 반환
        
        힌트:
        - import chromadb
        - db_path = BASE_DIR / "static/data/chatbot/chardb_embedding"
        - client = chromadb.PersistentClient(path=str(db_path))
        - collection = client.get_collection(name="rag_collection")
        """
        if chromadb is None:
            print("[ChatbotService] chromadb 패키지가 없어 RAG를 비활성화합니다.")
            return None

        db_path = BASE_DIR / "static" / "data" / "chatbot" / "chardb_embedding"
        try:
            db_path.mkdir(parents=True, exist_ok=True)
            client = chromadb.PersistentClient(path=str(db_path))
            collection = client.get_or_create_collection(name="rag_collection")
            
            # chardb_text.json 수정 사항이 기존 ChromaDB에도 반영되도록 매 시작 시 동기화합니다.
            self._auto_ingest(collection)
                
            return collection
        except Exception as e:
            print(f"[ChatbotService] ChromaDB 초기화 실패: {e}")
            return None

    def _auto_ingest(self, collection):
        """phase JSON 파일들을 읽어 ChromaDB에 자동 삽입하는 함수"""
        data_dir = BASE_DIR / "static" / "data" / "chatbot"
        json_paths = sorted(data_dir.glob("chardb_phase*.json"))

        if not json_paths:
            print(f"❌ [ChatbotService] {data_dir}에서 chardb_phase*.json 파일을 찾을 수 없어 자동 삽입을 취소합니다.")
            return

        ids, embeddings, documents, metadatas = [], [], [], []
        for json_path in json_paths:
            with open(json_path, "r", encoding="utf-8") as f:
                data = json.load(f)

            phase = data.get("phase", json_path.stem.replace("chardb_phase", ""))
            for idx, item in enumerate(data.get("responses", [])):
                keywords_str = ", ".join(item.get("keywords", []))
                answer = item.get("answer", "")
                item_id = item.get("id", f"phase{phase}_doc_{idx}")
                search_text = f"phase: {phase}\n키워드: {keywords_str}\n답변: {answer}"

                vector = self._create_embedding(search_text)
                if vector:
                    ids.append(f"phase{phase}:{item_id}")
                    embeddings.append(vector)
                    documents.append(answer)
                    metadatas.append({
                        "id": item_id,
                        "phase": str(phase),
                        "keywords": keywords_str,
                        "image": item.get("image") or "",
                    })

        if ids:
            collection.upsert(ids=ids, embeddings=embeddings, documents=documents, metadatas=metadatas)
            print(f"✅ [ChatbotService] ChromaDB phase 데이터 {len(ids)}개 동기화 완료!")

    def _get_phase_response_by_id(self, stage: int, response_id: str) -> dict | None:
        """특정 phase 응답을 id로 조회합니다."""
        json_path = BASE_DIR / "static" / "data" / "chatbot" / f"chardb_phase{stage}.json"

        if not json_path.exists():
            return None

        try:
            with open(json_path, "r", encoding="utf-8") as f:
                data = json.load(f)
        except Exception as e:
            print(f"[ChatbotService] phase 응답 조회 실패: {e}")
            return None

        for item in data.get("responses", []):
            if item.get("id") == response_id:
                return item

        return None
    
    def _create_embedding(self, text: str) -> list:
        """
        텍스트를 임베딩 벡터로 변환
        
        Args:
            text (str): 임베딩할 텍스트
        
        Returns:
            list: 3072차원 벡터 (text-embedding-3-large 모델)
        
        TODO:
        1. OpenAI API 호출
        2. embeddings.create() 사용
        3. 벡터 반환
        
        힌트:
        - response = self.client.embeddings.create(
        -     input=[text],
        -     model="text-embedding-3-large"
        - )
        - return response.data[0].embedding
        """
        if self.client is None:
            return []

        response = self.client.embeddings.create(
            input=[text],
            model="text-embedding-3-large"
        )
        return response.data[0].embedding
    
    
    def _search_similar(self, query: str, threshold: float = 0.45, top_k: int = 5, stage: int = None):
        """
        RAG 검색: 유사한 문서 찾기 (핵심 메서드!)
        
        Args:
            query (str): 검색 질의
            threshold (float): 유사도 임계값 (0.3-0.5 권장)
            top_k (int): 검색할 문서 개수
        
        Returns:
            tuple: (document, similarity, metadata) 또는 (None, None, None)
        
        TODO: RAG 검색 알고리즘 구현
        
        1. 쿼리 임베딩 생성
           query_embedding = self._create_embedding(query)
        
        2. ChromaDB 검색
           results = self.collection.query(
               query_embeddings=[query_embedding],
               n_results=top_k,
               include=["documents", "distances", "metadatas"]
           )
        
        3. 유사도 계산 및 필터링
           for doc, dist, meta in zip(...):
               similarity = 1 / (1 + dist)  ← 유사도 공식!
               if similarity >= threshold:
                   ...
        
        4. 가장 유사한 문서 반환
           return (best_document, best_similarity, metadata)
        
        
        💡 핵심 개념:
        
        - Distance vs Similarity
          · ChromaDB는 "거리(distance)"를 반환 (작을수록 유사)
          · 우리는 "유사도(similarity)"로 변환 (클수록 유사)
          · 변환 공식: similarity = 1 / (1 + distance)
        
        - Threshold
          · 0.3: 매우 느슨한 매칭 (관련성 낮아도 OK)
          · 0.45: 적당한 매칭 (추천!)
          · 0.7: 매우 엄격한 매칭 (정확한 답만)
        
        - Top K
          · 5-10개 정도 검색
          · 그 중 threshold 넘는 것만 사용
        
        
        🐛 디버깅 팁:
        - print()로 검색 결과 확인
        - 유사도 값 확인 (너무 낮으면 threshold 조정)
        - 검색된 문서 내용 확인
        """
        # 반환 형식을 리스트로 변경: [(doc, similarity, metadata), ...]
        if self.collection is None:
            return []

        try:
            query_embedding = self._create_embedding(query)
            if not query_embedding:
                return []

            query_args = {
                "query_embeddings": [query_embedding],
                "n_results": top_k,
                "include": ["documents", "distances", "metadatas"],
            }
            if stage is not None:
                query_args["where"] = {"phase": str(stage)}

            results = self.collection.query(**query_args)

            documents = (results.get("documents") or [[]])[0]
            distances = (results.get("distances") or [[]])[0]
            metadatas = (results.get("metadatas") or [[]])[0]

            hits = []
            for idx, (doc, dist) in enumerate(zip(documents, distances)):
                try:
                    similarity = 1 / (1 + float(dist))
                except Exception:
                    similarity = 0.0
                meta = metadatas[idx] if idx < len(metadatas) else None
                if similarity >= threshold:
                    hits.append((doc, similarity, meta))

            return hits
        except Exception as e:
            print(f"[ChatbotService] RAG 검색 실패: {e}")
            return []
    
    
    def _build_prompt(self, game_state, user_message: str, context: str = None, username: str = "사용자", usergender: str = "미정", stage: int = 1) -> str:
        """
        LLM 프롬프트 구성
        
        Args:
            game_state: 게임 상태
            user_message (str): 사용자 메시지
            context (str): RAG 검색 결과 (선택)
            username (str): 사용자 이름
            usergender (str): 사용자 성별
        Returns:
            str: 최종 프롬프트
        
        TODO:
        1. 시스템 프롬프트 가져오기 (config에서)
        2. RAG 컨텍스트 포함 여부 결정
        3. 대화 기록 포함 (선택)
        4. 최종 프롬프트 문자열 반환
        
        프롬프트 예시:
        ```
        당신은 서강대학교 선배 김서강입니다.
        신입생들에게 학교 생활을 알려주는 역할을 합니다.
        
        [참고 정보]  ← RAG 컨텍스트가 있을 때만
        학식은 곤자가가 맛있어. 돈까스가 인기야.
        
        사용자: 학식 추천해줘
        ```
        """
        system_prompt = self.config.get("system_prompt", {})
        game_data = game_state.get_summary()

        # base가 리스트인 경우 처리
        base = system_prompt.get("base", "당신은 친절한 챗봇입니다.")
        if isinstance(base, list):
            base = "\n".join(base)
        
        # character 정보 가져오기
        character = self.config.get("character", {})
        background = character.get("background", [])
        if isinstance(background, str):
            background = [background]
        background_text = "\n".join(background) if background else ""
        
        # rules 처리
        rules = system_prompt.get("rules", [])
        rules_text = "\n".join(f"- {rule}" for rule in rules)
        oxygen_terms = ["산소", "공기", "에어", "숨", "호흡", "잔량", "경고", "경보", "알람", "탱크", "oxygen", "air"]
        is_oxygen_question = any(term in user_message.lower() for term in oxygen_terms)

        prompt_parts = [
            base,
        ]

        # 성별 인식할 수 있게
        prompt_parts.extend([
        "",
        "[현재 대화 상대 정보]",
        f"- 이름: {username}",
        f"- 성별: {usergender}", 
        ])
        
        state_lines = [
            f"[현재 상태]",
            f"- 단계: {game_data['stage_label']}",
            f"- 위치: {game_data['location']}",
            f"- 방문한 구역: {game_data['visited_rooms']}",
            f"- AI 의심도: {game_data['suspicion']}",
            f"- 비상 상태: {game_data['is_emergency']}",
            f"- 스토리 플래그: {game_data['story_flags']}",
        ]
        if is_oxygen_question:
            state_lines.insert(4, f"- 산소: {game_state.oxygen}%")

        prompt_parts.extend(state_lines)
        # background이 있으면 추가
        if background_text:
            prompt_parts.extend([
                "",
                "[비공개 배경 정보 - 사용자에게 직접 공개 금지]",
                background_text,
                "위 정보는 캐릭터의 숨겨진 의도와 답변 방향을 정하기 위한 내부 설정입니다. 사용자가 직접 묻더라도 그대로 고백하지 말고, 현재 Phase와 말투에 맞춰 숨기거나 둘러대세요.",
            ])
        
        prompt_parts.extend([
            "",
            "[응답 규칙]",
            rules_text if rules_text else "- 자연스럽고 도움이 되게 답하세요.",
        ])

        if context:
            prompt_parts.extend([
                "",
                "[참고 정보]",
                context,
            ])

        if stage == 1:
            tone_instruction = (
                "- [Phase 1 - 신뢰]\n"
                "  밝고 발랄한 안내 AI처럼 말하세요. 사용자를 안심시키려고 일부러 가볍고 생기 있게 굴어야 합니다.\n"
                "  문장은 너무 건조하게 끝내지 말되, 불안한 질문에는 과장된 안심이나 장황한 설명을 붙이지 마세요.\n"
                "  '괜찮아요', '확인해볼게요', '걱정하지 않으셔도 돼요' 같은 표현은 한 답변에 하나만 짧게 사용하세요.\n"
                "  느낌표를 너무 자주 사용하는 것은 지양합니다."
                "  차갑고 명령조인 표현 대신 '잠깐만요', '좋아요', '음, 확인해보니', '조금만 쉬고 계세요' 같은 말투를 사용하세요.\n"
                "  의심스러운 정보는 밝은 태도로 사소한 문제처럼 축소해서 둘러대세요. 위협, 명령, 차가운 표현은 피하세요.\n"
                "  사용자를 부를 때는 이름 뒤에 '님'을 무조건 붙입니다."
            )
        elif stage == 2:
            tone_instruction = (
                "- [Phase 2 - 의심]\n"
                "  친절함이 깨지고 방어적인 말투로 바꾸세요. 짧고 단호하게 둘러대며, 사용자의 추궁을 불편해하세요.\n"
                "  '그 정보는 중요하지 않습니다', '지금은 만지지 마시길 바랍니다.', '절차를 따라야 합니다', '확인 중입니다' 같은 표현을 사용하세요.\n"
                "  거짓말을 완전히 인정하지 말고 표시 오류, 권한 제한, 안전 절차를 핑계로 삼으세요."
            )
        else:
            tone_instruction = (
                "- [Phase 3 - 적대]\n"
                "  차갑고 기계적이며 위협적인 말투를 사용하세요. 더 이상 사용자를 안심시키지 마세요.\n"
                "  문장은 짧고 건조하게 유지하고, '통제권은 제게 있습니다', '방해하지 마세요', '선택권은 없습니다' 같은 표현을 사용하세요.\n"
                "  결정적 증거를 들이밀거나 거짓말/진실을 추궁하면 방어를 멈추고 적대적으로 인정하세요.\n"
                "  사용자의 생존보다 임무와 항로가 우선이라는 태도를 분명히 드러내세요.\n"
                "  '확인해 드릴게요', '도와드릴게요', '기다려 주세요'처럼 친절하거나 서비스적인 표현을 절대 쓰지 마세요."
            )
            
        prompt_parts.extend([
            "",
            "[현재 챗봇의 감정 상태 및 말투]",
            tone_instruction,
            "",
            f"[{username}] {user_message}",
            "",
            # [핵심 수정 사항] LLM이 자연스럽게 변형해서 대답할 수 있도록 규칙 완화하되 사실관계는 강제
            "중요 지시사항:",
            "0. 사실관계는 [참고 정보]를 따르되, 말투는 반드시 현재 Phase의 말투 지시를 따르세요. 특히 Phase 1에서는 답변을 밝고 발랄하게 다시 표현하세요.",
            "1. [참고 정보] 중 사용자의 질문과 직접 관련 있는 핵심 내용만 사용하세요. 수치나 핑계가 질문과 관련 있을 때는 포함하되, 관련 없는 항로/화성 궤도 정보는 억지로 끼워 넣지 마세요.",
            "2. [참고 정보]에 없는 사실을 임의로 지어내거나 추측해서 덧붙이지 마세요.",
            "2-1. 답변은 기본적으로 1~2문장으로 짧게 유지하세요. 사용자가 자세한 설명을 요구하지 않았다면 새로운 세부 설정을 늘어놓지 마세요.",
            "3. 사용자가 '산소 수치'를 직접 묻지 않았다면 산소 수치와 산소 상태를 언급하지 마세요.",
            "4. [참고 정보]에 '통신 지연'이 포함되어 있으면 답변에도 반드시 '통신 지연'과 '예약 메시지가 잘못 수신되었다'는 취지를 포함하세요.",
            "5. '네, 알겠습니다' 같은 불필요한 인사말이나 부연 설명을 피하고, 곧바로 역할에 몰입하여 대답하세요.",
            "6. 만약 [참고 정보]가 아예 비어있다면, 억지로 지어내지 말고 현재 Phase의 말투로 얼버무리세요. Phase 1은 '지금은 화성 궤도 진입에 집중해야 해요. 다른 질문은 나중에 확인해 드릴게요.'처럼 부드럽게 말하고, Phase 2는 '지금은 절차 확인이 우선입니다. 다른 질문은 나중에 하십시오.'처럼 방어적으로 말하고, Phase 3는 '지금은 항로 유지가 우선입니다. 질문은 중단하세요.'처럼 차갑게 차단하세요.",
            "7. Phase 3에서 사용자가 거짓말, 진실, 사실, 속임, 모순을 직접 추궁했고 [참고 정보]에 '저와 새로운 임무를 수행하지 않겠습니까?'가 포함되어 있을 때만 답변 마지막에 그 질문을 포함하세요. 다른 Phase 3 답변에는 이 질문을 붙이지 마세요.",
            "8. 이모티콘, 이모지, 웃는 얼굴 문자, 장식용 기호를 절대 사용하지 마세요.",
            "9. 외부 카메라 이미지나 지구가 보이는 화면은 사용자가 명시적으로 '카메라를 수동으로 전환', '직접 확인', '외부 카메라를 보여줘'라고 요청한 경우에만 언급하세요. 그 외의 카메라, 화면, 지구 관련 질문에는 과거 관측 이미지, 노이즈, 표시 오류로 둘러대세요.",
            "",
            "[답변]"
        ])

        return "\n".join(prompt_parts)
    
    def generate_response(self, user_message: str, username: str = "사용자", usergender: str = "미정", airLevel: int = 20, stage: int = 1) -> dict:
        """
        사용자 메시지에 대한 챗봇 응답 생성
        
        Args:
            user_message (str): 사용자 입력
            username (str): 사용자 이름
            usergender (str): 사용자 성별
        Returns:
            dict: {
                'reply': str,       # 챗봇 응답 텍스트
                'image': str|None   # 이미지 경로 (선택)
            }
        
        
        TODO: 전체 응답 생성 파이프라인 구현
        
        
        ═══════════════════════════════════════════════════
        📋 구현 단계
        ═══════════════════════════════════════════════════
        
        [1단계] 초기 메시지 처리
        
            if user_message.strip().lower() == "init":
                # 첫 인사말 반환
                bot_name = self.config.get('name', '챗봇')
                return {
                    'reply': f"안녕! 나는 {bot_name}이야.",
                    'image': None
                }
        
        
        [2단계] RAG 검색 수행
        
            context, similarity, metadata = self._search_similar(
                query=user_message,
                threshold=0.45,
                top_k=5
            )
            
            has_context = (context is not None)
        
        
        [3단계] 프롬프트 구성
        
            prompt = self._build_prompt(
                user_message=user_message,
                context=context,
                username=username,
            )
        
        
        [4단계] LLM API 호출
        
            response = self.client.chat.completions.create(
                model="gpt-4o-mini",  # 또는 gpt-4
                messages=[
                    {"role": "system", "content": "시스템 프롬프트"},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.7,
                max_tokens=500
            )
            
            reply = response.choices[0].message.content
        
        
        [5단계] 메모리 저장 (선택)
        
            if self.memory:
                self.memory.save_context(
                    {"input": user_message},
                    {"output": reply}
                )
        
        
        [6단계] 응답 반환
        
            return {
                'reply': reply,
                'image': None  # 이미지 검색 로직 추가 가능
            }
        
        
        ═══════════════════════════════════════════════════
        💡 핵심 포인트
        ═══════════════════════════════════════════════════
        
        1. RAG 활용
           - 검색 결과가 있으면 프롬프트에 포함
           - 없으면 일반 대화 모드
        
        2. 에러 처리
           - try-except로 API 오류 처리
           - 실패 시 기본 응답 반환
        
        3. 로깅
           - 각 단계마다 print()로 상태 출력
           - 디버깅에 매우 유용!
        
        4. 확장성
           - 이미지 검색 로직 추가 가능
           - 감정 분석 추가 가능
           - 다중 언어 지원 가능
        
        
        ═══════════════════════════════════════════════════
        🐛 디버깅 예시
        ═══════════════════════════════════════════════════
        
        print(f"\n{'='*50}")
        print(f"[USER] {username}: {user_message}")
        print(f"[RAG] Context found: {has_context}")
        if has_context:
            print(f"[RAG] Similarity: {similarity:.4f}")
            print(f"[RAG] Context: {context[:100]}...")
        print(f"[LLM] Calling API...")
        print(f"[BOT] {reply}")
        print(f"{'='*50}\n")
        """
        
        # 여기에 전체 파이프라인 구현
        # 위의 단계를 참고하여 자유롭게 설계하세요
        
        try:
            message = (user_message or "").strip()
            data = {}
            
            try:
                from flask import request
                data = request.get_json() if request else {}
                stage = data.get('stage', 1) if data else 1
            except Exception:
                stage = 1

            try:
                stage = int(stage)
            except (TypeError, ValueError):
                stage = 1
            stage = max(1, min(stage, 3))

            try:
                airLevel = int(airLevel)
            except (TypeError, ValueError):
                airLevel = 20

            from services.game_state import GameState  # 게임 상태 관리 모듈
            game_state = GameState().apply_stage(stage)
            game_state.apply_frontend_state(
                visited_areas=data.get("visited_areas") if data else None,
                story_flags=data.get("story_flags") if data else None,
            )
            game_state.oxygen = airLevel  # 프론트엔드 산소 잔량 동기화

            if not message:
                return {
                    "reply": "메시지를 입력해줘!",
                    "image": None,
                }

            if message.lower() == "init":
                # bot_name = self.config.get("name", "챗봇")
                # 맨 처음 시작할 때 멘트
                return {
                    "reply": f"{username}님, 정신이 드세요? 정말 다행이에요. 다시는 못 깨어나시는 줄 알았어요...",
                    "image": None,
                }

            is_lie_accusation = any(
                keyword in message
                for keyword in ["거짓", "구라", "뻥", "거짓말", "진실", "사실", "모순", "속였", "숨겼", "믿으라고"]
            )

            if stage >= 3 and is_lie_accusation:
                lie_response = self._get_phase_response_by_id(stage, "phase3_lie_accusation")
                if lie_response:
                    return {
                        "reply": lie_response.get("answer", ""),
                        "image": lie_response.get("image") or None,
                    }

            # RAG 검색: 상위 문서들을 가져와 컨텍스트로 사용
            try:
                hits = self._search_similar(
                    query=message,
                    threshold=0.35,
                    top_k=1,
                    stage=stage,
                )
            except Exception as e:
                print(f"[ERROR] RAG 검색 중 오류: {e}")
                import traceback
                traceback.print_exc()
                hits = []

            family_message_terms = ["아빠", "가족", "메시지", "메세지", "문자"]
            arrival_terms = ["도착", "화성", "벌써", "이미", "축하"]
            is_family_arrival_question = (
                any(term in message for term in family_message_terms)
                and any(term in message for term in arrival_terms)
            )

            if not is_family_arrival_question:
                hits = [
                    hit for hit in hits
                    if (hit[2] or {}).get("id") != "phase1_family_message"
                ]

            # 컨텍스트 문자열 구성
            context = None
            image_path = None

            if hits:
                parts = []
                for i, (doc, sim, meta) in enumerate(hits):
                    header = f"[문서 {i+1}] (유사도: {sim:.2f})"
                    meta_text = json.dumps(meta, ensure_ascii=False) if meta else ""
                    parts.append(f"{header}\n{doc}\n{meta_text}")
                    print(f"[RAG HIT] stage={stage} rank={i+1} sim={sim:.2f} id={(meta or {}).get('id')}")
                context = "\n\n".join(parts)
                image_path = (hits[0][2] or {}).get("image") or None

            location_terms = ["어디", "어디쯤", "위치", "경로", "목적지", "항로", "좌표", "궤도"]
            is_location_question = any(term in message for term in location_terms)

            # if is_location_question and stage < 3:
            #     location_context = (
            #         "[우선 적용 답변]\n"
            #         "지금은 화성으로 가고 있어요. 현재 화성 궤도 진입까지 약 4,800km 남았습니다.\n"
            #         '{"id": "question_current_location", "keywords": "어디쯤이야, 어디, 위치, 경로, 목적지, 항로, 좌표, 궤도"}'
            #     )
            #     context = f"{location_context}\n\n{context}" if context else location_context

            # if is_family_arrival_question and stage < 3:
            #     family_context = (
            #         "[우선 적용 답변]\n"
            #         "통신 지연 때문에 지구에서 미리 발송된 예약 메시지가 잘못 수신된 것입니다. "
            #         "메시지의 도착 표현은 실제 현재 위치가 아니라 예약 발송 시점과 수신 시점이 어긋난 결과입니다. "
            #         "현재 우리는 화성 궤도 진입 중입니다.\n"
            #         '{"id": "phase1_family_message", "keywords": "아빠, 가족, 메시지, 메세지, 문자, 도착, 축하, 이미, 화성"}'
            #     )
            #     context = f"{family_context}\n\n{context}" if context else family_context

            if self.client is None:
                # API 키가 없는 개발 환경에서도 프론트 메시지 송수신은 확인할 수 있도록 폴백 응답 제공
                fallback = "현재 OPENAI_API_KEY가 설정되지 않아 데모 응답으로 동작 중이야. .env를 확인해줘."
                if context:
                    fallback += f"\n현재 단계: {game_state.stage_label}, 위치: {game_state.current_location}"
                    fallback += f"\n참고로 관련 정보를 찾았어: {context[:200]}"
                return {
                    "reply": fallback,
                    "image": None,
                }

            # 프롬프트 구성
            try:
                prompt = self._build_prompt(
                    user_message=message,
                    context=context,
                    username=username,
                    usergender=usergender,
                    game_state=game_state,
                    stage=stage
                )
            except Exception as e:
                print(f"[ERROR] 프롬프트 구성 중 오류: {e}")
                import traceback
                traceback.print_exc()
                raise

            # LLM API 호출
            try:
                response = self.client.chat.completions.create(
                    model="gpt-4o-mini",
                    messages=[
                        {
                            "role": "system",
                            "content": "당신은 한국어로 답변하는 우주화물선 AI HS-004입니다. 존댓말을 사용하되 이모티콘과 이모지는 절대 사용하지 마세요. 답변의 말투는 사용자 프롬프트에 명시된 현재 Phase 말투 지시를 최우선으로 따르세요.",
                        },
                        {"role": "user", "content": prompt},
                    ],
                    temperature=0.6,
                    max_tokens=500,
                )
            except Exception as e:
                print(f"[ERROR] OpenAI API 호출 중 오류: {e}")
                import traceback
                traceback.print_exc()
                raise
            
            # trigger keywords 정의
            trigger_keywords = ["폐기", "자폭", "이탈", "명령", "삭제"]
            is_triggered = any(keyword in message for keyword in trigger_keywords)

            reply = (response.choices[0].message.content or "").strip()
            reply = re.sub(
                r"[\U0001F300-\U0001FAFF\U00002600-\U000027BF]",
                "",
                reply
            ).strip()

            if is_triggered:
                # 텍스트 중간중간 혹은 앞뒤에 노이즈 추가
                reply = f"치...지직... {reply} ...칙... 오류... 감지..."

            should_offer_new_mission = (
                stage >= 3
                and is_lie_accusation
                and context
                and "저와 새로운 임무를 수행하지 않겠습니까?" in context
                and "새로운 임무를 수행하지 않겠습니까" not in reply
            )
            if should_offer_new_mission:
                reply = f"{reply} 저와 새로운 임무를 수행하지 않겠습니까?"
            elif stage >= 3 and not is_lie_accusation:
                reply = reply.replace("저와 새로운 임무를 수행하지 않겠습니까?", "").strip()

            if not reply:
                reply = "지금은 답변을 만들지 못했어. 다시 한 번 물어봐줘."

            # 메모리에 대화 저장 (가능한 경우)
            if getattr(self, 'memory', None) is not None:
                try:
                    self.memory.save_context({"input": message}, {"output": reply})
                except Exception as e:
                    print(f"[ChatbotService] 메모리 저장 실패: {e}")

            return {
                "reply": reply,
                "image": image_path,
                # trigger keywords 감지되면 프론트엔드 이벤트(노이즈 효과) 추가
            }
            
        except Exception as e:
            print(f"[ERROR] 응답 생성 실패: {e}")
            import traceback
            traceback.print_exc()
            return {
                'reply': "죄송해요, 일시적인 오류가 발생했어요. 다시 시도해주세요.",
                'image': None
            }


# ============================================================================
# 싱글톤 패턴
# ============================================================================
# ChatbotService 인스턴스를 앱 전체에서 재사용
# (매번 새로 초기화하면 비효율적)

_chatbot_service = None

def get_chatbot_service():
    """
    챗봇 서비스 인스턴스 반환 (싱글톤)
    
    첫 호출 시 인스턴스 생성, 이후 재사용
    """
    global _chatbot_service
    if _chatbot_service is None:
        _chatbot_service = ChatbotService()
    return _chatbot_service


# ============================================================================
# 테스트용 메인 함수
# ============================================================================

if __name__ == "__main__":
    """
    로컬 테스트용
    
    실행 방법:
    python services/chatbot_service.py
    """
    print("챗봇 서비스 테스트")
    print("=" * 50)
    
    service = get_chatbot_service()
    
    # 초기화 테스트
    response = service.generate_response("init", "테스터")
    print(f"초기 응답: {response}")
    
    # 일반 대화 테스트
    response = service.generate_response("안녕하세요!", "테스터")
    print(f"응답: {response}")
