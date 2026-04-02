import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { expect, test } from 'vitest';

import { fromZetasizer } from '../../index.ts';

const data = readFileSync(join(import.meta.dirname, 'data/zetaPotential.txt'));
const dataChb = readFileSync(
  join(import.meta.dirname, 'data/zetaPotential-chb.txt'),
);

test('file produces 1 spectrum', () => {
  const analysis = fromZetasizer(data);

  expect(analysis.spectra).toHaveLength(1);
  expect(analysis.spectra[0]?.dataType).toBe('Zeta potential measurement');
});

test('x variable contains Zeta Potentials data', () => {
  const analysis = fromZetasizer(data);
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
  const analysis = fromZetasizer(data);
  const spectrum = analysis.spectra[0];

  expect(spectrum).toBeDefined();
  expect(spectrum?.variables.y.data).toBeInstanceOf(Float64Array);
  expect(spectrum?.variables.y.data).toHaveLength(90);
  expect(spectrum?.variables.y.label).toBe('Intensity');
  expect(spectrum?.variables.y.isDependent).toBe(true);
});

test('title is extracted from sample name', () => {
  const analysis = fromZetasizer(data);

  expect(analysis.spectra[0]?.title).toBe('LCD in FB 75/25 1');
});

test('meta contains measurement metadata', () => {
  const analysis = fromZetasizer(data);
  const meta = analysis.spectra[0]?.meta;

  expect(meta?.['Zeta Potential (mV)']).toBe(-16.8);
  expect(meta?.['Zeta Deviation (mV)']).toBe(5.71);
  expect(meta?.['Conductivity (mS/cm)']).toBe(0.943);
  expect(meta?.['Mobility (µmcm/Vs)']).toBeCloseTo(-1.317, 3);
  expect(meta?.['Measurement Status']).toBe('Complete');
  expect(meta?.Type).toBe('Zeta');
});

test('meta contains measurement parameters', () => {
  const analysis = fromZetasizer(data);
  const meta = analysis.spectra[0]?.meta;

  expect(meta?.['Duration (s)']).toBe(3);
  expect(meta?.['Zeta Runs']).toBe(12);
  expect(meta?.Attenuator).toBe(11);
});

test('settings contain instrument info', () => {
  const analysis = fromZetasizer(data);
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

test('zetaPotential-chb produces 4 spectra', () => {
  const analysis = fromZetasizer(dataChb);

  expect(analysis.spectra).toHaveLength(4);

  for (const spectrum of analysis.spectra) {
    expect(spectrum.dataType).toBe('Zeta potential measurement');
    expect(spectrum.variables.x.data).toBeInstanceOf(Float64Array);
    expect(spectrum.variables.y.data).toBeInstanceOf(Float64Array);
    expect(spectrum.variables.x.label).toBe('Zeta potential');
    expect(spectrum.variables.x.units).toBe('mV');
  }

  expect(analysis.spectra[0]?.title).toBe('SD283 - F1, HBG6.4, 0h 1');
  expect(analysis.spectra[3]?.title).toBe('SD283 - F1, HBG6.4, 0h 4');
});

test('zetaPotential-chb includes time and phase variables', () => {
  const analysis = fromZetasizer(dataChb);
  const spectrum = analysis.spectra[0];

  expect(spectrum?.variables.t).toBeDefined();
  expect(spectrum?.variables.t?.data).toBeInstanceOf(Float64Array);
  expect(spectrum?.variables.t?.label).toBe('Time');
  expect(spectrum?.variables.t?.units).toBe('s');
  expect(spectrum?.variables.t?.isDependent).toBe(false);

  expect(spectrum?.variables.p).toBeDefined();
  expect(spectrum?.variables.p?.data).toBeInstanceOf(Float64Array);
  expect(spectrum?.variables.p?.label).toBe('Phase');
  expect(spectrum?.variables.p?.units).toBe('rad');
  expect(spectrum?.variables.p?.isDependent).toBe(true);
});

test('meta.cheminfo contains standardized zeta potential results', () => {
  const analysis = fromZetasizer(data);
  const cheminfo = analysis.spectra[0]?.meta?.cheminfo;

  expect(cheminfo).toBeDefined();
  expect(cheminfo.meta.zetaPotential).toStrictEqual({
    value: -16.8,
    units: 'mV',
  });
  expect(cheminfo.meta.zetaDeviation).toStrictEqual({
    value: 5.71,
    units: 'mV',
  });
  expect(cheminfo.meta.mobility?.value).toBeCloseTo(-1.317, 3);
  expect(cheminfo.meta.mobility?.units).toBe('µm·cm/Vs');
  expect(cheminfo.meta.conductivity).toStrictEqual({
    value: 0.943,
    units: 'mS/cm',
  });
  expect(cheminfo.meta.derivedMeanCountRate).toStrictEqual({
    value: 22,
    units: 'kcps',
  });
  expect(cheminfo.meta.meanCountRate).toStrictEqual({
    value: 22,
    units: 'kcps',
  });
});

test('simple file does not include time and phase variables', () => {
  const analysis = fromZetasizer(data);
  const spectrum = analysis.spectra[0];

  expect(spectrum?.variables.t).toBeUndefined();
  expect(spectrum?.variables.p).toBeUndefined();
});
