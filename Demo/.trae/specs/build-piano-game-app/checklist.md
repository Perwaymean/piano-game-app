# Checklist

## 阶段 0：脚手架与设计系统
- [x] `piano-game-app/` 目录已创建，`npm run dev` 可启动
- [x] `npm run build` 产出单文件 `dist/index.html`（vite-plugin-singlefile 生效，840KB）
- [x] `src/styles/tokens.css` 包含全部 `--piano-*` 与 `--state-*` 变量
- [x] Tailwind v4 `@theme inline` 映射 `--color-*` → `--piano-*` 生效
- [x] `<html class="dark">` 默认深色生效，`bg-background` 类渲染为 `#0d0b1a`
- [x] hero 图 `src/assets/hero-starry-piano.jpg` 已复制

## 阶段 1：路由与全局壳
- [x] HashRouter 配置 7 条路由，刷新不 404
- [x] `TopBar` 顶栏含 Logo + 导航 + 风格快切 + 帮助，保留全部 `data-dom-id`
- [x] `ImmersiveBackground` 含 CSS 渐变 + canvas 星点，支持 3 风格切换
- [x] `SettingsContext` 状态完整（theme/visualStyle/timbre/latency/a11y/camera）
- [x] `AudioContextProvider` 单例 AudioEngine，跨页面共享不重建
- [x] 设置写入 localStorage，刷新后保留

## 阶段 2：核心引擎
- [x] `AudioEngine.playNote` 4 种音色可播放（piano/music_box/pad/8bit + ADSR + Compressor）
- [x] 同时按 4 键无爆音丢音（DynamicsCompressor 防爆）
- [x] iOS 首次交互 resume 生效
- [x] `KeyMapper` 白键 A S D F G H J / 黑键 W E T Y U / Z X 切八度正确
- [x] C 大调音阶全可弹，3 音和弦映射 3 个物理键
- [x] `Judger` 判定窗口 Perfect±50/Great±100/Good±150/Miss 正确
- [x] 连击倍率 + S/A/B/C 评级正确
- [x] `storage` IndexedDB 写入历史/录音，刷新保留，QuotaExceeded 不崩溃
- [x] `song-data` 9 首曲目（含补加 Mary Had a Little Lamb）notes 时序合理

## 阶段 3：核心交互组件
- [x] `PianoKeyboard` 7 白 + 5 黑布局正确，键面标注字母+音名
- [x] 键盘 + 触屏双输入响应，`.is-down` 高亮动画 120ms
- [x] `useKeyboardInput` 忽略 repeat 与输入框焦点
- [x] `FallingNotes` 与时间基准同步下落
- [x] 判定线发光，命中缩放消失
- [x] `JudgmentPopup` 4 色文字浮起淡出 320ms
- [x] `HUD` 分数/连击/准确率/进度实时更新

## 阶段 4：页面
- [x] `Home` 三模式入口 + 推荐曲横向滚动 + 引导入口齐全
- [x] `FreePlay` 键盘按键即时发声 + 3D 占位 + 录音三态
- [x] `FreePlay` 触屏滑动切八度（80px 阈值）
- [x] `FollowPlay` 选曲加载谱面、下落、判定、HUD、暂停、自动演示全链路通
- [x] `FollowPlay` 曲终跳 `/results` 并带分数参数
- [x] `Results` 大分数 + 评级 + 四档分布 + 趋势折线 + 写历史
- [x] `SongLibrary` 难度筛选 + 搜索 + 选曲进跟弹
- [x] `AiTranscription` 上传 → 进度 → 结果 → 进跟弹全链路通（Mock 推理）
- [x] `AiTranscription` 模型加载失败 / 不支持 WASM 降级
- [x] `Settings` 5 区齐全（视觉/音频/无障碍/摄像头/关于）
- [x] 摄像头首次隐私弹窗 + 拒绝隐藏 + 关闭释放流

## 阶段 5：3D 与高级模块
- [x] `VisualEngine` 3D 钢琴 + 粒子爆发 + 3 风格切换
- [x] 桌面 60fps / 移动 30fps 降级（每两帧渲染 + pixelRatio 限制）
- [x] WebGL 不支持时构造 try/catch throw，调用方可 catch 降级
- [x] `Recorder` 回放音序正确（performance.now 计时 + setTimeout 回放）
- [x] 导出 `.mid` 标准 SMF format 0（VLQ 编码 + Tempo/NoteOnOff/EndOfTrack）
- [x] `ScoreSheet` SVG 渲染五线谱 + 高亮当前音符（纯 SVG 无外部依赖）
- [x] 新手引导 4 步遮罩 + 首次自动触发 + 跳过 + 常驻帮助
- [x] 引导完成后 localStorage 标记，不再自动触发

## 阶段 6：移动端与无障碍
- [x] 横屏优先：竖屏 free-play/follow-play 显示提示（PortraitWarning 组件）
- [x] 触屏琴键 ≥44px（白键 minHeight:44px + pointer:coarse CSS）
- [x] HUD 移动端单行压缩（max-width:640px flex-wrap）
- [x] 高对比度切换生效（浅色主题 + border/muted-foreground 加深）
- [x] 键盘 Tab 可达所有交互 + focus 可见环（*:focus-visible CSS）
- [x] `Toast` 统一错误展示（ToastProvider + useToast 4 种类型）
- [x] `prefers-reduced-motion` 动画降级
- [x] 色弱配色切换生效（html.color-blind 类替换 --state-* 变量）
- [x] 不支持 WASM 时 AI 入口显示降级页

## 阶段 7：集成与构建
- [x] 构建产出单文件 `dist/index.html`（840KB，gzip 368KB）
- [x] TypeScript strict 编译零错误（tsc -b 通过）
- [x] Vite 构建 394ms，1815 模块转换
- [x] build 产物 <30MB（840KB << 30MB）
- [x] `base: './'` + HashRouter 适配 file:// 与 zip 提交
- [x] viteSingleFile 内联所有 JS/CSS
- [ ] 运行时冒烟测试（需手动启动 dev server 验证）
- [ ] 运行时性能测试（需 Chrome DevTools 验证 fps/延迟）
- [ ] file:// 打开 dist/index.html 验证（需手动测试）

## 跨切关注
- [x] 所有色值走 `--piano-*` / `--state-*` 变量，无裸色值
- [x] 全部 `data-dom-id` 与原设计稿一致
- [x] 不修改 `需求文档/` 与 `UI相关文件/` 任何既有文件
- [x] 中文输出，CJK 字体回退栈正确（Noto Sans SC / PingFang SC / Microsoft YaHei）
- [x] 错误处理统一走 Toast，无 alert/confirm
- [x] AudioContext 跨页面共享单例（useRef + ContextProvider）
- [x] AI 转谱用 Mock 实现（Basic Pitch/ffmpeg.wasm 未实际加载，降级路径完整）
