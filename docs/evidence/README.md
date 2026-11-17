# Report evidence provenance

The PNG files were captured from a real browser integration run using a separately deployed local test contract. `manifest.json` records capture time, RPC, chain client, EVM compiler target, contract address, public wallets, transaction receipts, and NFT ownership after revocation. It contains no private keys.

- `certificate-valid.png`: successful exact-byte JSON verification before revocation.
- `certificate-tampered.png`: the same token checked against the changed-grade JSON.
- `certificate-revoked.png`: invalid status after a mined revocation, with ownership retained.
- `wallet-lookup.png`, `issuer-role.png`, `metadata-invalid.png`, `wrong-network.png`: additional UI evidence retained outside the six-page report.
- `test-log.png`: a rendered excerpt of `docs/test-results.txt`, explicitly identified as rendered log content rather than a terminal screenshot.
- `gas-deploy.png`: a chart generated from the deployment receipts in `docs/gas-optimized.json` and `docs/gas-unoptimized.json`.
- `test-run.json`: timestamp and EVM target of the refreshed contract suites.

The browser wallet is a simulated EIP-1193 provider; transactions really execute on Ganache. These screenshots do not establish that the MetaMask extension was manually exercised. The test does not replace `frontend/src/deployment.json` or the user's demo deployment.

The saved gas CSV/JSON belongs to the recorded Shanghai benchmark. Changing to another blockchain or using Paris GUI compatibility does not make those old receipts part of the new chain.
