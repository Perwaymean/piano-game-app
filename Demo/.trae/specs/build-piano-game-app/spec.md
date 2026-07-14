# 键盘弹钢琴网页游戏 · 功能实现 Spec

## Why

工作区当前已有两份资产：
1. `需求文档/` — 完整 PRD（14 个功能模块 M01–M14、AI 专项、技术架构、19 项缺失建议），以及交付验证计划。
2. `UI相关文件/piano-game/` — 7 张高保真静态设计稿（`home / free-play / follow-play / ai-transcription / song-library / results / settings`）+ `colors_and_type.css` 品牌设计 Token + hero 图片资源。

但两者都停留在「文档与视觉稿」层面，没有任何可运行的功能代码：键不会发声、下落音符不会判定、AI 转谱不可用、3D 钢琴只是 CSS 透视、历史/曲库/设置均无持久化。本 spec 的目标是把 PRD 三条核心链路（自由弹奏 M02、跟弹打分 M03、AI 转谱 M04）与必要支撑模块（M01 音源 / M05 键位映射 / M07 历史 / M08 沉浸视觉 / M09 曲库 / M13 全平台适配）落地为**可运行、可体验、可提交大赛**的纯前端 SPA，UI 严格沿用现有设计稿与 Token，不破坏既有静态稿。

## What Changes

### 新增工作区
- 在工作区根目录新建 `piano-game-app/` 目录，承载全部实现代码（与 `需求文档/`、`UI相关文件/` 平级，互不污染）。
- 技术栈：Vite + TypeScript + React 18 + React Router（hash 路由）+ Tailwind CSS v4 + Three.js + Chart.js + Lucide React + idb。
- 构建产物：单文件 HTML（通过 `vite-plugin-singlefile`），可直接打成 zip 提交大赛，断网可运行。

### 7 个视图落地为 SPA 路由
保留原设计稿的全部视觉、文案、Token、`data-dom-id`；用 React 组件重写为功能页面：

| 路由 | 对应设计稿 | 主要功能落地 |
|------|------------|--------------|
| `/` | home.html | 落地页 + 三模式入口 + 推荐曲横向滚动 + 新手引导入口 |
| `/free-play` | free-play.html | 自由弹奏（M02）+ 录音（M14 基础版）+ 3D 钢琴（M08） |
| `/follow-play` | follow-play.html | 跟弹打分（M03）+ 下落音符 + 判定 + HUD + 暂停/重启 |
| `/ai-transcription` | ai-transcription.html | AI 转谱（M04）+ 进度阶段 + 结果预览 + 进跟弹入口 |
| `/library` | song-library.html | 曲库（M09）+ 难度筛选 + 选曲进跟弹 |
| `/results` | results.html | 结算（M06/M07）+ 评级 + 四档分布 + 趋势折线 + 写历史 |
| `/settings` | settings.html | 设置（M12）+ 风格切换 + 音频校准 + 无障碍 + 摄像头 PiP（M08a）+ 关于 |

### 核心引擎模块（`src/engine/`）
- `audio-engine.ts` — Web Audio API 音源引擎（M01）：预创建 AudioContext、ADSR 包络、4 种音色（三角钢琴采样 / 音乐盒 / 合成 Pad / 8-bit）、MIDI→频率表、同时多音、iOS 首次交互 resume。
- `key-mapper.ts` — 键盘映射（M05）：A S D F G H J（白键 C D E F G A B）、W E T Y U（黑键）、Z/X 切八度，88 键折叠到可用按键，触屏琴键 ≥44px。
- `judger.ts` — 判定器（M03）：Perfect ±50ms / Great ±100ms / Good ±150ms / Miss；以 `AudioContext.currentTime` 为基准音画同步。
- `score-engine.ts` — 打分与连击（M03）：分数 = Perfect 100 / Great 60 / Good 30 / Miss 0；连击倍率；S/A/B/C 评级。
- `visual-engine.ts` — Three.js 沉浸视觉（M08）：3D 透视钢琴、命中粒子爆发、3 套预设（星空 / 樱花 / 赛博）、桌面 60fps / 移动 30fps 降级。
- `ai-transcriber.ts` — AI 转谱（M04）：动态 import `@spotify/basic-pitch`，输入 AudioBuffer 输出 notes→MIDI+MusicXML；MP4 走 ffmpeg.wasm 单线程懒加载兜底，引导直传音频优先；进度阶段回调；分级降级。
- `storage.ts` — 持久化（M07/M14）：IndexedDB（idb）存历史记录与录音；localStorage 存设置；存储超限兜底。
- `song-data.ts` — 内置曲库（M09）：8–12 首公有领域/自创片段（小星星 / 欢乐颂 / 卡农片段 / 天空之城片段 / 生日快乐 + 自创练习曲），格式为 `{id,title,difficulty,bpm,duration,notes:[{midi,time,duration}]}`。
- `recorder.ts` — 录音回放（M14 基础版）：记录 `{midi,time,duration,velocity}`，回放走同一音源，导出 `.mid`（MIDI 编码）。

