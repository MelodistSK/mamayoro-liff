# ままよろ人材紹介 LIFF アプリケーション

LINE × kintone × Google Calendar 連携システム

## 📁 プロジェクト構成

```
mamayoro-liff/
├── index.html                    # リダイレクトページ
├── registration.html             # 会員登録ページ（同意画面付き）
├── appointment.html              # 面談予約ページ
├── package.json                  # 依存関係
└── api/
    ├── register.js               # kintone求職者登録API
    ├── create-appointment.js     # 面談予約作成API
    ├── get-available-slots.js    # 空き枠取得API
    └── update-appointment.js     # 面談予定更新API
```

## 🚀 デプロイ方法

### 1. Vercelにデプロイ

```bash
# Vercel CLIをインストール（初回のみ）
npm install -g vercel

# デプロイ
vercel
```

### 2. 環境変数の設定

Vercel ダッシュボードで以下の環境変数を設定してください：

#### **kintone設定**
- `KINTONE_DOMAIN` - kintoneのドメイン（例: `your-domain.cybozu.com`）
- `KINTONE_APP_ID` - 求職者管理アプリID（例: `801`）
- `KINTONE_API_TOKEN` - 求職者管理アプリのAPIトークン
- `KINTONE_JOBSEEKER_API_TOKEN` - 求職者管理アプリのAPIトークン
- `KINTONE_APPOINTMENT_API_TOKEN` - 面談管理アプリのAPIトークン

#### **Google Calendar設定**
- `GOOGLE_CALENDAR_CREDENTIALS` - サービスアカウントのJSON認証情報（全体をコピー）
- `GOOGLE_CALENDAR_ID` - カレンダーID（例: `xxxxx@group.calendar.google.com`）

### 3. LIFFアプリの設定

LINE Developers コンソールで以下を設定：

- **Endpoint URL**: `https://your-app.vercel.app/`
- **Scope**: 
  - `profile`
  - `openid`

## 📋 システムフロー

### 会員登録フロー
1. ユーザーがLINEから登録画面を開く
2. 個人情報取り扱い同意画面を表示
3. 同意後、登録フォームに入力
4. `/api/register` → kintoneに求職者ID自動生成して登録
5. 面談予約画面へ遷移

### 面談予約フロー
1. `/api/get-available-slots` → Googleカレンダーから空き枠を取得
2. ユーザーが日時を選択
3. `/api/create-appointment` → 以下を実行：
   - kintone面談管理アプリにレコード作成
   - Googleカレンダーに予定追加
   - カレンダーイベントIDをkintoneに保存

## 🛠️ 開発

### ローカル開発

```bash
# 依存関係をインストール
npm install

# ローカルサーバー起動
vercel dev
```

### 環境変数（ローカル）

`.env` ファイルを作成：

```env
KINTONE_DOMAIN=your-domain.cybozu.com
KINTONE_APP_ID=801
KINTONE_API_TOKEN=your-token
KINTONE_JOBSEEKER_API_TOKEN=your-token
KINTONE_APPOINTMENT_API_TOKEN=your-token
GOOGLE_CALENDAR_CREDENTIALS={"type":"service_account",...}
GOOGLE_CALENDAR_ID=your-calendar@group.calendar.google.com
```

## 📝 注意事項

- **APIトークンは環境変数で管理**（コードに直接記述しない）
- **Google Calendar認証情報**はサービスアカウントのJSON全体をコピー
- **kintoneアプリ**は以下の2つを使用：
  - 求職者管理アプリ（ID: 801）
  - 面談管理アプリ（ID: 805）

## 🔒 セキュリティ

- 全てのAPIトークンは環境変数で管理
- CORS設定により、特定のオリジンからのみアクセス可能
- LIFF認証により、LINE認証済みユーザーのみアクセス可能

## 📞 サポート

問題が発生した場合は、Vercelのログを確認してください：

```bash
vercel logs
```
