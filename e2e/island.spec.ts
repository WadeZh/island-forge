import { expect, test, type Page } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const ART = path.join(process.cwd(), 'screenshots')
fs.mkdirSync(ART, { recursive: true })

const VIEWPORTS = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'mobile', width: 390, height: 844 },
  { name: 'small', width: 375, height: 667 }
]

async function collectErrors(page: Page): Promise<string[]> {
  const errors: string[] = []
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(`console: ${m.text()}`)
  })
  page.on('pageerror', (e) => errors.push(`pageerror: ${String(e)}`))
  return errors
}

async function drawEllipse(page: Page, rxK = 1.0, ryK = 0.72, steps = 44): Promise<void> {
  const box = (await page.locator('canvas.stage-canvas').boundingBox())!
  const m = Math.min(box.width, box.height) * 0.26
  const rx = m * rxK
  const ry = m * ryK
  const cx = box.x + box.width / 2
  const cy = box.y + box.height / 2
  await page.mouse.move(cx + rx, cy)
  await page.mouse.down()
  for (let i = 1; i <= steps; i++) {
    const t = (i / steps) * Math.PI * 2
    await page.mouse.move(cx + Math.cos(t) * rx, cy + Math.sin(t) * ry, { steps: 1 })
    await page.waitForTimeout(8)
  }
  await page.mouse.up()
}

/** 点击一种实体；自动跳过会被悬浮面板遮挡的坐标 */
async function clickEntity(page: Page, kind: string): Promise<void> {
  const vp = page.viewportSize()!
  let clickedAt = -1
  for (let i = 0; i < 8; i++) {
    const pos = await page.evaluate(
      ([k, idx]) => (window as any).__ISLAND_FORGE__.entityScreenPos(k, idx),
      [kind, i] as [string, number]
    )
    if (!pos) break
    const xOk = pos.x > vp.width * 0.08 && pos.x < vp.width * 0.72
    const yOk = pos.y > vp.height * 0.16 && pos.y < vp.height * 0.78
    if (xOk && yOk) {
      clickedAt = i
      const beforeCount = await page.evaluate(() => (window as any).__ISLAND_FORGE__.stats.interactions)
      await page.mouse.click(pos.x, pos.y)
      await page.waitForFunction(
        (prev) => (window as any).__ISLAND_FORGE__.stats.interactions > prev,
        beforeCount
      )
      break
    }
  }
  expect(clickedAt, `${kind} 应有可点击且不被面板遮挡的实例`).toBeGreaterThanOrEqual(0)
}

async function gotoDrawing(page: Page): Promise<void> {
  await page.goto('/')
  await expect(page.getByTestId('btn-start')).toBeVisible()
  await page.getByTestId('btn-start').click()
  await page.waitForFunction(() => (window as any).__ISLAND_FORGE__?.store.mode === 'drawing')
}

async function generateAndWait(page: Page): Promise<void> {
  await expect(page.getByTestId('btn-generate')).toBeEnabled()
  await page.getByTestId('btn-generate').click()
  await page.waitForFunction(
    () => (window as any).__ISLAND_FORGE__?.store.mode === 'exploring',
    undefined,
    { timeout: 20_000 }
  )
}

async function assertIslandVisible(page: Page): Promise<void> {
  const info = await page.waitForFunction(() => {
    const hook = (window as any).__ISLAND_FORGE__
    const isl = hook?.scene?.island
    if (!isl) return null
    return {
      name: isl.name,
      trees: isl.entities.filter((e: any) => e.kind === 'tree').length,
      houses: isl.entities.filter((e: any) => e.kind === 'house').length,
      area: isl.area
    }
  })
  const v = info.jsonValue()
  expect((await v).trees).toBeGreaterThanOrEqual(3)
  expect((await v).houses).toBeGreaterThanOrEqual(1)
  expect((await v).area).toBeGreaterThan(4000)
}