### 共享 UI 组件（`src/components/`）
- `PianoKeyboard.tsx` — 共享 3D 透视钢琴键盘（自由弹奏/跟弹复用），7 白 + 5 黑，键面标注字母+音名，`.is-down` 态高亮，键盘 + 触屏双输入。
- `TopBar.tsx` — 全局顶栏（Logo + 模式导航 + 风格快切 + 帮助）。
- `ImmersiveBackground.tsx` — 沉浸背景层（CSS 渐变 + canvas 星点粒子）。
- `FallingNotes.tsx` — 下落音符高速路（跟弹专用），7 白键列 + 5 黑键窄位，底部判定线发光，音符带键位字母。
- `JudgmentPopup.tsx` — 判定弹出文字（Perfect 青 / Great 紫 / Good 粉 / Miss 红，浮起淡出 320ms）。
- `HUD.tsx` — 大分数 + 连击 + 准确率 + 进度条。
- `ScoreSheet.tsx` — OpenSheetMusicDisplay 五线谱渲染（懒加载，跟弹页可折叠面板）。
- `RecordingControls.tsx` — 录音三态按钮 + 时长显示 + 回放 + 导出。
- `SongCard.tsx` — 曲库卡片（CSS 渐变封面 + 难度 pill + BPM + 时长）。
- `Toast.tsx` — 统一错误 Toast（M12 错误处理）。

### 全局上下文（`src/context/`）
- `SettingsContext.tsx` — 全局设置（主题/音色/延迟校准/无障碍开关/摄像头授权/风格预设），同步 localStorage。
- `AudioContextProvider.tsx` — 单例 AudioEngine，跨页面共享。

### 设计系统迁移
- 复制 `UI相关文件/piano-game/colors_and_type.css` 内容到 `src/styles/tokens.css`，作为 Tailwind v4 `@theme` 来源。
- 字体仍用 Outfit + JetBrains Mono + Noto Sans SC（CDN woff2，build 时内联为 base64 或保留 CDN）。
- 所有色值严格走 `--piano-*` / `--state-*` 变量，禁用裸色值。

## Impact

- **Affected specs**：本 spec 为新建，无前序 spec 受影响。
- **Affected code**：
  - 新增：`piano-game-app/`（完整 Vite 项目，预计 30–50 个源文件）
  - 只读引用：`UI相关文件/piano-game/colors_and_type.css`、`UI相关文件/piano-game/pages/*.html`、`UI相关文件/piano-game/assets/hero-starry-piano.jpg`、`需求文档/piano-game-prd/piano-game-prd.html`
  - 不修改：`需求文档/`、`UI相关文件/` 任何既有文件
- **依赖外部库**：`react` `react-dom` `react-router-dom` `three` `chart.js` `lucide-react` `idb` `@spotify/basic-pitch` `opensheetmusicdisplay` `ffmpeg.wasm`（后三者懒加载）
- **构建产物**：`piano-game-app/dist/index.html`（单文件，资源内联）

---

## ADDED Requirements

### Requirement: 音源引擎 (M01)
系统 SHALL 提供基于 Web Audio API 的音源引擎，键盘 / 触屏 / 自动播放触发后 50ms 内出声，支持 4 种音色与同时多音。

#### Scenario: 按下白键即时出声
- **WHEN** 用户按下 `A` 键（映射到 C4）
- **THEN** 系统在 ≤50ms 内播放 C4 钢琴音色，对应琴键高亮下沉

#### Scenario: 同时多音无爆音
- **WHEN** 用户同时按下 4 个键（如 A+S+D+F）
- **THEN** 4 个音同时发声，无丢音、无爆音、无削波

#### Scenario: iOS 首次交互激活
- **WHEN** iOS Safari 用户首次点击「立即弹奏」
- **THEN** 系统 resume AudioContext 并播放第一个音，无静音

#### Scenario: 八度切换
- **WHEN** 用户按 `X` 键切到下一八度
- **THEN** 八度指示变为 C5，所有键位映射上移一个八度

### Requirement: 自由弹奏 (M02)
系统 SHALL 提供自由弹奏模式，键盘任意键即时发声 + 3D 键动画 + 粒子，支持音色切换 / 八度切换 / 录音 / 节拍器。

#### Scenario: 键盘弹奏
- **WHEN** 用户在自由弹奏页按下任意映射键
- **THEN** 即时发声 + 3D 钢琴对应键下沉 + 命中粒子爆发

