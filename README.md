# BTC アービトラージ監視システム

ビットコインの価格差を監視し、アービトラージ機会を検知するWebアプリケーションです。

## 機能

- **リアルタイム価格監視**: bitFlyer、Coincheck、Zaif、GMOコイン、bitbank、BITPointから5秒毎にBTC/JPY価格を取得
- **アービトラージ検知**: 取引所間の価格差が1%以上の機会を自動検知
- **リアルタイム表示**: WebSocketを使用したリアルタイム価格更新
- **取引履歴**: 価格データとアービトラージ機会をSQLiteに保存
- **シンプルUI**: 直感的な価格一覧表示とハイライト通知

## セットアップ

### 1. 依存関係のインストール

```bash
# ルートディレクトリで
npm run install-deps
```

### 2. 環境変数の設定

```bash
# 環境変数テンプレートをコピー
cp .env.example .env

# .envファイルを編集して本番用の設定を入力
# 特に以下の項目は必ず変更してください：
# - JWT_SECRET
# - ADMIN_PASSWORD
# - ALLOWED_ORIGINS_PRODUCTION
```

### 3. アプリケーションの起動

```bash
# 開発モード（サーバーとクライアントを同時起動）
npm run dev
```

または個別に起動:

```bash
# サーバーのみ
npm run server

# クライアントのみ（別ターミナル）
npm run client
```

### 4. アクセス

- フロントエンド: http://localhost:3000
- API: http://localhost:3001

## API エンドポイント

### パブリックエンドポイント
- `GET /api/prices` - 現在の価格とアービトラージ機会
- `GET /api/history` - 過去の価格・アービトラージ履歴
- `GET /api/price-history?hours=24` - 指定時間の価格履歴
- `POST /api/login` - 管理者ログイン

### 認証が必要なエンドポイント
以下のエンドポイントは`Authorization: Bearer <token>`ヘッダーが必要：
- `GET /api/validate-token` - トークンの検証
- `DELETE /api/clear-data` - 全データの削除
- `GET /api/export-csv?hours=24` - CSV形式でデータエクスポート

#### 使用例
```bash
# ログイン
curl -X POST http://localhost:3001/api/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'

# 認証が必要なエンドポイントへのアクセス
curl -X DELETE http://localhost:3001/api/clear-data \
  -H "Authorization: Bearer <取得したトークン>"
```

## 技術スタック

- **バックエンド**: Node.js, Express, WebSocket, SQLite
- **フロントエンド**: React
- **セキュリティ**: JWT認証, bcryptjs, Helmet.js, express-rate-limit
- **API**: bitFlyer、Coincheck、Zaif、GMOコイン、bitbank、BITPoint公開API

## 設定

- アービトラージ検知閾値: 1%（`server/arbitrage.js`で変更可能）
- 価格取得間隔: 5秒（`server/index.js`で変更可能）

## セキュリティ

本アプリケーションは多層的なセキュリティ対策を実装しています：

### 認証・認可
- **JWT認証**: トークンベースの認証システム（デフォルト24時間有効）
- **管理者アクセス制御**: ロールベースのアクセス制御
- **保護されたエンドポイント**: データクリア、エクスポート機能は認証必須
- **WebSocket認証**: 管理者機能利用時にトークン認証

**デフォルト認証情報**（開発環境）：
- ユーザー名: `admin`
- パスワード: `admin123`

⚠️ **本番環境では必ず`.env`ファイルで強力なパスワードに変更してください！**

### 入力検証・セキュリティ対策
- **包括的バリデーション**: API パラメーターの厳格な検証
- **CSVインジェクション対策**: エクスポート時のデータエスケープ
- **パス・トラバーサル対策**: ファイル名の安全な処理
- **XSS対策**: Helmet.jsによるセキュリティヘッダー設定

### SQLインジェクション対策
- **パラメーター化クエリ**: 全てのデータベース操作でプリペアドステートメント使用
- **入力サニタイゼーション**: 悪意あるSQLパターンの検出・除去
- **データ型検証**: データベース挿入前の厳格な型チェック

### DoS攻撃対策
- **レート制限**: API呼び出し制限（デフォルト：15分間に100リクエスト）
- **WebSocket接続制限**: 最大同時接続数制限（デフォルト：50接続）
- **ペイロードサイズ制限**: メッセージサイズ制限（16KB）

### CORS・セキュリティヘッダー
- **厳格なCORS設定**: 環境別のオリジン制限
- **Helmet.js**: セキュリティヘッダーの自動設定
- **CSP**: コンテンツセキュリティポリシー
- **XSS・クリックジャッキング対策**

### 環境変数による設定
セキュリティ設定は環境変数で管理（`.env.example`参照）：

```bash
# 必須のセキュリティ設定
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
ADMIN_USERNAME=admin
ADMIN_PASSWORD=change-this-admin-password

# CORS設定
ALLOWED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
ALLOWED_ORIGINS_PRODUCTION=https://yourdomain.com

# レート制限
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# WebSocket設定
MAX_WS_CONNECTIONS=50
WS_MAX_PAYLOAD=16384
```

### セキュリティベストプラクティス

1. **本番環境での必須対応**：
   - `JWT_SECRET`を強力なランダム文字列に変更
   - `ADMIN_PASSWORD`を複雑なパスワードに変更
   - `ALLOWED_ORIGINS_PRODUCTION`を実際のドメインに設定

2. **定期的なセキュリティ更新**：
   ```bash
   # 脆弱性チェック
   npm audit
   npm audit fix
   
   # 依存関係の更新
   npm update
   ```

3. **監視とログ**：
   - 認証失敗の監視
   - 異常なAPI呼び出しパターンの検知
   - レート制限の発動状況確認

## データベース

SQLiteデータベース（`server/arbitrage.db`）に以下を保存:
- 価格履歴（`price_history`テーブル）
- アービトラージ機会（`arbitrage_opportunities`テーブル）