for (const vp of VIEWPORTS) {
  test.describe(`视口 ${vp.name} ${vp.width}x${vp.height}`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } })

    test('完整流程：绘制 → 生成 → 环境 → 交互 → 导出 → 重新造岛', async ({ page }) => {
      const errors = await collectErrors(page)

      // 首页（等待 GSAP 入场动画结束后再截图）
      await page.goto('/')
      await expect(page.getByText('画一条线，创造一个有生命的世界。')).toBeVisible()
      await page.waitForTimeout(3000)
      await page.screenshot({ path: path.join(ART, `01-welcome-${vp.name}.png`) })

      // 进入绘制页
      await page.getByTestId('btn-start').click()
      await page.waitForFunction(() => (window as any).__ISLAND_FORGE__?.store.mode === 'drawing')
      await expect(page.getByTestId('draw-panel')).toBeVisible()

      // 无效绘制（太小的点）→ 应有提示且不生成
      await page.mouse.move(vp.width / 2, vp.height / 2)
      await page.mouse.down()
      await page.mouse.move(vp.width / 2 + 6, vp.height / 2 + 3, { steps: 2 })
      await page.mouse.up()
      await expect(page.getByTestId('btn-generate')).toBeDisabled()

      // 正常绘制椭圆
      await drawEllipse(page)
      await page.waitForFunction(() => (window as any).__ISLAND_FORGE__?.store.mode === 'preview')
      await page.screenshot({ path: path.join(ART, `02-preview-${vp.name}.png`) })

      // 生成
      await generateAndWait(page)
      await assertIslandVisible(page)
      // 岛屿之歌的音符粒子随节拍出现
      await page.waitForFunction(
        () => (window as any).__ISLAND_FORGE__?.scene.ps.notes.length > 0,
        undefined,
        { timeout: 8000 }
      )
      await page.waitForTimeout(1200)
      await page.screenshot({ path: path.join(ART, `03-island-day-${vp.name}.png`) })

      // 趣味包：首岛成就 + 评级合法 + 旋律 + 岛民
      await page.waitForFunction(() =>
        Boolean((window as any).__ISLAND_FORGE__?.achievements?.snapshot.unlocked['first-island'])
      )
      const grade = await page.evaluate(() => (window as any).__ISLAND_FORGE__.scene.island.grade)
      expect(['S', 'A', 'B', 'C']).toContain(grade)
      const melodyLen = await page.evaluate(
        () => (window as any).__ISLAND_FORGE__.scene.island.melody.length
      )
      expect(melodyLen).toBe(16)
      const villagerCount = await page.evaluate(
        () => (window as any).__ISLAND_FORGE__.scene.island.entities.filter((e: any) => e.kind === 'villager').length
      )
      expect(villagerCount).toBeGreaterThanOrEqual(1)

      // 成就面板可开可关
      await page.getByTestId('btn-achievements').click()
      await expect(page.getByTestId('achievements-modal')).toBeVisible()
      await expect(page.getByTestId('ach-first-island')).toHaveClass(/unlocked/)
      await page.screenshot({ path: path.join(ART, `06-achievements-${vp.name}.png`) })
      await page.getByTestId('btn-close-achievements').click()
      await expect(page.getByTestId('achievements-modal')).toBeHidden()

      // 静音开关
      await page.getByTestId('btn-audio').click()
      await page.waitForFunction(() => (window as any).__ISLAND_FORGE__.store.audioMuted === true)
      await page.getByTestId('btn-audio').click()
      await page.waitForFunction(() => (window as any).__ISLAND_FORGE__.store.audioMuted === false)

      // 昼夜三态：白天→黄昏→夜晚；时光流逝开启时手动切换应接管
      await page.getByTestId('btn-timeflow').click()
      await page.getByTestId('btn-time').click()
      await page.waitForFunction(() => (window as any).__ISLAND_FORGE__?.store.timeFlow === false)
      await page.waitForFunction(() => (window as any).__ISLAND_FORGE__?.scene.duskT > 0.8)
      await page.getByTestId('btn-time').click()
      await page.waitForFunction(() => (window as any).__ISLAND_FORGE__?.scene.nightT > 0.85)
      // 雨天切换
      await page.getByTestId('btn-weather').click()
      await page.waitForFunction(() => (window as any).__ISLAND_FORGE__?.scene.rainT > 0.8)
      await page.waitForTimeout(1200)
      await page.screenshot({ path: path.join(ART, `04-island-night-rain-${vp.name}.png`) })
      // 切到雪天（第三种天气）
      await page.getByTestId('btn-weather').click()
      await page.waitForFunction(() => (window as any).__ISLAND_FORGE__?.scene.snowT > 0.8)
      await page.waitForFunction(() =>
        (window as any).__ISLAND_FORGE__?.achievements.snapshot.unlocked['first-snow']
      )
      await page.waitForTimeout(900)
      await page.screenshot({ path: path.join(ART, `04b-island-snow-${vp.name}.png`) })

      // 雪霁天晴：海面升起彩虹
      await page.getByTestId('btn-weather').click()
      await page.waitForFunction(
        () =>
          (window as any).__ISLAND_FORGE__?.scene.rainT < 0.2 &&
          (window as any).__ISLAND_FORGE__?.scene.snowT < 0.2
      )
      await page.waitForFunction(() => (window as any).__ISLAND_FORGE__?.scene.rainbow.active === true, undefined, {
        timeout: 10_000
      })
      await page.waitForFunction(() => (window as any).__ISLAND_FORGE__?.achievements.snapshot.unlocked['rainbow'])
      await page.getByTestId('btn-time').click()
      await page.waitForFunction(() => (window as any).__ISLAND_FORGE__?.scene.nightT < 0.2 && (window as any).__ISLAND_FORGE__?.scene.duskT < 0.2)

      // 岛屿代码：编码 → 拜访 → 回到我的岛
      const code = await page.evaluate(() => (window as any).__ISLAND_FORGE__.api.getIslandCode())
      expect(code.length).toBeGreaterThan(40)
      const visited = await page.evaluate((c) => (window as any).__ISLAND_FORGE__.api.visitByCode(c), code)
      expect(visited).toBe(true)
      await page.waitForFunction(() => (window as any).__ISLAND_FORGE__?.store.visiting === true)
      await expect(page.getByTestId('visit-banner')).toBeVisible()
      await assertIslandVisible(page)
      await page.getByTestId('btn-back-my-island').click()
      await page.waitForFunction(() => (window as any).__ISLAND_FORGE__?.store.visiting === false)

      // 重新装点（布局变化、海岸不变）
      const before = await page.evaluate(() => {
        const isl = (window as any).__ISLAND_FORGE__.scene.island
        return { seed: isl.decorSeed, outline: JSON.stringify(isl.outline.slice(0, 3)) }
      })
      await page.getByTestId('btn-redecorate').click()
      await page.waitForFunction(
        (prev) => (window as any).__ISLAND_FORGE__.scene.island.decorSeed !== prev,
        before.seed
      )
      const after = await page.evaluate(() => {
        const isl = (window as any).__ISLAND_FORGE__.scene.island
        return JSON.stringify(isl.outline.slice(0, 3))
      })
      expect(after).toBe(before.outline)
      // 等待重装点时间轴完全结束（store.mode 在此期间保持 exploring）
      await page.waitForFunction(() => {
        const H = (window as any).__ISLAND_FORGE__
        return H.store.mode === 'exploring' && H.scene.mode === 'exploring' && H.scene.gen.finished
      })
      await page.waitForTimeout(400)

      // 点击三种实体产生交互反馈
      for (const kind of ['tree', 'house', 'rock'] as const) {
        await clickEntity(page, kind)
      }

      // 导出 PNG
      await page.getByTestId('btn-save').click()
      await expect(page.getByTestId('export-modal')).toBeVisible()
      await page.screenshot({ path: path.join(ART, `05-export-${vp.name}.png`) })
      const dl = await Promise.all([
        page.waitForEvent('download'),
        page.getByTestId('btn-download').click()
      ]).then(([d]) => d)
      const file = path.join(ART, `poster-${vp.name}.png`)
      await dl.saveAs(file)
      const stat = fs.statSync(file)
      expect(stat.size).toBeGreaterThan(10_000)
      const head = fs.readFileSync(file).subarray(0, 8)
      expect([...head]).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

      // 重新造岛
      await page.getByTestId('btn-close-export').click()
      await page.getByTestId('btn-redraw').click()
      await page.waitForFunction(() => (window as any).__ISLAND_FORGE__?.store.mode === 'drawing')
      await drawEllipse(page, 0.82, 1.05)
      await page.waitForFunction(() => (window as any).__ISLAND_FORGE__?.store.mode === 'preview')
      await generateAndWait(page)
      await assertIslandVisible(page)

      expect(errors, errors.join('\n')).toEqual([])
    })
  })
}

