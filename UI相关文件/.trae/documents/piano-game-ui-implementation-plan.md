# 键盘弹钢琴网页游戏 · UI 实施计划

## 概述

基于上传的 PRD 文档（`piano-game-prd.html`），将三条核心链路（自由弹奏 M02、跟弹打分 M03、AI 转谱 M04）及支撑模块（音源 M01、按键映射 M05、沉浸视觉 M08、曲库 M09）落地为 **7 个高保真设计页面**，以 `.design` 画布项目交付。

用户决策：
- 范围：MVP 三大核心链路 + 支撑模块
- 技术：单 HTML 自包含（CDN 引入 Three.js / Chart.js / Lucide）
- 视觉：PRD 配色（紫 #6d28d9 / 粉 #db2777 / 青 #0891b2），3D 钢琴 + 粒子，星空/樱花/赛博三套预设

技能约束：
- `solo-design`：`.design` 画布项目，Main Agent 编排 + Sub-Agent 生成页面，`fill-html-head.mjs` 生成骨架，`scan-design-directory.mjs` 校验
- `frontend-skill`：构图优先、克制、强视觉锚点、稀疏文案、2-3 个有意动效、默认无卡片墙
- `frontend-design`：大胆美学方向、独特字体（避免 Inter/Roboto）、主色+强调色体系、生产级代码

---

## 当前状态分析

工作区为空，无现有 `.design` 项目或设计库。有 16 个内置设计库可用但用户未选择绑定，本项目为 `free_exploration` 模式。PRD 超 500 字符，触发长需求解析，页面上限 7 页。

PRD 关键特征提取：
- 键盘映射：A S D F G H J（白键 C D E F G A B）、W E T Y U（黑键）、Z/X 切八度
- 判定窗口：Perfect ±50ms / Great ±100ms / Good ±150ms / Miss
- 四种音色：三角钢琴、音乐盒、合成 Pad、8-bit
- 三种视觉风格：星空 / 樱花 / 赛博
- 下落音符标注键位字母，HUD 显示分数/连击/准确率
- 曲目含难度/BPM/时长标注
- AI 转谱展示音符数/时长/BPM + 进度条 + 五线谱预览
- 无障碍：高对比度、键盘可达、色弱友好

---

## 项目结构

交付根目录：`...\6a54f547cfd3e63d2c55e9eb\piano-game\`

```
piano-game/
├── piano-game.design              # 画布入口（7 页节点 + 1 图片节点 + config）
├── generation-tree.json            # 生成依赖树
├── orchestration-summary.json      # 运行时上下文
├── colors_and_type.css             # 品牌色系 + 字体 token
├── validation-report.json          # 最终校验产物
├── assets/
│   └── hero-starry-piano.jpg       # 首页 hero 预生成图
├── partials/
│   ├── project-shell.html          # 全局壳：沉浸背景 + 顶栏 + 页脚
│   └── piano-stage.html            # 共享 3D 透视钢琴键盘组件
└── pages/
    ├── home.html                   # 1 首页/模式选择
    ├── free-play.html              # 2 自由弹奏
    ├── follow-play.html            # 3 跟弹打分
    ├── ai-transcription.html       # 4 AI 转谱
    ├── song-library.html           # 5 曲库
    ├── results.html                # 6 结算页
    └── settings.html               # 7 设置/视觉
