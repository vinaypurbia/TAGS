name: Update market prices

on:
  schedule:
    - cron: '30 21 * * *'   # 21:30 UTC = 03:00 IST, daily
  workflow_dispatch:         # "Run workflow" button in the Actions tab
    inputs:
      dry_run:
        description: 'Dry run (print matches, save nothing)'
        default: 'true'

jobs:
  update:
    runs-on: ubuntu-latest
    timeout-minutes: 45
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: node scripts/update-market-prices.mjs
        env:
          TAGS_MONGO: ${{ secrets.TAGS_MONGO }}
          SERPAPI_KEY: ${{ secrets.SERPAPI_KEY }}
          APIFY_TOKEN: ${{ secrets.APIFY_TOKEN }}
          DRY_RUN: ${{ github.event.inputs.dry_run == 'true' && '1' || '' }}