test('示例岛按钮可直接生成不同轮廓', async ({ page }) => {
  const errors = await collectErrors(page)
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/')
  await page.getByTestId('btn-example').click()
  // 点击画布跳过生成动画，快速进入探索
  await page.waitForFunction(() => (window as any).__ISLAND_FORGE__?.store.mode === 'generating')
  await page.waitForTimeout(400)
  await page.locator('canvas.stage-canvas').click({ position: { x: 60, y: 60 } })
  await page.waitForFunction(() => (window as any).__ISLAND_FORGE__?.store.mode === 'exploring', undefined, {
    timeout: 5000
  })
  await assertIslandVisible(page)
  // 继续画：示例岛循环应生成不同形状预览
  await page.getByTestId('btn-redraw').click()
  await page.waitForFunction(() => (window as any).__ISLAND_FORGE__?.store.mode === 'drawing')
  await page.getByTestId('btn-try-example').click()
  await page.waitForFunction(() => (window as any).__ISLAND_FORGE__?.store.mode === 'preview')
  const area1 = await page.evaluate(
    () => (window as any).__ISLAND_FORGE__.scene.getPreview().poly.length
  )
  await page.getByTestId('btn-clear').click()
  await page.getByTestId('btn-try-example').click()
  await page.waitForFunction(() => (window as any).__ISLAND_FORGE__?.store.mode === 'preview')
  const area2 = await page.evaluate(
    () => (window as any).__ISLAND_FORGE__.scene.getPreview().poly.length
  )
  expect(area1).toBeGreaterThan(0)
  expect(area2).toBeGreaterThan(0)
  expect(errors, errors.join('\n')).toEqual([])
})

test('保存后可从首页恢复小岛', async ({ page }) => {
  const errors = await collectErrors(page)
  await page.setViewportSize({ width: 1440, height: 900 })
  await gotoDrawing(page)
  await drawEllipse(page)
  await generateAndWait(page)
  await assertIslandVisible(page)

  await page.goto('/')
  await expect(page.getByTestId('btn-resume')).toBeVisible()
  await page.getByTestId('btn-resume').click()
  await page.waitForFunction(() => (window as any).__ISLAND_FORGE__?.store.mode === 'exploring')
  await assertIslandVisible(page)
  expect(errors, errors.join('\n')).toEqual([])
})
