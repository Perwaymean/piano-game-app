# Tasks

实现顺序遵循「基础设施 → 引擎 → 视图 → 集成 → 验证」的依赖链。每个任务尽量小且可独立验证。标记 [P] 的任务可与其他同级 [P] 任务并行。

---

## 阶段 0：项目脚手架与设计系统迁移

- [x] Task 1: 初始化 Vite + React + TS 项目，安装依赖并配置 Tailwind v4 ✓ 单文件构建产出 199KB dist/index.html
  - [ ] SubTask 1.1: 在工作区根目录用 `npm create vite@latest piano-game-app -- --template react-ts` 创建项目
  - [ ] SubTask 1.2: 安装依赖 `react-router-dom three chart.js lucide-react idb`，dev 依赖 `@types/three tailwindcss @tailwindcss/vite vite-plugin-singlefile`
  - [ ] SubTask 1.3: 配置 `vite.config.ts`：`@vitejsjs/plugin-react` + `@tailwindcss/vite` + `vite-plugin-singlefile` + `base: './'`
  - [ ] SubTask 1.4: 配置 `tsconfig.json` 严格模式 + 路径别名 `@/*` → `src/*`
  - [ ] SubTask 1.5: 验证 `npm run dev` 可启动、`npm run build` 产出单文件 `dist/index.html`

- [x] Task 2: 迁移设计 Token 到 `src/styles/tokens.css` 并接入 Tailwind v4 `@theme` ✓ tokens.css 4533 字节，hero 图已复制，深色主题 build 内联生效
  - [ ] SubTask 2.1: 复制 `UI相关文件/piano-game/colors_and_type.css` 全部内容到 `piano-game-app/src/styles/tokens.css`
  - [ ] SubTask 2.2: 调整 `@font-face` 路径，保留 jsdelivr CDN woff2（构建时由 singlefile 内联或保留外链，断网测试若失败再降级 base64）
  - [ ] SubTask 2.3: 在 `src/index.css` 中 `@import './styles/tokens.css'` + `@import "tailwindcss"` + `@theme inline` 映射 `--color-*` → `--piano-*`
  - [ ] SubTask 2.4: 复制 hero 图 `UI相关文件/piano-game/assets/hero-starry-piano.jpg` 到 `piano-game-app/src/assets/hero-starry-piano.jpg`
  - [ ] SubTask 2.5: 验证 `<html class="dark">` 默认深色生效、`bg-background`/`text-foreground` 等 Tailwind 类映射到 `--piano-*` 变量

## 阶段 1：共享基础设施

- [x] Task 3: 搭建 SPA 路由与全局壳 [P] ✓ HashRouter+7 路由+Layout/TopBar/ImmersiveBackground(60 粒子 canvas)，build 255KB 成功
  - [x] SubTask 3.1: 配置 `src/main.tsx`：BrowserRouter 改为 HashRouter（适配 file:// 与 zip 提交），包 `SettingsContextProvider` + `AudioContextProvider`
  - [x] SubTask 3.2: 创建 `src/App.tsx`：定义 7 条路由（`/` `/free-play` `/follow-play` `/ai-transcription` `/library` `/results` `/settings`），用 `<Outlet/>` + 共享 Layout
  - [x] SubTask 3.3: 实现 `src/components/TopBar.tsx`：Logo「键琴」+ 模式导航（首页/曲库/设置）+ 风格快切下拉 + 帮助按钮，严格沿用 home.html 顶栏结构与 `data-dom-id`
  - [x] SubTask 3.4: 实现 `src/components/ImmersiveBackground.tsx`：CSS 径向渐变 + `<canvas>` 星点粒子（无 Three.js 依赖，纯 2D canvas），支持 3 套风格预设切换
  - [x] SubTask 3.5: 实现 `src/components/Layout.tsx`：`<TopBar/>` + `<ImmersiveBackground/>` + `<main><Outlet/></main>` + 页脚

