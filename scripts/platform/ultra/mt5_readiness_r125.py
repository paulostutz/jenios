"""Opt-in, local MT5/B3 expiry-contract inspection. No execution transport.

Importing this module does not import MetaTrader5 or initialize a terminal.
MT5Readiness reuses R118's account binding and initialization. The official
initialize call may launch MT5 and reuse its saved account; it is not attach-only.
"""
import hashlib
import json
import os
import platform
import re
import sys
import time
from decimal import Decimal, InvalidOperation

from mt5_collector_r118 import MT5Collector


PROFILE_KEYS = frozenset((
    'provider', 'environment', 'market', 'accountFingerprint', 'connectionLabel',
    'ledger', 'magic', 'days', 'positionCostsComplete',
))
# Exact names are supplied by the operator, never generated or rolled here.
# A name matching this narrow grammar is only a candidate, not eligibility proof.
SYMBOL = re.compile(r'(?:WIN|WDO)[FGHJKMNQUVXZ][0-9]{2}\Z')
SHA = re.compile(r'[a-f0-9]{64}\Z')
MAX_LINE = 32768
MAX_ROWS = 20000
ERROR_CODES = frozenset((
    'MT5_READINESS_PROFILE_INVALID', 'MT5_LOCAL_BINDING_REQUIRED',
    'MT5_ACCOUNT_BINDING_MISMATCH', 'INVALID_PROFILE', 'INVALID_MAGIC',
    'MT5_TERMINAL_UNAVAILABLE', 'MT5_DISCONNECTED', 'MT5_ACCOUNT_CHANGED',
    'MT5_ENVIRONMENT_MISMATCH', 'MT5_CURRENCY_UNSUPPORTED', 'MT5_B3_CURRENCY_MISMATCH',
    'MT5_SYMBOL_IDENTITY_MISMATCH', 'MT5_EXPOSURE_SNAPSHOT_UNAVAILABLE',
    'MT5_EXPOSURE_SNAPSHOT_INVALID', 'MT5_EXPOSURE_SNAPSHOT_LIMIT',
    'MT5_EXPOSURE_SYMBOL_MISMATCH', 'MT5_EXPLICIT_SYMBOLS_REQUIRED',
    'MT5_ULTRA_MINI_CONTRACT_SYMBOL_REQUIRED', 'MT5_QUOTE_AGE_INVALID',
    'MT5_LOCAL_CLOCK_INVALID', 'MT5_PERMISSIONS_CHANGED_DURING_SNAPSHOT',
    'MT5_READINESS_INPUT_TOO_LARGE', 'MT5_READINESS_JSON_INVALID',
    'MT5_EXPLICIT_TERMINAL_INSPECTION_REQUIRED', 'MT5_WINDOWS_TERMINAL_REQUIRED',
    'MT5_READINESS_REQUEST_INVALID',
))


def _integer(value, minimum=0, maximum=9007199254740991):
    return value if type(value) is int and minimum <= value <= maximum else None


def _flag(value):
    if type(value) is bool:
        return value
    if type(value) is int and value in (0, 1):
        return bool(value)
    return None


def _decimal(value, positive=False):
    if type(value) not in (int, float, Decimal):
        return None
    try:
        number = Decimal(str(value))
        if not number.is_finite() or number < 0 or (positive and number <= 0):
            return None
        result = format(number, 'f')
        return result if len(result) <= 100 else None
    except (InvalidOperation, ValueError):
        return None


def _currency(value):
    return value if isinstance(value, str) and re.fullmatch(r'[A-Z0-9]{2,12}', value) else None


def _safe_error(error, fallback='MT5_READINESS_FAILED'):
    code = str(error)
    return code if isinstance(error, ValueError) and code in ERROR_CODES else fallback


class _TerminalPathAdapter:
    """Keep R118 unchanged while using MetaQuotes' documented positional path."""
    def __init__(self, terminal):
        self.terminal = terminal

    def __getattr__(self, name):
        return getattr(self.terminal, name)

    def initialize(self, *, path=None):
        return self.terminal.initialize(path) if path else self.terminal.initialize()


def _profile(profile):
    if (not isinstance(profile, dict) or set(profile) - PROFILE_KEYS
            or profile.get('provider') != 'mt5' or profile.get('market') != 'b3'
            or profile.get('environment') not in ('demo', 'live')
            or not isinstance(profile.get('accountFingerprint'), str)
            or not SHA.fullmatch(profile['accountFingerprint'])
            or _integer(profile.get('magic'), 1, 2147483647) is None):
        raise ValueError('MT5_READINESS_PROFILE_INVALID')
    return dict(profile)


