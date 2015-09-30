/* global $, Koukun */

/*
・やる
	・ロケール取得について詳しく調べる
	・JSZipアップデート
	・html2canvasアップデート
・気が向いたら
	・ツールチップ以外のチュートリアル
	・言語選択のデザインの変更
	・シンプルモードを設けてデフォルトにする
	・いくつかのサンプルデータ
	・複数フレームの選択、グループでの選択
・メモ
	・input file を透明にして重ねる？
	・OffsetがわかったあとにDecodeする？
・データ調査
	・輪郭データがないファイルがあるか確認する
	・パレットの1280 Byteのやつ調べる
	・「guild_icon_base_color_partition.smi」でエラー
*/

// ==================================================
// 名前空間の定義
// ==================================================
(function() {
	$.extend(Koukun, {
		EffectViewer: {}
	});
})();

// ==================================================
// 定数の定義
// ==================================================
(function() {
	
	var _constant = {
		extension_effect: "sad sd rfo rbd rso smi mpr".split(" "),
		extension_palette: ["plt"],
		cookie_key_localize: "locale",
		cookie_expires: 365,
		default_language: "ja",
		background_default: "f0e3c2",
		canvas_default_width: 150,
		canvas_default_height: 150,
		animation_delay: 1000 / 16,
		shadow_pixel_data: [7, 7, 7, 0x40],
		outline_pixel_data: [1, 1, 1, 0xff],
		gifjs_quality: 5,
		gifjs_worker_count: 3,
		gifjs_worker_path: "../common-content/lib/gifjs/0.1.6/gif.worker.js"
	};
	
	$.extend(Koukun.EffectViewer, {
		Constant: new Koukun.cl.Resource(_constant)
	});
})();


