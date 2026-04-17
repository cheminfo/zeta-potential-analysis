import type {
  MeasurementVariable,
  MeasurementXY,
  MeasurementXYVariables,
  ZetaPotentialMeta,
} from 'cheminfo-types';
import { Analysis } from 'common-spectrum';
import type { ZmesParameter } from 'zmes-parser';
import { findParameter, findParameterDeep, parse } from 'zmes-parser';

import type { ZetaPotentialCheminfo } from '../types.ts';

interface VariableDescriptor {
  /** Parameter name to find in the tree. */
  parameterName: string;
  /** Variable key in MeasurementXYVariables (single letter). */
  symbol: keyof MeasurementXYVariables<Float64Array>;
  /** Label for the variable. */
  label: string;
  /** Units for the variable. */
  units: string;
  /** Whether this variable is dependent (true for y-like data). */
  isDependent: boolean;
}

const VARIABLE_DESCRIPTORS: VariableDescriptor[] = [
  {
    parameterName: 'Zeta Potentials',
    symbol: 'x',
    label: 'Zeta potential',
    units: 'mV',
    isDependent: false,
  },
  {
    parameterName: 'Zeta Potential Distribution Intensities (kcps)',
    symbol: 'y',
    label: 'Intensity',
    units: 'kcps',
    isDependent: true,
  },
  {
    parameterName: 'Mobility Distribution Values (µmcm/VS)',
    symbol: 'm',
    label: 'Mobility',
    units: 'µm·cm/Vs',
    isDependent: false,
  },
];

interface FromZmesOptions {
  /** Unique identifier for the analysis. */
  id?: string;
  /** Human-readable label for the analysis. */
  label?: string;
}

/**
 * Parse a raw .zmes file and create an Analysis for zeta potential measurements.
 *
 * Each zeta measurement record is pushed as a spectrum with:
 * - x: Zeta Potentials (mV)
 * - y: Zeta Potential Distribution Intensities (kcps)
 * - m: Mobility Distribution Values (µm·cm/Vs), when present
 *
 * Records whose `Measurement Type` is not a zeta measurement are skipped,
 * as are records missing the required x or y arrays.
 * @param data - The raw ArrayBuffer contents of a .zmes file
 * @param options - Options for the analysis
 * @returns An Analysis containing one spectrum per zeta record
 */
export async function fromZmes(
  data: ArrayBuffer,
  options: FromZmesOptions = {},
): Promise<Analysis> {
  const analysis = new Analysis(options);
  const zmesFile = await parse(data);

  for (const record of zmesFile.records) {
    const { parameters } = record;

    if (!isZetaMeasurement(parameters)) {
      continue;
    }

    const variables = buildVariables(parameters);
    if (!variables) {
      continue;
    }

    const meta = extractMeta(parameters);
    const cheminfo = extractCheminfo(parameters);
    if (cheminfo) {
      meta.cheminfo = cheminfo;
    }

    analysis.pushSpectrum(variables, {
      id: record.guid,
      title: extractTitle(parameters),
      dataType: 'Zeta potential measurement',
      meta,
    });

    const spectrum = analysis.spectra.at(-1);
    if (spectrum) {
      spectrum.settings = extractSettings(parameters);
    }
  }

  return analysis;
}

/**
 * Check whether a record corresponds to a zeta potential measurement.
 * @param parameters - Root parameter node
 * @returns True if the record's `Measurement Type` identifies a zeta measurement
 */
function isZetaMeasurement(parameters: ZmesParameter): boolean {
  const measurementType = findParameter(
    parameters.children ?? [],
    'Measurement Type',
  );
  return (
    typeof measurementType?.value === 'string' &&
    measurementType.value.includes('ZetaMeasurementResult')
  );
}

/**
 * Build the MeasurementXYVariables object from the parameter tree.
 *
 * Returns undefined if the required x (Zeta Potentials) or y (Intensities)
 * variable is missing.
 * @param parameters - Root parameter node
 * @returns Variables object with x, y, and optional mobility variable
 */
