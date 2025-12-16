# 03. Search Service

검색 전용 서비스 - Elasticsearch 기반

## 구성

- `search-service/` - Node.js Express API
- Elasticsearch 8.x

## 빠른 시작

```bash
# 02.Media, 11.AI가 먼저 실행되어 있어야 함
cd 03.Search
docker compose up --build
```

## DBeaver (JDBC) 주의

Elasticsearch SQL JDBC는 라이선스 제약이 있어, `current license is non-compliant for [jdbc]` 에러가 나면
로컬 Elasticsearch에 trial 라이선스를 켜야 한다.

- (이미 실행 중인 클러스터) `POST http://localhost:9200/_license/start_trial?acknowledge=true`
- (새로 띄우는 클러스터) `docker-compose.yml`에 `xpack.license.self_generated.type=trial` 설정을 사용

또한 JDBC 드라이버 버전은 서버 버전(예: 8.11.0)과 맞춰야 한다.

## 한글 분석기(nori) 주의

`search-service`는 `photos` 인덱스 생성 시 `nori_tokenizer`를 사용한다. Elasticsearch 컨테이너에 `analysis-nori` 플러그인이 없으면
인덱스가 `red` 상태로 남아 healthcheck가 실패할 수 있다. 이 프로젝트의 `docker-compose.yml`은 컨테이너 시작 시 `analysis-nori`를 자동 설치한다.

## 서비스

| 서비스 | 포트 | 설명 |
|:---|:---|:---|
| elasticsearch | 9200 | Elasticsearch |
| search-service | 4002 | 검색 API |

## API

```http
GET /search/photos?person=이상훈&year=2022
```

| 파라미터 | 설명 |
|:---|:---|
| person | 인물 이름 |
| year | 촬영 연도 |
| month | 촬영 월 |
| page | 페이지 (0부터) |
| size | 페이지 크기 (기본 20) |

## 흐름

```
11.AI → PUBLISH photo:analyzed
          ↓
Search Service ← SUBSCRIBE
          ↓
Elasticsearch 인덱싱
          ↓
GET /search/photos
```
