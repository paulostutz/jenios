// Credentials describe a connection; only explicit server flags permit new charges.
// Read-only reconciliation deliberately does not use this creation policy.
export function paymentCreationEnabled(env = process.env, provider = env.JENIOS_PAY_PROVIDER) {
  return env.JENIOS_PAY_PAYMENTS_ENABLED === 'true' &&
    (provider !== 'inter_pix' || env.JENIOS_INTER_CHARGES_ENABLED === 'true');
}

export function assertPaymentCreationEnabled(env = process.env, provider = env.JENIOS_PAY_PROVIDER) {
  if (!paymentCreationEnabled(env, provider)) throw Object.assign(
    new Error('Novas cobranças estão desativadas neste ambiente.'),
    { status:503, code:'PAYMENT_CREATION_DISABLED' }
  );
}
