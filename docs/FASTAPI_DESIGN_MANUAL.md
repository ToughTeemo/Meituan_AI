# FastAPI 设计手册

## 1. 手册定位

本文档定义本项目 FastAPI 后端的工程设计规范。它关注“怎么写后端代码”：目录结构、分层边界、接口约定、异常处理、配置管理、测试策略和团队协作规则。

业务接口和本地生活 AI Agent 的产品链路，请参考 `docs/BACKEND_DESIGN_MANUAL.md`。

## 2. 设计原则

- 接口契约先行：先定义 Pydantic schema 和 OpenAPI，再写业务实现。
- 分层清晰：Route 只处理 HTTP，Service 处理业务编排，Repository 处理存储，Integration 封装外部依赖。
- 类型稳定：后端 JSON 字段尽量与前端 `src/types/plan.ts` 对齐，减少前端重构成本。
- 可替换：第一阶段可以用 mock，后续能平滑替换为真实地图、天气、POI、LLM 和预约服务。
- 可观测：每个请求都要能追踪 request id、耗时、错误码和关键业务日志。
- 可测试：核心 service 不依赖 HTTP 框架，方便单元测试。

## 3. 推荐项目结构

```text
backend/
  app/
    main.py
    api/
      deps.py
      router.py
      routes/
        health.py
        plans.py
        risks.py
        requirements.py
        actions.py
        events.py
    core/
      config.py
      errors.py
      logging.py
      middleware.py
      security.py
    schemas/
      common.py
      plan.py
      risk.py
      requirement.py
      action.py
      event.py
    services/
      planning_service.py
      risk_service.py
      replan_service.py
      requirement_service.py
      action_service.py
    repositories/
      plan_repository.py
      unit_of_work.py
    integrations/
      llm_client.py
      map_client.py
      weather_client.py
      poi_client.py
    models/
      plan.py
      risk.py
    tests/
      conftest.py
      api/
      services/
  pyproject.toml
  README.md
```

### 分层职责

- `api/routes`：定义 HTTP 路由、状态码、入参校验、依赖注入。
- `schemas`：Pydantic 模型，是前后端协作的唯一接口契约。
- `services`：业务用例，例如创建计划、扫描风险、重排方案。
- `repositories`：数据读写接口，隐藏数据库或内存存储细节。
- `integrations`：第三方 API 客户端，只暴露项目内部需要的方法。
- `core`：配置、日志、中间件、异常、鉴权等基础能力。
- `models`：数据库 ORM 模型。第一阶段如果不用数据库，可以暂时为空。

## 4. 应用入口

`app/main.py` 只负责创建 FastAPI 实例和挂载全局能力。

```python
from fastapi import FastAPI

from app.api.router import api_router
from app.core.config import settings
from app.core.errors import register_exception_handlers
from app.core.middleware import register_middlewares


def create_app() -> FastAPI:
    app = FastAPI(
        title="Life Agent API",
        version=settings.app_version,
        docs_url="/docs",
        openapi_url="/openapi.json",
    )
    register_middlewares(app)
    register_exception_handlers(app)
    app.include_router(api_router, prefix="/api")
    return app


app = create_app()
```

约定：

- 不要在 `main.py` 写业务逻辑。
- 不要在模块 import 时执行外部 API 请求。
- 应用启动逻辑放在 lifespan 或独立 bootstrap 函数里。

## 5. 路由设计

### 路由命名

```text
GET    /api/health
POST   /api/plans
GET    /api/plans/{plan_id}
POST   /api/plans/{plan_id}/requirements
POST   /api/plans/{plan_id}/risks/scan
POST   /api/plans/{plan_id}/risks/{risk_id}/ignore
POST   /api/plans/{plan_id}/risks/{risk_id}/replan
POST   /api/plans/{plan_id}/confirm
POST   /api/plans/{plan_id}/actions
GET    /api/plans/{plan_id}/events
```

### Route 写法

Route 层只做四件事：

- 接收请求模型。
- 调用 service。
- 转换为响应模型。
- 抛出或传递业务异常。

```python
from fastapi import APIRouter, Depends, status

from app.api.deps import get_planning_service
from app.schemas.plan import CreatePlanRequest, PlanResponse
from app.services.planning_service import PlanningService

router = APIRouter(tags=["plans"])


@router.post(
    "/plans",
    response_model=PlanResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_plan(
    request: CreatePlanRequest,
    service: PlanningService = Depends(get_planning_service),
) -> PlanResponse:
    return await service.create_plan(request)
```

Route 层禁止：

- 直接操作数据库。
- 直接调用 LLM、地图、天气等第三方 API。
- 写复杂 if/else 业务流程。
- 返回裸 dict，除非是健康检查等极简单接口。

## 6. Schema 设计

所有接口输入输出必须有 Pydantic 模型。

### 命名规范

