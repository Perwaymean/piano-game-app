// VisualEngine: Three.js 3D 沉浸视觉引擎
// 对应 Task 21：3D 透视钢琴 + 粒子系统 + 三套风格预设 + 命中爆发
// 纯 TS 模块，无 React 依赖；调用方负责创建 canvas 并在 WebGL 不支持时 catch 异常

import * as THREE from 'three'

export type VisualStyle = 'starry' | 'sakura' | 'cyber'

export type BurstTier = 'perfect' | 'great' | 'good' | 'miss'

interface BurstParticle {
  mesh: THREE.Mesh
  velocity: THREE.Vector3
  life: number
}

interface KeyPressState {
  originalY: number
  restoreAt: number
  baseEmissive: THREE.Color
}

interface StyleConfig {
  background: number
  particleColor: number
  particleSize: number
  fogColor: number
  fogDensity: number
}

// 三套风格预设
const STYLE_CONFIGS: Record<VisualStyle, StyleConfig> = {
  // 星空：背景紫黑，白色小星点
  starry: {
    background: 0x0d0b1a,
    particleColor: 0xffffff,
    particleSize: 0.05,
    fogColor: 0x0d0b1a,
    fogDensity: 0.02,
  },
  // 樱花：背景粉黑，粉色花瓣
  sakura: {
    background: 0x1a0d14,
    particleColor: 0xf472b6,
    particleSize: 0.1,
    fogColor: 0x1a0d14,
    fogDensity: 0.025,
  },
  // 赛博：背景青黑，青色粒子 + 网格地面
  cyber: {
    background: 0x0a0e1a,
    particleColor: 0x22d3ee,
    particleSize: 0.08,
    fogColor: 0x0a0e1a,
    fogDensity: 0.018,
  },
}

// 命中评级对应的爆发粒子颜色
const TIER_COLORS: Record<BurstTier, number> = {
  perfect: 0x22d3ee, // 青
  great: 0x8b5cf6,   // 紫
  good: 0xdb2777,    // 粉
  miss: 0xf43f5e,    // 红
}

// 白键半音偏移（C D E F G A B）
const WHITE_KEY_OFFSETS: number[] = [0, 2, 4, 5, 7, 9, 11]

// 3D 钢琴：2 个八度（C4-B5），共 14 白键 + 10 黑键 = 24 键
const PIANO_BASE_MIDI = 60 // C4
const PIANO_OCTAVES = 2
const WHITE_KEY_WIDTH = 0.62
const WHITE_KEY_GAP = 0.04
const WHITE_KEY_PITCH = WHITE_KEY_WIDTH + WHITE_KEY_GAP
const BLACK_KEY_WIDTH = 0.36
const TOTAL_WHITE_KEYS = 7 * PIANO_OCTAVES
const PIANO_START_X = -(TOTAL_WHITE_KEYS * WHITE_KEY_PITCH) / 2 + WHITE_KEY_WIDTH / 2

// 黑键在白键序列中的插入位置（相对白键索引的偏移）
const BLACK_KEY_INSERTS = [
  { semitone: 1, afterWhite: 0.5 },  // C#
  { semitone: 3, afterWhite: 1.5 },  // D#
  { semitone: 6, afterWhite: 3.5 },  // F#
  { semitone: 8, afterWhite: 4.5 },  // G#
  { semitone: 10, afterWhite: 5.5 }, // A#
]

const BURST_PARTICLE_COUNT = 12
const BURST_LIFETIME = 1.5
const KEY_PRESS_DURATION = 250

export class VisualEngine {
  private renderer: THREE.WebGLRenderer
  private scene: THREE.Scene
  private camera: THREE.PerspectiveCamera
  private animationId: number = 0
  private pianoKeys: Map<number, THREE.Mesh> = new Map()
  private pianoBody: THREE.Mesh | null = null
  private pianoBack: THREE.Mesh | null = null
  private floor: THREE.Mesh | null = null
  private accentLight: THREE.PointLight | null = null
  private particles: THREE.Points
  private particleVelocities: Float32Array
  private style: VisualStyle = 'starry'
  private burstParticles: BurstParticle[] = []
  private onUnsupported?: () => void

  private particleCount: number
  private isMobile: boolean
  private reduceMotion: boolean
  private keyPressStates: Map<number, KeyPressState> = new Map()
  private particlePositions: Float32Array
  private particleMaterial: THREE.PointsMaterial
  private gridHelper: THREE.GridHelper | null = null
  private lastTime: number = 0
  private frameSkip: number = 0