function buildVariables(
  parameters: ZmesParameter,
): MeasurementXYVariables<Float64Array> | undefined {
  const found = new Map<string, MeasurementVariable<Float64Array>>();

  for (const descriptor of VARIABLE_DESCRIPTORS) {
    const parameter = findParameterDeep(parameters, descriptor.parameterName);

    if (
      !(parameter?.value instanceof Float64Array) ||
      parameter.value.length === 0
    ) {
      continue;
    }

    found.set(descriptor.symbol, {
      symbol: descriptor.symbol,
      label: descriptor.label,
      units: descriptor.units,
      data: parameter.value,
      isDependent: descriptor.isDependent,
    });
  }

  const x = found.get('x');
  const y = found.get('y');

  if (!x || !y) {
    return undefined;
  }

  const variables: MeasurementXYVariables<Float64Array> = { x, y };

  for (const [key, variable] of found) {
    if (key !== 'x' && key !== 'y') {
      const letter = key as keyof MeasurementXYVariables<Float64Array>;
      variables[letter] = variable;
    }
  }

  return variables;
}

/**
 * Extract the sample name from the parameter tree to use as title.
 * @param parameters - Root parameter node
 * @returns The sample name, or an empty string if not found
 */
function extractTitle(parameters: ZmesParameter): string {
  const sampleSettings = findParameter(
    parameters.children ?? [],
    'Sample Settings',
  );
  if (!sampleSettings) return '';
  const sampleName = findParameterDeep(sampleSettings, 'Sample Name');
  return typeof sampleName?.value === 'string' ? sampleName.value : '';
}

/**
 * Extract scalar metadata values from the parameter tree.
 * @param parameters - Root parameter node
 * @returns Record of metadata key-value pairs
 */
function extractMeta(parameters: ZmesParameter): Record<string, unknown> {
  const children = parameters.children ?? [];
  const meta: Record<string, unknown> = {};

  const topLevelFields = [
    { parameterName: 'Operator Name', metaKey: 'operatorName' },
    {
      parameterName: 'Measurement Start Date And Time',
      metaKey: 'measurementStartDateTime',
    },
    {
      parameterName: 'Measurement Completed Date And Time',
      metaKey: 'measurementCompletedDateTime',
    },
    { parameterName: 'Repeat', metaKey: 'repeat' },
    { parameterName: 'Number Of Repeats', metaKey: 'numberOfRepeats' },
    {
      parameterName: 'Pause Between Repeats (s)',
      metaKey: 'pauseBetweenRepeats',
    },
    { parameterName: 'Quality Indicator', metaKey: 'qualityIndicator' },
    { parameterName: 'Result State', metaKey: 'resultState' },
    { parameterName: 'Measurement Type', metaKey: 'measurementType' },
  ];

  for (const field of topLevelFields) {
    const parameter = findParameter(children, field.parameterName);
    if (parameter?.value !== undefined) {
      meta[field.metaKey] = parameter.value;
    }
  }

  // Zeta-specific scalar results (searched deep within Zeta Analysis Result).
  const zetaAnalysisResult = findParameter(children, 'Zeta Analysis Result');
  if (zetaAnalysisResult) {
    const deepFields = [
      { parameterName: 'Zeta Potential (mV)', metaKey: 'zetaPotential' },
      { parameterName: 'Zeta Deviation (mV)', metaKey: 'zetaDeviation' },
      { parameterName: 'Mobility (µmcm/VS)', metaKey: 'mobility' },
      { parameterName: 'Mobility Deviation', metaKey: 'mobilityDeviation' },
      { parameterName: 'Conductivity (mS/cm)', metaKey: 'conductivity' },
      {
        parameterName: 'Wall Zeta Potential (mV)',
        metaKey: 'wallZetaPotential',
      },
      {
        parameterName: 'FFR Relative Mobility Error',
        metaKey: 'ffrRelativeMobilityError',
      },
    ];
    for (const field of deepFields) {
      const parameter = findParameterDeep(
        zetaAnalysisResult,
        field.parameterName,
      );
      if (parameter?.value !== undefined) {
        meta[field.metaKey] = parameter.value;
      }
    }
  }

  const numberOfZetaRuns = findParameterDeep(parameters, 'Number Of Zeta Runs');
  if (numberOfZetaRuns?.value !== undefined) {
    meta.numberOfZetaRuns = numberOfZetaRuns.value;
  }

  return meta;
}

