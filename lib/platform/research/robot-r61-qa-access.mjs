/** Explicit, fail-closed access to the synthetic robot acceptance console. */
export function isRobotR61QaEnabled(env = {}) {
  return env.VERCEL_ENV === 'preview' &&
    env.JENIOS_QA_CANDIDATE_ENABLED === 'true' &&
    env.JENIOS_ROBOT_QA_ENABLED === 'true' &&
    env.JENIOS_REAL_EXECUTION_ENABLED === 'false' &&
    env.JENIOS_PRIVATE_PAPER_TRANSPORT_ENABLED === 'false' &&
    env.JENIOS_PRIVATE_PAPER_EXECUTOR === 'false';
}
