import type {
  MeasurementXY,
  MeasurementXYVariables,
  ZetaPotentialMeta,
} from 'cheminfo-types';
import { Analysis } from 'common-spectrum';
import type { TextData } from 'ensure-string';
import type { ZetasizerRecord } from 'parse-zetasizer';
import { fromText, getArray } from 'parse-zetasizer';

import type { ZetaPotentialCheminfo } from '../types.ts';

interface FromZetasizerOptions {
  /** Unique identifier for the analysis. */
  id?: string;
  /** Human-readable label for the analysis. */
  label?: string;
}

/**
 * Parse a Zetasizer tab-separated text export and create an Analysis
 * for zeta potential measurements.
 *
 * The parser dynamically discovers whatever columns the file contains.
 * Known array columns (Zeta Potentials, Intensities) are mapped to
 * standard variable symbols (x, y). Records of type Zeta are always
 * included; those without distribution arrays will have empty x/y data.
 * @param data - The raw content of a Zetasizer export file (string, ArrayBuffer, or typed array)
 * @param options - Options for the analysis
 * @returns An Analysis containing one spectrum per measurement
 */
export function fromZetasizer(
  data: TextData,
  options: FromZetasizerOptions = {},
): Analysis {
  const analysis = new Analysis(options);
  const records = fromText(data);

  for (const record of records) {
    const variables = buildVariables(record);
    if (!variables) continue;

    const meta = extractMeta(record);
    const cheminfo = extractCheminfo(record);
    if (cheminfo) {
      meta.cheminfo = cheminfo;
    }

    const spectrumBase = {
      title: extractTitle(record),
      dataType: 'Zeta potential measurement',
      meta,
    };

    if (variables.x.data.length > 0) {
      analysis.pushSpectrum(variables, spectrumBase);
    } else {
      analysis.spectra.push({ variables, ...spectrumBase });
    }

    const spectrum = analysis.spectra.at(-1);
    if (spectrum) {
      spectrum.settings = extractSettings(record);
    }
  }

  return analysis;
}

/**
 * Build MeasurementXYVariables from a parsed record.
 *
 * Returns undefined if the required Zeta Potentials or Intensities arrays
 * are missing.
 * @param record - Parsed Zetasizer record
 * @returns Variables object, or undefined if required data is missing
 */
function buildVariables(
  record: ZetasizerRecord,
): MeasurementXYVariables<Float64Array> | undefined {
  if (record.meta.Type !== 'Zeta') return undefined;

  const zetaPotentials = getArray(record, 'Zeta Potentials');
  const intensities = getArray(record, 'Intensities');

  const variables: MeasurementXYVariables<Float64Array> = {
    x: {
      symbol: 'x',
      label: 'Zeta potential',
      units: zetaPotentials?.units || 'mV',
      data: zetaPotentials?.data ?? new Float64Array(),
      isDependent: false,
    },
    y: {
      symbol: 'y',
      label: 'Intensity',
      units: intensities?.units || '',
      data: intensities?.data ?? new Float64Array(),
      isDependent: true,
    },
  };

  const times = getArray(record, 'Times');
  if (times?.data.length) {
    variables.t = {
      symbol: 't',
      label: 'Time',
      units: times.units || 's',
      data: times.data,
      isDependent: false,
    };
  }

  const phases = getArray(record, 'Phases');
  if (phases?.data.length) {
    variables.p = {
      symbol: 'p',
      label: 'Phase',
      units: phases.units || 'rad',
      data: phases.data,
      isDependent: true,
    };
  }

  return variables;
}

/**
 * Extract the sample name from the record metadata.
 * @param record - Parsed Zetasizer record
 * @returns The sample name, or empty string if not found
 */
function extractTitle(record: ZetasizerRecord): string {
  const sampleName = record.meta['Sample Name'];
  return typeof sampleName === 'string' ? sampleName : '';
}

/**
 * Extract metadata from a parsed record.
 *
 * All scalar metadata from the record is included except Sample Name
 * (which is used as the title).
 * @param record - Parsed Zetasizer record
 * @returns Record of metadata key-value pairs
 */
