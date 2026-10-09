const fs = require('fs');
const current = fs.readFileSync('lib/checkUser.js', 'utf8');
const beforeThisTurn = current
  .replace('import { cache } from "react";\n', '')
  .replace('async function checkUserImpl()', 'export default async function checkUser')
  .replace('}\n\nconst checkUser = cache(checkUserImpl);\n\nexport default checkUser;\n', '}\n');
fs.writeFileSync('before_this_turn.js', beforeThisTurn);
console.log('Written before_this_turn.js');
