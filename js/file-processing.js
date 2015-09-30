/* global $, Koukun */

// ==================================================
// データを処理するクラスの定義
// ==================================================
(function(undefined) {
	
	var _App = Koukun.EffectViewer;
	var _Constant = Koukun.EffectViewer.Constant;
	var _Message = Koukun.EffectViewer.Message;
	
	// -----------------------------------
	// FileInfo Class
	function FileInfo(file) {
		this.name = file.name;
		this.nameWithoutExtension = file.name.substring(0, file.name.lastIndexOf("."));
		this.extension = file.name.substring(file.name.lastIndexOf(".") + 1);
		this.size = file.size;
		
		this.isEffectFile = _Constant.get("extension_effect").indexOf(this.extension) !== -1;
		this.isPaletteFile = _Constant.get("extension_palette").indexOf(this.extension) !== -1;
	}
	
	
	// -----------------------------------
	// PaletteFile Class
	function PaletteFile(fileData) {
		this.buffer = fileData.buffer;
		this.fileInfo = fileData.fileInfo;
		this.stream = new Koukun.cl.Stream(this.buffer);
		
		this.paletteData = [];
		
		this.is16bitColor = false;
	}
	
	PaletteFile.prototype = {
		
		analyze: function() {
			var fileSize = this.fileInfo.size;
			
			// Interface/*
			if(fileSize === 1280) {
				this.analyzeInterface();
				return;
			}
			
			// monsters/*
			if (fileSize === 2562) {
				this.analyzeMonsters();
				return;
			}
			
			// effect.plt
			if(fileSize === 14080) {
				this.analyzeEffectPlt();
				return;
			}
			
			// Another
			if (fileSize % 512 === 0) {
				this.analyzeAnother();
				return;
			}
			
			_App.uiManager.notice("対応していないパレットファイルです");
		},
		
		updatePaletteNumberList: function() {
			var data = [{
				groupName: "",
				options: $.map(this.paletteData, function(elem, index) {
					return {
						key: index,
						value: index
					};
				})
			}];
			
			_App.uiManager.setPaletteNumber(data);
		},
		
		analyzeInterface: function() {
			this.paletteData[0] = [];
			
			for (var i = 0; i < 512; i++) {
				this.paletteData[0][i] = this.stream.getUint8();
			}
			
			this.is16bitColor = true;
			this.updatePaletteNumberList();
		},
		
		analyzeMonsters: function() {
			this.stream.seek(2);
			
			for (var i = 0; i < 5; i++) {
				this.paletteData[i] = [];
				
				for (var j = 0; j < 512; j++) {
					this.paletteData[i][j] = this.stream.getUint8();
				}
			}
			
			this.is16bitColor = false;
			this.updatePaletteNumberList();
		},
		
		analyzeEffectPlt: function() {
			for (var i = 0; i < 11; i++) {
				this.paletteData[i] = [];
				
				for (var j = 0; j < 512; j++) {
					this.paletteData[i][j] = this.stream.getUint8();
				}
			}
			
			this.is16bitColor = true;
			this.updatePaletteNumberList();
		},
		
		analyzeAnother: function() {
			var paletteLength = this.fileInfo.size / 512;
			
			for (var i = 0; i < paletteLength; i++) {
				this.paletteData[i] = [];
				
				for (var j = 0; j < 512; j++) {
					this.paletteData[i][j] = this.stream.getUint8();
				}
			}
			
			this.is16bitColor = true;
			this.updatePaletteNumberList();
		}
	};
	
	
	// -----------------------------------
	// EffectShape Class
	function EffectShape() {
		this.startOffset = [];
		this.endOffset = [];
		this.width = [];
		this.height = [];
		this.left = [];
		this.top = [];
	}
	
	// -----------------------------------
	// EffectFile Class
	function EffectFile(fileData) {
		this.buffer = fileData.buffer;
		this.fileInfo = fileData.fileInfo;
		this.paletteData = [];
		this.stream = new Koukun.cl.Stream(this.buffer);
		
		this.isNewType = false;
		this.isHighColor = false;
		this.isExistShadow = false;
		this.isExistOutline = false;
		this.isZeroFillShadowData = false;
		this.frameCount = 0;
		
		this.shape = {
			body: new EffectShape(),
			shadow: new EffectShape(),
			outline: new EffectShape()
		};
		this.maxSizeInfo = {
			left: 0,
			top: 0,
			outerWidth: 0,
			outerHeight: 0
		};
		
		this.isAnalyzeFailed = false;
		
		
		// Draw
		this.drawFrame = 0;
	}
	
	EffectFile.prototype = {
		
		/* Analyze Effects
		---------------------------------------------------------------------- */
		analyze: function() {
			// basic
			this.analyzeType();
			this.decodeBuffer();
			this.analyzeColorType();
			this.analyzeFrameCount();
			// palette
			this.analyzePalette();
			// body
			this.analyzeBody();
			// shadow
			this.checkShadowExist();
			this.analyzeShadow();
			// outline
			this.checkOutlineExist();
			this.analyzeOutline();
			// max size
			this.evaluateMaxSize();
			
			_App.logger.log("ファイル名", this.fileInfo.name, "#fcc");
			_App.logger.log("物体", this.shape.body, "#cfc");
			_App.logger.log("影", this.shape.shadow, "#cfc");
			_App.logger.log("輪郭", this.shape.outline, "#cfc");
			_App.logger.log("最大サイズ", this.maxSizeInfo, "#cfc");
			
			if (this.isNewType && !this.isHighColor) {
				_App.uiManager.notice(_Message.get("not_exact_palette"));
			}
		},
		
		/* Analyze Effect Type
		---------------------------------------------------------------------- */
		analyzeType: function() {
			if (this.stream.getUint32(0x0) == 0x12344321) {
				this.isNewType = true;
			}
		},
		
		/* Decode buffer for analyze
		---------------------------------------------------------------------- */
		decodeBuffer: function() {
			
			if (!this.isNewType) {
				return;
			}
			
			var i, j, k;
			var ENCODE_KEY_LENGTH = 326;
			var ENCODE_START_ADDRESS = 0x1c;
			
			var limitAddress = this.stream.getUint32(0x4);
			var xorKey = new Int16Array(ENCODE_KEY_LENGTH);
			var numCounts = [];
			
			var _data = this.stream.getData();
			
			// 初期化
			for (i = 0; i < ENCODE_KEY_LENGTH; i++) {
				numCounts[i] = new Array(256);
				
				for (j = 0; j < 256; j++) {
					numCounts[i][j] = 0;
				}
			}
			
			// 出現回数のカウント
			for (i = ENCODE_START_ADDRESS; i < limitAddress; i++) {
				j = (i - ENCODE_START_ADDRESS) % ENCODE_KEY_LENGTH;
				numCounts[j][_data[i]]++;
			}
			
			// 出現回数の最も多い値をkeyとする
			for (i = 0; i < ENCODE_KEY_LENGTH; i++) {
				xorKey[i] = numCounts[i].indexOf(Math.max.apply(null, numCounts[i]));
			}
			
			// デコード
			for (i = ENCODE_START_ADDRESS; i < limitAddress; i++) {
				j = (i - ENCODE_START_ADDRESS) % ENCODE_KEY_LENGTH;
				_data[i] = _data[i] ^ xorKey[j];
			}
		},
		
		/* Analyze color type
		---------------------------------------------------------------------- */
		analyzeColorType: function() {
			var extension = this.fileInfo.extension;
			var i, tmpAddress;
			
			// .mpr
			if (extension === "mpr") {
				this.isHighColor = true;
				return;
			}
			
			// .smi
			if (extension === "smi" && this.stream.getUint8(0x3c) == 0x10) {
				this.isHighColor = true;
				return;
			}
			
			// .sd
			if (extension === "sd" && this.stream.getUint8(0x36) == 0x10) {
				this.isHighColor = true;
				return;
			}
			
			// Old Type
			if (!this.isNewType && this.stream.getUint8(0x3f) == 0x10) {
				this.isHighColor = true;
				return;
			}
			
			// new type
			if (this.isNewType) {
				
				// 16bitであればそのまま使う
				if (this.stream.getUint8(0x1c) === 0x10) {
					this.isHighColor = true;
					
				// デコードが信頼できないので、画像データの塊数などから判断
				} else {
					tmpAddress = this.stream.getUint32(0x4);
					
					for (i = tmpAddress; ; ) {
						if (this.stream.getUint8(i) === 0x00) {
							// 8Byteの0埋めのエフェクトがあるので飛ばす
							i += 8;
							continue;
						} else {
							// 256色の場合
							// buf[i + 8]: 塊数。必ず1以上
							// buf[i + 9]: マージン。ほぼ1以上
							// buf[i + 10]: 長さ。必ず1以上
							// buf[i + 11]: 参照。すべての値
							
							// ハイカラーの場合
							// buf[i + 8]: 塊数1。必ず1以上
							// buf[i + 9]: 塊数2。ほぼ0（塊数が256個以上のものはないであろう）
							// buf[i + 10]: マージン1。ほぼ1以上
							// buf[i + 11]: マージン2。0x04以下（マージンが1024px以上のものはないであろう）
							
							// 両者の差
							// buf[i + 8]: なし
							// buf[i + 9]: 256色はほぼ1以上。ハイカラーは0
							// buf[i + 10]: ほぼなし
							// buf[i + 11]: 256は全て。ハイカラーは0x04以下
							
							// 曖昧^p^
							if (this.stream.getUint8(i + 9) === 0x00 && this.stream.getUint8(i + 11) <= 0x04) {
								this.isHighColor = true;
							} else {
								this.isHighColor = false;
							}
							
							return;
						}
					}
				}
			}
		},
		
		/* Analyze frame count
		---------------------------------------------------------------------- */
		analyzeFrameCount: function() {
			var extension = this.fileInfo.extension;
			var tmpAddress, unityCount;
			
			if (this.isNewType) {
				// 行動定義部
				tmpAddress = this.stream.getUint32(0x8);
				
				// まとまり数のデータまで飛ばす
				while (true) {
					if(this.stream.getUint32(tmpAddress) < 0x100) {
						break;
					} else {
						tmpAddress += 40;
					}
				}
				
				// まとまり数
				unityCount = this.stream.getUint8(tmpAddress);
				
				// 最後のフレーム番号を取る
				this.frameCount = this.stream.getUint32(tmpAddress + (unityCount + 1) * 4);
				
			} else {
				if (extension === "smi") {
					this.frameCount = this.stream.getUint16(0x40);
				} else if (extension === "mpr") {
					this.frameCount = this.stream.getUint16(0x28);
				} else {
					this.frameCount = this.stream.getUint16(0x38);
				}
			}
		},
		
		/* Analyze palette data
		---------------------------------------------------------------------- */
		analyzePalette: function() {
			if (this.isHighColor) {
				return;
			}
			
			var paletteDataStart, i;
			
			if (this.isNewType) {
				paletteDataStart = this.stream.getUint16(0x4) - ((this.frameCount + 1) * 4 * 3) - 512;
			} else {
				paletteDataStart = 0x40;
			}
			
			this.stream.seek(paletteDataStart);
			
			for(i = 0; i < 512; i++) {
				this.paletteData[i] = this.stream.getUint8();
			}
		},
		
		/* Analyze body infomation
		---------------------------------------------------------------------- */
		analyzeBody: function() {
			var extension = this.fileInfo.extension;
			
			switch (extension) {
				case "smi":
					this._analyzeBody_smi();
					break;
				case "mpr":
					this._analyzeBody_mpr();
					break;
				default:
					if (this.isNewType) {
						this._analyzeBody_newType();
					} else {
						this._analyzeBody_oldType();
					}
			}
		},
		
		_analyzeBody_smi: function() {
			var offsetsInfoStart = 0x44;
			var spriteDataStart = offsetsInfoStart + 4 + (this.frameCount * 4);
			var pixelDataLength = 2;
			var i;
			
			// Get offsets
			for (i = 0; i < this.frameCount; i++) {
				this.stream.seek(offsetsInfoStart + (i * 4));
				this.shape.body.startOffset[i] = spriteDataStart + (this.stream.getUint32() * pixelDataLength);
				this.shape.body.endOffset[i] = spriteDataStart + (this.stream.getUint32() * pixelDataLength);
			}
			
			// Get body info
			for (i = 0; i < this.frameCount; i++) {
				this.stream.seek(this.shape.body.startOffset[i]);
				this.shape.body.width[i] = this.stream.getUint16();
				this.shape.body.height[i] = this.stream.getUint16();
				this.shape.body.left[i] = 0;
				this.shape.body.top[i] = 0;
			}
		},
		
		_analyzeBody_mpr: function() {
			var spriteWidth = this.stream.getUint16(0x2a);
			var spriteHeight = this.stream.getUint16();
			var spriteDataStart = 0x2e;
			var pixelDataLength = 2;
			var i;
			
			// Get offsets
			for (i = 0; i < this.frameCount; i++) {
				this.shape.body.startOffset[i] = spriteDataStart + (i * spriteWidth * spriteHeight * pixelDataLength);
				this.shape.body.endOffset[i] = spriteDataStart + ((i + 1) * spriteWidth * spriteHeight * pixelDataLength);
			}
			
			// Get body info
			for (i = 0; i < this.frameCount; i++) {
				this.shape.body.width[i] = spriteWidth;
				this.shape.body.height[i] = spriteHeight;
				this.shape.body.left[i] = 0;
				this.shape.body.top[i] = 0;
			}
		},
		
		_analyzeBody_newType: function() {
			var spriteDataStart = this.stream.getUint16(0x4);
			var tmpAddress = spriteDataStart;
			var pixelDataLength = this.isHighColor ? 2 : 1;
			var i, j, unityCount;
			
			var readStream = this.isHighColor ?
					$.proxy(this.stream.getUint16, this.stream) :
					$.proxy(this.stream.getUint8, this.stream);
			
			// frameCountが信頼出来ないため
			try {
				for (i = 0; i < this.frameCount; i++) {
					this.stream.seek(tmpAddress);
					this.shape.body.startOffset[i] = tmpAddress;
					this.shape.body.width[i] = this.stream.getUint16();
					this.shape.body.height[i] = this.stream.getUint16();
					this.shape.body.left[i] = this.stream.getInt16();
					this.shape.body.top[i] = this.stream.getInt16();
					
					if (this.shape.body.width[i] === 0 || this.shape.body.height[i] === 0) {
						this.shape.body.width[i] = 0;
						this.shape.body.height[i] = 0;
						this.shape.body.left[i] = 0;
						this.shape.body.top[i] = 0;
					}
					
					tmpAddress += 8;
					
					// このフレームデータの最後までスキップ
					for (j = 0 ; j < this.shape.body.height[i]; j++) {
						unityCount = readStream(tmpAddress);
						while (unityCount--) {
							this.stream.seek(tmpAddress + (2 * pixelDataLength));
							tmpAddress += (readStream() + 2) * pixelDataLength;
						}
						tmpAddress += pixelDataLength;
					}
					
					this.shape.body.endOffset[i] = tmpAddress;
				}
			} catch(e) {
				_App.logger.error(e);
				_App.uiManager.notice(_Message.get("error_analyze_body"));
				this.isAnalyzeFailed = true;
			}
		},
		
		_analyzeBody_oldType: function() {
			var offsetsInfoStart = this.isHighColor ? 0x40 : 0x240;
			var spriteDataStart = offsetsInfoStart + 4 + (this.frameCount * 4);
			var pixelDataLength = this.isHighColor ? 2 : 1;
			var i, j, startOffset;
			
			// Get offsets
			for (i = 0; i < this.frameCount; i++) {
				this.stream.seek(offsetsInfoStart + (i * 4));
				this.shape.body.startOffset[i] = spriteDataStart + (this.stream.getUint32() * pixelDataLength);
				this.shape.body.endOffset[i] = spriteDataStart + (this.stream.getUint32() * pixelDataLength);
			}
			
			// Get body info
			for (i = 0; i < this.frameCount; i++) {
				this.stream.seek(this.shape.body.startOffset[i]);
				this.shape.body.width[i] = this.stream.getUint16();
				this.shape.body.height[i] = this.stream.getUint16();
				this.shape.body.left[i] = this.stream.getInt16();
				this.shape.body.top[i] = this.stream.getInt16();
				
				if (this.shape.body.width[i] === 0 || this.shape.body.height[i] === 0) {
					this.shape.body.width[i] = 0;
					this.shape.body.height[i] = 0;
					this.shape.body.left[i] = 0;
					this.shape.body.top[i] = 0;
				}
			}
		},
		
		/* Check shadow data exist
		---------------------------------------------------------------------- */
		checkShadowExist: function() {
			var extension = this.fileInfo.extension;
			
			if (extension !== "sad" && extension !== "sd") {
				this.isExistShadow = false;
				return;
			}
			
			if (this.isNewType) {
				this._checkShadowExist_newType();
			} else {
				this._checkShadowExist_oldType();
			}
		},
		
		_checkShadowExist_newType: function() {
			var spriteDataStart = this.shape.body.endOffset[this.frameCount - 1];
			var tmpAddress = spriteDataStart;
			var i, j, spriteHeight, unityCount;
			
			
			try {
				// フレームデータの末尾までスキップ
				for (i = 0; i < this.frameCount ;i++) {
					this.stream.seek(tmpAddress);
					spriteHeight = this.stream.getUint16();
					spriteHeight = this.stream.getUint16();
					
					tmpAddress += 8;
					
					for (j = 0 ; j < spriteHeight; j++) {
						unityCount = this.stream.getUint8(tmpAddress);
						while (unityCount--) {
							tmpAddress += 2;
						}
						tmpAddress += 1;
					}
				}
				
				if (tmpAddress >= this.stream.getUint32(0x8)) {
					this.isExistShadow = false;
					return;
				}
			} catch (e) {
				_App.logger.error(e);
				_App.uiManager.notice(_Message.get("error_analyze_shadow"));
				this.isExistShadow = false;
				this.isAnalyzeFailed = true;
				return;
			}
			
			this.isExistShadow = true;
		},
		
		_checkShadowExist_oldType: function() {
			var offsetsInfoStart = this.shape.body.endOffset[this.frameCount - 1];
			var spriteDataStart = offsetsInfoStart + 4 + (this.frameCount * 4);
			var lastOffset = 0;
			
			// 影データのオフセット情報がない
			if (this.stream.getUint32(offsetsInfoStart + 4) === 0 && this.stream.getUint32() === 0) {
				this.isExistShadow = false;
				this.isZeroFillShadowData = true;
				return
			}
			
			// 映像データのあとに影と輪郭のデータがあるが、１つしかない場合はそれは輪郭データである
			lastOffset = this.stream.getUint32(offsetsInfoStart + ((this.frameCount) * 4)); // 最後のオフセット情報
			
			if (spriteDataStart + lastOffset >= this.fileInfo.size) {
				this.isExistShadow = false;
				return;
			}
			
			// TODO: この部分の必要性を確認する
			if (this.stream.getUint32(spriteDataStart + lastOffset + 4) === 0 && this.stream.getUint32() === 0) {
				this.isExistShadow = false;
				return;
			}
			
			this.isExistShadow = true;
		},
		
		/* Analyze shadow infomation
		---------------------------------------------------------------------- */
		analyzeShadow: function() {
			
			if (!this.isExistShadow) {
				return;
			}
			
			if (this.isNewType) {
				this._analyzeShadow_newType();
			} else {
				this._analyzeShadow_oldType();
			}
		},
		
		_analyzeShadow_newType: function() {
			var spriteDataStart = this.shape.body.endOffset[this.frameCount - 1];
			var tmpAddress = spriteDataStart;
			var i;
			
			for (i = 0; i < this.frameCount ;i++) {
				this.stream.seek(tmpAddress);
				this.shape.shadow.startOffset[i] = tmpAddress;
				this.shape.shadow.width[i] = this.stream.getUint16();
				this.shape.shadow.height[i] = this.stream.getUint16();
				this.shape.shadow.left[i] = this.stream.getInt16();
				this.shape.shadow.top[i] = this.stream.getInt16();
				
				if (this.shape.shadow.width[i] === 0 || this.shape.shadow.height[i] === 0) {
					this.shape.shadow.width[i] = 0;
					this.shape.shadow.height[i] = 0;
					this.shape.shadow.left[i] = 0;
					this.shape.shadow.top[i] = 0;
				}
				
				tmpAddress += 8;
				
				// このフレームデータの最後までスキップ
				for (j = 0; j < this.shape.shadow.height[i]; j++) {
					unityCount = this.stream.getUint8(tmpAddress);
					while (unityCount--) {
						tmpAddress += 2;
					}
					tmpAddress += 1;
				}
				
				this.shape.shadow.endOffset[i] = tmpAddress;
			}
		},
		
		_analyzeShadow_oldType: function() {
			var offsetsInfoStart = this.shape.body.endOffset[this.frameCount - 1];
			var spriteDataStart = offsetsInfoStart + 4 + (this.frameCount * 4);
			var i;
			
			// Get offsets
			for (i = 0; i < this.frameCount; i++) {
				this.stream.seek(offsetsInfoStart + (i * 4));
				this.shape.shadow.startOffset[i] = spriteDataStart + this.stream.getUint32();
				this.shape.shadow.endOffset[i] = spriteDataStart + this.stream.getUint32();
			}
			
			// Get shadow info
			for (i = 0; i < this.frameCount; i++) {
				this.stream.seek(this.shape.shadow.startOffset[i]);
				this.shape.shadow.width[i] = this.stream.getUint16();
				this.shape.shadow.height[i] = this.stream.getUint16();
				this.shape.shadow.left[i] = this.stream.getInt16();
				this.shape.shadow.top[i] = this.stream.getInt16();
				
				if (this.shape.shadow.width[i] === 0 || this.shape.shadow.height[i] === 0) {
					this.shape.shadow.width[i] = 0;
					this.shape.shadow.height[i] = 0;
					this.shape.shadow.left[i] = 0;
					this.shape.shadow.top[i] = 0;
				}
			}
		},
		
		/* Check outline data exist
		---------------------------------------------------------------------- */
		checkOutlineExist: function() {
			var extension = this.fileInfo.extension;
			
			if (extension !== "sad" && extension !== "sd") {
				this.isExistOutline = false;
				return;
			}
			
			if (this.isNewType) {
				this._checkOutlineExist_newType();
			} else {
				this._checkOutlineExist_oldType();
			}
		},
		
		_checkOutlineExist_newType: function() {
			this.isExistOutline = true;
		},
		
		_checkOutlineExist_oldType: function() {
			this.isExistOutline = true;
		},
		
		/* Analyze outline infomation
		---------------------------------------------------------------------- */
		analyzeOutline: function() {
			
			if (!this.isExistOutline) {
				return;
			}
			
			if (this.isNewType) {
				this._analyzeOutline_newType();
			} else {
				this._analyzeOutline_oldType();
			}
		},
		
		_analyzeOutline_newType: function() {
			var tmpAddress, spriteDataStart, i;
			
			if (this.isExistShadow) {
				spriteDataStart = this.shape.shadow.endOffset[this.frameCount - 1];
			} else {
				spriteDataStart = this.shape.body.endOffset[this.frameCount - 1];
			}
			
			tmpAddress = spriteDataStart;
			
			// frameCountが信頼出来ないため
			try {
				for (i = 0; i < this.frameCount ;i++) {
					this.stream.seek(tmpAddress);
					this.shape.outline.startOffset[i] = tmpAddress;
					this.shape.outline.width[i] = this.stream.getUint16();
					this.shape.outline.height[i] = this.stream.getUint16();
					this.shape.outline.left[i] = this.stream.getInt16();
					this.shape.outline.top[i] = this.stream.getInt16();
					
					if (this.shape.outline.width[i] === 0 || this.shape.outline.height[i] === 0) {
						this.shape.outline.width[i] = 0;
						this.shape.outline.height[i] = 0;
						this.shape.outline.left[i] = 0;
						this.shape.outline.top[i] = 0;
					}
					
					tmpAddress += 8;
					
					// このフレームデータの最後までスキップ
					for (j = 0 ; j < this.shape.outline.height[i]; j++) {
						unityCount = this.stream.getUint8(tmpAddress);
						while (unityCount--) {
							tmpAddress += 2;
						}
						tmpAddress += 1;
					}
					
					this.shape.outline.endOffset[i] = tmpAddress;
				}
			} catch(e) {
				_App.logger.error(e);
				_App.uiManager.notice(_Message.get("error_analyze_outline"));
				this.isExistOutline = false;
				this.isAnalyzeFailed = true;
				return;
			}
		},
		
		_analyzeOutline_oldType: function() {
			var offsetsInfoStart, spriteDataStart, i;
			
			if (this.isExistShadow) {
				offsetsInfoStart = this.shape.shadow.endOffset[this.frameCount - 1];
				spriteDataStart = offsetsInfoStart + 4 + (this.frameCount * 4);
			} else {
				offsetsInfoStart = this.shape.body.endOffset[this.frameCount - 1];
				
				if (this.isZeroFillShadowData) {
					offsetsInfoStart += this.frameCount * 4 + 4;
				}
				
				spriteDataStart = offsetsInfoStart + 4 + (this.frameCount * 4);
			}
			
			// Get offsets
			for (i = 0; i < this.frameCount; i++) {
				this.stream.seek(offsetsInfoStart + (i * 4));
				this.shape.outline.startOffset[i] = spriteDataStart + this.stream.getUint32();
				this.shape.outline.endOffset[i] = spriteDataStart + this.stream.getUint32();
			}
			
			// Get outline info
			for (i = 0; i < this.frameCount; i++) {
				this.stream.seek(this.shape.outline.startOffset[i]);
				this.shape.outline.width[i] = this.stream.getUint16();
				this.shape.outline.height[i] = this.stream.getUint16();
				this.shape.outline.left[i] = this.stream.getInt16();
				this.shape.outline.top[i] = this.stream.getInt16();
				
				if (this.shape.outline.width[i] === 0 || this.shape.outline.height[i] === 0) {
					this.shape.outline.width[i] = 0;
					this.shape.outline.height[i] = 0;
					this.shape.outline.left[i] = 0;
					this.shape.outline.top[i] = 0;
				}
			}
		},
		
		/* Evaluate effect max size
		---------------------------------------------------------------------- */
		evaluateMaxSize: function() {
			
			//if (this.isAnalyzeFailed) {
			//	return;
			//}
			
			var shapeOuterWidth = [];
			var shapeOuterHeight = [];
			var shadowOuterWidth = [];
			var shadowOuterHeight = [];
			var outlineOuterWidth = [];
			var outlineOuterHeight = [];
			var i;
			
			var i;
			
			// left, top
			this.maxSizeInfo.left = Math.max(
				Math.max.apply(Math, this.shape.body.left),
				this.isExistShadow ? Math.max.apply(Math, this.shape.shadow.left) : 0,
				this.isExistOutline ? Math.max.apply(Math, this.shape.outline.left): 0
			);
			this.maxSizeInfo.top = Math.max(
				Math.max.apply(Math, this.shape.body.top),
				this.isExistShadow ? Math.max.apply(Math, this.shape.shadow.top) : 0,
				this.isExistOutline ? Math.max.apply(Math, this.shape.outline.top) : 0
			);
			
			// データ準備
			for (i = 0; i < this.frameCount; i++) {
				shapeOuterWidth[i] = this.shape.body.width[i] + this.maxSizeInfo.left - this.shape.body.left[i];
				shapeOuterHeight[i] = this.shape.body.height[i] + this.maxSizeInfo.top - this.shape.body.top[i];
				
				if (this.isExistShadow) {
					shadowOuterWidth[i] =  this.shape.shadow.width[i] + this.maxSizeInfo.left - this.shape.shadow.left[i];
					shadowOuterHeight[i] =  this.shape.shadow.height[i] + this.maxSizeInfo.top - this.shape.shadow.top[i];
				}
				
				if (this.isExistOutline) {
					outlineOuterWidth[i] =  this.shape.outline.width[i] + this.maxSizeInfo.left - this.shape.outline.left[i];
					outlineOuterHeight[i] =  this.shape.outline.height[i] + this.maxSizeInfo.top - this.shape.outline.top[i];
				}
			}
			
			// outerWidth, outerHeight
			this.maxSizeInfo.outerWidth = Math.max(
				Math.max.apply(Math, shapeOuterWidth),
				Math.max.apply(Math, shadowOuterWidth),
				Math.max.apply(Math, outlineOuterWidth)
			);
			this.maxSizeInfo.outerHeight = Math.max(
				Math.max.apply(Math, shapeOuterHeight),
				Math.max.apply(Math, shadowOuterHeight),
				Math.max.apply(Math, outlineOuterHeight)
			);
			
		},
		
		
		/* Draw Effects
		---------------------------------------------------------------------- */
		draw: function(rowIndex) {
			
			this.drawFrame = rowIndex;
			this.resizeCanvas();
			
			_App.canvasManager.clear();
			
			this.drawBody();
			this.drawShadow();
			this.drawOutline();
			
			_App.canvasManager.update();
		},
		
		redraw: function() {
			this.draw(this.drawFrame);
		},
		
		/* Resize canvas
		---------------------------------------------------------------------- */
		resizeCanvas: function() {
			if (_App.uiManager.isViewUseMargin) {
				_App.canvasManager.resize(this.maxSizeInfo.outerWidth, this.maxSizeInfo.outerHeight);
			} else {
				_App.canvasManager.resize(this.shape.body.width[this.drawFrame], this.shape.body.height[this.drawFrame])
			}
		},
		
		/* Draw body
		---------------------------------------------------------------------- */
		drawBody: function() {
			if (!_App.uiManager.isViewShowBody) {
				return;
			}
			
			var extension = this.fileInfo.extension;
			
			switch (extension) {
				case "smi":
				case "mpr":
					this._drawBody_smi();
					break;
				default:
					if (this.isHighColor) {
						this._drawBody_highColor();
					} else {
						this._drawBody_lowColor();
					}
			}
		},
		
		_getRGBA15bit: function(colorData1, colorData2, isUseOpacity) {
			var r = (colorData1 & 0x7c) << 1;
			var g = ((colorData1 << 8 | colorData2) & 0x03e0 ) >> 2;
			var b = (colorData2 & 0x1f) << 3;
			return [r, g, b, isUseOpacity ? this._getOpacity(r, g, b) : 0xff];
		},
		
		_getRGBA16bit: function(colorData1, colorData2, isUseOpacity) {
			var r = colorData1 & 0xf8;
			var g = ((colorData1 << 8 | colorData2) & 0x07e0 ) >> 3;
			var b = (colorData2 & 0x1f) << 3;
			return [r, g, b, isUseOpacity ? this._getOpacity(r, g, b) : 0xff];
		},
		
		_getOpacity: function(r, g, b) {
			return (r + g + b) / 3;
		},
		
		_drawBody_smi: function() {
			var isUseOpacity = _App.uiManager.isViewUseOpacity;
			var isUseMargin = _App.uiManager.isViewUseMargin;
			var isUseBackground = _App.uiManager.isViewUseBackground;
			
			var startOffset = this.shape.body.startOffset[this.drawFrame];
			var width = this.shape.body.width[this.drawFrame];
			var height = this.shape.body.height[this.drawFrame];
			var left = isUseMargin ? this.maxSizeInfo.left - this.shape.body.left[this.drawFrame] : 0;
			var top = isUseMargin ? this.maxSizeInfo.top - this.shape.body.top[this.drawFrame] : 0;
			
			var w, h, colorData1, colorData2, _drawPixel;
			
			if (isUseBackground && isUseOpacity) {
				_drawPixel = _App.canvasManager.drawBlendPixel;
			} else {
				_drawPixel = _App.canvasManager.drawPixel;
			}
			
			this.stream.seek(startOffset);
			
			if (this.fileInfo.extension === "smi") {
				this.stream.skip(4); // Skip shape info data
			}
			
			for (h = 0; h < height; h++) {
				for (w = 0; w < width; w++) {
					colorData2 = this.stream.getUint8();
					colorData1 = this.stream.getUint8();
					
					_drawPixel.call(
						_App.canvasManager,
						left + w,
						top + h,
						this._getRGBA15bit(colorData1, colorData2, isUseOpacity)
					)
					
				}
			}
		},
		
		_drawBody_highColor: function() {
			var isUseOpacity = _App.uiManager.isViewUseOpacity;
			var isUseMargin = _App.uiManager.isViewUseMargin;
			var isUseBackground = _App.uiManager.isViewUseBackground;
			
			var startOffset = this.shape.body.startOffset[this.drawFrame];
			var width = this.shape.body.width[this.drawFrame];
			var height = this.shape.body.height[this.drawFrame];
			var left = isUseMargin ? this.maxSizeInfo.left - this.shape.body.left[this.drawFrame] : 0;
			var top = isUseMargin ? this.maxSizeInfo.top - this.shape.body.top[this.drawFrame] : 0;
			
			var _drawPixel, w, h, unityCount, unityWidth, colorData1, colorData2;
			
			if (isUseBackground && isUseOpacity) {
				_drawPixel = _App.canvasManager.drawBlendPixel;
			} else {
				_drawPixel = _App.canvasManager.drawPixel;
			}
			
			this.stream.seek(startOffset + 8); // Skip shape info data
			
			for (h = 0; h < height; h++) {
				unityCount = this.stream.getUint16();
				w = 0;
				
				while (unityCount--) {
					w += this.stream.getUint16();
					unityWidth = this.stream.getUint16();
					
					while (unityWidth--) {
						colorData2 = this.stream.getUint8();
						colorData1 = this.stream.getUint8();
						
						_drawPixel.call(
							_App.canvasManager,
							left + w,
							top + h,
							this._getRGBA15bit(colorData1, colorData2, isUseOpacity)
						)
						w++;
					}
				}
			}
		},
		
		_drawBody_lowColor: function() {
			var isUseOpacity = _App.uiManager.isViewUseOpacity;
			var isUseMargin = _App.uiManager.isViewUseMargin;
			var isUseBackground = _App.uiManager.isViewUseBackground;
			var isUsePalette = _App.uiManager.isViewUsePalette;
			
			var startOffset = this.shape.body.startOffset[this.drawFrame];
			var width = this.shape.body.width[this.drawFrame];
			var height = this.shape.body.height[this.drawFrame];
			var left = isUseMargin ? this.maxSizeInfo.left - this.shape.body.left[this.drawFrame] : 0;
			var top = isUseMargin ? this.maxSizeInfo.top - this.shape.body.top[this.drawFrame] : 0;
			
			var paletteFile = _App.fileManager.paletteFile;
			var paletteNumber = _App.uiManager.selectedPaletteNumber;
			var paletteData = (isUsePalette && paletteFile) ? paletteFile.paletteData[paletteNumber] : this.paletteData;
			
			var _drawPixel, _getRGB, w, h, unityCount, unityWidth, colorReference, colorData1, colorData2;
			
			if (isUseBackground && isUseOpacity) {
				_drawPixel = _App.canvasManager.drawBlendPixel;
			} else {
				_drawPixel = _App.canvasManager.drawPixel;
			}
			
			if (isUsePalette && paletteFile && paletteFile.is16bitColor) {
				_getRGB = this._getRGBA16bit;
			} else {
				_getRGB = this._getRGBA15bit;
			}
				
			this.stream.seek(startOffset + 8); // Skip shape info data
			
			for (h = 0; h < height; h++) {
				unityCount = this.stream.getUint8();
				w = 0;
				
				while (unityCount--) {
					w += this.stream.getUint8();
					unityWidth = this.stream.getUint8();
					
					while (unityWidth--) {
						colorReference = this.stream.getUint8();
						colorData1 = paletteData[colorReference * 2 + 1];
						colorData2 = paletteData[colorReference * 2];
						
						_drawPixel.call(
							_App.canvasManager,
							left + w,
							top + h,
							_getRGB.call(this, colorData1, colorData2, isUseOpacity)
						)
						w++;
					}
				}
			}
		},
		
		/* Draw Shadow
		---------------------------------------------------------------------- */
		drawShadow: function() {
			if (!this.isExistShadow || !_App.uiManager.isViewShowShadow) {
				return;
			}
			
			if (!_App.uiManager.isViewUseMargin) {
				return;
			}
			
			var startOffset = this.shape.shadow.startOffset[this.drawFrame];
			var width = this.shape.shadow.width[this.drawFrame];
			var height = this.shape.shadow.height[this.drawFrame];
			var left = this.maxSizeInfo.left - this.shape.shadow.left[this.drawFrame];
			var top = this.maxSizeInfo.top - this.shape.shadow.top[this.drawFrame];
			
			var w, h, unityCount, unityWidth;
			
			this.stream.seek(startOffset + 8); // Skip shape info data
						
			for (h = 0; h < height; h++) {
				unityCount = this.stream.getUint8();
				w = 0;
				
				while (unityCount--) {
					w += this.stream.getUint8();
					unityWidth = this.stream.getUint8();
					
					while (unityWidth--) {
						_App.canvasManager.drawBlendPixel(
							left + w,
							top + h,
							_Constant.get("shadow_pixel_data")
						);
						w++;
					}
				}
			}
		},
		
		/* Draw Outline
		---------------------------------------------------------------------- */
		drawOutline: function() {
			if (!this.isExistOutline || !_App.uiManager.isViewShowOutline) {
				return;
			}
			
			if (!_App.uiManager.isViewUseMargin) {
				return;
			}
			
			var startOffset = this.shape.outline.startOffset[this.drawFrame];
			var width = this.shape.outline.width[this.drawFrame];
			var height = this.shape.outline.height[this.drawFrame];
			var left = this.maxSizeInfo.left - this.shape.outline.left[this.drawFrame];
			var top = this.maxSizeInfo.top - this.shape.outline.top[this.drawFrame];
			
			var w, h, unityCount, unityWidth;
			
			this.stream.seek(startOffset + 8); // Skip shape info data
						
			for (h = 0; h < height; h++) {
				unityCount = this.stream.getUint8();
				w = 0;
				
				while (unityCount--) {
					w += this.stream.getUint8();
					unityWidth = this.stream.getUint8();
					
					while (unityWidth--) {
						_App.canvasManager.drawBlendPixel(
							left + w,
							top + h,
							_Constant.get("outline_pixel_data")
						);
						w++;
					}
				}
			}
		}
	};
	
	
	// -----------------------------------
	// Exports
	$.extend(Koukun.EffectViewer, {
		FileInfo: FileInfo,
		EffectFile: EffectFile,
		PaletteFile: PaletteFile
	});
	
})();
