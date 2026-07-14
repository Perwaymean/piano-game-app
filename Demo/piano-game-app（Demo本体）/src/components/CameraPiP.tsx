import { useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'

export interface CameraPiPProps {
  enabled: boolean
  onToggle: (enabled: boolean) => void
  className?: string
}

/* ============================================================
   摄像头画中画组件
   - 首次开启时弹隐私确认 modal
   - 确认后调 getUserMedia({ video: true })
   - 成功：右下角 160x120 小窗实时渲染
   - 失败：Toast 提示 + onToggle(false) 回退
   - 关闭/卸载时释放 tracks
   ============================================================ */
export default function CameraPiP({ enabled, onToggle, className = '' }: CameraPiPProps) {
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [showPrivacyModal, setShowPrivacyModal] = useState(false)
  const [privacyConfirmed, setPrivacyConfirmed] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  const streamRef = useRef<MediaStream | null>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const toastTimerRef = useRef<number | null>(null)

  function showToast(msg: string) {
    setToast(msg)
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current)
    toastTimerRef.current = window.setTimeout(() => setToast(null), 3000)
  }

  async function startCamera() {
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('getUserMedia unavailable')
      }
      const s = await navigator.mediaDevices.getUserMedia({ video: true })
      streamRef.current = s
      setStream(s)
    } catch {
      showToast('无法访问摄像头')
      onToggle(false)
    }
  }

  function stopCamera() {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    setStream(null)
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
  }

  function confirmCamera() {
    setPrivacyConfirmed(true)
    setShowPrivacyModal(false)
    void startCamera()
  }

  function cancelCamera() {
    setShowPrivacyModal(false)
    onToggle(false)
  }

  // enabled 变化驱动开启 / 关闭
  useEffect(() => {
    if (enabled && !streamRef.current && !showPrivacyModal) {
      if (!privacyConfirmed) {
        setShowPrivacyModal(true)
      } else {
        void startCamera()
      }
    }
    if (!enabled) {
      setShowPrivacyModal(false)
      if (streamRef.current) {
        stopCamera()
      }
    }
    // 仅在 enabled 切换时触发，避免与 modal/确认状态形成循环
  }, [enabled])

  // video 元素挂载后绑定 stream（条件渲染下 videoRef 首次为 null）
  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream
    }
  }, [stream])

  // 组件卸载时释放摄像头与 toast 定时器
  useEffect(() => {
    return () => {
      if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current)
      streamRef.current?.getTracks().forEach((t) => t.stop())
    }
  }, [])

  return (
    <>
      {/* ---------- 隐私确认 Modal ---------- */}
      {showPrivacyModal && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
          role="dialog"
          aria-modal="true"
          aria-label="摄像头隐私说明"
        >
          <div
            className="max-w-sm mx-4 p-6 rounded-lg"
            style={{ background: 'var(--piano-card)', border: '1px solid var(--piano-border)' }}
          >
            <h3 className="text-lg font-semibold mb-2" style={{ color: 'var(--piano-foreground)' }}>
              摄像头隐私说明
            </h3>
            <p className="text-sm mb-4" style={{ color: 'var(--piano-muted-foreground)' }}>
              摄像头画面仅在本地浏览器显示，不会上传到任何服务器。关闭功能后立即释放摄像头资源。
            </p>
            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={cancelCamera}
                className="px-4 py-2 rounded-md text-sm"
                style={{ background: 'var(--piano-muted)', color: 'var(--piano-foreground)' }}
              >
                取消
              </button>
              <button
                type="button"
                onClick={confirmCamera}
                className="px-4 py-2 rounded-md text-sm font-semibold"
                style={{ background: 'var(--piano-primary)', color: 'var(--piano-primary-foreground)' }}
              >
                确认开启
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---------- 视频小窗 ---------- */}
      {stream && (
        <div
          className={`fixed top-16 right-4 z-40 rounded-lg overflow-hidden shadow-xl ${className}`}
          style={{ border: '2px solid var(--piano-border)' }}
        >
          <video ref={videoRef} autoPlay playsInline muted className="w-32 h-24 object-cover" />
          <button
            type="button"
            onClick={() => onToggle(false)}
            className="absolute top-1 right-1 p-1 rounded-full"
            style={{ background: 'rgba(0,0,0,0.6)', color: 'white' }}
            aria-label="关闭摄像头"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      )}

      {/* ---------- Toast ---------- */}
      {toast && (
        <div
          className="fixed bottom-20 left-1/2 -translate-x-1/2 z-[100] px-4 py-2 rounded-md text-sm"
          style={{
            background: 'var(--piano-popover)',
            color: 'var(--piano-foreground)',
            border: '1px solid var(--piano-border)',
          }}
          role="status"
          aria-live="polite"
        >
          {toast}
        </div>
      )}
    </>
  )
}