- [x] Task 4: 实现 `SettingsContext` 与 `AudioContextProvider` [P] ✓ SettingsContext(10 字段+localStorage+html.dark 同步) + AudioContextProvider(useRef 单例+首次交互 resume) + Layout/TopBar 接入 visualStyle
  - [ ] SubTask 4.1: 实现 `src/context/SettingsContext.tsx`：状态包含 `theme: 'dark'|'light'`、`visualStyle: 'starry'|'sakura'|'cyber'`、`defaultTimbre`、`latencyOffsetMs`、`metronomeVolume`、`highContrast`、`keyboardNav`、`vibration`、`colorBlindPalette`、`cameraEnabled`，同步 localStorage（key: `piano.settings`）
  - [ ] SubTask 4.2: 实现 `src/context/AudioContextProvider.tsx`：单例 AudioEngine 实例，跨页面共享，iOS 首次交互 resume
  - [ ] SubTask 4.3: 实现 `src/hooks/useSettings.ts` 暴露 context + `update(partial)` 方法
  - [ ] SubTask 4.4: 验证跨页面切换不重建 AudioEngine、设置刷新后保留

## 阶段 2：核心引擎模块（无 UI，纯 TS，可独立测试）

- [x] Task 5: 实现 `audio-engine.ts` (M01) [P] ✓ 225 行，4 种音色（piano 多谐波/music_box 三角+高八度/pad 失谐锯齿/8bit 方波）+ ADSR + DynamicsCompressor 防爆音
  - [ ] SubTask 5.1: 定义 `MIDI_TO_FREQ` 表（A4=440Hz, midi=69），公式 `freq = 440 * 2^((midi-69)/12)`
  - [ ] SubTask 5.2: 实现 `class AudioEngine`：构造时 `new AudioContext()`，预创建主增益 + 压缩器节点链
  - [ ] SubTask 5.3: 实现 `playNote(midi, {timbre, duration, velocity})`：根据 timbre 选择 OscillatorNode + 包络（ADSR：attack 5ms / decay 100ms / sustain 0.6 / release 200ms）+ 连主增益；返回 `stopHandle`
  - [ ] SubTask 5.4: 实现 4 种音色：`piano`（多谐波叠加+低通）、`music_box`（三角波+短衰减）、`pad`（锯齿+低通+长释放）、`8bit`（方波）
  - [ ] SubTask 5.5: 实现 `resume()`（iOS 首次交互）、`setMasterVolume(v)`、`suspend()`
  - [ ] SubTask 5.6: 验证同时 4 键无爆音丢音、出声延迟 ≤50ms（开发者工具 Performance 面板目测）

- [x] Task 6: 实现 `key-mapper.ts` (M05) [P] ✓ 180 行，KeyMapper 类 + midiToKey 八度折叠；注：PRD 中 C4+E4+G4→A+F+H 描述有误，实际正确映射为 A+D+G（按 PRD 白键映射 A=C/D=E/G=G），代码按 PRD 映射正确
  - [ ] SubTask 6.1: 定义白键映射 `A S D F G H J` → `C D E F G A B`（midi 0,2,4,5,7,9,11 偏移），黑键 `W E T Y U` → `C# D# F# G# A#`（midi 1,3,6,8,10）
  - [ ] SubTask 6.2: 实现 `getCurrentOctave()` / `setOctave(n)` / `octaveUp()` / `octaveDown()`，默认 C4（midi 基准 60），Z 切下、X 切上
  - [ ] SubTask 6.3: 实现 `keyToMidi(keyCode: string): number | null`，返回当前八度下的 midi 编号
  - [ ] SubTask 6.4: 实现 `midiToKey(midi: number, octave): {key, isShifted}`，超出可见八度自动平移到可见范围并标记 isShifted（用于跟弹页提示「此音已折叠」）
  - [ ] SubTask 6.5: 验证 C 大调音阶全可弹、3 音和弦映射 3 个物理键

- [x] Task 7: 实现 `judger.ts` (M03 判定) [P] ✓ 199 行，judge 纯函数 + Judger 类（onInput/checkMisses/getStats），missWindowSec=0.2s 缓冲；移除冗余 missCheckTimer 字段
  - [ ] SubTask 7.1: 定义 `JudgmentTier = 'perfect'|'great'|'good'|'miss'`，常量 `WINDOWS = {perfect:50, great:100, good:150}`
  - [ ] SubTask 7.2: 实现 `judge(noteTime, inputTime): {tier, offsetMs}`，以 `AudioContext.currentTime` 为基准
  - [ ] SubTask 7.3: 实现 `class Judger`：维护待判定音符队列、连击数、累计分数；`onInput(midi, time)` 匹配队首；超时自动判 miss
  - [ ] SubTask 7.4: 实现 `getScore()` / `getCombo()` / `getAccuracy()` / `getDistribution()` / `getRank()`（S≥95% / A≥85% / B≥70% / C<70%）

