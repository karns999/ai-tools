# AI Tools - 项目文档

## 项目概述

AI Tools 是一个 AI 生图工具的管理后台，基于 Next.js 16 构建，使用 Supabase 作为认证和数据库服务，部署目标为 Vercel。

## 技术栈

| 技术 | 版本 | 用途 |
|------|------|------|
| Next.js (App Router) | 16.1.6 | 前端框架 + API 路由 |
| React | 19.2.3 | UI 库 |
| TypeScript | 5.x | 类型安全 |
| Tailwind CSS | 4.x | 样式 |
| shadcn/ui (Radix) | 4.0.2 | UI 组件库 |
| Supabase | 2.99.0 | 认证 + 数据库 |
| @supabase/ssr | 0.9.0 | Supabase 服务端渲染支持 |
| sonner | 2.0.7 | Toast 通知 |
| recharts | 2.15.4 | 图表 |
| Vercel | - | 部署平台 |

## 目录结构

```
ai-tools/
├── docs/
│   └── PROJECT.md              # 项目文档（本文件）
├── public/                     # 静态资源
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   └── supabase/
│   │   │       ├── login/route.ts      # POST /api/supabase/login 登录接口
│   │   │       └── signout/route.ts    # POST /api/supabase/signout 退出接口
│   │   ├── dashboard/
│   │   │   └── page.tsx                # Dashboard 主页（shadcn dashboard-01）
│   │   ├── login/
│   │   │   └── page.tsx                # 登录页
│   │   ├── globals.css
│   │   ├── layout.tsx                  # 根布局（TooltipProvider + Toaster）
│   │   └── page.tsx                    # 首页（重定向到 /dashboard）
│   ├── components/
│   │   ├── ui/                         # shadcn 基础组件
│   │   ├── app-sidebar.tsx             # 侧边栏（导航数据 + 布局）
│   │   ├── chart-area-interactive.tsx  # 交互式面积图
│   │   ├── data-table.tsx              # 数据表格
│   │   ├── login-form.tsx              # 登录表单（接入 Supabase 认证）
│   │   ├── nav-documents.tsx           # 侧边栏 - 文档导航
│   │   ├── nav-main.tsx                # 侧边栏 - 主导航（支持子菜单）
│   │   ├── nav-secondary.tsx           # 侧边栏 - 次要导航
│   │   ├── nav-user.tsx                # 侧边栏 - 用户信息 + 退出登录
│   │   ├── section-cards.tsx           # Dashboard 数据卡片
│   │   └── site-header.tsx             # 顶部导航栏
│   ├── hooks/
│   │   └── use-mobile.ts              # 移动端检测 hook
│   ├── lib/
│   │   ├── supabase/
│   │   │   ├── client.ts              # 浏览器端 Supabase client
│   │   │   └── server.ts              # 服务端 Supabase client
│   │   └── utils.ts                   # 工具函数（cn）
│   └── proxy.ts                       # Next.js 16 Proxy（Session 刷新 + 路由保护）
├── .env.local                          # 环境变量（不提交到 git）
├── .env.local.example                  # 环境变量模板
├── package.json
└── tsconfig.json
```

## 认证流程

1. 用户管理：在 Supabase 控制台手动创建用户（已关闭公开注册）
2. 登录：前端调用 `POST /api/supabase/login`，服务端通过 Supabase `signInWithPassword` 验证
3. Session 管理：`src/proxy.ts` 在每次请求时自动刷新 Supabase auth token
4. 路由保护：未登录用户访问非公开页面时，proxy 自动重定向到 `/login`
5. 退出：调用 `POST /api/supabase/signout`，清除 session 后跳转到登录页
6. 错误提示：登录失败时通过 sonner toast 在页面顶部显示错误信息

### 公开路径（不需要登录）

- `/login`
- `/auth`
- `/api/*`

### API 接口鉴权

`/api` 路径不被 proxy 拦截，各 route handler 自行检查用户登录状态。

## 环境变量

```env
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
```

## 开发命令

```bash
npm run dev      # 启动开发服务器
npm run build    # 构建生产版本
npm run start    # 启动生产服务器
npm run lint     # 代码检查
```

## 部署

项目部署到 Vercel，连接 Git 仓库后自动部署。需要在 Vercel 项目设置中配置环境变量。

## 待开发功能

- [ ] AI 模型接入（生图 API）
- [ ] Dashboard 子页面（动态路由 `dashboard/[module]/page.tsx`）
- [ ] 侧边栏导航改为实际业务模块
- [ ] Dashboard 数据展示对接真实数据
