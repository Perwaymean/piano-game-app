import { useEffect, useRef, type ReactNode } from 'react'

type Style = 'starry' | 'sakura' | 'cyber'

// 三套主题：渐变 + 粒子配置 + 二次装饰层
interface ThemeConfig {
  // 主背景渐变（径向，自顶部向下扩散）
  gradient: string
  // 二次叠加渐变（增加层次感，让风格更鲜明）
  overlay: string
  // 粒子类型：star=闪烁星点 / petal=飘落花瓣 / grid=网格脉冲
  particle: 'star' | 'petal' | 'grid'
  // 粒子颜色（rgba 前缀）
  particleColor: string
  // 粒子数量
  particleCount: number
}

const THEME: Record<Style, ThemeConfig> = {
  // 星空：深紫黑底 + 顶部紫光晕 + 白色闪烁星点
  starry: {
    gradient: 'radial-gradient(ellipse at 50% 0%, var(--piano-purple-700) 0%, var(--piano-background) 70%)',
    overlay: 'radial-gradient(ellipse at 80% 90%, rgba(139, 92, 246, 0.08), transparent 50%)',
    particle: 'star',
    particleColor: '255, 255, 255',
    particleCount: 80,
  },
  // 樱花：粉黑底 + 顶部粉色光晕 + 飘落樱花花瓣（带摇摆 + 旋转）
  sakura: {
    gradient: 'radial-gradient(ellipse at 50% 0%, #831843 0%, #1a0d14 60%, var(--piano-background) 85%)',
    overlay: 'radial-gradient(ellipse at 20% 80%, rgba(244, 114, 182, 0.12), transparent 55%)',
    particle: 'petal',
    particleColor: '244, 114, 182', // --piano-pink-400
    particleCount: 35,
  },
  // 赛博：青黑底 + 顶部青色光晕 + 网格脉冲点
  cyber: {
    gradient: 'radial-gradient(ellipse at 50% 0%, var(--piano-cyan) 0%, #0a0e1a 65%, var(--piano-background) 90%)',
    overlay: 'linear-gradient(180deg, transparent 0%, rgba(8, 145, 178, 0.06) 100%)',
    particle: 'grid',
    particleColor: '34, 211, 238', // --piano-cyan-400
    particleCount: 50,
  },
}