```

`.design` config：
```json
{ "autoLayout": true, "deviceType": "desktop", "projectName": "键盘弹钢琴", "designLibrary": null }
```

7 个页面节点（Main Agent 预注册）：

| nodeId | title | htmlSrc | pageIndex |
|--------|-------|---------|-----------|
| page-home | 首页 | pages/home.html | 1 |
| page-free-play | 自由弹奏 | pages/free-play.html | 2 |
| page-follow-play | 跟弹打分 | pages/follow-play.html | 3 |
| page-ai-transcription | AI 转谱 | pages/ai-transcription.html | 4 |
| page-song-library | 曲库 | pages/song-library.html | 5 |
| page-results | 结算 | pages/results.html | 6 |
| page-settings | 设置 | pages/settings.html | 7 |

---

## 共享设计系统（colors_and_type.css）

### 字体（避免 Inter/Roboto）

- 展示/标题：`Outfit`（几何无衬线，PRD 原用）
- 正文：`Outfit` + `Noto Sans SC` + `PingFang SC` + `Microsoft YaHei` 回退
- 等宽（琴键字母/HUD 数字/MIDI）：`JetBrains Mono`

`@font-face` 使用 fontsource/jsdelivr woff2 绝对 URL，禁用 `@import`。

### 三色策略

紫色为唯一品牌主色（驱动主 CTA / 选中态 / 品牌识别），粉/青降级为游戏语义色（判定档位、模式强调、风格预设），不作为 secondary/accent 身份色。

### Token 表（深色为默认沉浸基调，浅色为高对比无障碍）

| Token | .dark（默认） | :root（高对比） | 用途 |
|-------|--------------|----------------|------|
| `--piano-background` | `#0d0b1a` | `#ffffff` | 页面基 |
| `--piano-foreground` | `#f4f1ff` | `#0b0a14` | 主文字 |
| `--piano-card` | `#16132a` | `#f6f7fb` | 卡片/面板 |
| `--piano-card-foreground` | `#ece8ff` | `#16182d` | 卡片文字 |
| `--piano-muted-foreground` | `#a89fcf` | `#6a6c80` | 次文字 |
| `--piano-border` | `#2a2545` | `#e7e8f0` | 分割线 |
| `--piano-primary` | `#8b5cf6` | `#6d28d9` | 品牌主色 |
| `--piano-primary-foreground` | `#ffffff` | `#ffffff` | 主色上文字 |

品牌色阶：
```
--piano-purple:#6d28d9; --piano-purple-400:#a78bfa; --piano-purple-500:#8b5cf6; --piano-purple-700:#5b21b6;
--piano-pink:#db2777;   --piano-pink-soft:rgba(219,39,119,.14);
--piano-cyan:#0891b2;   --piano-cyan-400:#22d3ee; --piano-cyan-soft:rgba(8,145,178,.14);
```

判定档位语义色：
```
--state-success:#22d3ee;  /* Perfect ±50ms → 青 */
--state-info:#8b5cf6;     /* Great ±100ms → 紫 */
--state-warning:#db2777;  /* Good ±150ms → 粉 */
--state-error:#f43f5e;    /* Miss → 红 */
```

圆角：`--piano-radius-sm:4px / --piano-radius-md:8px / --piano-radius-lg:16px / --piano-radius-full:9999px`

### 动效（CSS-first，2-3 个有意动效）

- 琴键按下：`translateY(2px)` + 渐变高亮，120ms `cubic-bezier(.2,.8,.2,1)`
- 下落音符：CSS `@keyframes` 下移，命中判定线触发缩放消失
- 判定弹出文字：`Perfect!` 浮起淡出 320ms
- 粒子：`<canvas>` 2D 氛围 + 命中爆发
- 全部包 `@media (prefers-reduced-motion: reduce)` 降级
- Three.js 仅用于自由弹奏/跟弹页的 3D 透视钢琴 + 粒子

### 共享组件

- **project-shell**：顶栏（Logo + 模式导航 + 风格快切 + 帮助）+ 沉浸背景层（CSS 渐变 + canvas 星点）+ 页脚。所有页通过 `<!-- SLOT: main -->` 填充。
- **piano-stage**：3D 透视钢琴键盘。7 白键（A S D F G H J）+ 5 黑键（W E T Y U）。键面标注字母+音名，白键 `flex:1`，黑键 `position:absolute` 偏移。八度指示「C4」。`.is-down` 态高亮。被自由弹奏与跟弹页复用。

---

## 逐页 UI 规格

### 页1 首页 home.html

- 类型：Showcase / 落地页
- 视觉锚点：全屏星空渐变背景 + canvas 星点粒子 + 透视钢琴剪影 + hero 图
- 布局：Hero 区（大标题「键盘即琴键」+ 副标题 + 主 CTA「立即弹奏」+ 次 CTA「AI 转谱」）→ 模式三栏区（自由弹奏/跟弹打分/AI 转谱，用列非等高卡）→ 「为你推荐」横向滚动歌曲 → 新手引导入口 → 页脚
- data-dom-id：`cta-free-play`、`cta-ai-transcription`、`cta-library`、`shortcut-follow-play`、`nav-settings`、`back-home`