```text
CreatePlanRequest
PlanResponse
RiskScanRequest
RiskScanResponse
ReplanRequest
ReplanResponse
ActionRequest
ActionResponse
```

### 字段规范

- JSON 字段使用 `snake_case`。
- 时间字段使用 ISO 8601 字符串，例如 `2026-05-13T10:00:00+08:00`。
- 前端已有日志字段 `created_at: number` 可以保留毫秒时间戳，但新增字段优先使用 ISO 8601。
- ID 使用字符串，带语义前缀：`plan_`、`card_`、`poi_`、`risk_`、`log_`。
- 可选字段必须明确为 `None`，不要用空字符串表达缺失。

### 示例

```python
from pydantic import BaseModel, Field


class CreatePlanRequest(BaseModel):
    prompt: str = Field(min_length=1, max_length=2000)
    city: str = "北京"
    timezone: str = "Asia/Shanghai"


class PoiSchema(BaseModel):
    poi_id: str
    name: str
    rating: float
    price_per_person: int
    queue_minutes: int
    category: str
    map_position: dict[str, float]
    is_child_friendly: bool
    hours_label: str | None = None
```

## 7. Service 设计

Service 是业务核心，应尽量不感知 HTTP。

```python
class PlanningService:
    def __init__(
        self,
        plan_repository: PlanRepository,
        llm_client: LlmClient,
        poi_client: PoiClient,
        route_service: RouteService,
    ) -> None:
        self.plan_repository = plan_repository
        self.llm_client = llm_client
        self.poi_client = poi_client
        self.route_service = route_service

    async def create_plan(self, request: CreatePlanRequest) -> PlanResponse:
        constraints = await self.llm_client.extract_constraints(request.prompt)
        candidates = await self.poi_client.search(constraints)
        cards = await self.route_service.build_cards(constraints, candidates)
        plan = await self.plan_repository.create(constraints, cards)
        return PlanResponse.from_domain(plan)
```

### Service 规则

- 一个 public 方法对应一个明确用例。
- 复杂逻辑拆成私有方法或独立 domain helper。
- 外部依赖通过构造函数注入，方便测试替换。
- 不在 service 里拼 HTTP Response。
- 不在 service 里吞异常，除非能提供可靠降级。

## 8. Repository 设计

第一阶段可以用内存存储，但必须保留 Repository 接口，方便后续替换数据库。

```python
class PlanRepository:
    async def create(self, plan: Plan) -> Plan:
        ...

    async def get(self, plan_id: str) -> Plan | None:
        ...

    async def save(self, plan: Plan) -> Plan:
        ...
```

### 并发控制

计划类修改接口建议使用 `version`：

```json
{
  "base_version": 3
}
```

如果当前版本不是 `base_version`，返回 `PLAN_VERSION_CONFLICT`，避免多人协作或多标签页覆盖。

## 9. Integration 设计

外部服务统一封装在 `integrations/`。

```python
class WeatherClient:
    async def get_forecast(self, city: str, time_window: TimeWindow) -> WeatherResult:
        ...
```

### Integration 规则

- 每个 client 设置 timeout。
- 外部错误转换为项目内部异常。
- 不把第三方原始响应直接传给前端。
- 所有 client 支持 mock 实现。
- API key 从环境变量读取，不能写进代码。

## 10. 异常处理

统一错误结构：

```json
{
  "error": {
    "code": "PLAN_NOT_FOUND",
    "message": "计划不存在或已过期",
    "details": {}
  }
}
```

### 项目异常

```python
class AppError(Exception):
    code = "INTERNAL_ERROR"
    message = "服务暂时不可用"
    status_code = 500

    def __init__(self, message: str | None = None, details: dict | None = None):
        self.message = message or self.message
        self.details = details or {}


class PlanNotFoundError(AppError):
    code = "PLAN_NOT_FOUND"
    message = "计划不存在或已过期"
    status_code = 404
```

常用错误码：

```text
INVALID_REQUEST
PLAN_NOT_FOUND
PLAN_VERSION_CONFLICT
RISK_NOT_FOUND
REPLAN_NOT_AVAILABLE
EXTERNAL_SERVICE_TIMEOUT
LLM_GENERATION_FAILED
ACTION_NOT_SUPPORTED
RATE_LIMITED
INTERNAL_ERROR
```

## 11. 配置管理

使用 Pydantic Settings 或等价方案统一管理配置。

```python
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    app_env: str = "local"
    app_version: str = "0.1.0"
    cors_origins: list[str] = ["http://localhost:5173"]
    log_level: str = "INFO"
    database_url: str | None = None
    llm_api_key: str | None = None


settings = Settings()
```

### 配置规则

- 本地 `.env` 不提交。
- `.env.example` 必须提交。
- 所有密钥从环境变量读取。
- 测试环境使用独立配置。
- CORS 只允许明确来源，不使用无限制 `*` 作为生产配置。

