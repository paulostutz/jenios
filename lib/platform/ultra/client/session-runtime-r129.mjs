import {DurableUltraRuntimeR128} from './session-runtime-r128.mjs';
import {UltraStartCycleBridgeR129} from './start-cycle-r129.mjs';

/** Adds only fixture Start/performance gates to the exact R128 runtime.
 * Order, selection, lease, reconciliation and reduction paths are inherited. */
export class DurableUltraRuntimeR129 extends DurableUltraRuntimeR128 {
  #cycle; #finishing = false;

  constructor({fixtureBinding, startFee, performanceAuthority, ...options}) {
    const cycle = new UltraStartCycleBridgeR129({fixtureBinding, startFee, performanceAuthority});
    super({...options, adapter: cycle.guardAdapter(options.adapter)});
    cycle.attachRuntime({ledger: this.ledger, session: () => super.session(), now: () => this.now(),
      sessionId: this.sessionId, ownerScope: options.ownerScope, connectionScope: options.connectionScope,
      platform: options.ledger.recordContext.sourcePlatform});
    this.#cycle = cycle;
  }

  startPreparation() { return this.#cycle.snapshot(); }
  reconcileStartPreparation() { return this.#cycle.reconcile(); }

  #observeTerminal() {
    const session = super.session();
    if (session?.phase === 'ended') this.#cycle.noteTerminal('ended');
    else if (['paused', 'expired', 'draining'].includes(session?.phase)) this.#cycle.noteTerminal('paused');
  }

  async start(options = {}) {
    const result = await super.start(options);
    if (result.created) this.#cycle.startNewCycle();
    else if (result.session.attached) this.#cycle.reconcile();
    if (result.session.attached) this.#observeTerminal();
    return {...result, startPreparation: this.startPreparation()};
  }

  async resume(options = {}) {
    const result = await super.resume(options);
    this.#cycle.reconcile(); this.#observeTerminal();
    return {...result, startPreparation: this.startPreparation()};
  }

  pause() {
    super.pause();
    // finish() uses this.pause() internally. Pauses during startup are observed
    // after R128 attaches the session, without inventing a second lifecycle.
    if (!this.#finishing && super.session()?.attached) this.#cycle.noteTerminal('paused');
  }

  async tick() {
    const result = await super.tick();
    if (result.state !== 'busy') this.#observeTerminal();
    const withheld = result.clientOrderId && this.ledger.order(result.clientOrderId)?.receipt?.reason === 'R129_OPENING_WITHHELD_BEFORE_DISPATCH';
    return {...result, ...(withheld ? {state: 'opening_withheld', brokerSubmissionAttempted: false} : {}), startPreparation: this.startPreparation()};
  }

  async finish() {
    this.#finishing = true;
    let result;
    try { result = await super.finish(); }
    finally { this.#finishing = false; }
    this.#observeTerminal();
    return {...result, startPreparation: this.startPreparation()};
  }
}
