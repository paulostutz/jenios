/** R69 selects the closed HTTPS profile of the existing R68 host lifecycle.
 * Source, lease, command schema, outbox, signatures and drain are unchanged.
 * Offline inspection never certifies TLS, a deployed target or hosted Auth.
 */
export { inspectR69PrivateHostProfile as inspectR69PrivateHost,
  runR69PrivateHostProfile as runR69PrivateHost,
  R68_HOST_LIMITS as R69_HOST_LIMITS } from './robot-r68-private-host.mjs';
