import asyncio
import sys
from pathlib import Path

from sqlalchemy import text


def bootstrap_path() -> None:
    base = Path(__file__).resolve().parents[1]
    if str(base) not in sys.path:
        sys.path.insert(0, str(base))


TUTORIALS = [
    {
        "title": "LEVEL 1-1: Boxing Stance (The Foundation)",
        "description": "복싱의 80%는 올바른 자세에서 시작됩니다. 양발을 어깨너비로 벌리고 스프링 상태를 유지하며 턱과 가드를 함께 잡는 기본 스탠스를 익힙니다.",
        "target_pose_json": '{"level": 1, "category": "foundation", "pose": "stance", "ai_judgement": "발 간격과 가드 높이 체크", "checkpoints": ["feet_shoulder_width", "rear_heel_up", "chin_tucked", "guard_up"]}',
        "video_url": "/assets/videos/tutorial-stance.mp4",
        "thumbnail_url": "/assets/images/tutorial-stance.jpg",
        "difficulty_level": 1,
        "is_premium": 0,
        "reward_exp": 100,
        "reward_coins": 10,
        "order_sequence": 1,
    },
    {
        "title": "LEVEL 1-2: Jab (The Foundation)",
        "description": "가장 빠르고 간결한 주먹인 잽을 익힙니다. 앞손을 가볍게 뻗고 즉시 가드 위치로 복귀하는 리듬을 훈련합니다.",
        "target_pose_json": '{"level": 1, "category": "foundation", "pose": "jab", "ai_judgement": "타격 후 손의 가드 복귀 속도 측정", "checkpoints": ["lead_hand_extension", "fast_guard_recovery", "chin_down"]}',
        "video_url": "/assets/videos/tutorial-jab-defense.mp4",
        "thumbnail_url": "/assets/images/tutorial-jab-defense.jpg",
        "difficulty_level": 1,
        "is_premium": 0,
        "reward_exp": 110,
        "reward_coins": 10,
        "order_sequence": 2,
    },
    {
        "title": "LEVEL 2-1: Straight / Cross (The Rhythm)",
        "description": "뒷발 회전과 체중 이동으로 스트레이트의 파워를 만드는 단계입니다. 어깨와 골반 회전을 함께 쓰는 감각을 익힙니다.",
        "target_pose_json": '{"level": 2, "category": "rhythm", "pose": "straight", "ai_judgement": "어깨 회전 각도와 골반 틀어짐 기반 파워 측정", "checkpoints": ["rear_foot_pivot", "hip_rotation", "shoulder_turn", "weight_transfer"]}',
        "video_url": "/assets/videos/tutorial-straight.mp4",
        "thumbnail_url": "/assets/images/tutorial-straight.jpg",
        "difficulty_level": 2,
        "is_premium": 0,
        "reward_exp": 130,
        "reward_coins": 12,
        "order_sequence": 3,
    },
    {
        "title": "LEVEL 2-2: Hook (The Rhythm)",
        "description": "팔을 ㄱ자로 유지한 채 짧고 강하게 회전하는 훅을 연습합니다. 팔꿈치와 어깨의 정렬이 핵심입니다.",
        "target_pose_json": '{"level": 2, "category": "rhythm", "pose": "hook", "ai_judgement": "팔꿈치와 어깨의 수평 정렬 평가", "checkpoints": ["elbow_horizontal", "shoulder_alignment", "torso_rotation"]}',
        "video_url": "/assets/videos/tutorial-hook.mp4",
        "thumbnail_url": "/assets/images/tutorial-hook.jpg",
        "difficulty_level": 2,
        "is_premium": 0,
        "reward_exp": 140,
        "reward_coins": 14,
        "order_sequence": 4,
    },
    {
        "title": "LEVEL 3-1: Ducking & Weaving (The Evasion)",
        "description": "무릎을 굽혀 아래로 피하고 U자 형태로 머리를 굴려 피하는 회피 패턴을 익힙니다. 위험 영역에서 머리를 벗어나는 타이밍이 중요합니다.",
        "target_pose_json": '{"level": 3, "category": "evasion", "pose": "ducking_weaving", "ai_judgement": "코 좌표가 위험 영역을 벗어나는지 판정", "checkpoints": ["knee_bend", "head_off_line", "weave_path"]}',
        "video_url": "/assets/videos/tutorial-ducking.mp4",
        "thumbnail_url": "/assets/images/tutorial-ducking.jpg",
        "difficulty_level": 3,
        "is_premium": 0,
        "reward_exp": 170,
        "reward_coins": 18,
        "order_sequence": 5,
    },
    {
        "title": "LEVEL 3-2: Combo & Counter (The Evasion)",
        "description": "잽-잽-스트레이트-위빙 같은 연속 동작을 수행하며 스파링 전용 리듬을 익힙니다. 동작 간 연결 속도가 콤보 점수로 이어집니다.",
        "target_pose_json": '{"level": 3, "category": "evasion", "pose": "combo_counter", "ai_judgement": "각 동작 사이 연결 속도와 지연 시간 측정", "checkpoints": ["jab_chain", "straight_finish", "weave_reset", "combo_tempo"]}',
        "video_url": "/assets/videos/tutorial-combo-counter.mp4",
        "thumbnail_url": "/assets/images/tutorial-combo-counter.jpg",
        "difficulty_level": 3,
        "is_premium": 0,
        "reward_exp": 200,
        "reward_coins": 22,
        "order_sequence": 6,
    },
]


async def main() -> None:
    bootstrap_path()

    from app.database import AsyncSessionLocal, engine

    upsert_sql = text(
        """
        INSERT INTO boxing_tutorials (
          title, description, target_pose_json, video_url, thumbnail_url,
          difficulty_level, is_premium, reward_exp, reward_coins, order_sequence
        ) VALUES (
          :title, :description, CAST(:target_pose_json AS JSON), :video_url, :thumbnail_url,
          :difficulty_level, :is_premium, :reward_exp, :reward_coins, :order_sequence
        )
        ON DUPLICATE KEY UPDATE
          description = VALUES(description),
          target_pose_json = VALUES(target_pose_json),
          video_url = VALUES(video_url),
          thumbnail_url = VALUES(thumbnail_url),
          difficulty_level = VALUES(difficulty_level),
          is_premium = VALUES(is_premium),
          reward_exp = VALUES(reward_exp),
          reward_coins = VALUES(reward_coins),
          order_sequence = VALUES(order_sequence)
        """
    )

    async with AsyncSessionLocal() as session:
        for tutorial in TUTORIALS:
            await session.execute(upsert_sql, tutorial)
        await session.commit()

        rows = (
            await session.execute(
                text(
                    "SELECT title, description, difficulty_level, is_premium, order_sequence "
                    "FROM boxing_tutorials WHERE title LIKE 'LEVEL %' "
                    "ORDER BY order_sequence, id"
                )
            )
        ).all()
        for row in rows:
            print(row)

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