#### Scenario: 音色切换
- **WHEN** 用户从「三角钢琴」切换到「音乐盒」
- **THEN** 后续按键使用音乐盒音色，UI 高亮当前选中

#### Scenario: 触屏多点
- **WHEN** 移动端用户在横屏下同时触按 3 个琴键
- **THEN** 3 个音同时响应，触屏琴键尺寸 ≥44px

### Requirement: 跟弹打分 (M03)
系统 SHALL 提供跟弹打分模式，下落音符到达判定线时按键判定为 Perfect/Great/Good/Miss，累分 + 连击 + 特效，结算写入历史。

#### Scenario: 命中 Perfect
- **WHEN** 下落音符到达判定线 ±50ms 内用户按下对应键
- **THEN** 显示「Perfect!」青色浮起文字，分数 +100，连击 +1，粒子爆发

#### Scenario: Miss 断连
- **WHEN** 音符过线 ±150ms 未按下对应键
- **THEN** 显示「Miss」红色文字，连击归零，分数不变

#### Scenario: 自动演示
- **WHEN** 用户点击「自动演示」按钮
- **THEN** 系统自动按下所有音符，仅展示不判定，可用于教学

#### Scenario: 结算写入历史
- **WHEN** 一曲结束（用户主动结束或谱面播完）
- **THEN** 跳转到 `/results`，分数 / 评级 / 四档分布写入 IndexedDB 历史

### Requirement: AI 转谱 (M04)
系统 SHALL 提供浏览器端 AI 转谱：上传 MP4/音频 → 提取音轨 → Basic Pitch 推理 → 生成 MIDI+MusicXML → 进入跟弹。

#### Scenario: 上传 WAV 成功转谱
- **WHEN** 用户上传 30s 钢琴独奏 WAV（≤10MB）
- **THEN** 进度条依次显示「提取音轨 → Basic Pitch 推理 → 生成乐谱」，60s 内完成，结果区显示音符数/时长/BPM + 五线谱预览 + 下落谱面预览，主 CTA「进入跟弹」可点

#### Scenario: MP4 音轨提取
- **WHEN** 用户上传 MP4
- **THEN** 系统懒加载 ffmpeg.wasm 单线程提取音轨后进入 Basic Pitch 流程；若环境不支持 SharedArrayBuffer 则引导用户改传音频文件

#### Scenario: 模型加载失败降级
- **WHEN** Basic Pitch 模型加载失败（网络/CDN）
- **THEN** Toast 提示「AI 模型加载失败，已为你打开内置曲库」，自动跳转 `/library`

#### Scenario: 复杂混音提示
- **WHEN** 推理结果音符数 < 阈值或检测到人声+伴奏混音特征
- **THEN** 结果区显示免责声明「AI 识别结果仅供参考，建议使用更清晰的独奏音频」

### Requirement: MIDI→按键映射 (M05)
系统 SHALL 将 88 键钢琴折叠到可用键盘：A S D F G H J（白键 C D E F G A B）、W E T Y U（黑键）、Z/X 切八度，超出可见八度的音符自动平移/折叠并显示提示。

#### Scenario: C 大调音阶全可弹
- **WHEN** 当前八度为 C4
- **THEN** A S D F G H J 对应 C4 D4 E4 F4 G4 A4 B4，W E T Y U 对应 C#4 D#4 F#4 G#4 A#4

#### Scenario: 三音和弦映射
- **WHEN** 谱面同时出现 C4+E4+G4 三音
- **THEN** 系统映射到 A+F+H 三个物理键，跟弹页同帧判定

### Requirement: 乐谱展示 (M06)
系统 SHALL 在跟弹页可折叠面板用 OpenSheetMusicDisplay 渲染 MusicXML 五线谱，跟弹时高亮当前小节。

#### Scenario: 标准谱面渲染
- **WHEN** 用户在跟弹页展开乐谱面板
- **THEN** OSMD 懒加载并渲染当前曲目 MusicXML，无卡顿

#### Scenario: 渲染失败回退
- **WHEN** OSMD 渲染失败或 MusicXML 损坏
- **THEN** 隐藏乐谱面板，仅显示下落音符，不阻断游戏

### Requirement: 历史记录 (M07)
系统 SHALL 在 IndexedDB 持久化跟弹历史与录音，刷新后保留，存储超限有提示。

#### Scenario: 刷新后数据保留
- **WHEN** 用户完成一曲后刷新浏览器
- **THEN** 历史记录仍在，结算页折线图显示近 10 次分数

#### Scenario: 存储超限
- **WHEN** IndexedDB 写入超限（QuotaExceededError）
- **THEN** Toast 提示「存储已满，建议清理早期历史」，不崩溃

