# zeta-potential-analysis

[![NPM version](https://img.shields.io/npm/v/zeta-potential-analysis.svg)](https://www.npmjs.com/package/zeta-potential-analysis)
[![npm download](https://img.shields.io/npm/dm/zeta-potential-analysis.svg)](https://www.npmjs.com/package/zeta-potential-analysis)
[![test coverage](https://img.shields.io/codecov/c/github/cheminfo/zeta-potential-analysis.svg)](https://codecov.io/gh/cheminfo/zeta-potential-analysis)
[![license](https://img.shields.io/npm/l/zeta-potential-analysis.svg)](https://github.com/cheminfo/zeta-potential-analysis/blob/main/LICENSE)

Analysis of zeta potential measurements from Malvern Panalytical Zetasizer instruments.

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

| Key | Label          | Units | Description                 |
| --- | -------------- | ----- | --------------------------- |
| x   | Zeta potential | mV    | Zeta potential distribution |
| y   | Intensity      |       | Intensity distribution      |

## License

[MIT](./LICENSE)
