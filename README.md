# zeta-potential-analysis

[![NPM version](https://img.shields.io/npm/v/zeta-potential-analysis.svg)](https://www.npmjs.com/package/zeta-potential-analysis)
[![npm download](https://img.shields.io/npm/dm/zeta-potential-analysis.svg)](https://www.npmjs.com/package/zeta-potential-analysis)
[![test coverage](https://img.shields.io/codecov/c/github/cheminfo/zeta-potential-analysis.svg)](https://codecov.io/gh/cheminfo/zeta-potential-analysis)
[![license](https://img.shields.io/npm/l/zeta-potential-analysis.svg)](https://github.com/cheminfo/zeta-potential-analysis/blob/main/LICENSE)

Analysis of zeta potential measurements from Malvern Panalytical Zetasizer instruments.

Zeta potential is the electric potential at the slipping plane of a colloidal particle in suspension. It is a key indicator of colloidal stability: particles with high absolute zeta potential values (typically > |30| mV) tend to repel each other, preventing aggregation, while values close to zero indicate a tendency to flocculate.

Malvern Zetasizer instruments measure zeta potential using electrophoretic light scattering (ELS). An electric field is applied across the sample, causing charged particles to migrate. The velocity of migration (electrophoretic mobility) is measured via laser Doppler velocimetry and converted to zeta potential using the Henry equation.

## Installation

```console
npm install zeta-potential-analysis
```

## Usage

```js
import { readFileSync } from 'node:fs';

import { fromZetasizer } from 'zeta-potential-analysis';

const text = readFileSync('measurement.txt', 'latin1');
const analysis = fromZetasizer(text);
```

Each measurement contains the following variables:

| Key | Label          | Units | Description                                          | Always present |
| --- | -------------- | ----- | ---------------------------------------------------- | -------------- |
| x   | Zeta potential | mV    | Zeta potential distribution values                   | Yes            |
| y   | Intensity      |       | Intensity distribution corresponding to each x value | Yes            |
| t   | Time           | s     | Correlation time for phase analysis                  | No             |
| p   | Phase          | rad   | Phase values from phase analysis light scattering    | No             |

The `x` and `y` variables are always present and represent the zeta potential distribution. The `t` (time) and `p` (phase) variables are only available when the Zetasizer export includes phase analysis data (e.g., PALS — Phase Analysis Light Scattering).

### Selector for visualization

```html
<select name="selector.variables">
  <option value="y vs x">Intensity versus zeta potential</option>
  <option value="p vs t">Phase versus time</option>
  <option value="y vs t">Intensity versus time</option>
  <option value="p vs x">Phase versus zeta potential</option>
</select>
```

## License

[MIT](./LICENSE)