### 页2 自由弹奏 free-play.html

- 类型：app-shell，`h-screen overflow-hidden`
- 布局：左控件栏（八度指示 C4 + Z/X 按钮、音色选择 4 项、延音踏板、节拍器、录音三态）→ 中央舞台（Three.js 3D 钢琴 + 粒子 + 当前音名浮层）→ 底部钢琴键盘条 → 右信息栏（按键映射对照 + 力度 + 录音时长）
- 交互态：按键 :active 下沉、音色切换即时高亮、录音态脉冲点
- data-dom-id：`cta-to-follow-play`（可见）、`back-home`、`nav-settings`

### 页3 跟弹打分 follow-play.html

- 类型：app-shell，`h-screen overflow-hidden`
- 布局：顶栏 + 曲目名/难度/BPM → HUD 条（大分数 + 连击 + 准确率 + 进度条）→ 下落音符高速路（7 白键列 + 5 黑键窄位，音符带键位字母，底部判定线发光）→ 判定弹出文字（Perfect 青/Great 紫/Good 粉/Miss 红）→ 底部钢琴键盘条（高亮当前应按键）→ 右侧可折叠乐谱面板 → 左下暂停/重启
- 判定窗口标注：`Perfect ±50ms · Great ±100ms · Good ±150ms`
- data-dom-id：`cta-results`（可见）、`back-home`、`nav-settings`

### 页4 AI 转谱 ai-transcription.html

- 类型：task-driven，document-scroll
- 布局：上传区（大虚线拖拽框 + 格式约束 + 隐私说明 + .mid 直传次入口）→ 进度区（进度条 + 阶段标签「提取音轨→Basic Pitch 推理→生成乐谱」+ 可取消 + 计时）→ 结果预览区（识别统计：音符数/时长/BPM + 五线谱预览缩略 + 下落谱面缩略 + 试听对比 + 免责声明）→ 主 CTA「进入跟弹」
- data-dom-id：`cta-enter-follow`（可见）、`back-home`、`nav-settings`

### 页5 曲库 song-library.html

- 类型：information-dense，document-scroll
- 布局：标题区 + 搜索框 + 难度筛选标签组（入门/进阶/挑战）→ 网格区（8-12 首，CSS 渐变封面 + 标题 + 难度 pill/BPM/时长，hover 上浮）→ 底部固定操作条「开始跟弹」
- 曲目：小星星、欢乐颂、卡农片段、天空之城片段、生日快乐 + 自创练习曲
- data-dom-id：`cta-play-song`（可见）、`back-home`、`nav-settings`

### 页6 结算 results.html

- 类型：dashboard / 数据页，chartsRequired: true
- 布局：主分数区（超大等宽分数 + 评级 S 圆章 + 曲目名）→ 三指标行（最大连击 + 准确率 + Perfect/Great/Good/Miss 四色分布条）→ Chart.js 准确率趋势折线 → 操作区（再来一次 + 换一首 + 分享）
- data-dom-id：`shortcut-library`、`back-home`、`nav-settings`
- 终端页，0 可见出口

### 页7 设置 settings.html

- 类型：form / task，document-scroll
- 布局：左侧设置导航（视觉风格/音频/无障碍/关于）→ 视觉风格区（3 风格预设大卡：星空/樱花/赛博，单选选中态）→ 音频区（音色默认/力度映射/节拍器音量/延迟校准）→ 无障碍区（高对比开关/键盘可达/振动反馈/色弱配色）→ 摄像头画中画（默认关 + 隐私说明）→ 关于（版本/纯前端说明/错误码表）
- data-dom-id：`back-home`、`nav-library`
- 辅助页，0 可见出口

---

## 布线方案

可见布线（5 条，画布箭头）：
```
home → ai-transcription    cta-ai-transcription
home → song-library        cta-library
ai-transcription → follow-play   cta-enter-follow
song-library → follow-play       cta-play-song
follow-play → results            cta-results
```

