# Bitcoin Arbitrage Monitoring System - Testing Guide

## 概要

このドキュメントは、Bitcoin Arbitrage Monitoring Systemの包括的なテストスイートについて説明します。

## テストの種類

### 1. ユニットテスト (`tests/unit/`)

各コンポーネントを個別にテストします。

- **ExchangeAPI** (`exchanges.test.js`)
  - 各取引所APIクライアントの動作
  - エラーハンドリング
  - データフォーマット

- **ArbitrageDetector** (`arbitrage.test.js`)
  - アービトラージ機会の検知ロジック
  - 閾値設定
  - 手数料計算

- **Database** (`database.test.js`)
  - SQLite操作
  - データ保存・取得
  - トランザクション処理

### 2. セキュリティテスト (`tests/security/`)

システムのセキュリティと脆弱性をテストします。

- **Security Test Suite** (`security.test.js`)
  - 入力検証・サニタイゼーション
  - 認証・認可
  - レート制限
  - CORS設定
  - セキュリティヘッダー
  - エラーハンドリング
  - WebSocketセキュリティ

- **SQL Injection Protection** (`sql-injection.test.js`)
  - パラメータ化クエリ
  - SQLインジェクション攻撃防止
  - データ型検証
  - トランザクション安全性

- **Input Validation** (`input-validation.test.js`)
  - 取引所名検証
  - 価格データ検証
  - バッファオーバーフロー防止
  - Unicode・エンコーディング攻撃対策
  - データ構造検証

### 3. 統合テスト (`tests/integration/`)

システム全体の連携をテストします。

- **API Endpoints** (`api.test.js`)
  - REST API エンドポイントの動作
  - リクエスト/レスポンス形式
  - エラーハンドリング

- **WebSocket** (`websocket.test.js`)
  - リアルタイム通信
  - 接続管理
  - メッセージブロードキャスト

- **External APIs** (`external-apis.test.js`)
  - 実際の取引所APIとの連携
  - レスポンス形式の検証
  - エラー耐性

### 4. パフォーマンステスト (`tests/performance/`)

システムの性能と負荷耐性をテストします。

- **Load Test** (`load-test.test.js`)
  - API応答時間
  - 同時接続処理
  - メモリ使用量
  - ストレステスト

## テストの実行

### 基本的な使用方法

```bash
# ユニットテストの実行
npm test
# または
node tests/test-runner.js unit

# セキュリティテストの実行
node tests/test-runner.js security

# 統合テストの実行（サーバーを起動してから実行）
node tests/test-runner.js integration

# パフォーマンステストの実行
node tests/test-runner.js performance

# 外部API統合テスト（実際のAPIを呼び出す）
node tests/test-runner.js external-api

# カバレッジ付きの全テスト（推奨）
npm run test:coverage
# または
node tests/test-runner.js coverage

# ウォッチモード（開発中）
node tests/test-runner.js watch
```

### 高度なオプション

```bash
# サーバーの状態確認
node tests/test-runner.js --check-server

# テストアーティファクトのクリーンアップ
node tests/test-runner.js --cleanup

# 利用可能なテストタイプを確認
node tests/test-runner.js help
```

## 前提条件

### 統合・パフォーマンステスト
```bash
# サーバーを起動
npm run dev
# または
npm run server
```

### 外部APIテスト
```bash
# 実際のAPIを呼び出すため注意
export SKIP_REAL_API_TESTS=false
npm run test:external-api
```

## テスト設定

### Jest設定 (`tests/setup/jest.config.js`)
- テスト環境の設定
- カバレッジの閾値（80-85%）
- タイムアウト設定

### セットアップファイル (`tests/setup/jest.setup.js`)
- カスタムマッチャー
- テストユーティリティ
- モック設定
- セキュリティ設定の読み込み

### テスト設定ファイル (`tests/config/test-config.js`)
- 機密データの一元管理
- セキュリティ設定
- 価格範囲・タイムアウト設定
- 環境変数による設定切り替え

### 環境設定 (`.env.test`)
- テスト専用環境変数
- 本番環境からの分離
- セキュリティ設定

## カバレッジ実績

| 項目 | 目標値 | 現在の閾値 |
|------|--------|-----------|
| Branches | 80% | 80% |
| Functions | 85% | 85% |
| Lines | 85% | 85% |
| Statements | 85% | 85% |