class MT5Readiness(MT5Collector):
    """Terminal is injected for tests; only the explicit CLI loads the SDK."""

    def __init__(self, terminal, profile, *, now_ms=None):
        profile = _profile(profile)
        account, server = os.environ.get('JENIOS_MT5_ACCOUNT'), os.environ.get('JENIOS_MT5_SERVER')
        if not account or not server:
            raise ValueError('MT5_LOCAL_BINDING_REQUIRED')
        fingerprint = hashlib.sha256(('mt5:' + account + ':' + server + ':' + profile['environment']).encode()).hexdigest()
        # Reject a wrong local binding before invoking even initialize().
        if fingerprint != profile['accountFingerprint']:
            raise ValueError('MT5_ACCOUNT_BINDING_MISMATCH')
        self.now_ms = now_ms or (lambda: int(time.time() * 1000))
        try:
            super().__init__(_TerminalPathAdapter(terminal), profile)
        except Exception:
            try:
                terminal.shutdown()
            except Exception:
                pass
            raise

    def _bound_snapshot(self):
        account = self.check()  # Existing R118 login/server/environment check.
        terminal = self.mt.terminal_info()
        if terminal is None or _flag(getattr(terminal, 'connected', None)) is not True:
            raise ValueError('MT5_DISCONNECTED')
        if account.currency != 'BRL':
            raise ValueError('MT5_B3_CURRENCY_MISMATCH')
        fingerprint = hashlib.sha256(('mt5:' + str(account.login) + ':' + account.server + ':' + self.profile['environment']).encode()).hexdigest()
        if fingerprint != self.profile['accountFingerprint']:
            raise ValueError('MT5_ACCOUNT_BINDING_MISMATCH')
        permissions = {
            'accountTradeAllowed': _flag(getattr(account, 'trade_allowed', None)),
            'accountExpertAllowed': _flag(getattr(account, 'trade_expert', None)),
            'terminalTradeAllowed': _flag(getattr(terminal, 'trade_allowed', None)),
            'pythonTradingDisabled': _flag(getattr(terminal, 'tradeapi_disabled', None)),
        }
        return account, terminal, permissions

    def _symbol_snapshot(self, requested):
        info = self.mt.symbol_info(requested)
        if info is None:
            return {'symbol': requested, 'available': False, 'specification': None,
                    'quote': None, 'positions': None, 'pendingOrders': None,
                    'ownershipVerified': False, 'issues': ['SYMBOL_NOT_FOUND']}
        if getattr(info, 'name', None) != requested:
            raise ValueError('MT5_SYMBOL_IDENTITY_MISMATCH')
        specification, issues = {}, []
        positive = ('point', 'trade_tick_size', 'trade_contract_size', 'volume_min', 'volume_max', 'volume_step')
        nonnegative = ('volume_limit', 'trade_tick_value', 'trade_tick_value_profit', 'trade_tick_value_loss',
                       'margin_initial', 'margin_maintenance', 'margin_hedged')
        integers = ('digits', 'trade_mode', 'trade_calc_mode', 'trade_exemode', 'filling_mode',
                    'order_mode', 'expiration_mode', 'trade_stops_level', 'trade_freeze_level',
                    'start_time', 'expiration_time')
        for field in positive + nonnegative:
            specification[field] = _decimal(getattr(info, field, None), positive=field in positive)
        for field in integers:
            specification[field] = _integer(getattr(info, field, None), maximum=18 if field == 'digits' else 9007199254740991)
        for field in ('custom', 'select', 'visible', 'margin_hedged_use_leg'):
            specification[field] = _flag(getattr(info, field, None))
        # currency_base can legitimately be empty for an exchange derivative.
        for field in ('currency_profit', 'currency_margin'):
            specification[field] = _currency(getattr(info, field, None))
        for field, value in specification.items():
            if value is None:
                issues.append('SYMBOL_SPEC_MISSING_OR_INVALID:' + field)
        if specification['custom'] is not False:
            issues.append('CUSTOM_SYMBOL_OR_STATUS_UNKNOWN')
        if specification['select'] is not True:
            issues.append('SYMBOL_NOT_SELECTED_NO_AUTOMATIC_SELECTION')
        if specification['trade_mode'] != getattr(self.mt, 'SYMBOL_TRADE_MODE_FULL', None) or specification['trade_mode'] is None:
            issues.append('SYMBOL_TRADING_RESTRICTED_OR_UNKNOWN')
        if all(specification[k] is not None for k in ('volume_min', 'volume_max', 'volume_step')):
            low, high, step = (Decimal(specification[k]) for k in ('volume_min', 'volume_max', 'volume_step'))
            if low > high or step > high:
                issues.append('SYMBOL_VOLUME_RULES_INCONSISTENT')
        tick = self.mt.symbol_info_tick(requested)
        quote = None
        if tick is not None:
            quote = {'timeMs': _integer(getattr(tick, 'time_msc', None), 1),
                     'bid': _decimal(getattr(tick, 'bid', None), positive=True),
                     'ask': _decimal(getattr(tick, 'ask', None), positive=True),
                     'last': _decimal(getattr(tick, 'last', None)), 'fresh': False, 'ageMs': None}
        # These counts cover ALL positions/orders for the symbol, including
        # manual and other robots. Magic never proves ownership here.
        positions = self.mt.positions_get(symbol=requested)
        orders = self.mt.orders_get(symbol=requested)
        if positions is None or orders is None:
            raise ValueError('MT5_EXPOSURE_SNAPSHOT_UNAVAILABLE')
        if not isinstance(positions, (tuple, list)) or not isinstance(orders, (tuple, list)):
            raise ValueError('MT5_EXPOSURE_SNAPSHOT_INVALID')
        if len(positions) + len(orders) > MAX_ROWS:
            raise ValueError('MT5_EXPOSURE_SNAPSHOT_LIMIT')
        if any(getattr(row, 'symbol', None) != requested for row in tuple(positions) + tuple(orders)):
            raise ValueError('MT5_EXPOSURE_SYMBOL_MISMATCH')
        if positions or orders:
            issues.append('EXISTING_SYMBOL_EXPOSURE_REQUIRES_RECONCILIATION')
        return {'symbol': requested, 'available': True, 'specification': specification, 'quote': quote,
                'positions': {'count': len(positions)}, 'pendingOrders': {'count': len(orders)},
                'ownershipVerified': False, 'issues': issues}

    def inspect(self, args):
        if (not isinstance(args, dict) or set(args) - {'symbols', 'maxQuoteAgeMs'}
                or not isinstance(args.get('symbols'), list) or not 1 <= len(args['symbols']) <= 20
                or any(not isinstance(name, str) for name in args['symbols'])
                or len(set(args['symbols'])) != len(args['symbols'])):
            raise ValueError('MT5_EXPLICIT_SYMBOLS_REQUIRED')
        if any(not SYMBOL.fullmatch(name) for name in args['symbols']):
            raise ValueError('MT5_ULTRA_MINI_CONTRACT_SYMBOL_REQUIRED')
        max_age = args.get('maxQuoteAgeMs', 5000)
        if _integer(max_age, 1, 30000) is None:
            raise ValueError('MT5_QUOTE_AGE_INVALID')
        began = _integer(self.now_ms(), 1)
        if began is None:
            raise ValueError('MT5_LOCAL_CLOCK_INVALID')
        before, terminal, permissions = self._bound_snapshot()
        rows = [self._symbol_snapshot(name) for name in args['symbols']]
        after, final_terminal, final_permissions = self._bound_snapshot()
        if (before.login, before.server, before.trade_mode, before.currency) != (after.login, after.server, after.trade_mode, after.currency):
            raise ValueError('MT5_ACCOUNT_CHANGED')
        if permissions != final_permissions:
            raise ValueError('MT5_PERMISSIONS_CHANGED_DURING_SNAPSHOT')
        observed = _integer(self.now_ms(), 1)
        if observed is None or observed < began:
            raise ValueError('MT5_LOCAL_CLOCK_INVALID')
        for row in rows:
            if not row['available']:
                continue
            spec, quote, issues = row['specification'], row['quote'], row['issues']
            # Narrow scope: only explicit dated contracts. No guessing the
            # current WIN/WDO maturity or replacing continuous chart symbols.
            expiry, start = spec['expiration_time'], spec['start_time']
            if expiry is None or expiry == 0:
                issues.append('DATED_CONTRACT_EXPIRY_NOT_VERIFIED')
            elif expiry * 1000 <= observed:
                issues.append('CONTRACT_EXPIRED')
            if start is not None and start * 1000 > observed:
                issues.append('CONTRACT_NOT_STARTED')
            if quote is None or any(quote[k] is None for k in ('timeMs', 'bid', 'ask')):
                issues.append('QUOTE_UNAVAILABLE_OR_INVALID')
            else:
                quote['ageMs'] = observed - quote['timeMs']
                if Decimal(quote['bid']) > Decimal(quote['ask']):
                    issues.append('QUOTE_CROSSED')
                elif quote['ageMs'] < 0:
                    issues.append('QUOTE_FROM_FUTURE')
                elif quote['ageMs'] > max_age:
                    issues.append('QUOTE_STALE')
                else:
                    quote['fresh'] = True
        missing = ['NATIVE_EXECUTION_NOT_RELEASED', 'MARKET_SESSION_NOT_VERIFIED',
                   'MARGIN_SUFFICIENCY_NOT_VERIFIED', 'PROTECTIVE_ORDERS_NOT_VERIFIED',
                   'BROKER_IDENTITY_NOT_INDEPENDENTLY_VERIFIED', 'PRODUCT_ELIGIBILITY_NOT_VERIFIED']
        for key, value in permissions.items():
            expected = key != 'pythonTradingDisabled'
            if value is None:
                missing.append('PERMISSION_NOT_OBSERVED:' + key)
            elif value != expected:
                missing.append('PERMISSION_BLOCKS_TRADING:' + key)
        if any(row['issues'] for row in rows):
            missing.append('SYMBOL_READINESS_GAPS')
        margin_mode = _integer(getattr(after, 'margin_mode', None))
        build = _integer(getattr(final_terminal, 'build', None), 1)
        if margin_mode is None:
            missing.append('ACCOUNT_MARGIN_MODE_NOT_OBSERVED')
        if build is None:
            missing.append('TERMINAL_BUILD_NOT_OBSERVED')
        return {'schema': 'JENIOS_ULTRA_MT5_READINESS_R125', 'provider': 'mt5', 'market': 'b3',
                'environment': self.profile['environment'], 'accountFingerprint': self.fingerprint,
                'currency': after.currency, 'accountMarginMode': margin_mode, 'terminalBuild': build,
                'observedAtMs': observed, 'collectionDurationMs': observed - began,
                'identityMatchedBeforeAndAfter': True, 'connected': True, 'readOnly': True,
                'scope': 'explicit_win_wdo_contract_candidates',
                'requestedProductScope': ['mini_index', 'mini_dollar'],
                'productEligibilityVerified': False, 'cryptoRouteVerified': False,
                'permissions': permissions, 'symbols': rows,
                'maxQuoteAgeMs': max_age, 'marketOpenVerified': False,
                'marginSufficiencyVerified': False, 'protectionVerified': False,
                'ownershipVerified': False, 'brokerIdentityVerified': False,
                'canStart': False, 'executionAvailable': False, 'missing': missing}


