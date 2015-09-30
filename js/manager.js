/* global $, Koukun */

// ==================================================
// 各マネージャクラスの定義
// ==================================================
(function(undefined) {
	
	var _App = Koukun.EffectViewer;
	var _Constant = Koukun.EffectViewer.Constant;
	var _Message = Koukun.EffectViewer.Message;
	
	
	// -----------------------------------
	// FileManager Class
	function FileManager() {
		this.effectFilesData = [];
		this.paletteFilesData = [];
		
		this.effectFile;
		this.paletteFile;
		
		this.zipFile;
		this.zipFrameCount = 0;
		this.zipMaxCount = 0;
		this.zipEffectName = "";
		
		this.gifFile;
		this.gifFrameCount = 0;
		this.gifMinCount = 0;
		this.gifMaxCount = 0;
		this.gifDelay = _Constant.get("animation_delay");
		this.gifEffectName = "";
	}
	
	FileManager.prototype = {
		
		initialize: function() {
			
		},
		
		get: function(key) {
			if (!this.effectFilesData[key]) {
				_App.logger.error(_Message.get("error_files_invalid_key"));
			} else {
				return this.effectFilesData[key];
			}
		},
		
		addEffect: function(fileInfo, buffer) {
			var key = this.effectFilesData.length;
			
			this.effectFilesData[key] = {
				fileInfo: fileInfo,
				buffer: buffer
			};
			
			return key;
		},
		
		removeAllEffect: function() {
			this.effectFile = null;
			this.effectFilesData = [];
		},
		
		addPalette: function(fileInfo, buffer) {
			var key = this.paletteFilesData.length;
			
			this.paletteFilesData[key] = {
				fileInfo: fileInfo,
				buffer: buffer
			};
			
			return key;
		},
		
		removeAllPalette: function() {
			this.paletteFile = null;
			this.paletteFilesData = [];
		},
		
		readFiles: function(fileList) {
			var that = this;
			
			// Read files
			$.each(fileList, function(key, file) {
				var fileReader = new FileReader();
				var $dfd_readFile = new $.Deferred();
				var isFirstFile = key === 0;
				
				fileReader.onload = $.proxy(that.onSuccessReadFile, that, file, isFirstFile);
				fileReader.onerror = $.proxy(that.onErrorReadFile, that);
				fileReader.readAsArrayBuffer(file);
			});
		},
		
		onSuccessReadFile: function(file, isFirstFile, ev) {
			var fileInfo = new _App.FileInfo(file);
			var buffer = ev.target.result;
			var fileIndex;
			
			if (!fileInfo.isEffectFile && !fileInfo.isPaletteFile) {
				_App.uiManager.notice(_Message.get("not_support_extension"));
				return;
			}
			
			if (fileInfo.isEffectFile) {
				fileKey = this.addEffect(fileInfo, buffer);
				
				_App.uiManager.addToFileList({
					name: fileInfo.nameWithoutExtension,
					extension: fileInfo.extension
				}, isFirstFile);
			}
			
			if (fileInfo.isPaletteFile) {
				fileKey = this.addPalette(fileInfo, buffer);
				_App.uiManager.addPaletteData(fileKey, fileInfo);
			}
		},
		
		onErrorReadFile: function() {
			_App.uiManager.notice(_Message.get("error_read_file"));
		},
		
		loadEffect: function(index) {
			var fileData = this.effectFilesData[index];
			this.effectFile = new _App.EffectFile(fileData);
			this.effectFile.analyze();
			
			_App.uiManager.updateEffectInfo();
			_App.uiManager.updateFrameList();
			_App.uiManager.updateViewControl();
		},
		
		loadPalette: function(index) {
			var fileData = this.paletteFilesData[index];
			this.paletteFile = new _App.PaletteFile(fileData);
			this.paletteFile.analyze();
		},
		
		autoSelectPalette: function(rowIndex) {
			var targetData = this.effectFilesData[rowIndex]
			var targetName = targetData.fileInfo.nameWithoutExtension.toLowerCase();
			var isSuccess = false;
			
			$.each(this.paletteFilesData, function(i, fileData) {
				if (fileData.fileInfo.nameWithoutExtension.toLowerCase() === targetName) {
					_App.uiManager.uiSelect_palette.select(i);
					isSuccess = true;
					return false;
				}
			});
			
			_App.uiManager.$viewUsePalette.prop("checked", isSuccess).trigger("change");
		},
		
		// Save file
		saveImage: function() {
			if (!this.effectFile) {
				_App.uiManager.notice(_Message.get("error_not_yet_load"));
				return;
			}
			
			var canvas = _App.canvasManager.getCanvasElement();
			var effectName = this.effectFile.fileInfo.nameWithoutExtension;
			var isSaveUseZeroFill = _App.uiManager.isSaveUseZeroFill;
			var selectedFrame = _App.uiManager.selectedFrameIndex;
			var frame = isSaveUseZeroFill ? ("000" + selectedFrame).slice(-4) : selectedFrame;
			var fileName = effectName + "_" + frame + ".png";
			_App.fileSaver.saveCanvas(canvas, fileName);
		},
		
		// Save Zip
		saveZip: function() {
			if (!this.effectFile) {
				_App.uiManager.notice(_Message.get("error_not_yet_load"));
				return;
			}
			
			this.generateZip();
		},
		
		generateZip: function() {
			_App.uiManager.setProgressText(_Message.get("progress_text_zip"));
			_App.uiManager.showProgress();
			_App.uiManager.uiGrid_frameList.navigateStop();
			
			this.zipFile = new JSZip();
			this.zipFrameCount = 0;
			this.zipMaxCount = this.effectFile.frameCount;
			this.zipEffectName = this.effectFile.fileInfo.nameWithoutExtension;
			
			this._generateZipLoop();
		},
		
		_generateZipLoop: function() {
			// TODO: 綺麗に書き直す
			// TODO: setZeroTimeout
			
			if (_App.uiManager.isFileSaveCanceled) {
				this._generateZipCanceled();
				return;
			}
			
			_App.fileManager.effectFile.draw(this.zipFrameCount);
			
			var that = this;
			var isSaveUseZeroFill = _App.uiManager.isSaveUseZeroFill;
			var rate = Math.round((this.zipFrameCount + 1) * 100 / this.zipMaxCount);
			var frame = isSaveUseZeroFill ? ("000" + this.zipFrameCount).slice(-4) : this.zipFrameCount;
			var imageName = this.zipEffectName + "_" + frame + ".png";
			var imageData = _App.canvasManager.getDataURL().replace("data:image/png;base64,", "");
			
			_App.uiManager.updateProgress(rate);
			
			this.zipFile.file(imageName, imageData, {base64: true});
			this.zipFrameCount++;
			
			if (this.zipFrameCount === this.zipMaxCount) {
				this._generateZipFinished();
				return;
			}
			
			Koukun.fn.setZeroTimeout(function() {
				that._generateZipLoop();
			});
		},
		
		_generateZipFinished: function() {
			var zipBlob = this.zipFile.generate({type: "blob"});
			var zipName = this.zipEffectName + "_0-" + (this.zipMaxCount - 1) + ".zip";
			
			_App.fileSaver.save(zipBlob, zipName);
			this._generateZipAlways();
		},
		
		_generateZipCanceled: function() {
			this._generateZipAlways();
		},
		
		_generateZipAlways: function() {
			this.zipFile = null;
			this.effectFile.draw(_App.uiManager.uiGrid_frameList.getSelectedIndex());
			_App.uiManager.hideProgress();
		},
		
		// Save Gif
		saveGif: function() {
			if (!window.Worker) {
				_App.uiManager.notice(_Message.get("not_support_browser"));
			}
			
			if (!this.effectFile) {
				_App.uiManager.notice(_Message.get("error_not_yet_load"));
				return;
			}
			
			_App.uiManager.showGifGenerator();
		},
		
		generateGif: function() {
			var gifRangeMin = _App.uiManager.numinGifRangeMin.getValue();
			var gifRangeMax = _App.uiManager.numinGifRangeMax.getValue();
			var gifFramerate = _App.uiManager.numinGifFramerate.getValue();
			var maxFrameCount = this.effectFile.frameCount;
			
			if (gifRangeMin > gifRangeMax) {
				_App.uiManager.notice(_Message.get("error_invalid_range"));
				return;
			}
			
			if (gifRangeMin >= maxFrameCount || gifRangeMax >= maxFrameCount) {
				_App.uiManager.notice(_Message.get("error_out_of_range"));
				return;
			}
			
			_App.uiManager.setProgressText(_Message.get("progress_text_gif_ready"));
			_App.uiManager.showProgress();
			_App.uiManager.uiGrid_frameList.navigateStop();
			
			this.gifFile = new GIF({
				width: this.effectFile.maxSizeInfo.outerWidth,
				height: this.effectFile.maxSizeInfo.outerHeight,
				quality: _Constant.get("gifjs_quality"),
				workers: _Constant.get("gifjs_worker_count"),
				workerScript: _Constant.get("gifjs_worker_path"),
				transparent: _App.uiManager.isViewUseBackground ? null : 0x000000
			});
			this.gifFrameCount = gifRangeMin;
			this.gifMinCount = gifRangeMin;
			this.gifMaxCount = gifRangeMax + 1;
			this.gifDelay = gifFramerate ? 1000 / gifFramerate : _Constant.get("animation_delay");
			this.gifEffectName = this.effectFile.fileInfo.nameWithoutExtension;
			
			this._generateGifLoop();
		},
		
		_generateGifLoop: function() {
			if (_App.uiManager.isFileSaveCanceled) {
				this._generateGifCanceled();
				return;
			}
			
			_App.fileManager.effectFile.draw(this.gifFrameCount);
			
			var that = this;
			var rate = Math.round((this.gifFrameCount + 1) * 100 / this.gifMaxCount);
			var imageData = _App.canvasManager.getContext();
			
			_App.uiManager.updateProgress(rate);
			
			this.gifFile.addFrame(imageData, {
				delay: this.gifDelay,
				copy: true
			});
			this.gifFrameCount++;
			
			if (this.gifFrameCount === this.gifMaxCount) {
				this._generateGifFinished();
				return;
			}
			
			Koukun.fn.setZeroTimeout(function() {
				that._generateGifLoop();
			});
		},
		
		_generateGifFinished: function() {
			var that = this;
			var gifName = this.gifEffectName + "_" + this.gifMinCount +"-" + (this.gifMaxCount - 1) + ".gif";
			
			this.gifFile.on("finished", function(blob) {
				_App.fileSaver.save(blob, gifName);
				that._generateGifAlways();
			});
			
			this.gifFile.on("progress", function(rate) {
				if (_App.uiManager.isFileSaveCanceled) {
					that.gifFile.abort();
					that.gifFile.freeWorkers.forEach(function(w, i) {
						w.terminate()
					});
					that._generateGifCanceled();
					return;
				}
				
				_App.uiManager.updateProgress(Math.floor(rate * 100));
			});
			
			_App.uiManager.setProgressText(_Message.get("progress_text_gif_generate"));
			this.gifFile.render();
		},
		
		_generateGifCanceled: function() {
			this._generateGifAlways();
		},
		
		_generateGifAlways: function() {
			this.gifFile = null;
			this.effectFile.draw(_App.uiManager.uiGrid_frameList.getSelectedIndex());
			_App.uiManager.hideProgress();
		}
	};
	
	
	// -----------------------------------
	// UIManager Class
	function UIManager() {
		this.$effectViewer = $(".effect-viewer");
		this.$maskDrop = $(".mask-drop");
		this.$notice = $(".notice");
		this.$languageSelect = $(".language-switcher").find("select");
		this.$colorPicker = $(".color-picker");
		
		this.uiGrid_fileList;
		this.uiGrid_frameList;
		this.uiSelect_palette;
		this.uiSelect_paletteNumber;
		this.selectPaletteData;
		this.selectPaletteNumberData;
		this.numinGifRangeMin;
		this.numinGifRangeMax;
		this.numinGifFramerate;
		
		this.selectedPaletteNumber = -1;
		this.selectedFrameIndex = -1;
		
		// View Control
		this.$viewShowBody = $(".view-show-body");
		this.$viewShowShadow = $(".view-show-shadow");
		this.$viewShowOutline = $(".view-show-outline");
		this.$viewUsePalette = $(".view-use-palette");
		this.$viewUseBackground = $(".view-use-background");
		this.$viewUseMargin = $(".view-use-margin");
		this.$viewUseOpacity = $(".view-use-opacity");
		this.isViewUseOpacity = false;
		this.isViewUseMargin = false;
		this.isViewUseBackground = false;
		this.isViewUsePalette = false;
		this.isViewShowBody = false;
		this.isViewShowShadow = false;
		this.isViewShowOutline = false;
		
		// Save Control
		this.$saveZeroFill = $(".output-zero-fill");
		this.isSaveUseZeroFill = false;
		this.isFileSaveCanceled = false;
		
		// Save Gif
		this.$maskGif = $(".mask-gif");
		
		// Save Progress
		this.progressText = _Message.get("progress_text_default");
		this.$maskProgress = $(".mask-progress");
		this.$saveProgressText = $(".save-progress-text");
		this.$saveProgressParent = $(".save-progress-parent");
		this.$saveProgressChild = this.$saveProgressParent.find("div");
	}
	
	UIManager.prototype = {
		
		initialize: function() {
			this._setViewText();
			this._setInputValue();
			this._createGrid_fileList();
			this._createGrid_frameList();
			this._createSelect_Palette();
			this._createSelect_PaletteNumber();
			this._createColorPicker();
			this._createNumin_gifRange();
			this._createQtip();
			this._setEventHandler();
			this._checkControl();
		},
		
		notice: function (text, delay) {
			this.$notice.text(text)
				.stop(true, true).hide().fadeIn(300).delay(delay || 2000).fadeOut(500);
			_App.logger.log("Notice", text, "#edf");
		},
		
		addToFileList: function(data, autoSelect) {
			this.uiGrid_fileList.add(data);
			autoSelect && this.uiGrid_fileList.navigateBottom();
		},
		
		addPaletteData: function(index, fileInfo) {
			this.selectPaletteData[0].options.push({
				key: index,
				value: fileInfo.nameWithoutExtension
			});
			this.uiSelect_palette.reset({}, this.selectPaletteData);
			this.uiSelect_palette.select(index);
		},
		
		setPaletteNumber: function(data) {
			this.uiSelect_paletteNumber.reset({}, data);
			this.uiSelect_paletteNumber.select(0);
		},
		
		_setEventHandler: function() {
			var that = this;
			
			// Language Switcher
			this.$languageSelect.on("change", $.proxy(this.onChangeLangSwitch, this));
			
			// Drop Area
			this.$effectViewer
				.on("dragenter", $.proxy(this.onDragEnter, this))
				.on("drop dragover dragleave", false);
			
			this.$maskDrop
				.on("drop", $.proxy(this.onDropFile, this))
				.on("mouseout dragleave", $.proxy(this.onDragLeave, this))
				.on("dragover dragenter", false)
			
			$(document).on("drop dragover dragenter dragleave", false);
			
			// fileList
			$(".file-list-nav-clear").on("click", $.proxy(this.onClickClearAll, this));
			
			// frameList
			$(".frame-list-nav-up").on("click", function() {that.uiGrid_frameList.navigateUp()});
			$(".frame-list-nav-down").on("click", function() {that.uiGrid_frameList.navigateDown()});
			$(".frame-list-nav-play").on("click", function() {that.uiGrid_frameList.navigatePlay()});
			$(".frame-list-nav-stop").on("click", function() {that.uiGrid_frameList.navigateStop()});
			
			// view control
			this.$viewShowBody.on("change", $.proxy(this.onClickViewShowBody, this));
			this.$viewShowShadow.on("change", $.proxy(this.onClickViewShowShadow, this));
			this.$viewShowOutline.on("change", $.proxy(this.onClickViewShowOutline, this));
			this.$viewUsePalette.on("change", $.proxy(this.onClickViewUsePalette, this));
			this.$viewUseBackground.on("change", $.proxy(this.onClickViewUseBackground, this));
			this.$viewUseMargin.on("change", $.proxy(this.onClickViewUseMargin, this));
			this.$viewUseOpacity.on("change", $.proxy(this.onClickViewUseOpacity, this));
			
			// Save
			$(".save-image").on("click", $.proxy(this.onClickSaveImage, this));
			$(".save-all-image").on("click", $.proxy(this.onClickSaveZip, this));
			$(".save-gif").on("click", $.proxy(this.onClickSaveGif, this));
			this.$saveZeroFill.on("change", $.proxy(this.onClickSaveUseZeroFill, this));
			
			// Save Progress
			$(".save-progress-cancel").on("click", $.proxy(this.onClickSaveCancel, this));
			
			// Gif Generator
			$(".generate-gif-generate").on("click", $.proxy(this.onClickGifGenerate, this));
			$(".generate-gif-cancel").on("click", $.proxy(this.onClickGifCancel, this));
		},
		
		_setViewText: function() {
			$(".file-list-nav-clear").text(_Message.get("button_all_clear"));
			$(".file-info-count-text").text(_Message.get("file_info_count"));
			$(".file-info-type-text").text(_Message.get("file_info_type"));
			$(".file-info-color-text").text(_Message.get("file_info_color"));
			$(".frame-list-nav-play").text(_Message.get("button_nav_play"));
			$(".frame-list-nav-stop").text(_Message.get("button_nav_stop"));
			
			this.$viewUsePalette.next().text(_Message.get("control_use_palette"));
			this.$viewUseBackground.next().text(_Message.get("control_use_background"));
			this.$viewUseMargin.next().text(_Message.get("control_use_margin"));
			this.$viewUseOpacity.next().text(_Message.get("control_use_opacity"));
			this.$viewShowBody.next().text(_Message.get("control_show_body"));
			this.$viewShowShadow.next().text(_Message.get("control_show_shadow"));
			this.$viewShowOutline.next().text(_Message.get("control_show_outline"));
			
			$(".save-image").text(_Message.get("button_save_image"));
			$(".save-all-image").text(_Message.get("button_save_all_image"));
			$(".save-gif").text(_Message.get("button_save_gif"));
			$(".output-zero-fill").next().text(_Message.get("output_zero_fill"));
			
			$(".generate-gif-range-text").text(_Message.get("generate_gif_range"));
			$(".generate-gif-frame-rate-text").text(_Message.get("generate_gif_frame_rate"));
			$(".generate-gif-generate").val(_Message.get("generate_gif_generate"));
			$(".generate-gif-cancel").val(_Message.get("generate_gif_cancel"));
			$(".save-progress-cancel").val(_Message.get("save_progress_cancel"));
		},
		
		_setInputValue: function() {
			this.$languageSelect.val(_Message.getLanguage());
		},
		
		_createGrid_fileList: function() {
			var options = {
				containerWidth: 305,
				containerHeight: 189,
				headerRowHeight: 18,
				rowHeight: 18,
				autoScrollMargin: 28,
				allowLoop: true,
				allowReselect: false,
				onSelectRow: $.proxy(this.onSelectFileList, this)
			};
			var columns = [
				{field: "name", name: _Message.get("column_name_file_name"), width: 224},
				{field: "extension", name: _Message.get("column_name_file_extension"), width: 60}
			];
			var data = [];
			
			this.uiGrid_fileList = new Koukun.cl.UI_Grid(options, columns, data);
			
			$(".file-list").append(this.uiGrid_fileList.getContainer());
			
			this.uiGrid_fileList.selectRow(0);
		},
		
		_createGrid_frameList: function() {
			var options = {
				containerWidth: 180,
				containerHeight: 275,
				headerRowHeight: 18,
				rowHeight: 18,
				autoScrollMargin: 28,
				animationInterval: 1000 / 16,
				allowLoop: true,
				allowReselect: false,
				onSelectRow: $.proxy(this.onSelectFrameList, this)
			};
			var columns = [
				{field: "frame", name: _Message.get("column_name_frame_frame"), width: 52},
				{field: "width", name: _Message.get("column_name_frame_width"), width: 53},
				{field: "height", name: _Message.get("column_name_frame_height"), width: 53}
			];
			var data = [];
			
			this.uiGrid_frameList = new Koukun.cl.UI_Grid(options, columns, data);
			
			$(".frame-list").append(this.uiGrid_frameList.getContainer());
			
			this.uiGrid_frameList.selectRow(0);
		},
		
		_createSelect_Palette: function() {
			var selectOption = {
				selectWidth: 100,
				listWidth: 240,
				optionWidth: 100,
				isPanelView: false,
				initText: _Message.get("select_palette_text"),
				selectIcon: _Message.get("select_icon"),
				openListenerType: "hover",
				onClick_option: $.proxy(this.onSelectPalette, this)
			};
			
			this.selectPaletteData = [{
				groupName: "",
				options: []
			}];
			
			this.uiSelect_palette = new Koukun.cl.UI_Select(selectOption, this.selectPaletteData);
			
			$(".palette-select").append(this.uiSelect_palette.getContainer());
		},
		
		_createSelect_PaletteNumber: function() {
			var selectOption = {
				selectWidth: 45,
				listWidth: 90,
				optionWidth: 35,
				isPanelView: false,
				initText: _Message.get("select_number_text"),
				selectIcon: _Message.get("select_icon"),
				openListenerType: "hover",
				onClick_option: $.proxy(this.onSelectPaletteNumber, this)
			};
			
			this.selectPaletteNumberData = [{
				groupName: "",
				options: []
			}];
			
			this.uiSelect_paletteNumber = new Koukun.cl.UI_Select(selectOption, this.selectPaletteNumberData);
			
			$(".palette-number-select").append(this.uiSelect_paletteNumber.getContainer());
		},
		
		_createColorPicker: function() {
			var that = this;
			var backgroundHex = $.cookie("colpick_background_hex") || _Constant.get("background_default");
			
			this.$colorPicker.colpick({
				colorScheme: "light",
				layout: "rgbhex",
				color: backgroundHex,
				onSubmit:function(hsb, hex, rgb, elememt) {
					$.cookie("colpick_background_hex", hex, {expires: _Constant.get("cookie_expires")});
					_App.canvasManager.backgroundColor = [rgb.r, rgb.g, rgb.b, 0xff];
					that.$colorPicker.css("background-color", "#" + hex);
					that.$colorPicker.colpickHide();
					that.redrawShape();
				}
			}).css("background-color", "#" + backgroundHex);
		},
		
		_createNumin_gifRange: function() {
			
			this.numinGifRangeMin = new Koukun.cl.UI_NumberInput({
				selectWidth: 50,
				listMarginLeft: 0,
				initText: 0,
				maxLength: 4,
				selectIcon: "▼",
				openListenerType: "hover", // click/hover
				onChange: $.proxy(this._setMonsterDetails, this)
			});
			
			this.numinGifRangeMax = new Koukun.cl.UI_NumberInput({
				selectWidth: 50,
				listMarginLeft: 0,
				initText: 0,
				maxLength: 4,
				selectIcon: "▼",
				openListenerType: "hover", // click/hover
				onChange: $.proxy(this._setMonsterDetails, this)
			});
			
			this.numinGifFramerate = new Koukun.cl.UI_NumberInput({
				selectWidth: 50,
				listMarginLeft: 0,
				initText: 16,
				maxLength: 2,
				selectIcon: "▼",
				openListenerType: "hover", // click/hover
				onChange: $.proxy(this._setMonsterDetails, this)
			});
			
			$(".numin-gif-range-min").append(this.numinGifRangeMin.getContainer());
			$(".numin-gif-range-max").append(this.numinGifRangeMax.getContainer());
			$(".numin-gif-frame-rate").append(this.numinGifFramerate.getContainer());
		},
		
		_createQtip: function() {
			var defaults = {
				prerender: true,
				style: "qtip-light qtip-shadow qtip-rounded qtip-koukun-style",
				show: ""
			};
			
			$(".file-list").qtip($.extend({}, defaults, {
				content: {title: _Message.get("qtip_file_table_title"), text: _Message.get("qtip_file_table_text")},
				position: {my: "top center", at: "top center"}
			}));
			
			$(".frame-list").qtip($.extend({}, defaults, {
				content: {title: _Message.get("qtip_frame_table_title"), text: _Message.get("qtip_frame_table_text")},
				position: {my: "top center", at: "top center"}
			}));
			
			$(".palette-select").qtip($.extend({}, defaults, {
				content: {title: _Message.get("qtip_palette_title"), text: _Message.get("qtip_palette_text")},
				position: {my: "bottom left", at: "top center"}
			}));
			
			$(".color-picker").qtip($.extend({}, defaults, {
				content: {title: _Message.get("qtip_colpick_title"), text: _Message.get("qtip_colpick_text")},
				position: {my: "top left", at: "bottom center"}
			}));
			
			$(".view-control-container").qtip($.extend({}, defaults, {
				content: {title: _Message.get("qtip_view_control_title"), text: _Message.get("qtip_view_control_text")},
				position: {my: "top center",at: "bottom center"}
			}));
			
			$(".image-output-area").qtip($.extend({}, defaults, {
				content: {title: _Message.get("qtip_output_zero_fill_title"), text: _Message.get("qtip_output_zero_fill_text")},
				position: {my: "bottom right", at: "top right"}
			}));
			
			$(".show-qtip-target").hover(function() {
				$(".show-qtip").qtip('toggle', true);
			}, function() {
				$(".show-qtip").qtip('toggle', false);
			});
		},
		
		_checkControl: function() {
			this.isViewUseOpacity = this.$viewUseOpacity.is(":checked");
			this.isViewUseMargin = this.$viewUseMargin.is(":checked");
			this.isViewUseBackground = this.$viewUseBackground.is(":checked");
			this.isViewUsePalette = this.$viewUsePalette.is(":checked");
			this.isViewShowBody = this.$viewShowBody.is(":checked");
			this.isViewShowShadow = this.$viewShowShadow.is(":checked");
			this.isViewShowOutline = this.$viewShowOutline.is(":checked");
			this.isSaveUseZeroFill = this.$saveZeroFill.is(":checked");
		},
		
		updateEffectInfo: function() {
			var effectFile = _App.fileManager.effectFile;
			$(".file-info-count").text(effectFile.frameCount);
			$(".file-info-type").text(effectFile.isNewType ? _Message.get("file_info_type_new") : _Message.get("file_info_type_old"));
			$(".file-info-color").text(effectFile.isHighColor ? _Message.get("file_info_color_high") : _Message.get("file_info_color_low"));
		},
		
		updateFrameList: function() {
			var effectFile = _App.fileManager.effectFile;
			var datas = [];
			
			for (var i = 0; i < effectFile.frameCount; i++) {
				datas.push({
					frame: i,
					width: effectFile.shape.body.width[i],
					height: effectFile.shape.body.height[i]
				});
			}
			
			this.uiGrid_frameList.resetDatas(datas);
			this.uiGrid_frameList.selectRow(0);
		},
		
		updateViewControl: function() {
			if (!_App.fileManager.effectFile) {
				return;
			}
			
			var isExistShadow = _App.fileManager.effectFile.isExistShadow;
			var isExistOutline = _App.fileManager.effectFile.isExistOutline;
			
			this.$viewShowShadow.parent().toggle(this.isViewUseMargin && isExistShadow);
			this.$viewShowOutline.parent().toggle(this.isViewUseMargin && isExistOutline);
		},
		
		redrawShape: function() {
			_App.fileManager.effectFile && _App.fileManager.effectFile.redraw();
		},
		
		// Save progress
		showProgress: function() {
			this.$maskProgress.show();
		},
		
		hideProgress: function() {
			this.$maskProgress.hide();
		},
		
		updateProgress: function(rate) {
			var progressText = this.progressText;
			this.$saveProgressChild.css("width", rate + "%");
			this.$saveProgressText.text(progressText + "(" + rate + "％)");
		},
		
		setProgressText: function(text) {
			this.progressText = text;
		},
		
		
		// Save Gif
		showGifGenerator: function() {
			this.$maskGif.show();
		},
		
		hideGifGenerator: function() {
			this.$maskGif.hide();
		},
		
		// Event Language Switcher
		onChangeLangSwitch: function() {
			var nextLanguage = this.$languageSelect.val();
			$.cookie(_Constant.get("cookie_key_localize"), nextLanguage, {
				expires: _Constant.get("cookie_expires")
			});
			document.location.reload(true);
		},
		
		// Event drag/drop
		onDragEnter: function() {
			this.$maskDrop.show();
		},
		
		onDragLeave: function() {
			this.$maskDrop.hide();
		},
		
		onDropFile: function(ev) {
			var orgEvent = ev.originalEvent;
			var fileList = orgEvent.dataTransfer && orgEvent.dataTransfer.files;
			
			this.$maskDrop.hide();
			
			if (fileList) {
				_App.fileManager.readFiles(fileList);
			} else {
				_App.uiManager.notice(_Message.get("error_read_file"));
			}
		},
		
		onSelectFileList: function(rowIndex, rowData) {
			this.uiGrid_frameList.navigateStop();
			_App.fileManager.autoSelectPalette(rowIndex);
			_App.fileManager.loadEffect(rowIndex);
		},
		
		onSelectFrameList: function(rowIndex, rowData) {
			this.selectedFrameIndex = rowIndex;
			_App.fileManager.effectFile.draw(rowIndex);
		},
		
		onSelectPalette: function(index) {
			_App.fileManager.loadPalette(index);
		},
		
		onSelectPaletteNumber: function(index) {
			this.selectedPaletteNumber = index;
			this.redrawShape();
		},
		
		onClickClearAll: function() {
			this.uiGrid_frameList.clear();
			this.uiGrid_fileList.clear();
			this.uiSelect_palette.reset({}, []);
			this.uiSelect_paletteNumber.reset({}, []);
			this.selectPaletteData = [{
				groupName: "",
				options: []
			}];
			_App.fileManager.removeAllEffect();
			_App.fileManager.removeAllPalette();
			_App.canvasManager.clear();
			_App.canvasManager.update();
			_App.canvasManager.initialize();
		},
		
		onClickViewShowBody: function() {
			this._checkControl();
			this.redrawShape();
		},
		
		onClickViewShowShadow: function() {
			this._checkControl();
			this.redrawShape();
		},
		
		onClickViewShowOutline: function() {
			this._checkControl();
			this.redrawShape();
		},
		
		onClickViewUsePalette : function() {
			this._checkControl();
			this.redrawShape();
		},
		
		onClickViewUseBackground : function() {
			this._checkControl();
			this.redrawShape();
		},
		
		onClickViewUseMargin: function() {
			this._checkControl();
			this.updateViewControl();
			this.redrawShape();
		},
		
		onClickViewUseOpacity: function() {
			this._checkControl();
			this.redrawShape();
		},
		
		// Save
		onClickSaveUseZeroFill: function() {
			this._checkControl();
		},
		
		onClickSaveImage: function() {
			_App.fileManager.saveImage();
		},
		
		onClickSaveZip: function() {
			this.isFileSaveCanceled = false;
			_App.fileManager.saveZip();
		},
		
		onClickSaveGif: function() {
			this.isFileSaveCanceled = false;
			_App.fileManager.saveGif();
		},
		
		onClickGenerateGif: function() {
			this.isFileSaveCanceled = false;
			_App.fileManager.generateGif();
		},
		
		// Save Progress
		onClickSaveCancel: function() {
			this.isFileSaveCanceled = true;
		},
		
		// Gif Generator
		onClickGifGenerate: function() {
			this.hideGifGenerator();
			_App.fileManager.generateGif();
		},
		
		onClickGifCancel: function() {
			this.hideGifGenerator();
		}
	};
	
	// -----------------------------------
	// CanvasManager Class
	function CanvasManager() {
		var bgHex = $.cookie("colpick_background_hex") || _Constant.get("background_default");
		var bgRGB = $.colpick.hexToRgb(bgHex);
		
		this.$canvas = $(".view-port");
		this.canvas = this.$canvas.get(0);
		this.context = this.canvas.getContext("2d");
		this.width = 0;
		this.height = 0;
		this.imageData;
		
		this.backgroundColor = [bgRGB.r, bgRGB.g, bgRGB.b, 0xff]; // rgba
		
		this.isErrorOccurred = false;
	}
	
	CanvasManager.prototype = {
		
		initialize: function() {
			this.resize(_Constant.get("canvas_default_width"), _Constant.get("canvas_default_height"));
		},
		
		getCanvasElement: function() {
			return this.canvas;
		},
		
		getContext: function() {
			return this.context;
		},
		
		getDataURL: function() {
			return this.canvas.toDataURL("image/png");
		},
		
		resize: function(width, height) {
			
			width = width === 0 ? 1 : width;
			height = height === 0 ? 1 : height;
			
			if (!width || !height || width > 0xffff || height > 0xffff) {
				_App.uiManager.notice(_Message.get("error_resize_canvas"));
				return;
			}
			
			if (width === this.width && height === this.height) {
				return;
			}
			
			this.width = width;
			this.height = height;
			
			this.$canvas.attr({
				width: this.width,
				height: this.height
			});
			
			this.imageData = this.context.createImageData(this.width, this.height);
			
			if (_App.uiManager.isViewUseBackground) {
				this.clear();
			}
		},
		
		drawPixel: function(x, y, rgba) {
			
			if (x < 0 || this.width <= x || y < 0 || this.height <= y) {
				this.isErrorOccurred = true;
				return
			}
			
			var pixelData = this.imageData.data;
			var index = (x + y * this.width) * 4;
			
			pixelData[index + 0] = rgba[0];
			pixelData[index + 1] = rgba[1];
			pixelData[index + 2] = rgba[2];
			pixelData[index + 3] = rgba[3];
		},
		
		drawBlendPixel: function(x, y, rgba) {
			
			if (x < 0 || this.width <= x || y < 0 || this.height <= y) {
				this.isErrorOccurred = true;
				return
			}
			
			var pixelData = this.imageData.data;
			var index = (x + y * this.width) * 4;
			var oldR = pixelData[index + 0];
			var oldG = pixelData[index + 1];
			var oldB = pixelData[index + 2];
			var oldA = pixelData[index + 3];
			var opacity = rgba[3] / 255;
			
			pixelData[index + 0] = oldR * (1 - opacity) + (rgba[0] * opacity);
			pixelData[index + 1] = oldG * (1 - opacity) + (rgba[1] * opacity);
			pixelData[index + 2] = oldB * (1 - opacity) + (rgba[2] * opacity);
			pixelData[index + 3] = Math.min(0xff, oldA + rgba[3]);
		},
		
		update: function() {
			this.context.putImageData(this.imageData, 0, 0);
			
			if (this.isErrorOccurred) {
				_App.uiManager.notice(_Message.get("error_draw"));
				this.isErrorOccurred = false;
			}
		},
		
		clear: function() {
			var pixelData = this.imageData.data;
			var i = pixelData.length;
			
			if (_App.uiManager.isViewUseBackground) {
				while (i--) {
					pixelData[i] = this.backgroundColor[i % 4];
				}
			} else {
				while (i--) {
					pixelData[i] = 0;
				}
				//this.imageData = this.context.createImageData(this.width, this.height);
			}
		}
	};
	
	
	// -----------------------------------
	// MainManager Class
	function MainManager() {
		
	}
	
	MainManager.prototype = {
		
		initialize: function() {
			
		},
		
		checkBasicSupport: function() {
			if (!window.FileReader) {
				return false;
			}
			
			if (!window.FileReader.prototype.readAsArrayBuffer) {
				return false;
			}
			
			return true;
		}
		
	};
	
	
	// -----------------------------------
	// Exports
	$.extend(Koukun.EffectViewer, {
		FileManager: FileManager,
		UIManager: UIManager,
		CanvasManager: CanvasManager,
		MainManager: MainManager
	});
	
})();
