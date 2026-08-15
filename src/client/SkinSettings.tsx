/**
 * The "Background skin" settings section. Owns the upload / opacity / fit /
 * scrim / remove controls and applies changes through a controller owned by
 * the client plugin. No ui-primitives dependency — plain elements + inline
 * styles keep the bundle small and the section self-contained.
 */
import { useCallback, useEffect, useRef, useState, type ChangeEvent, type ReactElement } from 'react'
import type { SkinLocaleService } from '../context-types.ts'
import { fileToDataUrl } from './extract.ts'
import type { SkinFit, SkinState } from './store.ts'

export interface SkinController {
  apply(state: SkinState): Promise<void>
  remove(): void
  /** The currently applied skin, or null — the source of truth for remounts. */
  getState(): SkinState | null
}

interface Props {
  close: () => void
  controller: SkinController
  locale: SkinLocaleService
}

const STR = {
  zh: {
    title: '背景皮肤',
    hint: '选择一张图片作为 DeepSeek Harness 的背景，界面文字与配色会跟随图片自动适配。',
    choose: '选择图片',
    opacity: '背景不透明度',
    fit: '填充方式',
    fitCover: '铺满',
    fitContain: '适应',
    fitStretch: '拉伸',
    scrim: '护目遮罩',
    auto: '自动明暗（跟随图片）',
    remove: '移除皮肤',
    applying: '正在应用…',
    error: '图片处理失败',
  },
  en: {
    title: 'Background skin',
    hint: 'Pick an image as the DeepSeek Harness background; text and chrome colors adapt to the picture automatically.',
    choose: 'Choose image',
    opacity: 'Background opacity',
    fit: 'Image fit',
    fitCover: 'Cover',
    fitContain: 'Contain',
    fitStretch: 'Stretch',
    scrim: 'Scrim',
    auto: 'Auto light/dark (follow image)',
    remove: 'Remove skin',
    applying: 'Applying…',
    error: 'Failed to process image',
  },
} as const

type Dict = (typeof STR)['zh']

function useActiveLocale(locale: SkinLocaleService): 'zh' | 'en' {
  const [active, setActive] = useState<string>(() => locale.getSnapshot().active)
  useEffect(() => locale.subscribe(() => setActive(locale.getSnapshot().active)), [locale])
  return active === 'zh' ? 'zh' : 'en'
}