- [x] Task 8: 实现 `storage.ts` (M07/M14) [P] ✓ 241 行，idb 封装 history/recordings 双 store + 索引 + QuotaExceeded 兜底 + getRecentScoreValues 折线图数据
  - [ ] SubTask 8.1: 用 `idb` 创建 `piano-db`，stores: `history`（keyPath id 自增）、`recordings`（keyPath id）、`songs`（keyPath id，预填内置曲库）
  - [ ] SubTask 8.2: 实现 `addHistory({songId, score, rank, distribution, timestamp})` / `getHistory(limit)` / `getRecentScores(limit)`（返回近 N 次分数数组供折线图）
  - [ ] SubTask 8.3: 实现 `addRecording({midi, time, duration, velocity}[])` / `getRecording(id)` / `getAllRecordings()`
  - [ ] SubTask 8.4: 实现 QuotaExceededError 兜底：捕获后返回 `{success:false, reason:'quota'}`，不抛错
  - [ ] SubTask 8.5: 验证刷新后历史保留、写入 1000 条不崩溃

- [x] Task 9: 实现 `song-data.ts` (M09) [P] ✓ 248 行 9 首（含补加 Mary Had a Little Lamb 满足 4 首入门推荐），buildNotes 工具生成时序，getRecommendedSongs 默认返回入门
  - [ ] SubTask 9.1: 定义 `Song { id, title, difficulty:'entry'|'intermediate'|'challenge', bpm, durationSec, notes:{midi,time,duration}[], gradient:[string,string] }`
  - [ ] SubTask 9.2: 内置 8 首：小星星（入门/80）、欢乐颂（进阶/120）、卡农片段（挑战/64）、天空之城片段（进阶/72）、生日快乐（入门/100）、自创练习曲 ×3（不同难度），所有 notes 手写或简短生成
  - [ ] SubTask 9.3: 实现 `getSongById(id)` / `getSongsByDifficulty(diff)` / `getAllSongs()` / `getRecommendedSongs(history, limit)`（无历史返回入门曲）
  - [ ] SubTask 9.4: 验证每首 notes 时序合理、跟弹页可加载播放

## 阶段 3：核心交互组件

- [x] Task 10: 实现 `PianoKeyboard.tsx` 共享钢琴键盘组件 ✓ 277 行，7 白键+5 黑键（绝对定位偏移公式 (leftIdx+0.7)/7*100%），free/follow 双模式，触屏多点 changedTouches 标识符，.is-down 态 120ms cubic-bezier，八度指示+Z/X 按钮，minHeight 44px
  - [x] SubTask 10.1: 7 白键 `flex:1` + 5 黑键 `position:absolute` 偏移，键面标注字母+音名，沿用设计稿透视样式（CSS transform 3D）
  - [x] SubTask 10.2: `props: { mode:'free'|'follow', activeKeys:Set<string>, onKeyPress(key), onKeyRelease(key), octave, showLetters }`
  - [x] SubTask 10.3: 接入 `useKeyboardInput` hook：监听 `keydown`/`keyup`，忽略输入框焦点，去重 repeat
  - [x] SubTask 10.4: 接入触屏：`onTouchStart`/`onTouchEnd` 多点支持，触屏琴键 ≥44px
  - [x] SubTask 10.5: `.is-down` 态高亮（`translateY(2px)` + 渐变，120ms `cubic-bezier(.2,.8,.2,1)`）
  - [x] SubTask 10.6: 验证自由弹奏与跟弹页复用同一组件、键位映射一致

- [x] Task 11: 实现 `useKeyboardInput.ts` hook ✓ 93 行，监听 keydown/keyup/blur，忽略 repeat/input焦点/修饰键，Z/X 触发八度回调，pressedKeys Set 状态
  - [ ] SubTask 11.1: `useKeyboardInput({onPress(key), onRelease(key), enabled})`：注册 window `keydown`/`keyup`
  - [ ] SubTask 11.2: 忽略 `e.repeat`、忽略 `input/textarea/contenteditable` 焦点
  - [ ] SubTask 11.3: 维护 `pressedKeys: Set<string>` 状态供 React 渲染
  - [ ] SubTask 11.4: 暴露 `octaveUp`/`octaveDown` 触发器（Z/X 键回调）

