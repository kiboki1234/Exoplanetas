import { mkdir } from 'node:fs/promises'
import { expect, test, type Page } from '@playwright/test'

const captures = '../docs/capturas'
const testUrl = process.env.COSMOS_TEST_URL ?? 'http://127.0.0.1:8000'

async function noExternalRequests(page: Page) {
  const attempts: string[] = []
  const origin = new URL(testUrl).origin
  await page.route('**/*', route => {
    const url = new URL(route.request().url())
    if (url.origin === origin) return route.continue()
    attempts.push(url.href)
    return route.abort()
  })
  return attempts
}

async function screenshot(page: Page, name: string) {
  await page.evaluate(() => document.fonts.ready)
  await expect.poll(() => page.evaluate(() => ({
    width: document.documentElement.scrollWidth, height: document.documentElement.scrollHeight,
  }))).toEqual({ width: 1920, height: 1080 })
  const visiblePlots = page.locator('.scene:visible .plot')
  for (const plot of await visiblePlots.all()) {
    await expect(plot.locator('.main-svg').first()).toBeVisible()
    const inside = await plot.evaluate(element => {
      const svg = element.querySelector('.main-svg')
      const box = element.getBoundingClientRect()
      const plotted = svg?.getBoundingClientRect()
      return plotted && plotted.width <= box.width + 2 && plotted.height <= box.height + 2
    })
    expect(inside).toBe(true)
  }
  await page.screenshot({ path: captures + '/' + name + '.png', animations: 'disabled' })
}

async function dragPlot(page: Page, label: string) {
  const plot = page.getByLabel(label, { exact: true })
  const box = await plot.locator('.nsewdrag').boundingBox()
  if (!box) throw new Error('No se encontró el área interactiva de ' + label)
  await page.mouse.move(box.x + box.width * 0.2, box.y + box.height * 0.2)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width * 0.45, box.y + box.height * 0.8, { steps: 8 })
  await page.mouse.up()
}