  constructor(canvas: HTMLCanvasElement, style: VisualStyle = 'starry') {
    this.style = style
    this.isMobile = typeof window !== 'undefined' && window.innerWidth < 768
    this.reduceMotion =
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches

    // 粒子数：移动端减半，prefers-reduced-motion 减到 50
    if (this.reduceMotion) {
      this.particleCount = 50
    } else if (this.isMobile) {
      this.particleCount = 150
    } else {
      this.particleCount = 300
    }

    // 创建 WebGL 渲染器（带降级处理：不支持时回调 + 抛异常让调用方 catch）
    try {
      this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true })
    } catch (e) {
      this.onUnsupported?.()
      throw e
    }
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, this.isMobile ? 1 : 2))

    // 场景 + 雾
    this.scene = new THREE.Scene()
    const config = STYLE_CONFIGS[this.style]
    this.scene.background = new THREE.Color(config.background)
    this.scene.fog = new THREE.FogExp2(config.fogColor, config.fogDensity)

    // 相机：fov 40，俯角透视（适配 2 八度宽度）
    const w = canvas.clientWidth || canvas.width || 1
    const h = canvas.clientHeight || canvas.height || 1
    this.camera = new THREE.PerspectiveCamera(40, w / h, 0.1, 100)
    this.camera.position.set(0, 5.5, 9.5)
    this.camera.lookAt(0, -0.3, 0)
    this.renderer.setSize(w, h, false)

    // 灯光：环境光 + 主聚光灯 + 彩色补光 + 方向补光
    const ambient = new THREE.AmbientLight(0xffffff, 0.35)
    this.scene.add(ambient)

    // 主聚光灯：从上方照亮键盘
    const spotlight = new THREE.SpotLight(0xffffff, 1.5, 25, Math.PI / 4.5, 0.4, 1)
    spotlight.position.set(0, 9, 4)
    spotlight.target.position.set(0, 0, 0)
    this.scene.add(spotlight)
    this.scene.add(spotlight.target)

    // 彩色补光：随风格变化（紫/粉/青）
    const accentColor = this.style === 'cyber' ? 0x22d3ee : this.style === 'sakura' ? 0xf472b6 : 0x8b5cf6
    this.accentLight = new THREE.PointLight(accentColor, 1.0, 18)
    this.accentLight.position.set(0, 2.5, 4.5)
    this.scene.add(this.accentLight)

    // 侧方补光
    const fill = new THREE.DirectionalLight(0xffffff, 0.25)
    fill.position.set(-6, 4, 5)
    this.scene.add(fill)

    // 粒子系统
    this.particlePositions = new Float32Array(this.particleCount * 3)
    this.particleVelocities = new Float32Array(this.particleCount * 3)
    this.particleMaterial = new THREE.PointsMaterial({
      color: config.particleColor,
      size: config.particleSize,
      transparent: true,
      opacity: 0.8,
      sizeAttenuation: true,
    })
    const particleGeo = new THREE.BufferGeometry()
    particleGeo.setAttribute('position', new THREE.BufferAttribute(this.particlePositions, 3))
    this.particles = new THREE.Points(particleGeo, this.particleMaterial)
    this.scene.add(this.particles)

    this.buildPiano()
    this.initParticles()
    this.applyStyleVisuals()

    // 启动渲染循环
    this.lastTime = performance.now()
    this.animate()
  }

  // 构建 3D 钢琴键盘：2 八度（14 白键 + 10 黑键）+ 琴体框架 + 反射地板
  private buildPiano(): void {
    // ---- 琴体框架（深色底座） ----
    const bodyWidth = TOTAL_WHITE_KEYS * WHITE_KEY_PITCH + 0.3
    const bodyGeo = new THREE.BoxGeometry(bodyWidth, 0.55, 3.5)
    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0x15152a,
      roughness: 0.35,
      metalness: 0.35,
    })
    this.pianoBody = new THREE.Mesh(bodyGeo, bodyMat)
    this.pianoBody.position.set(0, -0.32, 0)
    this.scene.add(this.pianoBody)

    // ---- 琴体后墙（谱架区域） ----
    const backGeo = new THREE.BoxGeometry(bodyWidth, 1.0, 0.18)
    const backMat = new THREE.MeshStandardMaterial({
      color: 0x0d0d18,
      roughness: 0.5,
      metalness: 0.4,
    })
    this.pianoBack = new THREE.Mesh(backGeo, backMat)
    this.pianoBack.position.set(0, 0.35, -1.68)
    this.scene.add(this.pianoBack)

    // ---- 反射地板 ----
    const floorGeo = new THREE.PlaneGeometry(40, 40)
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x080812,
      roughness: 0.25,
      metalness: 0.65,
    })
    this.floor = new THREE.Mesh(floorGeo, floorMat)
    this.floor.rotation.x = -Math.PI / 2
    this.floor.position.y = -0.62
    this.scene.add(this.floor)

    // ---- 白键 ----
    const whiteKeyGeo = new THREE.BoxGeometry(WHITE_KEY_WIDTH, 0.22, 3.0)
    for (let oct = 0; oct < PIANO_OCTAVES; oct++) {
      for (let wi = 0; wi < WHITE_KEY_OFFSETS.length; wi++) {
        const semitone = oct * 12 + WHITE_KEY_OFFSETS[wi]
        const whiteIndex = oct * 7 + wi
        const x = PIANO_START_X + whiteIndex * WHITE_KEY_PITCH
        const mat = new THREE.MeshStandardMaterial({
          color: 0xf5f3ee,
          roughness: 0.25,
          metalness: 0.05,
          emissive: 0x000000,
        })
        const mesh = new THREE.Mesh(whiteKeyGeo, mat)
        mesh.position.set(x, 0, 0)
        mesh.userData.semitone = semitone
        mesh.userData.isBlack = false
        this.scene.add(mesh)
        this.pianoKeys.set(semitone, mesh)
      }
    }

    // ---- 黑键 ----
    const blackKeyGeo = new THREE.BoxGeometry(BLACK_KEY_WIDTH, 0.32, 2.0)
    for (let oct = 0; oct < PIANO_OCTAVES; oct++) {
      for (const bk of BLACK_KEY_INSERTS) {
        const semitone = oct * 12 + bk.semitone
        const x = PIANO_START_X + (oct * 7 + bk.afterWhite) * WHITE_KEY_PITCH
        const mat = new THREE.MeshStandardMaterial({
          color: 0x0a0a12,
          roughness: 0.35,
          metalness: 0.2,
          emissive: 0x000000,
        })
        const mesh = new THREE.Mesh(blackKeyGeo, mat)
        mesh.position.set(x, 0.06, -0.5)
        mesh.userData.semitone = semitone
        mesh.userData.isBlack = true
        this.scene.add(mesh)
        this.pianoKeys.set(semitone, mesh)
      }
    }
  }

  // 初始化粒子位置与速度（缓慢下落）
  private initParticles(): void {
    for (let i = 0; i < this.particleCount; i++) {
      const i3 = i * 3
      this.particlePositions[i3] = (Math.random() - 0.5) * 20
      this.particlePositions[i3 + 1] = Math.random() * 10
      this.particlePositions[i3 + 2] = (Math.random() - 0.5) * 10
      this.particleVelocities[i3] = 0
      this.particleVelocities[i3 + 1] = -Math.random() * 0.01 - 0.005
      this.particleVelocities[i3 + 2] = 0
    }
    this.particles.geometry.attributes.position.needsUpdate = true
  }

  // 应用风格相关视觉元素（赛博风格的网格地面）
  private applyStyleVisuals(): void {
    if (this.gridHelper) {
      this.scene.remove(this.gridHelper)
      this.gridHelper.geometry.dispose()
      const oldMat = this.gridHelper.material
      if (Array.isArray(oldMat)) {
        oldMat.forEach((m) => m.dispose())
      } else {
        oldMat.dispose()
      }
      this.gridHelper = null
    }
    if (this.style === 'cyber') {
      const grid = new THREE.GridHelper(20, 20, 0x22d3ee, 0x0a4a5a)
      grid.position.y = -0.3
      this.gridHelper = grid
      this.scene.add(grid)
    }
  }

  // 切换风格：直接切换背景色、粒子颜色、雾，不强制淡入淡出（<500ms）
  setStyle(style: VisualStyle): void {
    this.style = style
    const config = STYLE_CONFIGS[style]
    this.scene.background = new THREE.Color(config.background)
    if (this.scene.fog instanceof THREE.FogExp2) {
      this.scene.fog.color = new THREE.Color(config.fogColor)
      this.scene.fog.density = config.fogDensity
    } else {
      this.scene.fog = new THREE.FogExp2(config.fogColor, config.fogDensity)
    }
    this.particleMaterial.color = new THREE.Color(config.particleColor)
    this.particleMaterial.size = config.particleSize
    this.particleMaterial.opacity = 0.8
    // 更新彩色补光颜色
    if (this.accentLight) {
      this.accentLight.color = new THREE.Color(
        style === 'cyber' ? 0x22d3ee : style === 'sakura' ? 0xf472b6 : 0x8b5cf6,
      )
    }
    this.applyStyleVisuals()
  }

  // 键按下动画：position.y -= 0.12 + emissive 高亮 250ms 后恢复
  pressKey(midi: number): void {
    const semitone = midi - PIANO_BASE_MIDI
    // 先尝试直接映射（C4-B5 两八度内）
    let mesh = this.pianoKeys.get(semitone)
    // 超出范围：折叠到一个八度
    if (!mesh) {
      const folded = ((semitone % 12) + 12) % 12
      mesh = this.pianoKeys.get(folded)
    }
    if (!mesh) return
    // 已被按下时跳过，避免重复触发
    if (this.keyPressStates.has(semitone)) return
    const mat = mesh.material as THREE.MeshStandardMaterial
    const state: KeyPressState = {
      originalY: mesh.position.y,
      restoreAt: performance.now() + KEY_PRESS_DURATION,
      baseEmissive: mat.emissive.clone(),
    }
    this.keyPressStates.set(semitone, state)
    mesh.position.y -= 0.12
    // emissive 高亮：赛博风格用青色，樱花用粉色，星空用紫色
    const glowColor = this.style === 'cyber' ? 0x22d3ee : this.style === 'sakura' ? 0xf472b6 : 0x8b5cf6
    mat.emissive = new THREE.Color(glowColor)
    mat.emissiveIntensity = 1.2
  }

  // 命中粒子爆发：从命中键位置生成 12 颗爆发粒子，颜色按 tier，1.5 秒后消失
  triggerBurst(midi: number, tier: BurstTier): void {
    // prefers-reduced-motion 时禁用爆发动画
    if (this.reduceMotion) return
    const semitone = midi - PIANO_BASE_MIDI
    let mesh = this.pianoKeys.get(semitone)
    if (!mesh) {
      const folded = ((semitone % 12) + 12) % 12
      mesh = this.pianoKeys.get(folded)
    }
    if (!mesh) return
    const color = TIER_COLORS[tier]
    const origin = mesh.position.clone()
    origin.y += 0.3
    for (let i = 0; i < BURST_PARTICLE_COUNT; i++) {
      const geo = new THREE.SphereGeometry(0.07, 6, 6)
      const mat = new THREE.MeshStandardMaterial({
        color,
        emissive: color,
        emissiveIntensity: 1.5,
        transparent: true,
        opacity: 1.0,
      })
      const sphere = new THREE.Mesh(geo, mat)
      sphere.position.copy(origin)
      this.scene.add(sphere)
      // 向外发散 + 重力下落
      const angle = (i / BURST_PARTICLE_COUNT) * Math.PI * 2
      const speed = 1.5 + Math.random() * 0.8
      const velocity = new THREE.Vector3(
        Math.cos(angle) * speed,
        Math.random() * 1.5 + 0.5,
        Math.sin(angle) * speed * 0.5,
      )
      this.burstParticles.push({ mesh: sphere, velocity, life: BURST_LIFETIME })
    }
  }

  resize(width: number, height: number): void {
    if (width <= 0 || height <= 0) return
    this.camera.aspect = width / height
    this.camera.updateProjectionMatrix()
    this.renderer.setSize(width, height, false)
  }

  dispose(): void {
    cancelAnimationFrame(this.animationId)
    // 清理钢琴键
    this.pianoKeys.forEach((mesh) => {
      this.scene.remove(mesh)
      mesh.geometry.dispose()
      this.disposeMaterial(mesh.material)
    })
    this.pianoKeys.clear()
    // 清理琴体框架
    if (this.pianoBody) {
      this.scene.remove(this.pianoBody)
      this.pianoBody.geometry.dispose()
      this.disposeMaterial(this.pianoBody.material)
      this.pianoBody = null
    }
    if (this.pianoBack) {
      this.scene.remove(this.pianoBack)
      this.pianoBack.geometry.dispose()
      this.disposeMaterial(this.pianoBack.material)
      this.pianoBack = null
    }
    // 清理地板
    if (this.floor) {
      this.scene.remove(this.floor)
      this.floor.geometry.dispose()
      this.disposeMaterial(this.floor.material)
      this.floor = null
    }
    // 清理粒子
    this.scene.remove(this.particles)
    this.particles.geometry.dispose()
    this.particleMaterial.dispose()
    // 清理爆发粒子
    this.burstParticles.forEach(({ mesh }) => {
      this.scene.remove(mesh)
      mesh.geometry.dispose()
      this.disposeMaterial(mesh.material)
    })
    this.burstParticles = []
    // 清理网格地面
    if (this.gridHelper) {
      this.scene.remove(this.gridHelper)
      this.gridHelper.geometry.dispose()
      this.disposeMaterial(this.gridHelper.material)
      this.gridHelper = null
    }
    this.renderer.dispose()
  }

  // 渲染循环
  private animate = (): void => {
    this.animationId = requestAnimationFrame(this.animate)
    // 移动端 30fps：每两帧渲染一次
    if (this.isMobile) {
      this.frameSkip++
      if (this.frameSkip < 2) return
      this.frameSkip = 0
    }
    const now = performance.now()
    const dt = Math.min((now - this.lastTime) / 1000, 0.05)
    this.lastTime = now
    this.updateParticles(now)
    this.updateBurstParticles(dt)
    this.updateKeyPresses(now)
    this.renderer.render(this.scene, this.camera)
  }

  // 更新粒子：下落 + 循环回到顶部 + 风格特定行为
  private updateParticles(now: number): void {
    const positions = this.particlePositions
    const velocities = this.particleVelocities
    const time = now * 0.001
    for (let i = 0; i < this.particleCount; i++) {
      const i3 = i * 3
      // 缓慢下落
      positions[i3 + 1] += velocities[i3 + 1]
      // 樱花风格：左右飘动
      if (this.style === 'sakura') {
        positions[i3] += Math.sin(time + i * 0.3) * 0.005
      }
      // 循环回到顶部
      if (positions[i3 + 1] < -3) {
        positions[i3 + 1] = 8
        positions[i3] = (Math.random() - 0.5) * 20
      }
    }
    // 星空风格：缓慢闪烁
    if (this.style === 'starry') {
      this.particleMaterial.opacity = 0.5 + 0.3 * Math.sin(time * 2)
    } else {
      this.particleMaterial.opacity = 0.8
    }
    this.particles.geometry.attributes.position.needsUpdate = true
  }

  // 更新爆发粒子：life 递减 + 重力下落 + 渐隐，life <= 0 时移除
  private updateBurstParticles(dt: number): void {
    const gravity = -2.0
    const remaining: BurstParticle[] = []
    for (const p of this.burstParticles) {
      p.life -= dt
      if (p.life <= 0) {
        this.scene.remove(p.mesh)
        p.mesh.geometry.dispose()
        this.disposeMaterial(p.mesh.material)
        continue
      }
      p.velocity.y += gravity * dt
      p.mesh.position.addScaledVector(p.velocity, dt)
      const mat = p.mesh.material as THREE.MeshStandardMaterial
      mat.opacity = Math.max(0, p.life / BURST_LIFETIME)
      remaining.push(p)
    }
    this.burstParticles = remaining
  }

  // 更新键按下恢复：超过 250ms 还原位置与 emissive
  private updateKeyPresses(now: number): void {
    const expired: number[] = []
    this.keyPressStates.forEach((state, semitone) => {
      if (now >= state.restoreAt) {
        expired.push(semitone)
        const mesh = this.pianoKeys.get(semitone)
        if (mesh) {
          mesh.position.y = state.originalY
          const mat = mesh.material as THREE.MeshStandardMaterial
          mat.emissive.copy(state.baseEmissive)
          mat.emissiveIntensity = 1.0
        }
      }
    })
    expired.forEach((semitone) => this.keyPressStates.delete(semitone))
  }

  // 材质销毁辅助：兼容 Material | Material[]
  private disposeMaterial(mat: THREE.Material | THREE.Material[]): void {
    if (Array.isArray(mat)) {
      mat.forEach((m) => m.dispose())
    } else {
      mat.dispose()
    }
  }
}