def _read_json(stream):
    line = stream.readline(MAX_LINE + 1)
    if not line:
        return None
    if len(line) > MAX_LINE:
        raise ValueError('MT5_READINESS_INPUT_TOO_LARGE')
    def reject_constant(_):
        raise ValueError('MT5_READINESS_JSON_INVALID')
    return json.loads(line, parse_constant=reject_constant)


def main():
    if sys.argv[1:] != ['--inspect-terminal']:
        raise ValueError('MT5_EXPLICIT_TERMINAL_INSPECTION_REQUIRED')
    if platform.system() != 'Windows':
        raise ValueError('MT5_WINDOWS_TERMINAL_REQUIRED')
    profile = _profile(_read_json(sys.stdin))
    import MetaTrader5 as mt5  # Only this explicit, operator-run path loads it.
    bridge = MT5Readiness(mt5, profile)
    try:
        while True:
            request, request_id = None, None
            try:
                request = _read_json(sys.stdin)
                if request is None:
                    break
                if not isinstance(request, dict) or set(request) - {'id', 'method', 'args'}:
                    raise ValueError('MT5_READINESS_REQUEST_INVALID')
                request_id = _integer(request.get('id'), 1)
                if request_id is None or request.get('method') != 'inspect':
                    raise ValueError('MT5_READINESS_REQUEST_INVALID')
                response = {'id': request_id, 'ok': True, 'result': bridge.inspect(request.get('args'))}
            except Exception as error:
                response = {'id': request_id, 'ok': False, 'error': _safe_error(error),
                            'canStart': False, 'executionAvailable': False}
                print(json.dumps(response, separators=(',', ':'), allow_nan=False), flush=True)
                break  # No later request may follow an uncertain/invalid snapshot.
            print(json.dumps(response, separators=(',', ':'), allow_nan=False), flush=True)
    finally:
        bridge.stop()


if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        print(json.dumps({'ok': False, 'error': _safe_error(error, 'MT5_READINESS_STARTUP_FAILED'),
                          'canStart': False, 'executionAvailable': False}), flush=True)
        sys.exit(1)
