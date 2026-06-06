# 生活任务驾驶舱

<p align="center">
  <img alt="React" src="https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white">
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-5.7-3178C6?logo=typescript&logoColor=white">
  <img alt="Vite" src="https://img.shields.io/badge/Vite-6-646CFF?logo=vite&logoColor=white">
  <img alt="FastAPI" src="https://img.shields.io/badge/FastAPI-0.115-009688?logo=fastapi&logoColor=white">
  <img alt="Deploy" src="https://img.shields.io/badge/Deploy-Vercel%20%2B%20Render-111827">
  <img alt="License" src="https://img.shields.io/badge/License-MIT-black">
</p>

<p align="center">
  <strong>AI 驱动的本地生活行程规划与执行驾驶舱</strong>
</p>

<p align="center">
  <img src="docs/assets/product-preview.svg" alt="生活任务驾驶舱产品截图" width="100%">
</p>

生活任务驾驶舱是一个面向本地生活出行场景的 AI 行程规划与执行辅助系统。项目以“上海周末亲子出行”为核心样例，将用户的自然语言需求转化为可执行行程，并在执行过程中结合天气、路线、排队、价格、营业状态等实时或准实时信号，完成风险识别、用户确认和动态重规划。

当前版本已经打通前端交互、FastAPI 后端、SQLite 本地持久化、高德地图服务、Open-Meteo 天气服务，以及 DeepSeek 驱动的重规划建议链路。项目也保留了本地演示数据与 fallback 机制，便于在没有真实服务密钥的情况下完成基础演示。

## 项目亮点

- 自然语言创建行程：从用户输入生成包含时间线、地点、预算、交通和行动建议的计划。
- 三栏驾驶舱界面：左侧任务输入，中间纵向时间线，右侧地图与状态面板协同展示。
- 执行期风险检测：通过执行检查生成快照，识别天气、排队、闭店、价格、疲劳等风险。
- 重规划建议链路：支持生成、查询、列表化和应用重规划方案。
- 真实服务接入：支持高德 POI 与路线、Open-Meteo 天气、DeepSeek LLM 重规划。
- 可控降级能力：服务不可用或未配置密钥时，可回退到 seed、mock 或 estimated 数据。
- 本地持久化：使用 SQLModel 保存计划、版本、执行快照和重规划建议。

## 技术栈

| 模块 | 技术 |
| --- | --- |
| 前端 | React 19、TypeScript、Vite、Tailwind CSS、Framer Motion |
| 后端 | FastAPI、SQLModel、Pydantic Settings |
| 数据库 | 本地 SQLite，具备 PostgreSQL 迁移空间 |
| 外部服务 | 高德地图、Open-Meteo、DeepSeek |
| 验证方式 | TypeScript 构建、pytest、ruff、手动联调 |

## 目录结构

```text
.
+-- src/                      # 前端应用
|   +-- api/                  # API 客户端与响应适配
|   +-- components/           # 驾驶舱、时间线、风险提示和规划页面
|   +-- context/              # Plan、UI、状态机上下文
|   +-- hooks/                # 风险处理和交互编排
|   +-- mock/                 # 演示数据与本地 fallback 重规划逻辑
|   +-- replan/               # 前端重规划动画生命周期
+-- backend/
|   +-- app/
|   |   +-- api/              # FastAPI 路由
|   |   +-- providers/        # 外部服务适配
|   |   +-- services/         # 规划、执行、重规划和行动服务
|   |   +-- schemas/          # API 数据结构
|   |   +-- prompts/          # 重规划提示词模板
|   +-- scripts/              # 冒烟测试和评估脚本
|   +-- tests/                # 后端测试
+-- docs/                     # API 契约、验收清单和架构文档
+-- package.json              # 前端脚本
```

## 本地环境要求

- Node.js 18 或更高版本
- Python 3.11 或更高版本
- uv
- 高德地图 Web 服务 Key
- DeepSeek API Key

安装 uv：

```powershell
pip install uv
```

## 环境变量

项目使用两个环境变量文件：

- 根目录 `.env`：前端 Vite 配置
- `backend/.env`：后端服务与外部 provider 配置

### 前端 `.env`

```env
VITE_API_BASE_URL=http://localhost:8000
VITE_API_MODE=api
VITE_USE_MOCK_FALLBACK=false
VITE_SHOW_DEMO_CONTROLS=true
```

### 后端 `backend/.env`

```env
APP_ENV=local
APP_VERSION=0.1.0
DATABASE_URL=sqlite:///./life_agent_integration.db
DATABASE_AUTO_CREATE=true
CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173

PLANNING_PROVIDER=shanghai_seed
POI_PROVIDER=amap
ROUTE_PROVIDER=amap
WEATHER_PROVIDER=open_meteo
HOURS_PROVIDER=hybrid
PRICE_PROVIDER=estimated
QUEUE_PROVIDER=estimated
BOOKING_PROVIDER=stub
ACTION_PROVIDER=amap_uri

AMAP_API_KEY=<your-amap-web-service-key>

REPLANNER_PROVIDER=llm
LLM_REPLANNER_MOCK=false
REPLAN_PROMPT_VERSION=v1
DEEPSEEK_API_KEY=<your-deepseek-api-key>
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_MODEL=deepseek-chat
```

