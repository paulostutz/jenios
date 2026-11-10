import os
import time
import unittest
from types import SimpleNamespace as N
from test_mt5_collector import Terminal
from mt5_collector_r118 import MT5Collector


class WindowTerminal(Terminal):
    def __init__(self):
        super().__init__()
        now = int(time.time() * 1000)
        self.orders[0].time_setup_msc = now - 40 * 86400000
        self.deals[0].time_msc = self.orders[0].time_setup_msc + 1
        self.deals[1].time_msc = now - 1000
        self.deals[1].magic = 0
        self.closing = N(ticket=self.deals[1].order, magic=0, type=1, time_setup_msc=now-1000, symbol='EURUSD', volume_initial=1, state=4)
        self.lookups = []

    def history_orders_get(self, *args, **kwargs):
        self.lookups.append(kwargs)
        return tuple(self.orders) + (self.closing,) if kwargs.get('position') else (self.closing,)

    def history_deals_get(self, *args, **kwargs):
        if args:
            start, end = (int(d.timestamp() * 1000) for d in args)
            return tuple(d for d in self.deals if start <= d.time_msc <= end)
        return super().history_deals_get(**kwargs)


class Tests(unittest.TestCase):
    def setUp(self):
        os.environ['JENIOS_MT5_ACCOUNT'] = '123'
        os.environ['JENIOS_MT5_SERVER'] = 'Fixture'
        self.terminal = WindowTerminal()
        self.profile = {'environment': 'demo', 'market': 'forex', 'magic': 117, 'positionCostsComplete': True}

    def collect(self):
        return MT5Collector(self.terminal, self.profile).collect({'days': 30})['operations']

    def test_old_entry_closed_today_is_recovered(self):
        rows = self.collect()
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]['state'], 'closed')
        self.assertEqual(rows[0]['id'], 'mt5_order_9007199254740995')
        self.assertEqual(rows[0]['fees'], '2.20000000')
        self.assertIn({'position': self.terminal.position}, self.terminal.lookups)

    def test_manual_close_does_not_need_robot_magic(self):
        self.assertEqual(self.terminal.closing.magic, 0)
        self.assertEqual(self.collect()[0]['exitQuantity'], '1.000000000000')

    def test_unrelated_position_history_is_not_assigned_to_robot(self):
        self.terminal.orders[0].magic = 999
        self.assertEqual(self.collect(), [])

    def test_incomplete_costs_remain_incomplete(self):
        self.profile['positionCostsComplete'] = False
        self.assertFalse(self.collect()[0]['costsComplete'])

    def test_mixed_position_remains_unknown(self):
        extra = N(**vars(self.terminal.deals[0]))
        extra.order = 987
        self.terminal.deals.append(extra)
        self.assertEqual(self.collect()[0]['state'], 'unknown')

    def test_missing_expansion_fails_without_partial_report(self):
        self.terminal.history_orders_get = lambda *args, **kwargs: None if kwargs else (self.terminal.closing,)
        with self.assertRaisesRegex(ValueError, 'MT5_HISTORY_UNAVAILABLE'):
            self.collect()

    def test_account_switch_and_position_race_still_fail(self):
        self.terminal.login = 999
        with self.assertRaisesRegex(ValueError, 'MT5_ACCOUNT_CHANGED'):
            self.collect()
        self.terminal.login = 123
        self.terminal.positions = [N(identifier=self.terminal.position, magic=117, volume=.2, profit=4, swap=0)]
        with self.assertRaisesRegex(ValueError, 'MT5_POSITION_RECONCILIATION_PENDING'):
            self.collect()

    def test_duplicate_exits_do_not_duplicate_operation(self):
        self.terminal.deals[1].volume = .5
        extra = N(**vars(self.terminal.deals[1]))
        extra.ticket += 1
        self.terminal.deals.append(extra)
        self.assertEqual(len(self.collect()), 1)

    def test_missing_recent_deal_history_is_not_an_empty_success(self):
        old = self.terminal.history_deals_get
        self.terminal.history_deals_get = lambda *args, **kwargs: None if args else old(**kwargs)
        with self.assertRaisesRegex(ValueError, 'MT5_HISTORY_UNAVAILABLE'):
            self.collect()

    def test_close_by_is_recovered(self):
        self.terminal.deals[1].entry = self.terminal.DEAL_ENTRY_OUT_BY
        self.assertEqual(self.collect()[0]['state'], 'closed')

    def test_reversal_remains_unknown_instead_of_fake_close(self):
        self.terminal.deals[1].entry = self.terminal.DEAL_ENTRY_INOUT
        self.assertEqual(self.collect()[0]['state'], 'unknown')

    def test_expansion_has_a_hard_work_limit(self):
        self.terminal.history_deals_get = lambda *args, **kwargs: [self.terminal.deals[1]] * 20001
        with self.assertRaisesRegex(ValueError, 'MT5_HISTORY_LIMIT'):
            self.collect()


if __name__ == '__main__':
    unittest.main()
