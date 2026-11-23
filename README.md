# 日々の手帖

「日々の手帖」は、iOS 17以降のiPhoneでSafariからホーム画面に追加して使う、個人用のカレンダーです。主開発は `web/` のPWAです。Windowsで開発・テストでき、予定・タスク・設定は利用している端末に保存します。 [日々の手帖を開く（非公開）](https://hibi-techou-calendar.steeplarch8.chatgpt.site/)

- [使い方・Google連携の設定・WindowsとiPhoneの検証手順](web/README.md)
- [画面とデータの仕様](SPEC.md) · [開発計画と進捗](PLAN.md) · [開発ルール](AGENTS.md)

## 旧ネイティブ版の記録

iOS 17以降のiPhone向け個人用カレンダーです。Phase 1では、モック予定を使って月・週・日の見た目と日付移動を確認できます。システムのカレンダーやリマインダーへのアクセス許可は求めません。

### 起動

MacのXcodeで `PaperCalendar.xcodeproj` を開き、`PaperCalendar` スキームとiOS 17以降のiPhoneシミュレータを選択して実行します。Google Sign-In SDK 10.1.0の解決にはSwift 6以降を搭載したXcodeを使います。実機で起動する場合は、ターゲットの「Signing & Capabilities」で自分のチームを選択します。初期表示は月間カレンダーです。 [Google Sign-In SDK 10.1.0](https://github.com/google/GoogleSignIn-iOS/releases/tag/10.1.0)

- [SPEC.md](SPEC.md) と [PLAN.md](PLAN.md) の「旧ネイティブ版の記録」に当時の仕様と計画を収録しています。

### Google Cloud Consoleの設定

1. Google Cloud Consoleで開発用プロジェクトを作り、**APIとサービス → ライブラリ**で **Google Calendar API** を有効にします。 [Google CloudのAPI有効化手順](https://cloud.google.com/apis/docs/enable-disable-apis)
2. **Google Auth Platform → ブランディング・対象・データアクセス**を設定します。個人のGoogleアカウントで試す場合は外部ユーザーのテスト運用を選び、テスト専用アカウントを追加します。データアクセスには `https://www.googleapis.com/auth/calendar.calendarlist.readonly` と `https://www.googleapis.com/auth/calendar.events.readonly` を追加します。 [OAuth同意画面](https://developers.google.com/workspace/guides/configure-oauth-consent) · [Calendar APIのスコープ](https://developers.google.com/workspace/calendar/api/auth)
3. **Google Auth Platform → クライアント → クライアントを作成**で種類を **iOS** にし、実際に署名するアプリのBundle IDを登録します。初期値は `local.personal.PaperCalendar` です。署名時に変更した場合は同じ値をGoogle側に登録します。 [OAuthクライアントの作成](https://developers.google.com/workspace/guides/create-credentials)
4. `PaperCalendar/Config/GoogleOAuth.local.xcconfig` を作成し、次の2項目に発行された値を入れます。このローカル設定ファイルはGitの管理対象外です。 [Google Sign-InのiOS設定](https://developers.google.com/identity/sign-in/ios/start-integrating)

   ```xcconfig
   GOOGLE_OAUTH_CLIENT_ID = 123456-example.apps.googleusercontent.com
   GOOGLE_OAUTH_REVERSED_CLIENT_ID = com.googleusercontent.apps.123456-example
   ```

5. Xcodeで署名して起動し、**その他 → 設定欄の「Googleカレンダー連携」**を開きます。ログイン後にテスト専用カレンダーを選び、その日付を表示します。OAuthクライアント未設定時は設定画面に案内が表示されます。

クライアントIDと逆順のURLスキームを `Info.plist` に展開します。アクセストークンと更新トークンの管理はGoogle Sign-In SDKとKeychainが行います。テスト運用では、Googleの規定によりCalendar APIの同意で発行された更新トークンが7日で失効する場合があります。失効時は連携画面から再認証してください。 [Google OAuthのトークン失効条件](https://developers.google.com/identity/protocols/oauth2#expiration)

### Google連携 Phase 1・2の検証

- WSLのSwift 6.4.2で `CalendarCore` をビルドし、既存10件とGoogle APIのモック8件が通過しました。ページ分割、繰り返し各回の取得、読み取り権限、レート制限、終日と時間指定の時差、キャンセル済み予定の除外、取得元IDを検証しました。
- Swiftコンパイラでアプリソースを構文解析し、認証サービスとViewModelをSDKのインターフェースを模した定義で型チェックしました。Xcodeプロジェクトのソース参照、SDK製品参照、OAuthの設定とURLスキームは静的に確認しました。
- Windows環境では、XcodeでのSDK解決・ビルド、Google OAuthの画面と実API、Keychainの復元、SwiftData設定の再起動後の保持、iPhoneの画面操作は未確認です。

実機の検証にはテスト専用Googleアカウントとテスト用カレンダーを使います。初回に読み取り権限を拒否してから再許可し、複数カレンダーの選択と切替を確認します。Google側でテスト予定を追加・変更・削除して「再取得」を押し、月・週・日表示への反映を確認します。終日・繰り返し予定の表示とタイムゾーン変更を試し、アプリの再起動・連携解除・再ログインでアカウントと選択設定を確認します。

## Phase 1の検証

- WSLのUbuntuでSwift 6.4.2を使い、`CalendarCore` のビルドと単体テスト10件に成功しました。`CalendarViewModel` の型チェックと、Swiftコンパイラによるアプリソースの構文解析も通過しました。
- Xcodeターゲットのソース参照、ローカルパッケージ、共有スキーム、iOS 17／iPhone向け設定を静的に確認しました。
- iOSアプリのコンパイル、画面表示、実機・シミュレータでの操作は未確認です。作業環境のWindowsではXcodeとiOSシミュレータを実行できません。

Macでシミュレータ用にビルドし、日付計算・配置の単体テストを実行するコマンドです。単体テストはうるう年、月・年境界、タイムゾーン、夏時間、午前0時終了、複数日予定の帯、重なる予定のタイムラインを対象にしています。

```sh
xcodebuild -project PaperCalendar.xcodeproj -scheme PaperCalendar \
  -destination 'generic/platform=iOS Simulator' CODE_SIGNING_ALLOWED=NO build
swift test --package-path CalendarCore
```

### シミュレータ確認項目

1. 月表示で日付を選び、「週」「日」に切り替えて選択日が引き継がれることを確認する。各表示で左右スワイプと矢印を試し、日・週・月のそれぞれの単位で移動することを確認する。縦スクロール中にページが切り替わらないことも確認する。
2. 過去のページに移動して現在のカレンダータブを再タップし、今日へ戻ることを確認する。今日の下線と選択日の背景を確認する。
3. 上部の日付からうるう日を指定し、移動とキャンセルの両方を試す。「その他」でも「今日へ」と「日付を指定」が使えることを確認する。
4. 今月中旬の複数日予定、月末から翌月に続く帯、予定が重なった場合の日表示、日付下の `+件数`、予定詳細を確認する。「＋」と「タスク」では準備中の案内が開く。
5. 「その他」で週の開始曜日と予定文字サイズを変更し、再起動後にも設定が維持されることを確認する。小型・大型iPhoneの縦画面、Dynamic Typeの最大サイズとVoiceOverで試す。