**総テスト数: 37+テスト**
- ユニットテスト: 37テスト
- セキュリティテスト: 新規追加
- 統合テスト: 42テスト 
- パフォーマンステスト: 12テスト

### セキュリティテストカバレッジ
- 入力検証: 完全テスト済み
- SQLインジェクション防止: 完全テスト済み
- 認証・認可: 新規追加
- レート制限: 新規追加
- CORS・セキュリティヘッダー: 新規追加

## 継続的インテグレーション

テストは以下の環境変数で制御できます：

- `NODE_ENV`: 環境設定（test/development/production）
- `SKIP_REAL_API_TESTS`: 実際のAPIコールをスキップ（default: true）
- `MOCK_EXTERNAL_APIS`: 外部APIをモック化（default: true）
- `VERBOSE_TESTS`: 詳細なログ出力（default: false）
- `TEST_DB_PATH`: テストデータベースパス（default: :memory:）
- `JWT_SECRET`: テスト用JWT秘密鍵
- `MAX_REQUESTS_PER_MINUTE`: レート制限設定

## トラブルシューティング

### よくある問題

1. **サーバー接続エラー**
   ```bash
   npm run test:check-server
   ```

2. **外部APIレート制限**
   ```bash
   export SKIP_REAL_API_TESTS=true
   ```

3. **メモリ不足**
   ```bash
   node --max-old-space-size=4096 tests/test-runner.js
   ```

4. **セキュリティテスト失敗**
   ```bash
   # 環境変数が正しく設定されているか確認
   echo $NODE_ENV
   echo $TEST_DB_PATH
   ```

5. **本番データベースアクセスエラー**
   ```bash
   # テスト環境設定を確認
   export NODE_ENV=test
   export TEST_DB_PATH=:memory:
   ```

### デバッグ

```bash
# 詳細ログでテスト実行
export VERBOSE_TESTS=true
npm test

# Jest デバッグモード
node --inspect-brk node_modules/.bin/jest --runInBand
```

## 新しいテストの追加

### ユニットテスト
1. `tests/unit/` に `*.test.js` ファイルを作成
2. 適切なモックを設定
3. `describe` と `it` ブロックでテストを構造化
4. `global.testConfig` を使用して設定値を取得

### セキュリティテスト
1. `tests/security/` にファイルを作成
2. 入力検証・SQLインジェクション・認証をテスト
3. `testUtils` のセキュリティ関数を活用
4. 悪意のある入力データでテスト

### 統合テスト
1. `tests/integration/` にファイルを作成
2. サーバーが必要な場合は前提条件を記載
3. 実際のHTTP/WebSocket通信をテスト
4. セキュリティヘッダーも検証

### パフォーマンステスト
1. `tests/performance/` にファイルを作成
2. 適切なタイムアウトを設定
3. パフォーマンスメトリクスを検証
4. セキュリティ制限下での性能も考慮

## ベストプラクティス

1. **テストの独立性**: 各テストは他のテストに依存しない
2. **モックの使用**: 外部依存は適切にモック
3. **エラーテスト**: 正常系だけでなく異常系もテスト
4. **セキュリティファースト**: すべての入力を疑い、検証する
5. **環境分離**: テスト環境と本番環境を完全に分離
6. **機密データ保護**: ハードコード禁止、設定ファイル使用
7. **パフォーマンス**: テストの実行時間を適切に管理
8. **メンテナンス性**: テストコードも保守しやすく記述

## レポート

テスト結果は以下で確認できます：

- **コンソール出力**: リアルタイムの結果
- **カバレッジレポート**: `coverage/index.html`
- **ログファイル**: `test-results.log`
- **セキュリティテストレポート**: セキュリティ脆弱性の検出結果

## セキュリティ改善履歴

### 2024年版アップデート
- ✅ ハードコードされた機密データの除去
- ✅ SQLインジェクション攻撃対策の強化
- ✅ 入力検証・サニタイゼーションの追加
- ✅ テスト環境の完全分離
- ✅ カバレッジ閾値の向上（39% → 80-85%）
- ✅ 認証・認可テストの追加
- ✅ レート制限・CORS設定の検証
- ✅ セキュリティヘッダーの確認