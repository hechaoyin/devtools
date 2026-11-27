# 工具箱（devtools）

一个仿 macOS 桌面、完全运行在浏览器里的开发者工具箱：菜单栏、Dock、Launchpad、可拖动缩放的窗口、应用管理器，以及一组常用的开发小工具。纯静态站点，可直接部署到 GitHub Pages。仅适配桌面浏览器。

## 功能

### 桌面环境

- **菜单栏**：应用菜单（关于 / 设置）、文件、窗口、视图菜单，搜索入口、明暗主题切换、实时时钟。
- **Dock**：鼠标悬停放大、运行中指示点、图标弹跳、右键菜单（打开 / 固定 / 关闭 / 卸载）。
- **桌面壁纸**：5 款渐变壁纸，随明暗主题自动适配；主题支持 浅色 / 深色 / 跟随系统。桌面右键菜单可快速切换。
- **Launchpad**：全屏毛玻璃应用网格，支持搜索、方向键 + Enter 选择、`Esc` 关闭，`Ctrl/⌘ + K` 呼出。
- **窗口管理器**：打开、拖动、8 方向缩放、最小化（动画收入 Dock）、最大化 / 还原（双击标题栏）、点击置顶、层级管理；窗口位置、大小、最小化 / 最大化状态与层级刷新后保持。
- **桌面应用组**：类似 macOS 文件夹 / Launchpad 文件夹。桌面右键或「文件 → 新建应用组」创建，鼠标悬浮在组上展开应用列表，移开后自动收起；点击应用即可打开。弹层中点「+」从已安装工具里勾选添加，悬停应用左上角「×」或右键「从组中移除」可移出；组图标右键可重命名（也可双击名称）、添加应用、删除（组内应用不会被卸载）；图标可在桌面上拖动。名称、应用与位置保存在 `localStorage`（`toolbox:groups:v1`），卸载应用时自动从组内移除。
- **应用管理器**：已安装（拖拽或按钮排序、固定到 Dock、卸载）/ 工具商店（安装内置工具）/ 自定义工具（新增、编辑、删除、导入导出配置）。

### 内置工具

| 工具 | 能力 |
| --- | --- |
| JSON | 格式化（可选缩进、键排序）、压缩、校验（报告行列号）、转义 / 去转义 |
| XML | 格式化、压缩、格式良好性校验 |
| 哈希 | MD5、SHA-1 / 224 / 256 / 384 / 512，支持 HMAC，输出大小写切换 |
| Base64 | UTF-8 安全的编码 / 解码，支持 URL-safe |
| URL 编解码 | `encodeURIComponent` / `encodeURI` 及解码，解析查询参数表格 |
| 时间戳 | 秒 / 毫秒自动识别，时区切换，日期 ↔ 时间戳互转，当前时间 |

### 自定义工具

在「应用管理器 → 自定义工具」中添加：

1. **URL 工具**：以 iframe 窗口打开任意 `http(s)` 页面（受目标站点 `X-Frame-Options` / CSP 限制，无法被嵌入的站点会无法显示）。
2. **代码工具**：自己编写 HTML / CSS / JS，在沙箱 iframe 中运行，编辑时实时预览。

自定义工具保存在浏览器 `localStorage`，可编辑、删除，并支持配置的导入 / 导出（JSON 文件）。

#### 沙箱与安全

- 代码工具使用 `<iframe srcdoc sandbox="allow-scripts ...">`，**不含 `allow-same-origin`**，因此运行在不透明源中，无法访问主站的 `localStorage`、Cookie、DOM 或 Pinia 状态；同时注入 CSP `<meta>` 限制其行为。
- URL 工具使用受限的 `sandbox` 属性，并拒绝与本站同源的地址，避免被嵌入页面接触本站数据。
- 导入配置会逐字段校验与清洗，非法内容直接拒绝。

#### 配置导入导出格式

```json
{
  "app": "devtools-toolbox",
  "version": 1,
  "customTools": [ { "id": "...", "type": "url | code", "name": "...", "icon": "🧰", "color": "#3b82f6" } ]
}
```

## 技术栈

Vue 3 + TypeScript、Vite、Pinia、Tailwind CSS v4、VueUse、CodeMirror 6、Vitest；哈希使用 `crypto-js`，XML 格式化使用 `xml-formatter`。

## 开发

```bash
npm install
npm run dev          # 开发服务器 http://127.0.0.1:5173
npm test             # Vitest 单元测试
npm run typecheck    # vue-tsc 类型检查
npm run build        # 类型检查 + 构建到 dist/
npm run preview      # 预览构建产物
```

## 目录结构

```
src/
  components/   菜单栏、Dock、Launchpad、窗口框架、应用管理器、编辑器等 UI 组件
  stores/       Pinia：apps（安装/排序/自定义工具）、windows（窗口状态）、settings、ui
  lib/          纯逻辑：自定义工具校验与沙箱、布局常量、壁纸、存储键
  tools/        内置工具，每个工具一个目录：logic.ts（纯函数）+ logic.test.ts + *Tool.vue
  tools/registry.ts  内置工具注册表
```

### 新增一个内置工具

1. 在 `src/tools/<name>/` 下编写 `logic.ts`（纯函数）、`logic.test.ts` 与 `XxxTool.vue`。
2. 在 `src/tools/registry.ts` 中注册（id、名称、图标、默认窗口尺寸、异步组件）。

## 部署到 GitHub Pages

仓库已包含 `.github/workflows/deploy.yml`：推送到 `main` 时自动执行 `npm ci` → `npm test` → 构建 → 发布到 Pages。

首次使用需要在仓库 **Settings → Pages → Build and deployment → Source** 选择 **GitHub Actions**。

构建时的 `base` 由环境变量 `BASE_PATH` 决定（工作流中为 `/<仓库名>/`；未设置时构建默认为 `/devtools/`，开发服务器为 `/`）。部署到根域名或其他路径时：

```bash
BASE_PATH=/ npm run build
```

另有 `.github/workflows/ci.yml`，对 PR 执行类型检查、单测与构建。

## 数据存储

所有数据仅保存在浏览器 `localStorage`（`toolbox:apps:v1`、`toolbox:windows:v1`、`toolbox:settings:v1`），不会上传到任何服务器；所有工具均在本地计算。
