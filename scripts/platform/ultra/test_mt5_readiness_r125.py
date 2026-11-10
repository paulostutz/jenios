"""R125 delta only. Every terminal method below is an in-memory fixture."""
import copy
import hashlib
import io
import json
import os
from pathlib import Path
import subprocess
import sys
import unittest
from types import SimpleNamespace as N
from unittest.mock import patch

from mt5_readiness_r125 import MT5Readiness, _safe_error, main


NOW = 1800000000000
NAME = 'WINZ99'  # Fictitious fixture name; never queried at a broker.
OTHER = 'WDOZ99'
ENV = {'JENIOS_MT5_ACCOUNT': '123', 'JENIOS_MT5_SERVER': 'Fixture',
       'JENIOS_MT5_TERMINAL_PATH': ''}
FINGERPRINT = hashlib.sha256(b'mt5:123:Fixture:demo').hexdigest()


def profile():
    return {'provider': 'mt5', 'market': 'b3', 'environment': 'demo', 'magic': 125,
            'accountFingerprint': FINGERPRINT, 'connectionLabel': 'Local fixture',
            'ledger': 'unused.sqlite', 'days': 30, 'positionCostsComplete': False}


class Terminal:
    ACCOUNT_TRADE_MODE_DEMO = 0
    ACCOUNT_TRADE_MODE_REAL = 2
    SYMBOL_TRADE_MODE_FULL = 4

    def __init__(self):
        self.calls = []
        self.account = N(login=123, server='Fixture', trade_mode=0, currency='BRL',
                         trade_allowed=True, trade_expert=True, margin_mode=0,
                         balance=87654321.12, equity=87654321.13, name='PRIVATE_NAME')
        self.terminal = N(connected=True, trade_allowed=True, tradeapi_disabled=False,
                          build=6000, path='PRIVATE_PATH', data_path='PRIVATE_DATA_PATH')
        self.info = N(name=NAME, custom=False, select=True, visible=True,
                      point=1, digits=0, trade_tick_size=5, trade_contract_size=.2,
                      volume_min=1, volume_max=100, volume_step=1, volume_limit=0,
                      trade_tick_value=1, trade_tick_value_profit=1, trade_tick_value_loss=1,
                      margin_initial=100, margin_maintenance=80, margin_hedged=0,
                      trade_mode=4, trade_calc_mode=33, trade_exemode=3,
                      filling_mode=3, order_mode=127, expiration_mode=15,
                      trade_stops_level=0, trade_freeze_level=0,
                      start_time=NOW // 1000 - 86400, expiration_time=NOW // 1000 + 86400,
                      margin_hedged_use_leg=False, currency_profit='BRL', currency_margin='BRL')
        self.tick = N(time_msc=NOW - 100, bid=1000, ask=1005, last=1000)
        self.positions, self.orders = (), ()
        self.after_orders = None

    def initialize(self, *args):
        self.calls.append(('initialize', args))
        return True

    def account_info(self):
        self.calls.append(('account_info',))
        return copy.copy(self.account)

    def terminal_info(self):
        self.calls.append(('terminal_info',))
        return copy.copy(self.terminal)

    def symbol_info(self, symbol):
        self.calls.append(('symbol_info', symbol))
        return copy.copy(self.info) if self.info is not None else None

    def symbol_info_tick(self, symbol):
        self.calls.append(('symbol_info_tick', symbol))
        return copy.copy(self.tick) if self.tick is not None else None

    def positions_get(self, **kwargs):
        self.calls.append(('positions_get', kwargs))
        return self.positions

    def orders_get(self, **kwargs):
        self.calls.append(('orders_get', kwargs))
        if self.after_orders:
            self.after_orders()
        return self.orders

    def shutdown(self):
        self.calls.append(('shutdown',))

    def __getattr__(self, name):
        raise AssertionError('Unexpected terminal capability: ' + name)


