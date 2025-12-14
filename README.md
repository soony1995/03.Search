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
