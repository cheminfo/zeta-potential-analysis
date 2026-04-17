import { openAsBlob } from 'node:fs';
import { join } from 'node:path';

import type { Analysis } from 'common-spectrum';
import { expect, test } from 'vitest';

import { fromZmes } from '../../index.ts';

const testFilePath = join(import.meta.dirname, 'data/zetaTest.zmes');

/**
 * Load and parse the test .zmes file into an Analysis.
 * @returns Analysis from the test file
 */
async function loadAnalysis(): Promise<Analysis> {
  const blob = await openAsBlob(testFilePath);
  const arrayBuffer = await blob.arrayBuffer();
  return fromZmes(arrayBuffer);
}

test('records produce zeta spectra', async () => {
  const analysis = await loadAnalysis();

  expect(analysis.spectra).toHaveLength(3);

  for (const spectrum of analysis.spectra) {
    expect(spectrum.dataType).toBe('Zeta potential measurement');
  }
});

test('x variable contains Zeta Potentials', async () => {
  const analysis = await loadAnalysis();
  const spectrum = analysis.spectra[0];

  expect(spectrum).toBeDefined();
  expect(spectrum?.variables.x.data).toBeInstanceOf(Float64Array);
  expect(spectrum?.variables.x.data).toHaveLength(84);
  expect(spectrum?.variables.x.label).toBe('Zeta potential');
  expect(spectrum?.variables.x.units).toBe('mV');
  expect(spectrum?.variables.x.isDependent).toBe(false);
  expect(spectrum?.variables.x.data[0]).toBeCloseTo(-148.795, 2);
  expect(spectrum?.variables.x.data[83]).toBeCloseTo(143.666, 2);
});

test('y variable contains intensity distribution', async () => {
  const analysis = await loadAnalysis();
  const spectrum = analysis.spectra[0];

  expect(spectrum).toBeDefined();
  expect(spectrum?.variables.y.data).toBeInstanceOf(Float64Array);
  expect(spectrum?.variables.y.data).toHaveLength(84);
  expect(spectrum?.variables.y.label).toBe('Intensity');
  expect(spectrum?.variables.y.units).toBe('kcps');
  expect(spectrum?.variables.y.isDependent).toBe(true);
});

test('m variable contains mobility distribution', async () => {
  const analysis = await loadAnalysis();
  const spectrum = analysis.spectra[0];

  expect(spectrum?.variables.m).toBeDefined();
  expect(spectrum?.variables.m?.data).toBeInstanceOf(Float64Array);
  expect(spectrum?.variables.m?.data).toHaveLength(84);
  expect(spectrum?.variables.m?.label).toBe('Mobility');
  expect(spectrum?.variables.m?.units).toBe('µm·cm/Vs');
  expect(spectrum?.variables.m?.isDependent).toBe(false);
});

test('title is extracted from sample name', async () => {
  const analysis = await loadAnalysis();

  expect(analysis.spectra[0]?.title).toBe('SICPA-DNA FN220 1 z');
});

test('record GUID is used as id', async () => {
  const analysis = await loadAnalysis();

  expect(analysis.spectra[0]?.id).toBe('ce330109-2bd7-4bbd-a45f-34196d36cb1c');
});

test('meta contains measurement metadata', async () => {
  const analysis = await loadAnalysis();
  const meta = analysis.spectra[0]?.meta;

  expect(meta?.operatorName).toBe('gbf-network');
  expect(meta?.measurementStartDateTime).toBe('2026-01-14T10:40:13.4787715Z');
  expect(meta?.qualityIndicator).toBe('GoodData');
  expect(meta?.resultState).toBe('Completed');
  expect(meta?.repeat).toBe(1);
  expect(meta?.numberOfRepeats).toBe(3);
  expect(meta?.numberOfZetaRuns).toBe(12);
});

test('meta.cheminfo contains standardized zeta potential results', async () => {
  const analysis = await loadAnalysis();
  const cheminfo = analysis.spectra[0]?.meta?.cheminfo;

  expect(cheminfo).toBeDefined();
  expect(cheminfo?.meta?.zetaPotential).toStrictEqual({
    value: expect.closeTo(-28.781, 2),
    units: 'mV',
  });
  expect(cheminfo?.meta?.zetaDeviation).toStrictEqual({
    value: expect.closeTo(12.602, 2),
    units: 'mV',
  });
  expect(cheminfo?.meta?.mobility).toStrictEqual({
    value: expect.closeTo(-2.2547, 3),
    units: 'µm·cm/Vs',
  });
  expect(cheminfo?.meta?.conductivity).toStrictEqual({
    value: expect.closeTo(0.3157, 3),
    units: 'mS/cm',
  });
});

test('settings contain instrument info', async () => {
  const analysis = await loadAnalysis();
  const settings = analysis.spectra[0]?.settings;

  expect(settings?.instrument).toStrictEqual({
    manufacturer: 'Malvern Panalytical',
    model: 'Zetasizer',
    serialNumber: '100038577',
    software: {
      name: 'ZS XPLORER',
      version: '4.1.0.82',
    },
  });
});

test('settings contain zeta run counts', async () => {
  const analysis = await loadAnalysis();
  const settings = analysis.spectra[0]?.settings;

  expect(settings?.numberOfZetaRuns).toBe(12);
  expect(settings?.minimumNumberOfZetaRuns).toBe(10);
  expect(settings?.maximumNumberOfZetaRuns).toBe(100);
});

test('second and third records have distinct zeta potential values', async () => {
  const analysis = await loadAnalysis();

  expect(
    analysis.spectra[1]?.meta?.cheminfo?.meta?.zetaPotential?.value,
  ).toBeCloseTo(-31.53, 2);
  expect(
    analysis.spectra[2]?.meta?.cheminfo?.meta?.zetaPotential?.value,
  ).toBeCloseTo(-34.428, 2);
});

test('non-zeta records are skipped', async () => {
  const dlsFilePath = join(import.meta.dirname, 'data/dlsTest.zmes');
  const blob = await openAsBlob(dlsFilePath);
  const arrayBuffer = await blob.arrayBuffer();
  const analysis = await fromZmes(arrayBuffer);

  expect(analysis.spectra).toHaveLength(0);
});