/**
 * Extract instrument settings from the parameter tree.
 * @param parameters - Root parameter node
 * @returns Settings object with instrument info and measurement parameters
 */
function extractSettings(parameters: ZmesParameter): MeasurementXY['settings'] {
  const children = parameters.children ?? [];
  const softwareVersion = findParameter(children, 'Software Version');

  const instrumentSerialNumber = findParameterDeep(
    parameters,
    'Instrument Serial Number',
  );

  const settings: Record<string, unknown> = {
    instrument: {
      manufacturer: 'Malvern Panalytical',
      model: 'Zetasizer',
      ...(typeof instrumentSerialNumber?.value === 'string'
        ? { serialNumber: instrumentSerialNumber.value }
        : {}),
      software: {
        name: 'ZS XPLORER',
        ...(typeof softwareVersion?.value === 'string'
          ? { version: softwareVersion.value }
          : {}),
      },
    },
  };

  const instrumentSettingsFields = [
    { parameterName: 'Temperature (°C)', settingsKey: 'temperature' },
    { parameterName: 'Attenuator', settingsKey: 'attenuator' },
    { parameterName: 'Attenuation Factor', settingsKey: 'attenuationFactor' },
    {
      parameterName: 'Cuvette Position (mm)',
      settingsKey: 'cuvettePosition',
    },
    {
      parameterName: 'Laser Wavelength (nm)',
      settingsKey: 'laserWavelength',
    },
  ];

  for (const field of instrumentSettingsFields) {
    const parameter = findParameterDeep(parameters, field.parameterName);
    if (typeof parameter?.value === 'number') {
      settings[field.settingsKey] = parameter.value;
    }
  }

  const zetaRunFields = [
    { parameterName: 'Number Of Zeta Runs', settingsKey: 'numberOfZetaRuns' },
    {
      parameterName: 'Minimum Number Of Zeta Runs',
      settingsKey: 'minimumNumberOfZetaRuns',
    },
    {
      parameterName: 'Maximum Number Of Zeta Runs',
      settingsKey: 'maximumNumberOfZetaRuns',
    },
  ];

  for (const field of zetaRunFields) {
    const parameter = findParameterDeep(parameters, field.parameterName);
    if (typeof parameter?.value === 'number') {
      settings[field.settingsKey] = parameter.value;
    }
  }

  return settings as MeasurementXY['settings'];
}

/**
 * Build the standardized cheminfo metadata for a zeta potential measurement.
 *
 * Extracts zeta potential, deviation, mobility, and conductivity from the
 * `Zeta Analysis Result` container into the `ZetaPotentialMeta` structure.
 * @param parameters - Root parameter node
 * @returns ZetaPotentialCheminfo object, or undefined if no relevant data is found
 */
function extractCheminfo(
  parameters: ZmesParameter,
): ZetaPotentialCheminfo | undefined {
  const zetaAnalysisResult = findParameter(
    parameters.children ?? [],
    'Zeta Analysis Result',
  );
  if (!zetaAnalysisResult) return undefined;

  const zpMeta: ZetaPotentialMeta = {};

  const zetaPotential = findParameterDeep(
    zetaAnalysisResult,
    'Zeta Potential (mV)',
  );
  if (typeof zetaPotential?.value === 'number') {
    zpMeta.zetaPotential = { value: zetaPotential.value, units: 'mV' };
  }

  const zetaDeviation = findParameterDeep(
    zetaAnalysisResult,
    'Zeta Deviation (mV)',
  );
  if (typeof zetaDeviation?.value === 'number') {
    zpMeta.zetaDeviation = { value: zetaDeviation.value, units: 'mV' };
  }

  const mobility = findParameterDeep(zetaAnalysisResult, 'Mobility (µmcm/VS)');
  if (typeof mobility?.value === 'number') {
    zpMeta.mobility = { value: mobility.value, units: 'µm·cm/Vs' };
  }

  const conductivity = findParameterDeep(
    zetaAnalysisResult,
    'Conductivity (mS/cm)',
  );
  if (typeof conductivity?.value === 'number') {
    zpMeta.conductivity = { value: conductivity.value, units: 'mS/cm' };
  }

  if (Object.keys(zpMeta).length === 0) {
    return undefined;
  }

  return { meta: zpMeta };
}
