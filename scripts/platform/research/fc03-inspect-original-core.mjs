import { inspectFC03OriginalCore } from '../../../lib/platform/research/fc03-original-core-inspection.mjs';
const result = await inspectFC03OriginalCore(process.env.JENIOS_B297_PRIVATE_CORE_DIR);
process.stdout.write(JSON.stringify(result, null, 2) + '\n');
// Missing or mismatched bytes must not count as a successful private runtime check.
if (!result.originalBytesMatch) process.exitCode = 2;