test('recorrido de conferencia con navegador limitado al servidor local', async ({ page }) => {
  const external = await noExternalRequests(page)
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  page.on('response', response => { if (response.status() >= 400) errors.push(response.url() + ' ' + response.status()) })
  await mkdir(captures, { recursive: true })
  await page.goto('/')
  await expect(page.getByRole('heading', { name: '¿Podemos encontrar un planeta invisible?' })).toBeVisible()
  await expect(page.getByLabel('Curva de luz sintética sincronizada', { exact: false })).toBeVisible()
  await page.getByRole('button', { name: 'Pausar', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Reproducir', exact: true })).toBeEnabled()
  await page.locator('#planet-radius').press('ArrowRight')
  await expect(page.locator('.depth-readout strong')).toHaveText('1,69 %')
  await page.locator('#orbit-period').press('ArrowRight')
  await expect(page.locator('output[for="orbit-period"]')).toHaveText('6,1 días')
  await page.locator('#orbit-noise').press('ArrowRight')
  await expect(page.locator('output[for="orbit-noise"]')).toHaveText('50 ppm')
  await page.getByRole('button', { name: 'Reiniciar toda la demostración' }).click()
  await expect(page.getByLabel('Curva de luz sintética sincronizada', { exact: false })).toBeVisible()
  await expect(page.locator('.depth-readout strong')).toHaveText('1,44 %')
  await page.getByRole('button', { name: 'Ver tránsito', exact: true }).click()
  await screenshot(page, '01-simulacion')

  await page.getByRole('button', { name: 'Modo Presentación' }).click()
  await expect(page.locator('.lab')).toHaveClass(/in-presentation/)
  await page.keyboard.press('ArrowRight')
  await expect(page.getByRole('heading', { name: 'Conectamos con NASA TESS' })).toBeVisible()
  await page.getByRole('button', { name: 'Cargar observaciones reales' }).click()
  await expect(page.getByRole('button', { name: 'Observaciones cargadas' })).toBeVisible()
  await expect(page.getByText('2018-07-25 a 2018-08-22')).toBeVisible()
  await screenshot(page, '02-tess')

  await page.keyboard.press('ArrowRight')
  await expect(page.getByRole('heading', { name: '¿Ven algún patrón en todos estos puntos?' })).toBeVisible()
  const rawPlot = page.getByLabel('Curva de luz real de Pi Mensae')
  await expect(rawPlot.locator('.main-svg').first()).toBeVisible()
  await page.getByLabel('Unidad de flujo').selectOption('ppm')
  await expect(rawPlot.getByText('Variación (ppm)', { exact: true })).toBeVisible()
  await rawPlot.hover()
  await rawPlot.locator('[data-attr="dragmode"][data-val="select"]').click()
  await dragPlot(page, 'Curva de luz real de Pi Mensae')
  await expect(page.locator('.scene:visible .chart-footer')).toContainText('cadencias en el intervalo')
  await page.getByRole('button', { name: 'Restablecer vista' }).click()
  await screenshot(page, '03-observaciones')

  await page.keyboard.press('ArrowRight')
  await expect(page.getByText('Curva procesada', { exact: false })).toBeVisible()
  const detrending = page.getByLabel('Corregir tendencia lenta')
  const processing = page.waitForResponse(response => response.url().endsWith('/analysis/preprocess') && response.ok())
  await detrending.uncheck()
  const reply = await (await processing).json()
  expect(reply.steps.find((step: { operation: string }) => step.operation === 'Tendencia lenta').enabled).toBe(false)
  await expect(detrending).not.toBeChecked()
  await page.getByRole('button', { name: 'Restablecer original' }).click()
  await expect(page.getByText('Después · vista original restaurada')).toBeVisible()
  const defaults = page.waitForResponse(response => response.url().endsWith('/analysis/preprocess') &&
    response.request().postDataJSON().detrend === true && response.ok())
  await page.getByRole('button', { name: 'Usar valores iniciales' }).click()
  await defaults
  await expect(detrending).toBeChecked()
  await expect(page.getByText('Actualizando…', { exact: true })).toBeHidden()
  const beforePlot = page.getByLabel('Flujo antes de limpiar')
  const afterPlot = page.getByLabel('Flujo después de limpiar')
  const ticks = afterPlot.locator('.xtick text')
  const originalTicks = await ticks.allTextContents()
  await dragPlot(page, 'Flujo antes de limpiar')
  await expect.poll(() => ticks.allTextContents()).not.toEqual(originalTicks)
  await expect.poll(() => ticks.allTextContents()).toEqual(await beforePlot.locator('.xtick text').allTextContents())
  await page.getByRole('button', { name: 'Restablecer original' }).click()
  const restoredDefaults = page.waitForResponse(response => response.url().endsWith('/analysis/preprocess') &&
    response.request().postDataJSON().detrend === true && response.ok())
  await page.getByRole('button', { name: 'Usar valores iniciales' }).click()
  await restoredDefaults
  await expect(page.getByText('Actualizando…', { exact: true })).toBeHidden()
  await screenshot(page, '04-preparacion')

  await page.keyboard.press('ArrowRight')
  const exact = page.getByLabel('Período exacto (d)')
  await expect(exact).toHaveValue('5')
  await exact.fill('6.1')
  await page.getByRole('button', { name: 'Aplicar', exact: true }).click()
  await expect(page.getByText('6,1000 d')).toBeVisible()
  const published = page.waitForResponse(response =>
    response.url().endsWith('/analysis/fold') && response.request().postDataJSON().period === 6.2679)
  await page.getByRole('button', { name: 'Mostrar período publicado' }).click()
  expect((await (await published).json()).epoch_btjd).toBe(1325.504)
  await expect(page.getByText('Período publicado', { exact: true })).toBeVisible()
  await screenshot(page, '05-plegado')

  await page.getByRole('button', { name: 'Búsqueda automática' }).click()
  await expect(page.getByText('Pico de mayor potencia')).toBeVisible()
  const recomputed = page.waitForResponse(response =>
    response.url().endsWith('/analysis/bls') && response.request().postDataJSON().recalculate === true)
  await page.getByRole('button', { name: 'Recalcular' }).click()
  const best = (await (await recomputed).json()).candidates[0]
  expect(Math.abs(best.period - 6.2679)).toBeLessThan(0.1)
  await expect(page.getByText('Calculado localmente')).toBeVisible()
  await screenshot(page, '06-bls')
  await page.getByRole('button', { name: /Pico de mayor potencia/ }).click()
  await expect(page.getByText('Candidato BLS', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Ir a Pi Mensae c', exact: true }).click()
  await expect(page.getByText('Medido en nuestro procesamiento')).toBeVisible()
  await expect(page.getByText('Publicado por investigadores')).toBeVisible()
  await screenshot(page, '07-pi-mensae-c')

  await page.getByRole('button', { name: 'Siguiente' }).click()
  await expect(page.getByText('La ciencia empieza con una pregunta.')).toBeVisible()
  await page.getByRole('button', { name: 'Alto contraste' }).click()
  await expect(page.getByRole('button', { name: 'Alto contraste' })).toHaveAttribute('aria-pressed', 'true')
  await page.getByRole('button', { name: 'Alto contraste' }).click()
  await screenshot(page, '08-conclusiones')
  await page.getByRole('button', { name: 'Salir de presentación' }).click()
  await expect(page.locator('.sidebar')).toBeVisible()
  expect(external).toEqual([])
  expect(errors).toEqual([])
})

test('la simulación y la consulta TESS caben en un móvil', async ({ page }) => {
  const external = await noExternalRequests(page)
  await page.setViewportSize({ width: 390, height: 844 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  await expect(page.getByLabel('Curva de luz sintética sincronizada', { exact: false })).toBeVisible()
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBe(390)
  await page.getByRole('button', { name: 'Siguiente' }).click()
  await page.getByRole('button', { name: 'Cargar observaciones reales' }).click()
  await expect(page.getByRole('button', { name: 'Observaciones cargadas' })).toBeVisible()
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBe(390)
  await page.setViewportSize({ width: 320, height: 720 })
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBe(320)
  expect(external).toEqual([])
})

test('importa una curva FITS, analiza su resultado y permite volver a Pi Mensae', async ({ page }) => {
  const external = await noExternalRequests(page)
  const file = process.env.COSMOS_TEST_FITS ?? '../data/real/tess2018206045859-s0001-0000000261136679-0120-s_lc.fits'
  const tic = process.env.COSMOS_TEST_TIC ?? '261136679'
  const sector = process.env.COSMOS_TEST_SECTOR ?? '1'
  await page.goto('/')
  await page.getByRole('button', { name: 'Ir a Observaciones TESS', exact: true }).click()
  await page.getByLabel('Archivo FITS de TESS').setInputFiles(file)
  await expect(page.getByText('Archivo importado · análisis local')).toBeVisible()
  await expect(page.getByRole('definition').filter({ hasText: 'TIC ' + tic })).toBeVisible()
  await page.getByRole('button', { name: 'Ver curva de luz' }).click()
  await expect(page.getByText('Serie temporal del sector ' + sector, { exact: true })).toBeVisible()
  await expect(page.locator('.scene:visible .main-svg').first()).toBeVisible()
  await page.getByRole('button', { name: 'Ir a Plegado orbital', exact: true }).click()
  await expect(page.getByLabel('Época de fase cero (BTJD)')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Mostrar período publicado' })).toHaveCount(0)
  await expect(page.getByLabel('Curva plegada por fase').locator('.main-svg').first()).toBeVisible()
  const bls = page.waitForResponse(response => response.url().includes('/analysis/bls?dataset_id=') && response.ok())
  await page.getByRole('button', { name: 'Búsqueda automática' }).click()
  expect((await (await bls).json()).provenance.fits_sha256).toBeTruthy()
  await page.getByRole('button', { name: 'Ir a Resultado del FITS', exact: true }).click()
  await expect(page.getByText('Publicado por investigadores')).toHaveCount(0)
  await expect(page.getByText('Profundidad BLS', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Ir a Observaciones TESS', exact: true }).click()
  await page.getByLabel('Archivo FITS de TESS').setInputFiles({ name: 'lista.sh', mimeType: 'text/plain', buffer: Buffer.from('#!/bin/sh') })
  await expect(page.getByRole('alert')).toContainText('Selecciona una curva de luz FITS')
  await expect(page.getByText('Archivo importado · análisis local')).toBeVisible()
  await page.getByRole('button', { name: 'Volver a Pi Mensae' }).click()
  await expect(page.getByRole('button', { name: 'Observaciones cargadas' })).toBeVisible()
  await page.getByRole('button', { name: 'Ir a Plegado orbital', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Mostrar período publicado' })).toBeVisible()
  expect(external).toEqual([])
})
