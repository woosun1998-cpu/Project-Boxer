"""
백엔드 로깅 설정.

- 개발: INFO 수준 기본 출력
- 운영: DEBUG=False일 때도 요청/오류 로그가 남도록 구성
"""

import logging


def configure_logging(debug: bool) -> None:
    level = logging.DEBUG if debug else logging.INFO
    logging.basicConfig(
        level=level,
        format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
    )
