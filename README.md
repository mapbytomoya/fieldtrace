# FieldTrace

A privacy-first story map for visualizing photo and video location metadata.

**公開版: https://mapbytomoya.github.io/fieldtrace/**

写真・動画ファイルに保存された撮影日時と位置情報（メタデータ）を読み取り、地図とタイムラインに表示するローカルWebアプリです。

> この記録は、写真・動画に保存された撮影日時・位置情報をもとに事後的に可視化したものです。連続的なGPSトラッキング記録ではありません。

- バックエンドなし。ファイルはブラウザ内だけで処理し、サーバーへ送信しません。
- 地図タイルは OpenStreetMap から取得します（表示範囲のタイル画像を取得するための通信が発生します。メディアやメタデータは送信しません）。
- APIキーは不要です。

## 公開版の使い方

上記 URL をブラウザで開くだけで使えます。インストールやアカウント登録は不要です。
公開版でも、読み込んだ写真・動画とメタデータはサーバーへ送信されず、閲覧しているブラウザ内だけで処理されます。入力内容はそのブラウザの localStorage に保存され、他の人には共有されません。

## ローカルでの起動方法

Node.js 20.19 以上（または 22.12 以上）が必要です。

```bash
npm install
npm run dev
```

表示された URL（通常 http://localhost:5173 ）をブラウザで開きます。

本番用ビルド:

```bash
npm run build
npm run preview
```

## 操作方法

### 1. イベント情報

画面上部の「イベント情報を編集」から、イベント名・会場名・開催日・会場の緯度経度・記録についての説明を入力します。会場の緯度経度は「地図をクリックして指定」でも入力できます。

### 2. 写真・動画の読み込み

- 「ファイルを選択」、またはファイルを画面にドロップします（複数可）。
- 対応形式: JPEG / HEIC / PNG / MOV / MP4
- 読み取る項目:
  - 写真: EXIF の DateTimeOriginal（なければ CreateDate / ModifyDate）、OffsetTimeOriginal、GPSLatitude / GPSLongitude、GPSHPositioningError、機種
  - 動画: QuickTime の `com.apple.quicktime.creationdate`、`com.apple.quicktime.location.ISO6709`、`©xyz`。日時がない場合は `mvhd` の作成時刻（UTC）
- 読み取れなかった項目は空欄のまま「未取得」と表示します。推測で補完しません。

### 3. 手動入力

右側の詳細欄で「情報を編集」を押すと、タイトル・メモ・分類・撮影日時・緯度経度を入力できます。

- 手動入力した値には「手動入力」、ファイルから読み取った値には「メタデータから取得」と表示します。
- 手動入力はメタデータの値を上書きせず、別に保存します。「手動入力を消去」でメタデータの値に戻せます。
- 地図上で手動入力された地点は破線の丸で表示します。

### 4. 地図とタイムライン

- 位置情報があるメディアを、撮影日時順の番号付きマーカーで表示します。マーカーを押すとプレビュー・撮影日時・座標・メモ・取得方法を表示します。
- 複数地点は撮影日時順に破線で結びます。これは撮影地点を結んだ直線で、実際の移動経路ではありません。
- 下部の一覧（撮影日時順）の項目を押すと、地図が該当地点へ移動します。

### 5. 会場からの距離と分類

- 会場の緯度経度を入力すると、各メディアの撮影地点との直線距離（Haversine公式）を「会場から約120mの地点で撮影」の形式で表示します。
- 分類（会場内 / 会場付近 / 移動中 / その他）は記録者が設定する項目で、「記録者が設定」と併記します。距離から自動判定はしません。

### 6. 保存・書き出し

- イベント情報・メタデータ・入力内容・サムネイルはブラウザの localStorage に自動保存され、再読み込み後も復元されます。
- 写真・動画の本体は保存されません。再読み込み後に表示・再生するには、同じファイルを選択し直してください（ファイル名とサイズで照合し、既存の記録に再接続します）。
- 「JSONを書き出す」で登録データを JSON ファイルに保存し、「JSONを読み込む」で復元できます。

### 7. 閲覧モード・印刷

- 「閲覧モード」では編集ボタンとファイル選択欄を非表示にします。
- 「印刷 / PDF保存」でブラウザの印刷画面を開きます。印刷時はイベント情報・注意書き・地図・各メディアのプレビュー（動画は代表フレーム）・撮影日時・座標・会場からの距離・取得方法を出力します。PDF にする場合は印刷先で「PDFに保存」を選択してください。地図タイルの読み込みが終わってから印刷してください。

## 制限事項

- HEIC 画像は Safari 以外のブラウザでは表示できない場合があります（メタデータの読み取りは可能です）。その場合は JPEG に変換してください。
- HEVC（H.265）の動画は、ブラウザによって再生できない場合があります。
- iPhone から AirDrop・メッセージ・一部のクラウドサービス経由で転送したファイルは、位置情報が削除されていることがあります。「写真」アプリの共有オプションで位置情報を含めるか、Mac の「写真」から「未編集のオリジナルを書き出す」を使用してください。
- タイムゾーン情報のない撮影日時は、閲覧している端末の時刻帯として並べ替えます。
- localStorage の容量（約5MB）を超える場合はサムネイルを除いて保存します。

## ファイル構成

```
src/
  main.tsx                 エントリポイント
  App.tsx                  画面全体の状態管理とレイアウト
  types.ts                 データ型
  styles.css               画面・印刷用スタイル
  lib/metadata.ts          形式判定と EXIF 読み取り（exifr）
  lib/quicktime.ts         MOV / MP4 のメタデータ解析
  lib/derive.ts            手動入力値とメタデータ値の統合、並べ替え、距離計算
  lib/geo.ts               Haversine 距離と座標表示
  lib/format.ts            日時・サイズ表示
  lib/thumbnail.ts         サムネイル・動画の代表フレーム作成
  lib/storage.ts           localStorage 保存と JSON 検証
  components/MapView.tsx   Leaflet 地図・マーカー・ポップアップ
  components/DetailPanel.tsx  選択中メディアの詳細と編集フォーム
  components/Timeline.tsx  撮影日時順の一覧
  components/EventInfoView.tsx  イベント情報の表示と編集
  components/MediaPreview.tsx   写真・動画プレビューとエラー表示
  components/PrintReport.tsx    印刷用の一覧
  components/DropZone.tsx       ファイル選択・ドロップ欄
  components/SourceBadge.tsx    取得方法の表示
  components/Icons.tsx          線画アイコン
```

## 公開（GitHub Pages）

`main` ブランチへ push すると、GitHub Actions（`.github/workflows/deploy.yml`）がビルドして GitHub Pages に公開します。

## ライセンス

[Creative Commons Attribution 4.0 International (CC BY 4.0)](https://creativecommons.org/licenses/by/4.0/)

Copyright (c) 2026 mapbytomoya

利用・改変・再配布は自由ですが、クレジット（作者名とリポジトリURL）の表示が必要です。全文は [LICENSE](LICENSE) を参照してください。

地図データ: © OpenStreetMap contributors（ODbL）。使用ライブラリはそれぞれのライセンスに従います（React / Leaflet / react-leaflet / exifr ほか）。
