// Node 26 removed `buffer.SlowBuffer`, which the legacy
// `buffer-equal-constant-time` module (a transitive dep of `jsonwebtoken`,
// used by `firebase-admin`/`googleapis`/`firebase-tools`) references at
// module-load time. Pointing SlowBuffer at Buffer makes that module load
// cleanly (Buffer.prototype.equals exists). Loaded via --require before
// any other module.
const buffer = require('buffer');
if (!buffer.SlowBuffer) {
  buffer.SlowBuffer = Buffer;
}