const sx = {
  root: { display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 560 } as const,
  hint: { fontSize: 13, lineHeight: 1.6, color: 'var(--dsw-alias-label-secondary)' } as const,
  preview: {
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12,
    height: 160, borderRadius: 12, border: '1px solid var(--dsw-alias-border-l2)',
    background: 'var(--dsw-alias-bg-layer-2)', overflow: 'hidden',
  } as const,
  previewImg: { maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' } as const,
  row: { display: 'flex', alignItems: 'center', gap: 12 } as const,
  button: {
    padding: '6px 14px', borderRadius: 8, border: '1px solid var(--dsw-alias-border-l2)',
    background: 'var(--dsw-alias-button-elevated-fill)', color: 'var(--dsw-alias-label-primary)',
    cursor: 'pointer', fontSize: 13,
  } as const,
  danger: { color: 'var(--dsw-alias-state-error-primary)' } as const,
  slider: { flex: 1 } as const,
  label: { fontSize: 13, color: 'var(--dsw-alias-label-primary)', minWidth: 88 } as const,
  meta: { fontSize: 12, color: 'var(--dsw-alias-label-tertiary)' } as const,
  select: {
    padding: '4px 8px', borderRadius: 8, border: '1px solid var(--dsw-alias-border-l2)',
    background: 'var(--dsw-alias-button-elevated-fill)', color: 'var(--dsw-alias-label-primary)',
    fontSize: 13,
  } as const,
}

export function SkinSettings({ controller, locale }: Props): ReactElement {
  const active = useActiveLocale(locale)
  const t = useCallback((key: keyof Dict): string => (STR[active] as Dict)[key], [active])

  // Restore the currently-applied skin on mount: the settings shell unmounts
  // this section when the panel closes, so plain useState defaults would lose
  // the picture (and disable every control) every time the panel reopens.
  const initial = controller.getState()
  const [image, setImage] = useState<string | null>(initial?.image ?? null)
  const [opacity, setOpacity] = useState(initial?.opacity ?? 0.9)
  const [fit, setFit] = useState<SkinFit>(initial?.fit ?? 'cover')
  const [scrim, setScrim] = useState(initial?.scrim ?? 0)
  const [auto, setAuto] = useState(initial?.auto ?? false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const apply = useCallback(
    async (img: string, op: number, ft: SkinFit, sc: number, au: boolean): Promise<void> => {
      setBusy(true)
      setError(null)
      try {
        await controller.apply({ image: img, opacity: op, fit: ft, scrim: sc, auto: au })
        setImage(img)
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err))
      } finally {
        setBusy(false)
      }
    },
    [controller],
  )

  const onPick = useCallback(
    async (event: ChangeEvent<HTMLInputElement>): Promise<void> => {
      const file = event.target.files?.[0]
      if (!file) return
      try {
        const url = await fileToDataUrl(file)
        await apply(url, opacity, fit, scrim, auto)
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err))
      } finally {
        if (fileRef.current) fileRef.current.value = ''
      }
    },
    [apply, opacity, fit, scrim, auto],
  )

  const onOpacity = useCallback(
    async (value: number): Promise<void> => {
      setOpacity(value)
      if (image) await apply(image, value, fit, scrim, auto)
    },
    [apply, image, fit, scrim, auto],
  )

  const onFit = useCallback(
    async (value: SkinFit): Promise<void> => {
      setFit(value)
      if (image) await apply(image, opacity, value, scrim, auto)
    },
    [apply, image, opacity, scrim, auto],
  )

  const onScrim = useCallback(
    async (value: number): Promise<void> => {
      setScrim(value)
      if (image) await apply(image, opacity, fit, value, auto)
    },
    [apply, image, opacity, fit, auto],
  )

  const onAuto = useCallback(
    async (value: boolean): Promise<void> => {
      setAuto(value)
      if (image) await apply(image, opacity, fit, scrim, value)
    },
    [apply, image, opacity, fit, scrim],
  )

  const onRemove = useCallback((): void => {
    controller.remove()
    setImage(null)
    setError(null)
  }, [controller])

  return (
    <div style={sx.root}>
      <div style={sx.hint}>{t('hint')}</div>

      <div style={sx.preview}>
        {image ? (
          <img src={image} alt="" style={sx.previewImg} />
        ) : (
          <span style={sx.meta}>{t('hint').split('。')[0]}</span>
        )}
      </div>

      <div style={sx.row}>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={onPick}
        />
        <button type="button" style={sx.button} disabled={busy} onClick={() => fileRef.current?.click()}>
          {busy ? t('applying') : t('choose')}
        </button>
        {image ? (
          <button type="button" style={{ ...sx.button, ...sx.danger }} onClick={onRemove}>
            {t('remove')}
          </button>
        ) : null}
      </div>

      <div style={sx.row}>
        <span style={sx.label}>{t('opacity')}</span>
        <input
          type="range"
          min={0.3}
          max={1}
          step={0.05}
          value={opacity}
          disabled={!image}
          style={sx.slider}
          onChange={(e) => void onOpacity(Number(e.target.value))}
        />
        <span style={sx.meta}>{Math.round(opacity * 100)}%</span>
      </div>

      <div style={sx.row}>
        <span style={sx.label}>{t('fit')}</span>
        <select
          value={fit}
          disabled={!image}
          style={sx.select}
          onChange={(e) => void onFit(e.target.value as SkinFit)}
        >
          <option value="cover">{t('fitCover')}</option>
          <option value="contain">{t('fitContain')}</option>
          <option value="stretch">{t('fitStretch')}</option>
        </select>
      </div>

      <div style={sx.row}>
        <span style={sx.label}>{t('scrim')}</span>
        <input
          type="range"
          min={0}
          max={0.6}
          step={0.05}
          value={scrim}
          disabled={!image}
          style={sx.slider}
          onChange={(e) => void onScrim(Number(e.target.value))}
        />
        <span style={sx.meta}>{Math.round(scrim * 100)}%</span>
      </div>

      <div style={sx.row}>
        <label style={{ ...sx.label, display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={auto}
            disabled={!image}
            onChange={(e) => void onAuto(e.target.checked)}
          />
          {t('auto')}
        </label>
      </div>

      {error ? <div style={{ ...sx.meta, color: 'var(--dsw-alias-state-error-primary)' }}>{t('error')}: {error}</div> : null}
    </div>
  )
}
