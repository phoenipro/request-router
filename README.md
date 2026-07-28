# request-router

社内の依頼・問い合わせを受け付け、**内容から担当者と優先度を自動で判定して振り分ける**小さなWebアプリです。

「問い合わせのルーティングを自動化する」という業務課題を、最小構成で実装した学習用のプロジェクトです。

## 画面の流れ

1. Google アカウントでログイン
2. 件名と内容を入力すると、**入力中に振り分け先がその場で表示される**
3. 登録すると一覧に追加され、担当者・優先度・判定に使われた語が表示される
4. ステータス（受付済み／対応中／完了）を変更できる。Firestore の購読により変更が即座に反映される

## 技術構成

| 領域 | 使用技術 |
|---|---|
| フロントエンド | Next.js 16（App Router）／React 19／TypeScript／Tailwind CSS |
| 認証 | Firebase Authentication（Google ログイン） |
| データベース | Cloud Firestore（`onSnapshot` によるリアルタイム購読） |
| テスト | Vitest（単体）／Playwright（E2E） |
| CI | GitHub Actions（lint → 型チェック → 単体 → E2E） |

## 設計で意識したこと

### 振り分けロジックを純粋関数として切り出している

判定処理は [`src/lib/routing.ts`](src/lib/routing.ts) にまとめ、Firebase や React に依存しない純粋関数にしています。

振り分けルールは業務側の都合で最も変わりやすい部分です。ここが UI や DB と絡んでいると、ルールを1つ変えるたびに画面を開いて動作確認する必要が出ます。外部I/Oを持たない形にしておくことで、[`src/lib/routing.test.ts`](src/lib/routing.test.ts) の単体テストだけで挙動を固定できます。

```ts
export function route(title: string, body: string, rules = DEFAULT_RULES): RoutingResult
```

判定は「キーワードの一致数が最も多いカテゴリを選ぶ」方式で、同数の場合はルール定義順で決まります。**同じ入力で判定結果が揺れないこと**を優先しました。

### 判定の根拠を返す

`route()` は担当者だけでなく、判定に使われたキーワード（`matched`）も返します。自動振り分けは「なぜそこへ割り振られたのか」が分からないと現場で信用されないため、画面上に理由を表示できるようにしています。

### 優先度は取りこぼさない側に倒す

「急ぎませんが、システムが止まっています」のように緊急語と低優先語が混在した場合は、**緊急側を採用**します。優先度を低く見積もって対応が遅れる方が損失が大きいためです。この判断はテストで固定しています。

### 認証情報が無くても起動する

Firebase の環境変数が未設定でも画面は開き、設定を促す表示が出ます。これにより **CI では認証情報を渡さずに E2E テストを実行できます**。秘密情報を GitHub Actions に登録しなくても、ビルドと画面表示の確認までは自動化できる状態にしてあります。

### Firestore のルールで書き換えを制限する

[`firestore.rules`](firestore.rules) で、更新時に変更できるフィールドを `status` のみに限定しています。クライアント側の実装に関わらず、担当者や判定結果を後から書き換えられないようにするためです。

## セットアップ

```bash
npm install
cp .env.local.example .env.local
```

`.env.local` に Firebase コンソールの設定値（プロジェクトの設定 → マイアプリ → ウェブアプリ）を入力します。

Firebase 側では以下を有効にします。

- Authentication → Sign-in method → **Google** を有効化
- Firestore Database を作成し、`firestore.rules` の内容を反映

```bash
npm run dev
```

## コマンド

```bash
npm run dev        # 開発サーバー
npm run build      # 本番ビルド
npm run lint       # ESLint
npm run typecheck  # tsc --noEmit
npm test           # 単体テスト（Vitest）
npm run test:e2e   # E2E テスト（Playwright）
```

## 補足

実装には AI コーディングツール（Claude Code）を併用しています。生成された差分は確認したうえで採用し、上記「設計で意識したこと」の判断は自分で決めています。

## ライセンス

MIT
