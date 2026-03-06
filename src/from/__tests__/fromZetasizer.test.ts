import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { expect, test } from 'vitest';

import { fromZetasizer } from '../../index.ts';

const testFilePath = join(import.meta.dirname, 'data/zetaPotential.txt');
const text = readFileSync(testFilePath, 'utf8');

test('file produces 1 spectrum', () => {
  const analysis = fromZetasizer(text);

  expect(analysis.spectra).toHaveLength(1);
  expect(analysis.spectra[0]?.dataType).toBe('Zeta potential measurement');
});

test('x variable contains Zeta Potentials data', () => {
  const analysis = fromZetasizer(text);
  const spectrum = analysis.spectra[0];

  expect(spectrum).toBeDefined();
  expect(spectrum?.variables.x.data).toBeInstanceOf(Float64Array);
  expect(spectrum?.variables.x.data).toHaveLength(90);
  expect(spectrum?.variables.x.label).toBe('Zeta potential');
  expect(spectrum?.variables.x.units).toBe('mV');
  expect(spectrum?.variables.x.isDependent).toBe(false);
  expect(spectrum?.variables.x.data[0]).toBe(-147);
  expect(spectrum?.variables.x.data[89]).toBe(147);
});

test('y variable contains intensity distribution', () => {
  const analysis = fromZetasizer(text);
  const spectrum = analysis.spectra[0];

  expect(spectrum).toBeDefined();
  expect(spectrum?.variables.y.data).toBeInstanceOf(Float64Array);
  expect(spectrum?.variables.y.data).toHaveLength(90);
  expect(spectrum?.variables.y.label).toBe('Intensity');
  expect(spectrum?.variables.y.isDependent).toBe(true);
});

test('title is extracted from sample name', () => {
  const analysis = fromZetasizer(text);

  expect(analysis.spectra[0]?.title).toBe('LCD in FB 75/25 1');
});

test('meta contains measurement metadata', () => {
  const analysis = fromZetasizer(text);
  const meta = analysis.spectra[0]?.meta;

  expect(meta?.['Zeta Potential (mV)']).toBe(-16.8);
  expect(meta?.['Zeta Deviation (mV)']).toBe(5.71);
  expect(meta?.['Conductivity (mS/cm)']).toBe(0.943);
  expect(meta?.['Mobility (\uFFFDmcm/Vs)']).toBeCloseTo(-1.317, 3);
  expect(meta?.['Measurement Status']).toBe('Complete');
  expect(meta?.Type).toBe('Zeta');
});

test('meta contains measurement parameters', () => {
  const analysis = fromZetasizer(text);
  const meta = analysis.spectra[0]?.meta;

  expect(meta?.['Duration (s)']).toBe(3);
  expect(meta?.['Zeta Runs']).toBe(12);
  expect(meta?.Attenuator).toBe(11);
});

test('settings contain instrument info', () => {
  const analysis = fromZetasizer(text);
  const settings = analysis.spectra[0]?.settings;

  expect(settings?.instrument).toStrictEqual({
    manufacturer: 'Malvern Panalytical',
    model: 'Zetasizer',
    serialNumber: 'MAL1086580',
    software: {
      name: 'Zetasizer Nano',
      version: '8.02',
    },
  });
});
