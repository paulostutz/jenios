import {OfflineFixtureBroker} from './fixture-broker.mjs';

/** Test fixture only: generated inventory is not an observation of a broker. */
export class OfflineFixtureBrokerR127 extends OfflineFixtureBroker {
  constructor({scope, ...options}) {
    super(options);
    this.scope = Object.freeze({...scope});
    this.generation = 'fixture_connection_1';
    this.stateVersion = 1;
    this.tradingAllowed = true;
    this.instrumentEnabled = true;
    this.streamSynchronized = true;
    this.ordersComplete = true;
    this.positionsComplete = true;
    this.fillsComplete = true;
    this.unresolvedReferences = [];
  }
  async runtimeState() {
    this.check();
    return {
      ...this.scope, accountBinding: this.binding, generation: this.generation,
      revision: 'fixture_state_' + this.stateVersion, observedAtMs: this.now(), connected: this.connected,
      tradingAllowed: this.tradingAllowed, streamSynchronized: this.streamSynchronized,
      ordersComplete: this.ordersComplete, positionsComplete: this.positionsComplete, fillsComplete: this.fillsComplete,
      unresolvedReferences: [...this.unresolvedReferences]
    };
  }
  async inspect() { return {...await super.inspect(), tradingAllowed: this.tradingAllowed}; }
  async account() {
    return {...await super.account(), ...this.scope, accountCurrency: this.currency,
      connectionGeneration: this.generation, stateRevision: 'fixture_state_' + this.stateVersion};
  }
  async observations() {
    const rows = await super.observations();
    return rows.map(row => ({...row, ...(row.market === 'b3' ? {lotStep: 1, minLot: 1} : {}), instrument: {
      symbol: row.symbol, evidence: 'broker_metadata', observedAtMs: this.now(),
      provider: this.scope.provider, environment: this.scope.environment,
      accountFingerprint: this.scope.accountFingerprint, tradingEnabled: this.instrumentEnabled,
      ...(row.market === 'b3' ? {
        venue: 'B3', kind: 'future', family: row.symbol.startsWith('WIN') ? 'mini_index' : 'mini_usd',
        expiryMs: Date.parse('2099-12-31T00:00:00Z')
      } : {
        venue: 'binance', kind: this.scope.product === 'spot' ? 'spot' : 'future',
        eligibility: {product: this.scope.product, status: 'eligible', accountFingerprint: this.scope.accountFingerprint, observedAtMs: this.now()}
      })
    }}));
  }
  async submitProtected(request) { try { return await super.submitProtected(request); } finally { this.stateVersion++; } }
  async cancelRemainder(command, operation) { try { return await super.cancelRemainder(command, operation); } finally { this.stateVersion++; } }
  async closeOwned(command, operation) { try { return await super.closeOwned(command, operation); } finally { this.stateVersion++; } }
}
