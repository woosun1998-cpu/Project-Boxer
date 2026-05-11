# PR 작성 템플릿

아래 내용을 복사해서 GitHub PR 본문에 사용하세요.

```md
## 변경 내용
- 
- 

## 변경 이유
- 

## 테스트 방법
- [ ] 로컬 실행 확인
- [ ] 주요 페이지 동작 확인
- [ ] 에러 로그 없음 확인

## 체크리스트
- [ ] base: `main`, compare: `내 브랜치` 확인
- [ ] 리뷰어 지정
- [ ] 충돌(conflict) 없음 확인
```

---

## PR 제목 예시
- `feat: 튜토리얼 UI 개선`
- `fix: 로그인 토큰 만료 처리 오류 수정`
- `docs: 실행/협업 가이드 문서 업데이트`
- `refactor: 세션 저장 로직 분리`

---

## 빠른 생성 순서
1. GitHub 저장소 -> `Pull requests` -> `New pull request`
2. `base: main`, `compare: 내 브랜치` 선택
3. 제목/본문 작성 (위 템플릿 사용)
4. `Create pull request` 클릭