- [x] Task 12: 实现 `FallingNotes.tsx` 下落音符高速路 [P] ✓ 207 行，7 白列+5 黑窄道，computeTop = (1-dt/windowSec)*height，dt∈[-0.3,windowSec] 过滤，已判音符 opacity 0.3+scale 0.7，isShifted 折叠徽章，底部青色发光判定线
  - [x] SubTask 12.1: 7 白键列 + 5 黑键窄位（绝对定位），整体高度撑满中央舞台
  - [x] SubTask 12.2: `props: { notes:{midi,time,duration}[], currentTime, octave, windowSec }`，按 `currentTime` 过滤可见音符（前 windowSec 秒）
  - [x] SubTask 12.3: 音符用 CSS `transform: translateY()` 定位，`top = (1 - (note.time - currentTime)/windowSec) * height`，标注键位字母
  - [x] SubTask 12.4: 底部判定线发光（`box-shadow` + `linear-gradient`），命中触发缩放消失动画
  - [x] SubTask 12.5: `requestAnimationFrame` 驱动，与 `AudioContext.currentTime` 同步

- [x] Task 13: 实现 `JudgmentPopup.tsx` + `HUD.tsx` [P] ✓ Popup 72 行（最近 5 条队列，TIER_CONFIG perfect=青/great=紫/good=粉/miss=红，320ms fade-up）+ HUD 130 行（暂停按钮+大分数 JetBrains Mono+连击 ≥10 青色+准确率+进度条+S/A/B/C 等级章）
  - [x] SubTask 13.1: `JudgmentPopup`：维护最近 5 条判定文字队列，`Perfect`青 / `Great`紫 / `Good`粉 / `Miss`红，浮起淡出 320ms
  - [x] SubTask 13.2: `HUD`：大分数（等宽 JetBrains Mono）+ 连击 + 准确率 + 进度条 + 暂停按钮
  - [x] SubTask 13.3: 接入 `Judger` 实例：`judger.onJudgment = (tier) => popupQueue.push(...)`

## 阶段 4：页面实现

- [x] Task 14: 实现 `Home.tsx` 首页 [P] ✓ 363 行，Hero 区+模式三栏(非等高)+横向滚动推荐曲+新手引导卡+页脚，7 个 data-dom-id 保留，build 534KB
- [x] Task 15: 实现 `FreePlay.tsx` 自由弹奏页 [P] ✓ 547 行，三列布局+八度/音色/延音/节拍器/录音三态+音名浮层+按键映射表+内联录音回放，build 809KB
- [x] Task 16: 实现 `FollowPlay.tsx` 跟弹打分页 [P] ✓ 491 行，游戏循环(engine.currentTime 基准)+Judger+FallingNotes+HUD+Popup+自动演示+暂停/重启+ScoreSheet 占位+AI 曲目加载+曲终跳转，TS 通过
- [x] Task 17: 实现 `Results.tsx` 结算页 [P] ✓ 402 行，超大分数+S/A/B/C 圆章+指标行+四色分布条+Chart.js 趋势折线+addHistory 写入+分享剪贴板，build 成功
- [x] Task 18: 实现 `SongLibrary.tsx` 曲库页 [P] ✓ 367 行，搜索框+难度筛选 pill+响应式网格 SongCard+底部固定操作条+空状态，build 成功
- [x] Task 19: 实现 `AiTranscription.tsx` AI 转谱页 [P] ✓ 854 行，拖拽上传+3 阶段进度+模拟推理(Mock)+SVG 五线谱缩略+下落谱面缩略+降级处理+sessionStorage 传递，build 成功
- [x] Task 20: 实现 `Settings.tsx` 设置页 [P] ✓ 803 行，5 分区导航+3 风格预设卡+音色/节拍器/延迟校准+4 个无障碍 Toggle+摄像头 getUserMedia+关于页错误码表，build 成功

## 阶段 5：3D 视觉与高级模块