如果只需要本地演示，可以使用更稳定的 seed 与 rule 配置：

```env
PLANNING_PROVIDER=rule_based
POI_PROVIDER=seed
ROUTE_PROVIDER=estimated
WEATHER_PROVIDER=seed
REPLANNER_PROVIDER=rule
LLM_REPLANNER_MOCK=true
```

## 本地启动

安装前端依赖：

```powershell
cd E:\Meituan_AI
npm install
```

安装后端依赖：

```powershell
cd E:\Meituan_AI\backend
uv sync
```

启动后端：

```powershell
cd E:\Meituan_AI\backend
.\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

启动前端：

```powershell
cd E:\Meituan_AI
npm run dev -- --host 127.0.0.1 --port 5173
```

访问地址：

```text
前端页面：http://127.0.0.1:5173
后端文档：http://127.0.0.1:8000/docs
健康检查：http://127.0.0.1:8000/api/health
```

## 手动联调流程

1. 启动后端，确认日志中出现预期 provider，例如：

   ```text
   Weather Service: OpenMeteoWeatherService
   Route Service: AmapRouteService
   ```

2. 启动前端并从首页创建一个新行程。

3. 确认 `POST /api/plans` 返回 `201 Created`。

4. 在驾驶舱中提交执行变化或用户补充需求。

5. 当风险支持重规划时，前端应显示“按这个调整”，并应用最新重规划建议。

6. 当风险只需要用户确认且没有重规划建议时，前端应显示“确认继续”，不应请求 `/api/plans/{plan_id}/replan/latest`。

## 核心接口

```text
GET  /api/health
POST /api/plans
GET  /api/plans?session_id={session_id}
GET  /api/plans/{plan_id}

POST /api/plans/{plan_id}/execution/check
GET  /api/plans/{plan_id}/execution/latest

GET  /api/plans/{plan_id}/replan/latest
GET  /api/plans/{plan_id}/replans
POST /api/plans/{plan_id}/replan/{proposal_id}/apply

POST /api/plans/{plan_id}/requirements
POST /api/plans/{plan_id}/confirm
POST /api/plans/{plan_id}/actions

