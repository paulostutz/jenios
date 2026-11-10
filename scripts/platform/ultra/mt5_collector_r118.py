"""R118 read-only collector. Recover old entries when their exit is in the window.

R117 is preserved for its signed download. No order or account mutation is added.
"""
import json
import sys
from mt5_worker import MT5Collector as PreviousCollector


class _HistoryExpansion:
    def __init__(self, terminal):
        self.terminal = terminal

    def __getattr__(self, name):
        return getattr(self.terminal, name)

    def history_orders_get(self, *args, **kwargs):
        orders = self.terminal.history_orders_get(*args, **kwargs)
        if kwargs or not args or orders is None:
            return orders
        # A manually submitted close can have another magic. Use its position
        # identity to retrieve the original entry, then let R117 verify ownership.
        deals = self.terminal.history_deals_get(*args)
        if deals is None:
            raise ValueError('MT5_HISTORY_UNAVAILABLE')
        if len(orders) > 20000 or len(deals) > 20000:
            raise ValueError('MT5_HISTORY_LIMIT')
        position_ids = {
            int(d.position_id) for d in deals
            if d.entry in (self.DEAL_ENTRY_OUT, self.DEAL_ENTRY_OUT_BY, self.DEAL_ENTRY_INOUT)
            and d.type in (self.DEAL_TYPE_BUY, self.DEAL_TYPE_SELL)
            and int(d.position_id) > 0
        }
        if len(position_ids) > 2000:
            raise ValueError('MT5_POSITION_HISTORY_LIMIT')
        expanded = {str(o.ticket): o for o in orders}
        for position_id in sorted(position_ids):
            history = self.terminal.history_orders_get(position=position_id)
            if history is None:
                raise ValueError('MT5_HISTORY_UNAVAILABLE')
            for order in history:
                expanded[str(order.ticket)] = order
            if len(expanded) > 20000:
                raise ValueError('MT5_HISTORY_LIMIT')
        return tuple(expanded.values())


class MT5Collector(PreviousCollector):
    def __init__(self, terminal, profile):
        super().__init__(_HistoryExpansion(terminal), profile)


def main():
    import MetaTrader5 as mt5
    profile = json.loads(sys.stdin.readline())
    bridge = MT5Collector(mt5, profile)
    try:
        for line in sys.stdin:
            request = None
            try:
                request = json.loads(line)
                if request.get('method') not in ('inspect', 'collect'):
                    raise ValueError('INVALID_METHOD')
                result = getattr(bridge, request['method'])(request.get('args', {}))
                response = {'id': request['id'], 'ok': True, 'result': result}
            except Exception as error:
                code = str(error) if isinstance(error, ValueError) and str(error).replace('_', '').isalnum() and str(error).isupper() else 'MT5_COLLECTION_FAILED'
                response = {'id': request.get('id') if isinstance(request, dict) else None, 'ok': False, 'error': code}
            print(json.dumps(response, separators=(',', ':')), flush=True)
    finally:
        bridge.stop()


if __name__ == '__main__':
    try:
        main()
    except Exception:
        print(json.dumps({'ok': False, 'error': 'MT5_STARTUP_FAILED'}), flush=True)
        sys.exit(1)
