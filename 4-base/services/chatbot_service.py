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
            with open(config_path, "r", encoding="utf-8") as f:
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
            return client.get_or_create_collection(name="rag_collection")
        except Exception as e:
            print(f"[ChatbotService] ChromaDB 초기화 실패: {e}")
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
    
    
    def _search_similar(self, query: str, threshold: float = 0.45, top_k: int = 5):
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
        if self.collection is None or self.client is None:
            return None, None, None

        try:
            query_embedding = self._create_embedding(query)
            if not query_embedding:
                return None, None, None

            results = self.collection.query(
                query_embeddings=[query_embedding],
                n_results=top_k,
                include=["documents", "distances", "metadatas"],
            )

            documents = (results.get("documents") or [[]])[0]
            distances = (results.get("distances") or [[]])[0]
            metadatas = (results.get("metadatas") or [[]])[0]

            best = (None, None, None)
            for idx, (doc, dist) in enumerate(zip(documents, distances)):
                similarity = 1 / (1 + float(dist))
                if similarity >= threshold:
                    meta = metadatas[idx] if idx < len(metadatas) else None
                    if best[1] is None or similarity > best[1]:
                        best = (doc, similarity, meta)

            return best
        except Exception as e:
            print(f"[ChatbotService] RAG 검색 실패: {e}")
            return None, None, None
    
    
    def _build_prompt(self, user_message: str, context: str = None, username: str = "사용자"):
        """
        LLM 프롬프트 구성
        
        Args:
            user_message (str): 사용자 메시지
            context (str): RAG 검색 결과 (선택)
            username (str): 사용자 이름
        
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
        base = system_prompt.get("base", "당신은 친절한 챗봇입니다.")
        rules = system_prompt.get("rules", [])
        rules_text = "\n".join(f"- {rule}" for rule in rules)

        prompt_parts = [
            base,
            "",
            "[응답 규칙]",
            rules_text if rules_text else "- 자연스럽고 도움이 되게 답하세요.",
        ]

        if context:
            prompt_parts.extend([
                "",
                "[참고 정보]",
                context,
            ])

        prompt_parts.extend([
            "",
            f"[{username}] {user_message}",
            "[답변]",
        ])

        return "\n".join(prompt_parts)
    
    
    def generate_response(self, user_message: str, username: str = "사용자") -> dict:
        """
        사용자 메시지에 대한 챗봇 응답 생성
        
        Args:
            user_message (str): 사용자 입력
            username (str): 사용자 이름
        
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
                username=username
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
            if not message:
                return {
                    "reply": "메시지를 입력해줘!",
                    "image": None,
                }

            if message.lower() == "init":
                bot_name = self.config.get("name", "챗봇")
                return {
                    "reply": f"안녕! 나는 {bot_name}이야. 무엇이든 편하게 물어봐.",
                    "image": None,
                }

            context, similarity, _metadata = self._search_similar(
                query=message,
                threshold=0.45,
                top_k=5,
            )

            if self.client is None:
                # API 키가 없는 개발 환경에서도 프론트 메시지 송수신은 확인할 수 있도록 폴백 응답 제공
                fallback = "현재 OPENAI_API_KEY가 설정되지 않아 데모 응답으로 동작 중이야. .env를 확인해줘."
                if context and similarity is not None:
                    fallback += f"\n참고로 관련 정보(유사도 {similarity:.2f})를 찾았어: {context[:200]}"
                return {
                    "reply": fallback,
                    "image": None,
                }

            prompt = self._build_prompt(
                user_message=message,
                context=context,
                username=username,
            )

            response = self.client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {
                        "role": "system",
                        "content": "당신은 한국어로 답변하는 친절한 캐릭터 챗봇입니다.",
                    },
                    {"role": "user", "content": prompt},
                ],
                temperature=0.7,
                max_tokens=500,
            )
            reply = (response.choices[0].message.content or "").strip()

            if not reply:
                reply = "지금은 답변을 만들지 못했어. 다시 한 번 물어봐줘."

            return {
                "reply": reply,
                "image": None,
            }
            
        except Exception as e:
            print(f"[ERROR] 응답 생성 실패: {e}")
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