### Requirement: 沉浸视觉引擎 (M08)
系统 SHALL 用 Three.js 渲染 3D 透视钢琴 + 命中粒子爆发 + 3 套风格预设（星空 / 樱花 / 赛博），桌面 60fps / 移动 30fps，风格切换 <500ms。

#### Scenario: 命中触发粒子
- **WHEN** 跟弹命中或自由弹奏按键
- **THEN** 对应琴键位置触发粒子爆发，颜色随判定档位

#### Scenario: 风格切换
- **WHEN** 用户在设置页从「星空」切到「赛博」
- **THEN** 500ms 内背景 / 粒子 / 配色全部切换，无白屏

#### Scenario: WebGL 不支持降级
- **WHEN** 浏览器不支持 WebGL
- **THEN** 隐藏 3D 钢琴，仅显示 CSS 2D 钢琴键盘，Toast 提示已降级

### Requirement: 摄像头画中画 (M08a)
系统 SHALL 提供摄像头画中画功能，默认关闭，首次开启弹隐私提示，纯本地不上传，无权限时优雅隐藏。

#### Scenario: 首次开启
- **WHEN** 用户首次在设置页开启摄像头画中画
- **THEN** 弹隐私提示「视频仅本地显示，不上传」，用户同意后调 getUserMedia 渲染小窗

#### Scenario: 拒绝授权
- **WHEN** 用户拒绝摄像头授权
- **THEN** 隐藏画中画功能，不报错，Toast 提示「已隐藏画中画」

### Requirement: 内置曲库 (M09)
系统 SHALL 提供至少 8 首内置曲目，按难度（入门/进阶/挑战）分类，每首含难度/BPM/时长标签。

#### Scenario: 曲库展示
- **WHEN** 用户进入 `/library`
- **THEN** 网格展示 ≥8 首曲目卡片，含 CSS 渐变封面 + 标题 + 难度 pill + BPM + 时长

#### Scenario: 选曲进跟弹
- **WHEN** 用户点击某曲目卡片后点底部「开始跟弹」
- **THEN** 跳转 `/follow-play?song=<id>`，加载该曲目谱面

### Requirement: 歌单推荐 (M10)
系统 SHALL 在首页基于曲库 + 用户历史规则推荐「为你推荐」歌单，无历史时给默认推荐，结果不重复。

#### Scenario: 首次访问默认推荐
- **WHEN** 无历史的用户首次访问首页
- **THEN** 「为你推荐」横向滚动展示 4 首入门曲目，不重复

### Requirement: 新手引导 (M11)
系统 SHALL 提供分步遮罩新手引导，首次进入自动触发，可跳过，常驻帮助入口。

#### Scenario: 首次自动触发
- **WHEN** 首次访问的用户进入首页
- **THEN** 自动启动分步遮罩引导（按键 → 看下落音符 → 切八度 → 上传转谱），含跳过按钮

### Requirement: 无障碍与错误处理 (M12)
系统 SHALL 全局支持键盘可达、高对比度、视觉等价反馈、统一错误 Toast、不兼容降级页。

#### Scenario: 高对比度切换
- **WHEN** 用户在设置页开启高对比度
- **THEN** 主题切到浅色（`--piano-background:#ffffff`），所有文字对比度达标

#### Scenario: 不支持 WebAssembly 降级
- **WHEN** 浏览器不支持 WebAssembly
- **THEN** AI 转谱入口显示降级提示页，引导用内置曲库，其他功能不受影响

### Requirement: 全平台适配 (M13)
系统 SHALL 桌面 + 移动全适配，移动端横屏优先，触屏琴键可滑动切八度，触屏多点可同时响应。

#### Scenario: 桌面缩窗自适应
- **WHEN** 桌面用户拖小窗口至 768px 宽
- **THEN** 布局自适应，琴键不溢出，HUD 不遮挡

#### Scenario: 移动横屏触屏
- **WHEN** 移动用户横屏访问 `/free-play`
- **THEN** 显示触屏琴键（≥44px），滑动可切八度，多点同时响应

### Requirement: 录音回放 (M14)
系统 SHALL 在自由弹奏页提供录音功能，记录 `{midi,time,duration,velocity}`，回放走同一音源，可导出 `.mid`。

#### Scenario: 录音回放
- **WHEN** 用户录音 10s 后点回放
- **THEN** 系统按原时序重放所有音符，音序与力度正确

#### Scenario: 导出 MIDI
- **WHEN** 用户点导出
- **THEN** 下载 `.mid` 文件，可被其他 MIDI 工具打开

---

## MODIFIED Requirements

### Requirement: 静态设计稿保持只读
现有 `UI相关文件/piano-game/` 静态设计稿作为本实现的视觉与 Token 唯一来源，实现过程不修改原稿，仅在 `piano-game-app/src/` 内派生新代码。

---

## REMOVED Requirements

无移除项。本 spec 全部为新增。