## 12. 日志与可观测性

### 必备日志字段

```text
request_id
method
path
status_code
duration_ms
plan_id
user_id
error_code
```

### 业务日志

Agent 执行日志要写入计划上下文，同时可返回给前端：

```json
{
  "id": "log_001",
  "created_at": 1715580000000,
  "message": "正在筛选亲子友好、低等待的地点。"
}
```

### 日志规则

- 不记录用户敏感信息、API key、完整第三方响应。
- 外部 API timeout、失败、降级必须记录。
- Replan 开始、完成、失败必须记录。

## 13. 安全与鉴权

黑客松 Demo 阶段可以先不做完整登录，但接口仍应预留用户上下文。

### 建议

- 开发期使用 `X-Demo-User-Id` 模拟用户。
- 后续接入真实鉴权后，统一从 dependency 获取 `current_user`。
- 所有写接口预留用户身份校验。
- 对 LLM prompt 输入设置长度限制。
- 对动作接口做白名单校验，例如只允许已定义的 `action_type`。

## 14. CORS

前端 Vite 默认端口通常是 `5173`。

允许来源建议：

```text
http://localhost:5173
http://127.0.0.1:5173
```

生产环境必须配置具体域名。

## 15. 测试规范

### 测试分层

- `tests/services/`：测试业务逻辑，不启动 HTTP。
- `tests/api/`：使用 FastAPI TestClient 或 httpx 测接口。
- `tests/integrations/`：默认 mock 外部服务，少量 smoke test 可选。

### 必测场景

- 创建计划成功。
- prompt 为空时返回 `422` 或 `INVALID_REQUEST`。
- 获取不存在计划返回 `PLAN_NOT_FOUND`。
- 风险扫描返回风险列表。
- 接受风险重排返回新 cards 和 version。
- version 冲突返回 `PLAN_VERSION_CONFLICT`。
- 外部服务 timeout 时返回可降级结果或明确错误。

### 测试命名

```text
test_create_plan_success
test_create_plan_rejects_empty_prompt
test_replan_returns_new_cards
test_replan_rejects_stale_version
```

## 16. OpenAPI 规范

FastAPI 会自动生成 `/docs` 和 `/openapi.json`，但需要维护好接口描述。

### 每个接口应包含

- `summary`
- `description`
- `response_model`
- 主要错误状态码
- 请求和响应示例

示例：

```python
@router.post(
    "/plans/{plan_id}/risks/{risk_id}/replan",
    response_model=ReplanResponse,
    summary="接受风险建议并重新规划",
    description="根据当前风险生成新的时间轴卡片，前端收到后播放 Replan 动画。",
)
async def replan(...):
    ...
```

## 17. 前端对接约定

### 字段兼容

后端返回的核心字段应兼容：

```text
Constraints
TimelineConfig
Card
POI
RiskSignal
AgentLogEntry
```

### Replan 对接

后端只返回重排结果：

```json
{
  "cards": [],
  "inserted_card_ids": [],
  "removed_card_ids": [],
  "agent_message": "已插入低等待替代方案。"
}
```

前端继续负责：

```text
freezing -> deconstructing -> generating -> animating -> done
```

### Loading 和错误

前端需要区分：

- 创建计划中。
- 风险扫描中。
- 重排中。
- 执行动作中。
- 可重试错误。
- 不可重试错误。

后端需要返回稳定错误码，方便前端做精确提示。

## 18. 本地开发命令建议

后端 `README.md` 应包含：

```bash
cd backend
uv sync
uv run fastapi dev app/main.py
uv run pytest
uv run ruff check .
uv run mypy app
```

如果团队不用 `uv`，可以替换为 Poetry 或 pip-tools，但命令需要统一。

## 19. 代码审查清单

每个后端 PR 都检查：

- 是否新增或更新 schema。
- 是否更新接口示例。
- Route 是否保持薄层。
- Service 是否可单元测试。
- 是否有错误码。
- 是否有成功和失败测试。
- 是否没有硬编码 API key。
- 是否没有把第三方原始响应透传给前端。
- 是否不会破坏前端已有字段。

## 20. 第一版落地顺序

建议按以下顺序开发：

1. 搭建 FastAPI 项目骨架。
2. 实现配置、CORS、异常格式、健康检查。
3. 定义 `Plan/Card/POI/Risk` schema。
4. 实现 `POST /api/plans`，先返回 mock 等价数据。
5. 实现 `GET /api/plans/{plan_id}`。
6. 实现风险扫描和重排接口。
7. 前端接入 API client。
8. 补充需求、确认方案、执行动作。
9. 增加 SSE 或 WebSocket 实时事件。
10. 替换 mock integration 为真实外部服务。

先把主链路跑通，再追求智能程度。这样前后端能稳定并行，不会因为某个外部服务没接好而拖住整个 Demo。
