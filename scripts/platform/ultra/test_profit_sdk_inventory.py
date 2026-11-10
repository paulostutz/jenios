import unittest
import tempfile
from pathlib import Path
import struct
from zipfile import ZipFile
from profit_sdk_inventory import inspect_package, pe_architecture, safe_name


def pe(machine=0x8664):
    body = bytearray(128)
    body[:2] = b'MZ'
    struct.pack_into('<I', body, 60, 64)
    body[64:68] = b'PE\0\0'
    struct.pack_into('<H', body, 68, machine)
    return bytes(body)


class InventoryTests(unittest.TestCase):
    def test_empty_package_reports_exact_missing_categories(self):
        with tempfile.TemporaryDirectory() as directory:
            result = inspect_package(directory)
            self.assertEqual(len(result['missingArtifacts']), 3)
            self.assertFalse(result['executionAvailable'])
            self.assertFalse(result['dllLoaded'])

    def test_present_files_are_not_license_or_abi_certification(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory)/'ProfitDLL.zip'
            with ZipFile(path, 'w') as archive:
                archive.writestr('Win64/ProfitDLL.dll', pe())
                archive.writestr('Declarations/ProfitDLL.h', '// fixture')
                archive.writestr('Manual.pdf', 'synthetic placeholder')
            result = inspect_package(path)
            self.assertTrue(result['sdkPresenceOnly'])
            self.assertEqual(result['binaries'][0]['architecture'], 'Win64')
            self.assertFalse(result['officialAuthenticityVerified'])
            self.assertFalse(result['licenseVerified'])
            self.assertFalse(result['abiVerified'])
            self.assertFalse(result['nativeRoutingValidated'])
            self.assertFalse(result['networkUsed'])

    def test_architecture_is_read_from_binary_not_folder_label(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory)/'ProfitDLL.dll'
            path.write_bytes(pe(0x14c))
            self.assertEqual(inspect_package(directory)['binaries'][0]['architecture'], 'Win32')
            self.assertEqual(pe_architecture(pe(0xffff)), 'unsupported')

    def test_invalid_or_truncated_pe_is_never_loaded(self):
        for body in [b'', b'not a DLL', bytes(128), pe()[:65]]:
            with self.assertRaises(ValueError):
                pe_architecture(body)

    def test_nonlocal_package_paths_are_rejected(self):
        for name in ['../ProfitDLL.dll', '/ProfitDLL.dll', 'C:/ProfitDLL.dll', 'Win64/../../ProfitDLL.dll']:
            with self.assertRaises(ValueError):
                safe_name(name)

    def test_duplicate_archive_paths_fail(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory)/'ProfitDLL.zip'
            with ZipFile(path, 'w') as archive:
                archive.writestr('Win64/ProfitDLL.dll', pe())
                archive.writestr('Win64/ProfitDLL.dll', pe())
            with self.assertRaisesRegex(ValueError, 'DUPLICATE_PATH'):
                inspect_package(path)


if __name__ == '__main__':
    unittest.main()