// 樱花花瓣形状（五瓣椭圆）
function drawPetal(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, rotation: number, alpha: number, color: string) {
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(rotation)
  ctx.globalAlpha = alpha
  ctx.fillStyle = `rgba(${color}, 1)`
  // 五瓣花瓣
  for (let i = 0; i < 5; i++) {
    ctx.save()
    ctx.rotate((i * Math.PI * 2) / 5)
    ctx.beginPath()
    ctx.ellipse(0, -size * 0.7, size * 0.35, size * 0.7, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  }
  // 中心黄点
  ctx.fillStyle = 'rgba(250, 240, 140, 0.8)'
  ctx.beginPath()
  ctx.arc(0, 0, size * 0.25, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

export default function ImmersiveBackground({
  style = 'starry',
  children,
}: {
  style?: Style
  children?: ReactNode
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduceMotion) return

    const cfg = THEME[style]
    let rafId = 0
    let width = (canvas.width = window.innerWidth)
    let height = (canvas.height = window.innerHeight)

    // === 粒子初始化（按风格差异化）===
    interface Particle {
      x: number
      y: number
      r: number
      baseAlpha: number
      phase: number
      speed: number
      // 花瓣专属
      vx: number
      vy: number
      rotation: number
      rotSpeed: number
      swayPhase: number
      swayAmp: number
      // 网格专属
      gridX: number
      gridY: number
    }

    const particles: Particle[] = []
    const count = cfg.particleCount

    if (cfg.particle === 'petal') {
      // 花瓣：从顶部生成，向下飘落 + 横向摇摆 + 旋转
      for (let i = 0; i < count; i++) {
        particles.push({
          x: Math.random() * width,
          y: Math.random() * height - height,
          r: Math.random() * 4 + 3,
          baseAlpha: Math.random() * 0.5 + 0.4,
          phase: 0,
          speed: 0,
          vx: 0,
          vy: Math.random() * 0.6 + 0.3, // 下落速度
          rotation: Math.random() * Math.PI * 2,
          rotSpeed: (Math.random() - 0.5) * 0.04,
          swayPhase: Math.random() * Math.PI * 2,
          swayAmp: Math.random() * 1.2 + 0.5,
          gridX: 0,
          gridY: 0,
        })
      }
    } else if (cfg.particle === 'grid') {
      // 网格：均匀分布，脉冲呼吸
      const cols = Math.ceil(Math.sqrt(count * (width / height)))
      const rows = Math.ceil(count / cols)
      const stepX = width / cols
      const stepY = height / rows
      let idx = 0
      for (let r = 0; r < rows && idx < count; r++) {
        for (let c = 0; c < cols && idx < count; c++) {
          particles.push({
            x: c * stepX + stepX / 2,
            y: r * stepY + stepY / 2,
            r: 1.5,
            baseAlpha: Math.random() * 0.4 + 0.2,
            phase: Math.random() * Math.PI * 2,
            speed: Math.random() * 0.03 + 0.01,
            vx: 0, vy: 0, rotation: 0, rotSpeed: 0, swayPhase: 0, swayAmp: 0,
            gridX: c, gridY: r,
          })
          idx++
        }
      }
    } else {
      // 星点：随机分布，闪烁
      for (let i = 0; i < count; i++) {
        particles.push({
          x: Math.random() * width,
          y: Math.random() * height,
          r: Math.random() * 1.5 + 0.4,
          baseAlpha: Math.random() * 0.6 + 0.3,
          phase: Math.random() * Math.PI * 2,
          speed: Math.random() * 0.025 + 0.005,
          vx: 0, vy: 0, rotation: 0, rotSpeed: 0, swayPhase: 0, swayAmp: 0,
          gridX: 0, gridY: 0,
        })
      }
    }

    const handleResize = () => {
      width = canvas.width = window.innerWidth
      height = canvas.height = window.innerHeight
    }
    window.addEventListener('resize', handleResize)

    const render = () => {
      ctx.clearRect(0, 0, width, height)

      if (cfg.particle === 'petal') {
        // 樱花花瓣：飘落 + 摇摆 + 旋转
        for (const p of particles) {
          p.swayPhase += 0.02
          p.x += Math.sin(p.swayPhase) * p.swayAmp
          p.y += p.vy
          p.rotation += p.rotSpeed
          if (p.y > height + 20) {
            p.y = -20
            p.x = Math.random() * width
          }
          if (p.x < -20) p.x = width + 20
          if (p.x > width + 20) p.x = -20
          drawPetal(ctx, p.x, p.y, p.r, p.rotation, p.baseAlpha, cfg.particleColor)
        }
      } else if (cfg.particle === 'grid') {
        // 赛博网格：脉冲呼吸 + 连接线
        for (const p of particles) {
          p.phase += p.speed
          const alpha = p.baseAlpha * (0.4 + 0.6 * Math.sin(p.phase))
          ctx.beginPath()
          ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
          ctx.fillStyle = `rgba(${cfg.particleColor}, ${alpha})`
          ctx.fill()
        }
        // 绘制网格连接线（仅在赛博风格）
        ctx.strokeStyle = `rgba(${cfg.particleColor}, 0.08)`
        ctx.lineWidth = 1
        const cols = Math.ceil(Math.sqrt(particles.length * (width / height)))
        for (let i = 0; i < particles.length; i++) {
          const p = particles[i]
          // 右邻
          if (i + 1 < particles.length && particles[i + 1].gridY === p.gridY) {
            ctx.beginPath()
            ctx.moveTo(p.x, p.y)
            ctx.lineTo(particles[i + 1].x, particles[i + 1].y)
            ctx.stroke()
          }
          // 下邻
          const downIdx = i + cols
          if (downIdx < particles.length) {
            ctx.beginPath()
            ctx.moveTo(p.x, p.y)
            ctx.lineTo(particles[downIdx].x, particles[downIdx].y)
            ctx.stroke()
          }
        }
      } else {
        // 星点：闪烁
        for (const p of particles) {
          p.phase += p.speed
          const alpha = p.baseAlpha * (0.5 + 0.5 * Math.sin(p.phase))
          // 大星点带十字光芒
          if (p.r > 1.2) {
            ctx.strokeStyle = `rgba(${cfg.particleColor}, ${alpha * 0.4})`
            ctx.lineWidth = 0.5
            ctx.beginPath()
            ctx.moveTo(p.x - p.r * 3, p.y)
            ctx.lineTo(p.x + p.r * 3, p.y)
            ctx.moveTo(p.x, p.y - p.r * 3)
            ctx.lineTo(p.x, p.y + p.r * 3)
            ctx.stroke()
          }
          ctx.beginPath()
          ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
          ctx.fillStyle = `rgba(${cfg.particleColor}, ${alpha})`
          ctx.fill()
        }
      }
      rafId = requestAnimationFrame(render)
    }
    render()

    return () => {
      cancelAnimationFrame(rafId)
      window.removeEventListener('resize', handleResize)
    }
  }, [style])

  const cfg = THEME[style]

  return (
    <div
      aria-hidden="true"
      className="fixed inset-0 -z-10 pointer-events-none"
      style={{ background: cfg.gradient }}
    >
      {/* 二次装饰叠加层 */}
      <div
        className="absolute inset-0"
        style={{ background: cfg.overlay }}
      />
      <canvas ref={canvasRef} className="w-full h-full block" />
      {children}
    </div>
  )
}
