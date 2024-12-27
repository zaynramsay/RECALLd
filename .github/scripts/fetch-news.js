name: Fetch News
on:
  schedule:
    - cron: '*/30 * * * *'  # Runs every 30 minutes
  workflow_dispatch:  # Allows manual triggers

jobs:
  fetch-news:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          
      - name: Fetch and Update News
        env:
          NEWS_API_KEY: ${{ secrets.NEWS_API_KEY }}
        run: |
          node ./.github/scripts/fetch-news.js
          
      - name: Commit and Push
        run: |
          git config --global user.name 'GitHub Action'
          git config --global user.email 'action@github.com'
          git add data/news.json
          git commit -m "Update news data" || exit 0
          git push
