/** R70 selects the shared host's closed signed-target-preflight profile.
 * Original capture, observation HTTPS sender, lease, outbox and drain are reused.
 * Matching configured pins never certifies a deployment, host or real identity.
 */
export { inspectR70PrivateHostProfile as inspectR70PrivateHost,
  runR70PrivateHostProfile as runR70PrivateHost,
  R68_HOST_LIMITS as R70_HOST_LIMITS } from './robot-r68-private-host.mjs';
