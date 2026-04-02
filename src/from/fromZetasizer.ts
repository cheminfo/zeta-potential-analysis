import type { MeasurementXY, MeasurementXYVariables } from 'cheminfo-types';
import { Analysis } from 'common-spectrum';
import type { ZetasizerRecord } from 'parse-zetasizer';
import { fromText, getArray } from 'parse-zetasizer';

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
 * standard variable symbols (x, y). Records missing Zeta Potentials or
 * Intensities are skipped.
 * @param text - The raw text content of a Zetasizer export file
 * @param options - Options for the analysis
 * @returns An Analysis containing one spectrum per measurement
 */
export function fromZetasizer(
  text: string,
  options: FromZetasizerOptions = {},
): Analysis {
  const analysis = new Analysis(options);
  const records = fromText(text);

  for (const record of records) {
    const variables = buildVariables(record);
    if (!variables) continue;

    analysis.pushSpectrum(variables, {
      title: extractTitle(record),
      dataType: 'Zeta potential measurement',
      meta: extractMeta(record),
    });

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
  const zetaPotentials = getArray(record, 'Zeta Potentials');
  const intensities = getArray(record, 'Intensities');

  if (!zetaPotentials?.data.length || !intensities?.data.length) {
    return undefined;
  }

  return {
    x: {
      symbol: 'x',
      label: 'Zeta potential',
      units: zetaPotentials.units || 'mV',
      data: zetaPotentials.data,
      isDependent: false,
    },
    y: {
      symbol: 'y',
      label: 'Intensity',
      units: intensities.units || '',
      data: intensities.data,
      isDependent: true,
    },
  };
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