GET  /api/plans/{plan_id}/versions
GET  /api/plans/{plan_id}/versions/compare
POST /api/plans/{plan_id}/versions/{version_id}/restore
```

兼容旧前端流程的风险接口仍然保留：

```text
POST /api/plans/{plan_id}/risks/scan
POST /api/plans/{plan_id}/risks/{risk_id}/replan
POST /api/plans/{plan_id}/risks/{risk_id}/ignore
```

完整契约见 [docs/API_CONTRACT_CURRENT.md](docs/API_CONTRACT_CURRENT.md)。

## 验证命令

前端构建：

```powershell
cd E:\Meituan_AI
npm run build
```

后端测试：

```powershell
cd E:\Meituan_AI\backend
.\.venv\Scripts\python.exe -m pytest
```

后端指定文件 lint：

```powershell
cd E:\Meituan_AI\backend
.\.venv\Scripts\python.exe -m ruff check <changed-python-files>
```

常用后端冒烟脚本：

```powershell
cd E:\Meituan_AI\backend
.\.venv\Scripts\python.exe scripts\check_api_contract.py
.\.venv\Scripts\python.exe scripts\check_execution_api.py
.\.venv\Scripts\python.exe scripts\check_replan_proposal_api.py
```

真实 DeepSeek 冒烟测试需要配置 `DEEPSEEK_API_KEY` 并允许访问外网：

```powershell
cd E:\Meituan_AI\backend
.\.venv\Scripts\python.exe scripts\check_deepseek_real_smoke.py
```

## Provider 模式

| 配置项 | 常用值 | 作用 |
| --- | --- | --- |
| `PLANNING_PROVIDER` | `rule_based`、`mock`、`shanghai_seed` | 选择行程生成路径 |
| `POI_PROVIDER` | `seed`、`amap` | 选择地点数据来源 |
| `ROUTE_PROVIDER` | `estimated`、`amap` | 选择路线计算方式 |
| `WEATHER_PROVIDER` | `seed`、`open_meteo` | 选择天气数据来源 |
| `REPLANNER_PROVIDER` | `rule`、`llm` | 选择规则或 LLM 重规划 |
| `LLM_REPLANNER_MOCK` | `true`、`false` | 控制 LLM 重规划是否使用 mock |

Open-Meteo 不需要 API Key；高德地图和 DeepSeek 需要配置 Key。

## 部署到 Vercel 和 Render

推荐部署方式是：

```text
前端：Vercel
后端：Render Web Service
数据库：演示环境可用 SQLite；正式环境建议迁移到 Render PostgreSQL
```

官方参考：

- [Vercel 构建配置](https://vercel.com/docs/deployments/configure-a-build)
- [Vercel CLI 部署](https://vercel.com/docs/cli/deploy)
- [Render FastAPI 部署](https://render.com/docs/deploy-fastapi)
- [Render 环境变量](https://render.com/docs/configure-environment-variables)

### 第一步：部署后端到 Render

1. 在 Render 创建新的 Web Service。

2. 连接 GitHub 仓库。

3. 设置服务参数：

   ```text
   Root Directory: backend
   Runtime: Python
   Build Command: pip install uv && uv sync --frozen
   Start Command: .venv/bin/python -m uvicorn app.main:app --host 0.0.0.0 --port $PORT
   ```

4. 配置环境变量：

   ```env
   APP_ENV=production
   APP_VERSION=0.1.0
   DATABASE_URL=sqlite:///./life_agent.db
   DATABASE_AUTO_CREATE=true
   CORS_ORIGINS=https://<your-vercel-domain>.vercel.app

   PLANNING_PROVIDER=shanghai_seed
   POI_PROVIDER=amap
   ROUTE_PROVIDER=amap
   WEATHER_PROVIDER=open_meteo
   HOURS_PROVIDER=hybrid
   PRICE_PROVIDER=estimated
   QUEUE_PROVIDER=estimated
   BOOKING_PROVIDER=stub
   ACTION_PROVIDER=amap_uri

   AMAP_API_KEY=<your-amap-web-service-key>

   REPLANNER_PROVIDER=llm
   LLM_REPLANNER_MOCK=false
   REPLAN_PROMPT_VERSION=v1
   DEEPSEEK_API_KEY=<your-deepseek-api-key>
   DEEPSEEK_BASE_URL=https://api.deepseek.com
   DEEPSEEK_MODEL=deepseek-chat
   ```

5. 部署完成后，访问：

   ```text
   https://<your-render-service>.onrender.com/api/health
   https://<your-render-service>.onrender.com/docs
   ```

6. 如果之后绑定了 Vercel 正式域名，回到 Render 更新 `CORS_ORIGINS`。

### 第二步：部署前端到 Vercel

1. 在 Vercel 导入同一个 GitHub 仓库。

2. 设置项目参数：

   ```text
   Framework Preset: Vite
   Root Directory: .
   Install Command: npm install
   Build Command: npm run build
   Output Directory: dist
   ```

3. 配置 Vercel 环境变量：

   ```env
   VITE_API_BASE_URL=https://<your-render-service>.onrender.com
   VITE_API_MODE=api
   VITE_USE_MOCK_FALLBACK=false
   VITE_SHOW_DEMO_CONTROLS=false
   ```

4. 部署完成后，打开 Vercel 域名并创建一个新行程。

5. 如果浏览器出现 CORS 错误，将当前 Vercel 域名追加到 Render 的 `CORS_ORIGINS`。

### 可选：命令行部署 Vercel

```powershell
cd E:\Meituan_AI
npm install -g vercel
vercel
vercel --prod
```

Vercel 会在部署时执行构建流程。当前项目的生产构建命令是：

```powershell
npm run build
```

构建产物目录是：

```text
dist
```

### 部署后检查清单

- Vercel 页面可以正常打开。
- Render `/api/health` 返回正常。
- 前端创建行程时可以看到 `POST /api/plans` 成功。
- 执行检查可以调用 `/api/plans/{plan_id}/execution/check`。
- 支持重规划的风险会显示“按这个调整”。
- 不支持重规划的确认型风险会显示“确认继续”。

## 文档索引

- [后端说明](backend/README.md)
- [当前 API 契约](docs/API_CONTRACT_CURRENT.md)
- [验收清单](docs/ACCEPTANCE_CHECKLIST_CURRENT.md)
- [架构说明](docs/ARCHITECTURE.md)
- [上海 MVP 说明](docs/SHANGHAI_MVP_SPEC.md)
- [高德 POI 验收](docs/AMAP_PROVIDER_ACCEPTANCE.md)
- [高德路线验收](docs/AMAP_ROUTE_ACCEPTANCE.md)
- [生产数据验收](docs/PRODUCTION_DATA_ACCEPTANCE.md)

## 当前状态

项目当前可用于本地联调、PR 评审和演示部署。主链路如下：

```text
用户输入
  -> 创建行程
  -> 驾驶舱执行
  -> 执行检查
  -> 可选重规划建议
  -> 应用重规划
```

确认型风险不会强制生成重规划建议。没有可用 proposal 时，前端会确认继续，而不是请求 `/replan/latest`。

## 许可证

本项目采用 MIT License。完整文本见 [LICENSE](LICENSE)。