// ==================================================
// メッセージの定義
// ==================================================
(function() {
	
	var _messages = {
		en: {
			button_all_clear: "All clear",
			file_info_count: "The number of frames",
			file_info_type: "Effect type",
			file_info_color: "Color type",
			button_nav_play: "Play",
			button_nav_stop: "Stop",
			control_use_palette: "Palette",
			control_use_background: "BG color",
			control_use_margin: "Adjust position",
			control_use_opacity: "Use transparency",
			control_show_body: "Body",
			control_show_shadow: "Shadow",
			control_show_outline: "Outline",
			button_save_image: "Save this image",
			button_save_all_image: "Save all images",
			button_save_gif: "Save GIF",
			output_zero_fill: "Zero-fill the number of frame",
			generate_gif_range: "Range",
			generate_gif_frame_rate: "Framerate",
			generate_gif_generate: "Generate",
			generate_gif_cancel: "Cancel",
			save_progress_cancel: "Cancel",
			
			column_name_file_name: "File name",
			column_name_file_extension: "Extension",
			column_name_frame_frame: "Frame",
			column_name_frame_width: "Width px",
			column_name_frame_height: "Height px",
			file_info_type_new: "New type",
			file_info_type_old: "Old type",
			file_info_color_high: "High color",
			file_info_color_low: "256 colors",
			select_palette_text: "Palette selection",
			select_number_text: "Number",
			select_icon: "▼",
			progress_text_default: "Ceating a file...",
			progress_text_zip: "Ceating a zip file...",
			progress_text_gif_ready: "Preparing the image data...",
			progress_text_gif_generate: "Ceating a gif file...",
			
			qtip_file_table_title: "Basic description",
			qtip_file_table_text: "You can drop the file in the \"Data\" folder of RED STONE.<br><br>" + 
				"The file that can be read as<br>\"sad sd rfo rso rbd smi mpr\" and \"plt\".",
			qtip_frame_table_title: "Table manipulation",
			qtip_frame_table_text: "Table can be operated with<br>the keyboard \"↑↓←→\".",
			qtip_palette_title: "Palette file",
			qtip_palette_text: "\"plt\" file will be added here.<br>After you have added the \"plt\" file before the effect file, it will be selected automatically.",
			qtip_colpick_title: "Background color",
			qtip_colpick_text: "If you click on this part,<br>you can select<br>the background color.",
			qtip_view_control_title: "Adjustment of the position",
			qtip_view_control_text: "\"Adjusting the position\" also includes<br>the shadow and outline.<br>If you do not check this,<br>shadow and outline can not be displayed.",
			qtip_output_zero_fill_title: "Zero-fill",
			qtip_output_zero_fill_text: "If you check this, the file name<br>will be like \"effect_0011.png\".",
			
			not_support_file_reader: "It doesn't support the file read",
			not_support_extension: "This extension can not be read",
			not_support_browser: "Not available in your browser",
			not_exact_palette: "This type does not reproduce the color",
			error_files_invalid_key: "Key is invalid",
			error_not_yet_load: "File has not been selected",
			error_read_file: "Failed to read file",
			error_analyze: "Failed to analysis part of the data",
			error_analyze_body: "Failed to parse the body data",
			error_analyze_shadow: "Failed to parse the shadow data",
			error_analyze_outline: "Failed to parse the outline data",
			error_resize_canvas: "Failed to resize the Canvas",
			error_draw: "Failed to part of the drawing",
			error_invalid_range: "Please range correctly input",
			error_out_of_range: "Entered value is out of range"
		},
		ja: {
			button_all_clear: "全てクリア",
			file_info_count: "フレーム数",
			file_info_type: "エフェクトタイプ",
			file_info_color: "色タイプ",
			button_nav_play: "再生",
			button_nav_stop: "停止",
			control_use_palette: "パレット",
			control_use_background: "背景色",
			control_use_margin: "位置の調整",
			control_use_opacity: "本体の透過",
			control_show_body: "本体の表示",
			control_show_shadow: "影の表示",
			control_show_outline: "輪郭の表示",
			button_save_image: "この画像を保存",
			button_save_all_image: "全ての画像を保存",
			button_save_gif: "GIF形式で保存",
			output_zero_fill: "フレーム数のゼロ埋め",
			generate_gif_range: "範囲",
			generate_gif_frame_rate: "フレームレート",
			generate_gif_generate: "GIF生成",
			generate_gif_cancel: "キャンセル",
			save_progress_cancel: "キャンセル",
			
			column_name_file_name: "ファイル名",
			column_name_file_extension: "拡張子",
			column_name_frame_frame: "フレ",
			column_name_frame_width: "幅 px",
			column_name_frame_height: "高さ px",
			file_info_type_new: "新タイプ",
			file_info_type_old: "旧タイプ",
			file_info_color_high: "ハイカラー",
			file_info_color_low: "256色",
			select_palette_text: "パレット選択",
			select_number_text: "番号",
			select_icon: "▼",
			progress_text_default: "ファイル作成中...",
			progress_text_zip: "zipファイルを作成中...",
			progress_text_gif_ready: "画像データを準備中...",
			progress_text_gif_generate: "gifファイルを作成中...",
			
			qtip_file_table_title: "基本的な説明",
			qtip_file_table_text: "RED STONEの「Data」フォルダ内のファイルを<br>ドロップしてください。<br><br>" +
				"読み込めるファイルは<br>「sad sd rfo rso rbd smi mpr」と「plt」です。",
			qtip_frame_table_title: "テーブル操作",
			qtip_frame_table_text: "キーボードの↑↓←→でも<br>操作できます。",
			qtip_palette_title: "パレットファイル",
			qtip_palette_text: "「plt」ファイルはここに追加されます。<br>先に追加しておくと、自動で選択されます。",
			qtip_colpick_title: "背景色",
			qtip_colpick_text: "この部分をクリックすると<br>背景色が選択できます。",
			qtip_view_control_title: "位置の調整",
			qtip_view_control_text: "「位置の調整」は影や輪郭も含みます。<br>調整しない場合、影や輪郭は表示できません。",
			qtip_output_zero_fill_title: "ゼロ埋め",
			qtip_output_zero_fill_text: "チェックすると、出力時のファイル名が<br />「effect_0011.png」のようになります。",
			
			not_support_file_reader: "ファイル読み込みに対応していません",
			not_support_extension: "読み込めない拡張子です",
			not_support_browser: "現在のブラウザでは利用できません",
			not_exact_palette: "このタイプは色が再現できません",
			error_files_invalid_key: "keyが不正",
			error_not_yet_load: "ファイルを読み込んでいません",
			error_read_file: "ファイル読み込みに失敗しました",
			error_analyze: "一部のデータ解析に失敗しました",
			error_analyze_body: "本体データの解析に失敗しました",
			error_analyze_shadow: "影データの解析に失敗しました",
			error_analyze_outline: "輪郭データの解析に失敗しました",
			error_resize_canvas: "Canvasのサイズ変更に失敗しました",
			error_draw: "一部の描画に失敗しました",
			error_invalid_range: "範囲を正しく入力してください",
			error_out_of_range: "入力された値が範囲外です"
		}
	};
	
	$.extend(Koukun.EffectViewer, {
		Message: new Koukun.cl.Globalize(_messages)
	});
})();


// ==================================================
// 言語選択
// ==================================================
(function() {
	var _Constant = Koukun.EffectViewer.Constant;
	
	var storedLang = $.cookie(_Constant.get("cookie_key_localize"));
	var browserLang = Koukun.fn.getLanguage();
	var defaultLang = _Constant.get("default_language");
	
	Koukun.EffectViewer.Message.selectLanguage(storedLang || browserLang || defaultLang);
})();
