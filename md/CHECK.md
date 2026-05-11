Sparring 방법제안 

1.먼저 Level을 고릅니다.
•	초급: 회피 창이 넓고, 큰 움직임으로 익히는 단계
•	중급: 반응과 콤보를 같이 익히는 단계
•	상급: 더 짧고 정확한 회피가 필요한 단계
•	프로: 실전 압박에 가까운 빠른 반응 단계
2.	Attack Type을 선택합니다.
•	Jab: 빠른 직선 공격
•	Straight: 정면 압박형 공격
•	Hook: 옆으로 휘는 공격
•	Mixed: 여러 공격이 섞인 실전형 패턴
3.	Round Length를 정합니다.
•	60초: 짧고 집중된 연습
•	90초: 기본 추천
•	120초: 긴 라운드 체력형 연습
4.	Mode를 선택합니다.
•	Training: 학습 중심, 부담 적음
•	Ranked: 점수와 결과를 더 의식하는 실전형
5.	Assist를 정합니다.
•	On: 히트박스와 코치 힌트가 보여서 학습하기 좋음
•	Off: 실전 감각 위주, 더 어려움
6.	FIGHT!를 누르면 시작됩니다.
•	공격 영상이 재생됨
•	공격 타이밍이 오면 경고가 뜸
•	웹캠에서 내 자세를 추적함
•	히트박스 밖으로 피하면 DODGE
•	안 피하면 HIT
•	성공하면 점수, 콤보, 정확도가 올라감
•	맞으면 HP가 줄고 콤보가 리셋됨
7.	라운드 중에 확인할 것
•	반응속도 ms
•	회피 방향
•	이번 공격 획득 점수
•	회피/총 공격
•	라운드 회피율
•	판정 결과
8.	라운드가 끝나면
•	최종 점수
•	최고 콤보
•	회피율
•	총 회피
•	총 피격
을 KO 화면에서 확인합니다.
실전 팁
•	초급에서는 크게 움직여도 괜찮고, Assist On으로 먼저 익히는 게 좋아요.
•	중급부터는 반응 타이밍이 중요해집니다.
•	상급과 프로는 “빨리 피하는 것”보다 “정확한 방향으로 피하는 것”이 더 중요합니다.
•	Hook은 옆으로, Straight는 뒤로/몸통 회피, Uppercut은 아래로 숙이는 느낌으로 생각하면 됩니다.


실행 체크리스트
1.	백엔드가 떠 있는지 확인
cd "c:\Users\User\Desktop\PROJECT\2차 작업파일 (PROJECT)\운동앱\boxer\backend"
py -m uvicorn main:app --reload --host 0.0.0.0 --port 8000
2.	DB 연결 확인
•	http://localhost:8000/api/health
•	http://localhost:8000/api/health/db
3.	프런트 서버 실행
cd "c:\Users\User\Desktop\PROJECT\2차 작업파일 (PROJECT)\운동앱\boxer"
py -m http.server 5500
4.	브라우저에서 접속
•	http://localhost:5500/frontend/index.html
•	로그인 후 http://localhost:5500/frontend/sparring.html
5.	스파링 화면에서 꼭 볼 것
•	Level / Attack Type / Round Length / Mode / Assist가 보이는지
•	기본값이 초급 + Training + Assist On인지
•	영상 목록이 뜨는지
•	웹캠 권한이 정상 허용되는지
•	FIGHT! 버튼을 누르면 경기 화면으로 넘어가는지
•	점수, 콤보, 반응속도, 회피율 패널이 갱신되는지