隐藏交互（hideEdge:true）：
```
所有页 → 首页        back-home
所有页 → 设置        nav-settings
首页   → 跟弹        shortcut-follow-play
首页   → 自由弹奏    cta-free-play
曲库/结算/设置 → 曲库  nav-library / shortcut-library
```

结算/设置为终端页，0 可见出口。自由弹奏经首页隐藏交互可达。

---

## 实现顺序（依赖感知）

### 批次1：项目初始化（Main Agent 直接执行）
- 建目录结构
- 写 `colors_and_type.css`（品牌 token + @font-face）
- 跑 `fill-html-head.mjs` 语义预检（`--theme=dark --prefix=piano`）
- 写 `.design` 骨架（7 页节点 + config）
- 写 `orchestration-summary.json` + `generation-tree.json`

### 批次2：图片预生成
- 生成 1 张 `hero-starry-piano.jpg`（首页 critical-hero）
- Main Agent 注册 image-001 节点到 `.design`

### 批次3：共享片段 + 独立叶页（并行）
- 分派 `project-shell` 共享片段（先）
- 完成后并行分派：`piano-stage` + home / ai-transcription / song-library / results / settings

### 批次4：钢琴依赖页（并行）
- `piano-stage` 完成后，并行分派 `free-play` + `follow-play`

### 批次5：收尾
- 汇总 Sub-Agent 报告
- 批量 `--replace-head` 修复 head 基建（results 加 `--charts`，自由弹奏/跟弹加 Three.js CDN）
- 注册布线 interactions 到 `.design`
- 执行 `scan-design-directory.mjs` 校验

每页 head 模式：SkeletonMainOnly（先 `fill-html-head.mjs` 生成骨架，Sub-Agent 仅编辑 `<main>` 内部）。

---

## 假设与决策

1. 设备 = desktop；7 页单 group；深色为默认沉浸主题，浅色 = 高对比无障碍
2. 三色：紫 = 主色，粉/青 = 游戏语义色（判定档位/风格预设），全部为 CSS 变量
3. 字体 = Outfit + JetBrains Mono（fontsource 绝对 URL @font-face）
4. 共享片段：project-shell（全局壳）+ piano-stage（钢琴键盘，自由弹奏/跟弹复用）
5. 可见布线 5 条，自由弹奏/设置经隐藏交互
6. 图片仅 1 张（首页 hero），曲库封面用 CSS 渐变 + 图标
7. head 模式 = SkeletonMainOnly，results 加 `--charts`，自由弹奏/跟弹加 Three.js
8. Three.js 仅 canvas 像素渲染，不修改 DOM 树
9. 不创建设计库（free_exploration 模式，直接派生本地样式）

---

## 校验步骤

全部 Sub-Agent 完成、布线写回 `.design` 后，执行一次完整校验：

```bash
node {SKILL_DIR}/script/scan-design-directory.mjs \
  ".../piano-game" \
  --expected-pages=7 \
  --require-interactions=cta-ai-transcription:home.html,cta-library:home.html,cta-enter-follow:ai-transcription.html,cta-play-song:song-library.html,cta-results:follow-play.html \
  --report-json=".../piano-game/validation-report.json"
```

通过判据：`validation-report.json` 存在且 `success:true`、`renderBlockingErrorCount:0`。

交付前自检清单：
- 7 页 HTML 均含 `id="theme-vars"`、`id="semantic-token-fallback"`、`@theme inline`、`<html class="dark">`、Tailwind CDN、Lucide
- results 含 Chart.js CDN；自由弹奏/跟弹含 Three.js CDN
- 所有色值来自 `--piano-*` / `--state-*` 变量；无 `bg-blue-500` 类
- 图片仅 `../assets/hero-starry-piano.jpg`，已注册 image-001
- 琴键映射 A S D F G H J / W E T Y U / Z X 八度在自由弹奏与跟弹页一致
- 判定档位青/紫/粉/红与 token 一致
- 布线 5 可见 + 隐藏交互，`data-dom-id` 唯一