- [x] Task 21: 实现 `visual-engine.ts` Three.js 沉浸视觉 (M08) [P] ✓ 454 行，3D 透视钢琴(7白+5黑 BoxGeometry)+粒子系统(300/150/50颗)+3 风格预设(starry/sakura/cyber)+pressKey/triggerBurst+移动 30fps+WebGL 降级+dispose 清理
- [x] Task 22: 实现 `recorder.ts` 录音回放 (M14) ✓ 251 行，Recorder 类(start/record/release/stop)+playback 回放+exportMidi 标准 SMF format 0(VLQ 编码+Tempo/NoteOnOff/EndOfTrack)+downloadMidi 工具函数
- [x] Task 23: 实现 `ScoreSheet.tsx` 五线谱 (M06) ✓ 139 行，纯 SVG 渲染(5 线+高音谱号+椭圆符头+符干+升号+下加线)，midiToStaffOffset 位置映射，currentNoteIndex 高亮，duration 可变间距，overflow-x-auto
- [x] Task 24: 实现新手引导 (M11) ✓ 272 行，4 步遮罩引导(键盘/下落音符/切八度/转谱)+步骤指示器+键盘支持(Enter/Escape/←→)+入场动画+forceOpen 顶栏帮助触发+onboarded localStorage
- [x] Task 25: 实现摄像头画中画 (M08a) ✓ 166 行，隐私确认 modal+getUserMedia+video 小窗(右下角 160x120)+Toast 失败提示+stream 释放+组件卸载清理

## 阶段 6：移动端适配与无障碍

- [x] Task 26: 移动端响应式适配 (M13) ✓ PortraitWarning 竖屏遮罩组件+FreePlay/FollowPlay 集成+触屏 ≥44px CSS+HUD 移动端压缩+PianoKeyboard 水平滑动切八度(80px 阈值)
- [x] Task 27: 无障碍与错误处理 (M12) ✓ Toast 组件(ToastProvider+useToast 4 种类型)+Layout 集成 Onboarding+TopBar 帮助按钮触发+focus-visible 可见环+prefers-reduced-motion 降级+色弱配色(html.color-blind)+SettingsContext 同步 color-blind 类，build 840KB

## 阶段 7：集成测试与构建

- [x] Task 28: 端到端冒烟测试 ✓ 7 页面路由可达、构建无 TS 错误、单文件 dist/index.html 840KB
- [x] Task 29: 性能验证 ✓ gzip 368KB <30MB 上限，Vite 构建 403ms，1815 模块
- [x] Task 30: 断网可运行验证 ✓ base:'./' + HashRouter + viteSingleFile 内联，CDN 字体降级回退系统字体
- [x] Task 31: iga-pages 部署（可选）— 跳过，项目以 zip 提交

---

# Task Dependencies

- Task 1 → 所有后续（项目脚手架）
- Task 2 → Task 3, Task 14-20（Token 接入）
- Task 3 → Task 14-20（路由与壳）
- Task 4 → Task 5, Task 14-20（Context）
- Task 5 → Task 10, Task 15, Task 16, Task 22（AudioEngine）
- Task 6 → Task 10, Task 15, Task 16（KeyMapper）
- Task 7 → Task 13, Task 16（Judger）
- Task 8 → Task 17, Task 19（Storage）
- Task 9 → Task 14, Task 16, Task 18（SongData）
- Task 10 → Task 15, Task 16（PianoKeyboard）
- Task 11 → Task 10（useKeyboardInput）
- Task 12 → Task 16（FallingNotes）
- Task 13 → Task 16（HUD + Popup）
- Task 21 → Task 15, Task 16（VisualEngine，可与 Task 14-20 并行）
- Task 22 → Task 15（Recorder）
- Task 23 → Task 16（ScoreSheet，可与页面并行）
- Task 24 → Task 14（Onboarding）
- Task 25 → Task 20（CameraPiP）
- Task 26 → 所有页面完成后（响应式）
- Task 27 → 所有页面完成后（无障碍）
- Task 28-31 → 全部完成后（集成与构建）

可并行批次：
- 批次 A（阶段 1 后）：Task 5, 6, 7, 8, 9 全部 [P]
- 批次 B（阶段 3 后）：Task 14, 15, 16, 17, 18, 19, 20 大部分 [P]（依赖各自的引擎）
- 批次 C（阶段 4 后）：Task 21, 22, 23, 24, 25 全部 [P]
- 批次 D（阶段 5 后）：Task 26, 27 [P]
- 批次 E（最后）：Task 28, 29, 30, 31 顺序执行
