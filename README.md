# My Little MCP Server

현재 시간과 랜덤 숫자를 제공하는 아주 간단한 MCP (Model Context Protocol) 서버입니다.

## 기능

1. **현재 시간 조회** (`get_current_time`)
   - 한국 시간(KST) 기준으로 현재 날짜와 시간을 반환
   - 포맷: `locale` (기본), `iso`, `timestamp`

2. **랜덤 숫자 생성** (`get_random_number`)
   - 1~50 사이의 랜덤한 숫자를 생성
   - 범위 커스터마이징 가능 (1~100)

## 설치 및 실행

```bash
# 의존성 설치
npm install

# 빌드
npm run build
```

### stdio transport (기본)
```bash
# 개발 모드
npm run dev

# 프로덕션
npm start
```

### HTTP transport
```bash
# 개발 모드 (포트 8004)
npm run dev:http

# 프로덕션 (포트 8004)
npm run start:http

# 커스텀 포트
npm run dev -- --transport=http --port=8005
```

## 사용법

### MCP 클라이언트에서 사용

#### Cursor (`.cursor/mcp.json`)
```json
{
  "mcpServers": {
    "my-little-mcp": {
      "command": "node",
      "args": ["/Users/swan/swan/chequer-projects/chequer-io/ironman/mcp-suite/mcp-servers/my-little-mcp/dist/index.js"]
    }
  }
}
```

#### Claude Desktop (`claude_desktop_config.json`)
```json
{
  "mcpServers": {
    "my-little-mcp": {
      "command": "node", 
      "args": ["/Users/swan/swan/chequer-projects/chequer-io/ironman/mcp-suite/mcp-servers/my-little-mcp/dist/index.js"]
    }
  }
}
```

#### HTTP transport 사용 시

**Cursor** (`.cursor/mcp.json`):
```json
{
  "mcpServers": {
    "my-little-mcp": {
      "url": "http://localhost:8004/mcp"
    }
  }
}
```

### 로컬에서 테스트

#### stdio transport
```bash
# MCP Inspector로 테스트
npx @modelcontextprotocol/inspector node dist/index.js
```

#### HTTP transport
```bash
# 서버 실행 (별도 터미널)
npm run start:http

# MCP Inspector로 테스트
npx @modelcontextprotocol/inspector http://localhost:8004/mcp

# 또는 직접 HTTP API 호출
curl http://localhost:8004/health
curl http://localhost:8004/
```

## 도구 사용 예제

### 현재 시간 조회
- 기본: `get_current_time`
- ISO 포맷: `get_current_time` with `{"format": "iso"}`
- 타임스탬프: `get_current_time` with `{"format": "timestamp"}`

### 랜덤 숫자 생성
- 기본 (1-50): `get_random_number`
- 커스텀 범위: `get_random_number` with `{"min": 10, "max": 30}`

## 특징

- **매우 간단함**: 100줄 미만의 코드
- **순수 MCP SDK**: 추가 의존성 최소화
- **한국어 지원**: 한국 시간대 및 한국어 메시지
- **타입 안전성**: TypeScript + Zod

## 요구사항

- Node.js 18.0.0+
- TypeScript 5.0+

## 라이센스

MIT License