class ReadinessTests(unittest.TestCase):
    def setUp(self):
        self.environment = patch.dict(os.environ, ENV)
        self.environment.start()
        self.addCleanup(self.environment.stop)
        self.mt = Terminal()
        self.bridge = MT5Readiness(self.mt, profile(), now_ms=lambda: NOW)

    def inspect(self, **kwargs):
        return self.bridge.inspect({'symbols': [NAME], **kwargs})

    def test_complete_fixture_remains_incapable_of_execution(self):
        result = self.inspect()
        self.assertEqual(result['schema'], 'JENIOS_ULTRA_MT5_READINESS_R125')
        self.assertEqual(result['accountFingerprint'], FINGERPRINT)
        self.assertEqual(result['requestedProductScope'], ['mini_index', 'mini_dollar'])
        for key in ('canStart', 'executionAvailable', 'marketOpenVerified', 'ownershipVerified',
                    'marginSufficiencyVerified', 'protectionVerified', 'brokerIdentityVerified',
                    'productEligibilityVerified', 'cryptoRouteVerified'):
            self.assertIs(result[key], False, key)
        self.assertTrue(result['identityMatchedBeforeAndAfter'])
        row = result['symbols'][0]
        self.assertEqual(row['issues'], [])
        self.assertTrue(row['quote']['fresh'])
        self.assertEqual(row['quote']['ageMs'], 100)
        self.assertEqual(row['specification']['trade_tick_size'], '5')
        self.assertIn('NATIVE_EXECUTION_NOT_RELEASED', result['missing'])

    def test_output_contains_no_account_ids_names_balances_paths_or_order_ids(self):
        self.mt.positions = (N(symbol=NAME, ticket=9999999999999999, magic=125),)
        result = self.inspect()
        raw = json.dumps(result, allow_nan=False)
        for private in ('PRIVATE_NAME', 'PRIVATE_PATH', 'PRIVATE_DATA_PATH', '87654321',
                        '9999999999999999', 'Fixture', '"login"', '"server"', '"balance"', '"equity"'):
            self.assertNotIn(private, raw)

    def test_terminal_capability_allowlist_contains_only_inspection_methods(self):
        self.inspect()
        names = {call[0] for call in self.mt.calls}
        self.assertLessEqual(names, {'initialize', 'account_info', 'terminal_info', 'symbol_info',
                                     'symbol_info_tick', 'positions_get', 'orders_get'})
        self.assertEqual([c for c in self.mt.calls if c[0] == 'positions_get'], [('positions_get', {'symbol': NAME})])
        self.assertEqual([c for c in self.mt.calls if c[0] == 'orders_get'], [('orders_get', {'symbol': NAME})])

    def test_wrong_profile_fingerprint_rejects_before_initialize(self):
        mt, p = Terminal(), profile()
        p['accountFingerprint'] = '0' * 64
        with self.assertRaisesRegex(ValueError, 'MT5_ACCOUNT_BINDING_MISMATCH'):
            MT5Readiness(mt, p)
        self.assertEqual(mt.calls, [])

    def test_unknown_profile_keys_cannot_supply_login_password_or_server(self):
        for field in ('password', 'login', 'server', 'apiKey'):
            with self.subTest(field=field):
                mt, p = Terminal(), profile()
                p[field] = 'private'
                with self.assertRaisesRegex(ValueError, 'MT5_READINESS_PROFILE_INVALID'):
                    MT5Readiness(mt, p)
                self.assertEqual(mt.calls, [])

    def test_non_b3_profile_and_other_providers_are_rejected(self):
        for update in ({'market': 'forex'}, {'market': 'crypto'}, {'provider': 'profit'}):
            with self.assertRaisesRegex(ValueError, 'MT5_READINESS_PROFILE_INVALID'):
                MT5Readiness(Terminal(), {**profile(), **update})

    def test_positional_terminal_path_uses_existing_r118_lifecycle(self):
        mt = Terminal()
        with patch.dict(os.environ, {'JENIOS_MT5_TERMINAL_PATH': 'FIXTURE_TERMINAL.exe'}):
            bridge = MT5Readiness(mt, profile())
        self.assertEqual(mt.calls[0], ('initialize', ('FIXTURE_TERMINAL.exe',)))
        bridge.stop()
        self.assertEqual(mt.calls[-1], ('shutdown',))

    def test_constructor_closes_ipc_after_failed_initial_binding(self):
        mt = Terminal()
        mt.account.login = 999
        with self.assertRaisesRegex(ValueError, 'MT5_ACCOUNT_CHANGED'):
            MT5Readiness(mt, profile())
        self.assertEqual(mt.calls[-1], ('shutdown',))

    def test_only_explicit_unique_mini_contract_candidates_are_accepted(self):
        invalid = ({}, {'symbols': []}, {'symbols': [NAME, NAME]}, {'symbols': [None]},
                   {'symbols': [NAME], 'select': True}, {'symbols': [NAME] * 21})
        for args in invalid:
            with self.subTest(args=args), self.assertRaisesRegex(ValueError, 'MT5_EXPLICIT_SYMBOLS_REQUIRED'):
                self.bridge.inspect(args)
        for name in ('WIN$N', 'WDO$N', 'WIN1!', 'WIN*', '*', 'WIN', 'WDO', 'EURUSD', 'PETR4',
                     'BTCUSDT', 'WINZ99.alias', '../WINZ99', 'WINZ99\n'):
            with self.subTest(name=name), self.assertRaisesRegex(ValueError, 'MT5_ULTRA_MINI_CONTRACT_SYMBOL_REQUIRED'):
                self.bridge.inspect({'symbols': [name]})
        self.assertFalse(any(c[0] == 'symbol_info' for c in self.mt.calls))

    def test_minidollar_exact_symbol_is_not_rewritten(self):
        self.mt.info.name = OTHER
        result = self.inspect(symbols=[OTHER])
        self.assertEqual(result['symbols'][0]['symbol'], OTHER)
        self.assertIn(('symbol_info', OTHER), self.mt.calls)

    def test_account_server_environment_change_before_read_is_rejected(self):
        for field, value, code in (('login', 999, 'MT5_ACCOUNT_CHANGED'),
                                   ('server', 'Other', 'MT5_ACCOUNT_CHANGED'),
                                   ('trade_mode', 2, 'MT5_ENVIRONMENT_MISMATCH')):
            with self.subTest(field=field):
                old = getattr(self.mt.account, field)
                setattr(self.mt.account, field, value)
                with self.assertRaisesRegex(ValueError, code):
                    self.inspect()
                setattr(self.mt.account, field, old)

    def test_account_server_environment_change_during_read_discards_snapshot(self):
        for field, value, code in (('login', 999, 'MT5_ACCOUNT_CHANGED'),
                                   ('server', 'Other', 'MT5_ACCOUNT_CHANGED'),
                                   ('trade_mode', 2, 'MT5_ENVIRONMENT_MISMATCH')):
            with self.subTest(field=field):
                old = getattr(self.mt.account, field)
                self.mt.after_orders = lambda: setattr(self.mt.account, field, value)
                with self.assertRaisesRegex(ValueError, code):
                    self.inspect()
                setattr(self.mt.account, field, old)

    def test_disconnect_or_currency_change_discards_snapshot(self):
        self.mt.after_orders = lambda: setattr(self.mt.terminal, 'connected', False)
        with self.assertRaisesRegex(ValueError, 'MT5_DISCONNECTED'):
            self.inspect()
        self.mt.terminal.connected = True
        self.mt.after_orders = lambda: setattr(self.mt.account, 'currency', 'USD')
        with self.assertRaisesRegex(ValueError, 'MT5_B3_CURRENCY_MISMATCH'):
            self.inspect()

    def test_permission_change_discards_snapshot(self):
        self.mt.after_orders = lambda: setattr(self.mt.terminal, 'tradeapi_disabled', True)
        with self.assertRaisesRegex(ValueError, 'MT5_PERMISSIONS_CHANGED_DURING_SNAPSHOT'):
            self.inspect()

    def test_python_disabled_or_unknown_is_reported_without_changing_setting(self):
        self.mt.terminal.tradeapi_disabled = True
        result = self.inspect()
        self.assertTrue(result['permissions']['pythonTradingDisabled'])
        self.assertIn('PERMISSION_BLOCKS_TRADING:pythonTradingDisabled', result['missing'])
        self.assertTrue(self.mt.terminal.tradeapi_disabled)
        del self.mt.terminal.tradeapi_disabled
        result = self.inspect()
        self.assertIsNone(result['permissions']['pythonTradingDisabled'])
        self.assertIn('PERMISSION_NOT_OBSERVED:pythonTradingDisabled', result['missing'])

    def test_account_and_terminal_trade_flags_are_separate(self):
        self.mt.account.trade_allowed = False
        self.mt.account.trade_expert = False
        self.mt.terminal.trade_allowed = False
        result = self.inspect()
        for field in ('accountTradeAllowed', 'accountExpertAllowed', 'terminalTradeAllowed'):
            self.assertIn('PERMISSION_BLOCKS_TRADING:' + field, result['missing'])

    def test_quote_age_bounds(self):
        for age in (0, -1, 30001, True, '5000', float('nan')):
            with self.subTest(age=age), self.assertRaisesRegex(ValueError, 'MT5_QUOTE_AGE_INVALID'):
                self.inspect(maxQuoteAgeMs=age)

    def test_stale_future_crossed_missing_quotes_are_never_fresh(self):
        for tick, expected in ((N(time_msc=NOW-5001, bid=1000, ask=1005, last=0), 'QUOTE_STALE'),
                               (N(time_msc=NOW+1, bid=1000, ask=1005, last=0), 'QUOTE_FROM_FUTURE'),
                               (N(time_msc=NOW-1, bid=1006, ask=1005, last=0), 'QUOTE_CROSSED'),
                               (N(time_msc=NOW-1, bid=float('nan'), ask=1005, last=0), 'QUOTE_UNAVAILABLE_OR_INVALID'),
                               (N(time_msc=NOW-1, bid=0, ask=1005, last=0), 'QUOTE_UNAVAILABLE_OR_INVALID'),
                               (None, 'QUOTE_UNAVAILABLE_OR_INVALID')):
            with self.subTest(expected=expected):
                self.mt.tick = tick
                result = self.inspect()
                row = result['symbols'][0]
                self.assertIn(expected, row['issues'])
                self.assertTrue(row['quote'] is None or row['quote']['fresh'] is False)
                json.dumps(result, allow_nan=False)

    def test_quote_freshness_is_checked_at_end_of_entire_snapshot(self):
        times = iter((NOW, NOW + 6000))
        self.bridge.now_ms = lambda: next(times)
        row = self.inspect()['symbols'][0]
        self.assertEqual(row['quote']['ageMs'], 6100)
        self.assertIn('QUOTE_STALE', row['issues'])

    def test_backwards_local_clock_discards_snapshot(self):
        times = iter((NOW, NOW - 1))
        self.bridge.now_ms = lambda: next(times)
        with self.assertRaisesRegex(ValueError, 'MT5_LOCAL_CLOCK_INVALID'):
            self.inspect()

    def test_missing_or_mismatched_symbol_is_not_substituted(self):
        self.mt.info = None
        row = self.inspect()['symbols'][0]
        self.assertFalse(row['available'])
        self.assertIsNone(row['positions'])
        self.assertEqual(row['issues'], ['SYMBOL_NOT_FOUND'])
        self.mt.info = N(name=OTHER)
        with self.assertRaisesRegex(ValueError, 'MT5_SYMBOL_IDENTITY_MISMATCH'):
            self.inspect()

    def test_missing_expired_or_not_started_contract_remains_blocked(self):
        for value, expected in ((0, 'DATED_CONTRACT_EXPIRY_NOT_VERIFIED'),
                                (NOW // 1000, 'CONTRACT_EXPIRED'),
                                (None, 'DATED_CONTRACT_EXPIRY_NOT_VERIFIED')):
            with self.subTest(value=value):
                self.mt.info.expiration_time = value
                self.assertIn(expected, self.inspect()['symbols'][0]['issues'])
        self.mt.info.start_time = NOW // 1000 + 1
        self.assertIn('CONTRACT_NOT_STARTED', self.inspect()['symbols'][0]['issues'])

    def test_missing_invalid_or_zero_required_specs_are_not_defaulted(self):
        self.mt.info.volume_step = 0
        self.mt.info.margin_initial = float('inf')
        del self.mt.info.trade_tick_size
        row = self.inspect()['symbols'][0]
        for field in ('volume_step', 'margin_initial', 'trade_tick_size'):
            self.assertIsNone(row['specification'][field])
            self.assertIn('SYMBOL_SPEC_MISSING_OR_INVALID:' + field, row['issues'])
        self.assertEqual(row['specification']['trade_stops_level'], 0)
        self.assertEqual(row['specification']['margin_hedged'], '0')

    def test_custom_unselected_and_restricted_symbols_are_not_enabled(self):
        self.mt.info.custom = True
        self.mt.info.select = False
        self.mt.info.trade_mode = 3
        issues = self.inspect()['symbols'][0]['issues']
        self.assertIn('CUSTOM_SYMBOL_OR_STATUS_UNKNOWN', issues)
        self.assertIn('SYMBOL_NOT_SELECTED_NO_AUTOMATIC_SELECTION', issues)
        self.assertIn('SYMBOL_TRADING_RESTRICTED_OR_UNKNOWN', issues)
        self.assertFalse(self.mt.info.select)

    def test_existing_exposure_includes_other_magic_and_manual_orders(self):
        self.mt.positions = (N(symbol=NAME, magic=125), N(symbol=NAME, magic=999))
        self.mt.orders = (N(symbol=NAME, magic=0),)
        row = self.inspect()['symbols'][0]
        self.assertEqual(row['positions']['count'], 2)
        self.assertEqual(row['pendingOrders']['count'], 1)
        self.assertFalse(row['ownershipVerified'])
        self.assertIn('EXISTING_SYMBOL_EXPOSURE_REQUIRES_RECONCILIATION', row['issues'])

    def test_missing_exposure_or_wrong_symbol_discards_snapshot(self):
        self.mt.positions = None
        with self.assertRaisesRegex(ValueError, 'MT5_EXPOSURE_SNAPSHOT_UNAVAILABLE'):
            self.inspect()
        self.mt.positions = (N(symbol=OTHER),)
        with self.assertRaisesRegex(ValueError, 'MT5_EXPOSURE_SYMBOL_MISMATCH'):
            self.inspect()
        self.mt.positions = 'invalid'
        with self.assertRaisesRegex(ValueError, 'MT5_EXPOSURE_SNAPSHOT_INVALID'):
            self.inspect()
        self.mt.positions = [N(symbol=NAME)] * 20001
        with self.assertRaisesRegex(ValueError, 'MT5_EXPOSURE_SNAPSHOT_LIMIT'):
            self.inspect()

    def test_missing_margin_mode_and_build_are_reported(self):
        del self.mt.account.margin_mode
        del self.mt.terminal.build
        result = self.inspect()
        self.assertIn('ACCOUNT_MARGIN_MODE_NOT_OBSERVED', result['missing'])
        self.assertIn('TERMINAL_BUILD_NOT_OBSERVED', result['missing'])

    def test_raw_vendor_errors_are_not_exposed(self):
        for error in (ValueError('PRIVATE_ACCOUNT_123'), RuntimeError('private path / password')):
            self.assertEqual(_safe_error(error), 'MT5_READINESS_FAILED')

    def test_cli_uses_injected_sdk_and_inspect_only_protocol(self):
        mt = Terminal()
        lines = [profile(), {'id': 1, 'method': 'inspect', 'args': {'symbols': [NAME]}},
                 {'id': 2, 'method': 'collect', 'args': {}},
                 {'id': 3, 'method': 'inspect', 'args': {'symbols': [OTHER]}}]
        output = io.StringIO()
        with patch.object(sys, 'argv', ['mt5_readiness_r125.py', '--inspect-terminal']), \
                patch('mt5_readiness_r125.platform.system', return_value='Windows'), \
                patch.dict(sys.modules, {'MetaTrader5': mt}), \
                patch.object(sys, 'stdin', io.StringIO('\n'.join(json.dumps(x) for x in lines))), \
                patch.object(sys, 'stdout', output):
            main()
        replies = [json.loads(line) for line in output.getvalue().splitlines()]
        self.assertEqual(len(replies), 2)
        self.assertTrue(replies[0]['ok'])
        self.assertFalse(replies[0]['result']['canStart'])
        self.assertFalse(replies[1]['ok'])
        self.assertEqual(replies[1]['error'], 'MT5_READINESS_REQUEST_INVALID')
        self.assertEqual(mt.calls[-1], ('shutdown',))

    def test_cli_without_explicit_flag_never_loads_or_initializes_sdk(self):
        script = Path(__file__).with_name('mt5_readiness_r125.py')
        result = subprocess.run([sys.executable, '-B', str(script)], input='', capture_output=True,
                                text=True, check=False, env={**os.environ, 'PYTHONDONTWRITEBYTECODE': '1'})
        self.assertEqual(result.returncode, 1)
        self.assertEqual(json.loads(result.stdout)['error'], 'MT5_EXPLICIT_TERMINAL_INSPECTION_REQUIRED')
        self.assertEqual(result.stderr, '')


if __name__ == '__main__':
    unittest.main()
