"""Inspect a trader-supplied ProfitDLL package without loading DLLs or executing code.

Presence and PE architecture are not license, signature, ABI or routing validation.
The SDK and any license remain on the trader's computer; no network is used.
"""
import hashlib
import json
from pathlib import Path, PurePosixPath
import struct
import sys
from zipfile import ZipFile, BadZipFile

MAX_FILES = 5000
MAX_DLL = 64 * 1024 * 1024
MAX_ARCHIVE = 256 * 1024 * 1024
DECLARATIONS = {'.h', '.hpp', '.pas', '.cs', '.py'}
DOCUMENTS = {'.pdf', '.chm', '.html', '.md', '.txt'}


def safe_name(name):
    path = PurePosixPath(name.replace('\\', '/'))
    if path.is_absolute() or '..' in path.parts or any(':' in part for part in path.parts):
        raise ValueError('PROFIT_PACKAGE_PATH_INVALID')
    return str(path)


def pe_architecture(body):
    if len(body) < 64 or body[:2] != b'MZ':
        raise ValueError('PROFIT_DLL_PE_INVALID')
    offset = struct.unpack_from('<I', body, 60)[0]
    if offset > len(body) - 6 or body[offset:offset+4] != b'PE\0\0':
        raise ValueError('PROFIT_DLL_PE_INVALID')
    machine = struct.unpack_from('<H', body, offset+4)[0]
    return {0x14c: 'Win32', 0x8664: 'Win64'}.get(machine, 'unsupported')


def inspect_package(source):
    source = Path(source)
    files = []
    binaries = []
    if source.is_file():
        if source.stat().st_size > MAX_ARCHIVE:
            raise ValueError('PROFIT_PACKAGE_TOO_LARGE')
        with ZipFile(source) as archive:
            entries = archive.infolist()
            if len(entries) > MAX_FILES:
                raise ValueError('PROFIT_PACKAGE_FILE_LIMIT')
            names = set()
            for entry in entries:
                name = safe_name(entry.filename)
                if name in names:
                    raise ValueError('PROFIT_PACKAGE_DUPLICATE_PATH')
                names.add(name)
                if entry.is_dir():
                    continue
                files.append(name)
                if PurePosixPath(name).name.lower() == 'profitdll.dll':
                    if entry.file_size > MAX_DLL:
                        raise ValueError('PROFIT_DLL_TOO_LARGE')
                    body = archive.read(entry)
                    binaries.append({'path': name, 'bytes': len(body), 'architecture': pe_architecture(body), 'sha256': hashlib.sha256(body).hexdigest()})
    elif source.is_dir():
        for path in source.rglob('*'):
            if path.is_symlink():
                raise ValueError('PROFIT_PACKAGE_SYMLINK_UNSUPPORTED')
            if not path.is_file():
                continue
            if len(files) >= MAX_FILES:
                raise ValueError('PROFIT_PACKAGE_FILE_LIMIT')
            name = safe_name(path.relative_to(source).as_posix())
            files.append(name)
            if path.name.lower() == 'profitdll.dll':
                if path.stat().st_size > MAX_DLL:
                    raise ValueError('PROFIT_DLL_TOO_LARGE')
                body = path.read_bytes()
                binaries.append({'path': name, 'bytes': len(body), 'architecture': pe_architecture(body), 'sha256': hashlib.sha256(body).hexdigest()})
    else:
        raise ValueError('LOCAL_PROFIT_PACKAGE_REQUIRED')
    declarations = sorted(name for name in files if PurePosixPath(name).suffix.lower() in DECLARATIONS)
    documents = sorted(name for name in files if PurePosixPath(name).suffix.lower() in DOCUMENTS)
    missing = []
    if not any(binary['architecture'] in ('Win32', 'Win64') for binary in binaries):
        missing.append('OFFICIAL_WINDOWS_PROFITDLL_BINARY')
    if not declarations:
        missing.append('VERSION_MATCHED_NATIVE_DECLARATIONS')
    if not documents:
        missing.append('VERSION_MATCHED_OFFICIAL_MANUAL')
    return {'schema': 'JENIOS_ULTRA_PROFIT_PACKAGE_INVENTORY_R118', 'networkUsed': False, 'dllLoaded': False,
            'executionAvailable': False, 'sdkPresenceOnly': not missing, 'officialAuthenticityVerified': False,
            'licenseVerified': False, 'abiVerified': False, 'nativeRoutingValidated': False,
            'binaries': binaries, 'declarationCandidates': declarations, 'manualCandidates': documents, 'missingArtifacts': missing,
            'remainingChecks': ['VERIFY_PACKAGE_AND_VERSION_WITH_NELOGICA', 'CONFIRM_ROUTING_LICENSE', 'REVIEW_VERSION_MATCHED_TYPES_AND_CALLBACKS', 'VERIFY_TRADER_ACCOUNT_ON_WINDOWS', 'IMPLEMENT_AND_QUALIFY_NATIVE_BRIDGE']}


def main():
    if len(sys.argv) != 2:
        raise ValueError('USAGE_PROFIT_SDK_INVENTORY_LOCAL_ZIP_OR_DIRECTORY')
    print(json.dumps(inspect_package(sys.argv[1]), indent=2))


if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        code = str(error) if isinstance(error, ValueError) and str(error).replace('_', '').isalnum() and str(error).isupper() else 'PROFIT_PACKAGE_INSPECTION_FAILED'
        print(json.dumps({'ok': False, 'error': code, 'executionAvailable': False, 'dllLoaded': False}))
        sys.exit(1)