function extractMeta(record: ZetasizerRecord): Record<string, unknown> {
  const meta: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(record.meta)) {
    if (key === 'Sample Name') continue;
    meta[key] = value;
  }

  return meta;
}

/**
 * Build standardized cheminfo metadata from a Zetasizer record.
 *
 * Extracts zeta potential, deviation, mobility, conductivity, and count rates.
 * @param record - Parsed Zetasizer record
 * @returns ZetaPotentialCheminfo object, or undefined if no relevant data is found
 */
function extractCheminfo(
  record: ZetasizerRecord,
): ZetaPotentialCheminfo | undefined {
  const { meta } = record;
  const zpMeta: ZetaPotentialMeta = {};

  const zetaPotential = getNumber(meta, 'Zeta Potential (mV)');
  if (zetaPotential !== undefined) {
    zpMeta.zetaPotential = { value: zetaPotential, units: 'mV' };
  }

  const zetaDeviation = getNumber(meta, 'Zeta Deviation (mV)');
  if (zetaDeviation !== undefined) {
    zpMeta.zetaDeviation = { value: zetaDeviation, units: 'mV' };
  }

  const mobility = getMobility(meta);
  if (mobility !== undefined) {
    zpMeta.mobility = { value: mobility, units: 'µm·cm/Vs' };
  }

  const conductivity = getNumber(meta, 'Conductivity (mS/cm)');
  if (conductivity !== undefined) {
    zpMeta.conductivity = { value: conductivity, units: 'mS/cm' };
  }

  const derivedMeanCountRate = getNumber(meta, 'Derived Count Rate (kcps)');
  if (derivedMeanCountRate !== undefined) {
    zpMeta.derivedMeanCountRate = {
      value: derivedMeanCountRate,
      units: 'kcps',
    };
  }

  const meanCountRate = getNumber(meta, 'Mean Count Rate (kcps)');
  if (meanCountRate !== undefined) {
    zpMeta.meanCountRate = { value: meanCountRate, units: 'kcps' };
  }

  const qualityFactor = getNumber(meta, 'Quality Factor');
  if (qualityFactor !== undefined) {
    zpMeta.qualityFactor = qualityFactor;
  }

  if (Object.keys(zpMeta).length === 0) {
    return undefined;
  }

  return { meta: zpMeta };
}

/**
 * Get a numeric value from the record meta, or undefined if not present.
 * @param meta - Record metadata
 * @param key - Meta key to look up
 * @returns The numeric value, or undefined
 */
function getNumber(
  meta: Record<string, boolean | number | string>,
  key: string,
): number | undefined {
  const value = meta[key];
  return typeof value === 'number' ? value : undefined;
}

/**
 * Extract the electrophoretic mobility value from the record metadata.
 *
 * The key contains a µ character whose encoding depends on how the file
 * was read (latin1 vs utf-8), so we search by prefix.
 * @param meta - Record metadata
 * @returns The mobility value, or undefined
 */
function getMobility(
  meta: Record<string, boolean | number | string>,
): number | undefined {
  for (const [key, value] of Object.entries(meta)) {
    if (key.startsWith('Mobility') && typeof value === 'number') {
      return value;
    }
  }
  return undefined;
}

/**
 * Extract instrument settings from a parsed record.
 * @param record - Parsed Zetasizer record
 * @returns Settings object with instrument info
 */
function extractSettings(record: ZetasizerRecord): MeasurementXY['settings'] {
  const { meta } = record;

  const serialNumber = meta['Serial Number'];
  const softwareVersion = meta['S/W Version'];

  const settings: Record<string, unknown> = {
    instrument: {
      manufacturer: 'Malvern Panalytical',
      model: 'Zetasizer',
      ...(typeof serialNumber === 'string' ? { serialNumber } : {}),
      software: {
        name: 'Zetasizer Nano',
        ...(typeof softwareVersion === 'string' ||
        typeof softwareVersion === 'number'
          ? { version: String(softwareVersion) }
          : {}),
      },
    },
  };

  return settings as MeasurementXY['settings'];
}
