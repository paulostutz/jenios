"""Local, read-only terminal diagnostics. Never sends/cancels an order or changes leverage."""
import json, os, sys, platform

def mt5_diagnostic():
    if platform.system() != 'Windows':
        raise ValueError('MT5_WINDOWS_TERMINAL_REQUIRED')
    import MetaTrader5 as mt5
    terminal_path = os.environ.get('JENIOS_MT5_TERMINAL_PATH')
    expected_account = os.environ.get('JENIOS_MT5_ACCOUNT')
    expected_server = os.environ.get('JENIOS_MT5_SERVER')
    environment = os.environ.get('JENIOS_ULTRA_ENVIRONMENT')
    if not expected_account or not expected_server or environment not in ('demo', 'live'):
        raise ValueError('LOCAL_MT5_BINDING_REQUIRED')
    # Uses the terminal session already opened by the trader; no cloud password handling.
    if not (mt5.initialize(path=terminal_path) if terminal_path else mt5.initialize()):
        raise ValueError('MT5_TERMINAL_UNAVAILABLE')
    try:
        account, terminal = mt5.account_info(), mt5.terminal_info()
        if account is None or terminal is None or not terminal.connected:
            raise ValueError('MT5_NOT_CONNECTED')
        if str(account.login) != expected_account or account.server != expected_server:
            raise ValueError('MT5_ACCOUNT_MISMATCH')
        expected_mode = mt5.ACCOUNT_TRADE_MODE_DEMO if environment == 'demo' else mt5.ACCOUNT_TRADE_MODE_REAL
        if account.trade_mode != expected_mode:
            raise ValueError('MT5_ENVIRONMENT_MISMATCH')
        return {'provider':'mt5','environment':environment,'connected':True,'readOnlyDiagnostic':True,
                'tradingPermission':bool(account.trade_allowed and account.trade_expert and terminal.trade_allowed),
                'currency':account.currency,'executionAvailable':False,
                'reason':'MT5_EXECUTOR_AND_RECONCILIATION_PENDING'}
    finally:
        mt5.shutdown()

def profit_diagnostic():
    if platform.system() != 'Windows':
        raise ValueError('PROFIT_WINDOWS_REQUIRED')
    import ctypes
    dll_path = os.environ.get('JENIOS_PROFIT_DLL_PATH', '')
    if not os.path.isabs(dll_path) or not os.path.isfile(dll_path):
        raise ValueError('LOCAL_LICENSED_PROFIT_DLL_REQUIRED')
    # The trader supplies the licensed DLL. Only exported symbols are inspected.
    dll = ctypes.WinDLL(dll_path)
    for name in ('DLLInitializeLogin','DLLFinalize','GetAccountCount','GetAccounts','GetOrderDetails','SendOrder'):
        if not hasattr(dll, name):
            raise ValueError('PROFIT_SDK_INCOMPATIBLE')
    return {'provider':'profit','connected':False,'readOnlyDiagnostic':True,'sdkLoaded':True,
            'executionAvailable':False,'reason':'PROFIT_ROUTING_BRIDGE_PENDING'}

if __name__ == '__main__':
    try:
        if len(sys.argv) != 2 or sys.argv[1] not in ('mt5','profit'):
            raise ValueError('INVALID_PROVIDER')
        result = mt5_diagnostic() if sys.argv[1] == 'mt5' else profit_diagnostic()
        print(json.dumps({'ok':True, **result}))
    except Exception as error:
        # Do not print native paths, account IDs, passwords or vendor exception contents.
        code = str(error) if isinstance(error, ValueError) and str(error).replace('_','').isupper() else 'LOCAL_TERMINAL_DIAGNOSTIC_FAILED'
        print(json.dumps({'ok':False,'code':code,'executionAvailable':False}))
        sys.exit(1)
