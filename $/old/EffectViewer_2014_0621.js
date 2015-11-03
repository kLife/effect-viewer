
(function() {
	var canvas, comaTable, fileTable, progresbar,
		bCancelOut = false,
		bAlreadyOut = false,
		canvasBGColor = {
			r: 0,
			g: 0,
			b: 0
		};

	if (!window.FileReader) {
		$("#efv_noticeError").text("ファイル読み込みに対応していません。").show();
		return;
	}

	/* ---------------------------------------------------------------------- */
	// エラー通知

	function noticeError(errorText, delayTime) {
		$("#efv_noticeError").text(errorText).stop(true).fadeIn(500).delay(delayTime || 1000).fadeOut(500);
		console.log("Error: " + errorText);
	}


	/* ---------------------------------------------------------------------- */
	// 確認用

	function checkObj(obj) {
		if (!obj) {
			consoleLog("※ Object is undefined");
			return;
		}
		
		var bOwnProp, strType;
		
		console.log(obj);
		consoleLog("■ " + obj.constructor);
		$.each(obj, function(key , value){
			if ($.isNumeric(key)) {
				return
			}
			bOwnProp = obj.hasOwnProperty(key) ? "own" : "not";
			strType = "{" + (typeof value) + "}";
			consoleLog("- " + bOwnProp + " " + strType + " " + key + ": " + value);
		});
	}

	function consoleLog(value) {
		var text = value.toString().replace(/\n/g, "").replace(/\s+/g," ").replace(/(.{80}).+/, "$1 ...");
		console.log(text);
	}


	/* ---------------------------------------------------------------------- */
	// ファイルドロップ

	jQuery.event.props.push('dataTransfer');

	$("#efv_effectViewer").on("dragenter", function() {
		$("#efv_dropArea").show();
	}).on("drop dragover dragleave", false);


	$("#efv_dropArea").css("opacity", 0.2).on("drop", function(event) {

		var dt,
			i = 0;

		$(this).hide();
        event.stopPropagation();
        event.preventDefault();

		dt = event.dataTransfer;
		
		if (!dt.files) {
	        noticeError("ご利用のブラウザはファイル読み込みをサポートしていません");
			return;
		}

		for ( ; i < dt.files.length; i++) {
	    	loadFileContent(dt.files[i], i === 0);
		}
	}).on("mouseout", function() {
		$(this).hide();
	}).on("dragleave", function() {
		$(this).hide();
	}).on("dragover dragenter", false);

	$("html").on("drop dragover dragenter dragleave", false);


	function loadFileContent(file, bFirstFile) {
		var fr, data, buf;

		if (!window.FileReader) {
	        noticeError("ご利用のブラウザはファイル読み込みをサポートしていません");
	        return;
	    }

	    fr = new FileReader();
	    
	    if (!fr.readAsArrayBuffer) {
	        noticeError("ご利用のブラウザはバイナリ読み込みをサポートしていません");
	        return;
	    }

	    fr.onload = function(event){
	        data = event.target.result;
	        buf = new Uint8Array(data);
			fileLoaded(file, buf, bFirstFile);
	    };

	    fr.onerror = function(error) {
	        noticeError("読み込みに失敗しました。");
	    };

	    fr.readAsArrayBuffer(file);
	}

	function fileLoaded(file, buf, bFirstFile) {
		var effectFile, index, column,
			fileInfo = new FileInfo(file);

		if (equalAnyStr(fileInfo.exte, "sad sd rfo rbd rso smi mpr")) {

			effectFile = new EffectFile(fileInfo, buf);

			if (effectFile.bParsable) {
				if (effectFile.bHighColor) {
					fileTable.add([
						fileInfo.nameWithoutExte,
						fileInfo.exte,
						effectFile.strType,
						"使用不可"
					], effectFile);
				} else {
					fileTable.add([
						fileInfo.nameWithoutExte,
						fileInfo.exte,
						effectFile.strType,
						"ドロップできます。"
					], effectFile);
				}

				bFirstFile && fileTable.trigIndex(fileTable.columns.length - 1);

			}
		} else if (fileInfo.exte === "plt") {

			index = fileTable.lastClickIndex;

			if (index === -1) {
				return;
			}

			column = fileTable.columns[index];

			if (column.data.bHighColor) {
				return;
			}

			column.data.pltFile = new PaletteFile(fileInfo, buf);

			column.set(3, fileInfo.nameWithoutExte);
			fileTable.trigLastSelect();
			
		} else {
			noticeError("その拡張子は読み込めません。", 3000);
		}
	}


	/* ---------------------------------------------------------------------- */
	// FileInfo

	/**
	 * ファイル情報の取得用
	 * {File} file: ファイルオブジェクト
	 */
	function FileInfo(file) {
		var dotIndex = file.name.lastIndexOf(".");

		this.name = file.name;
		this.nameWithoutExte = file.name.split(".")[0].replace(/(.{24}).+/, "$1 ...");
		this.exte = dotIndex > 0 ? this.name.substring(dotIndex + 1) : "-";
		this.size = file.size;
		this.ksize = Math.round(file.size / 1000);
		this.strSize = addFigure(this.ksize);
	}

	/* ---------------------------------------------------------------------- */
	// EffectFile

	/**
	 * sadファイル用
	 * {FileInfo} fileInfo: ファイルの情報
	 * {Uint8ClampedArray} buf: 読み込んだファイルのバッファ
	 */
	function EffectFile(fileInfo, buf) {
		this.fileInfo = fileInfo;
		this.buf = buf;
		this.pltData = [];
		this.pltFile = null;

		this.coma = 0;
		this.strType = "";
		this.bParsable =  false;
		this.bNewType = false;
		this.bHighColor = false;
		
		this.bNoShadow = false;
		this.bNoOutline = false;

		this.lefMax = 0;
		this.topMax = 0;
		this.xMax = 0; // width + left
		this.yMax = 0; // height + top

		this.adrArr = [];
		this.widArr = null;
		this.heiArr = null;
		this.lefArr = null;
		this.topArr = null;

		this.s_adrArr = [];
		this.s_widArr = null;
		this.s_heiArr = null;
		this.s_lefArr = null;
		this.s_topArr = null;
		
		this.outline_adrArr = [];
		this.outline_widArr = null;
		this.outline_heiArr = null;
		this.outline_lefArr = null;
		this.outline_topArr = null;

		this.init();
	}

	EffectFile.prototype = {
		bFailure: false,
		init: function() {
			if (this.initParsable()) {
				this.initColorType();
				this.initDecodeBuffer();
				this.initComa();
				this.initType();
				this.initInfo();
				this.initShadow();
				this.initOutline();
				this.initCalcMaxSize();
				this.initDecodeBuffer2();
				this.initPalette();
			}
		},
		load: function() {
			this.bFailure && noticeError("読み込みに失敗しました。");
			this.outComaData();

			if (this.pltFile) {
				$("#efv_labelPltSelect").show();
			} else {
				$("#efv_labelPltSelect").hide();
			}
		},

		/* ----------------------------------- */
		// init

		initParsable: function() {
			var exte = this.fileInfo.exte,
				buf = this.buf;

			// 拡張子
			if ( !equalAnyStr(exte, "sad sd rfo rbd rso smi mpr") ) {
				this.bNewType = false;
				this.bParsable = false;
				
			// new type
			} else if (buf[0x00] === 0x21 && buf[0x01] === 0x43) {
					
				this.bNewType = true;
				this.bParsable =  true;
				
			// old type
			} else {
				this.bNewType = false;
				this.bParsable =  true;
			}
			
			return this.bParsable;
		},
		initColorType: function() {
			var address, i,
				exte = this.fileInfo.exte,
				buf = this.buf;

			if (buf[0x3F] === 0x10 || exte === "mpr" ||
				(exte === "sd" && buf[0x36] === 0x10) ||
				(exte === "smi" && buf[0x3C] === 0x10) ) {
					this.bHighColor = true;
					return;
			}

			if (this.bNewType) {
				address = getLongNum(buf, 0x4, 4);

				for (i = address; i < 64 + address; i += 8) {
					if (buf[i] === 0x00) {
						continue;
					}
					// 曖昧^p^
					// buf[i+9]: 色数の部分(色数255は超えないと見越して)
					// buf[i+11]: マージン(4096は超えないと見越して)
					if (buf[i + 9] === 0x00 && buf[i + 11] < 0x10) {
						this.bHighColor = true;
						return;
					}
				}
				this.bHighColor = false;
			}

			this.bHighColor = false;
		},
		
		// 復号鍵を求める処理がわからないため多数決をする
		initDecodeBuffer: function() {
			
			if (!this.bNewType || this.bHighColor) {
				return;
			}
			
			var i, j, k;
			var buf = this.buf;
			var ENCODE_KEY_LENGTH = 326;
			var ENCODE_START_ADDRESS = 0x1C;
			var limitAddress = getLongNum(buf, 0x4, 4);
			var xorKey = new Int16Array(ENCODE_KEY_LENGTH);
			var numCounts = [];
			
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
				numCounts[j][buf[i]]++;
			}
			
			// 出現回数の最も多い値をkeyとする
			for (i = 0; i < ENCODE_KEY_LENGTH; i++) {
				xorKey[i] = numCounts[i].indexOf(Math.max.apply(null, numCounts[i]));
			}
			
			// デコード
			for (i = ENCODE_START_ADDRESS; i < limitAddress; i++) {
				j = (i - ENCODE_START_ADDRESS) % ENCODE_KEY_LENGTH;
				buf[i] = buf[i] ^ xorKey[j];
			}
		},
		initType: function() {
			this.strType += this.bNewType ? "新グラ " : "旧グラ ";
			this.strType += this.bHighColor ? "ハイカラー" : "256色";
			
			if (this.bNewType && !this.bHighColor) {
				noticeError("このタイプは色を正しく再現できません。", 4000);
			}
		},
		initComa: function() {
			var buf = this.buf,
				exte = this.fileInfo.exte,
				address = getLongNum(buf, 0x08, 4) + 40;

			if (this.bNewType) {
				
				// this.coma = getLongNum(buf, 0x6A, 2);
				
				// 行動定義部にある最後の値を出す(かなり曖昧)
				while (true) {
					if(buf[address + 1] === 0x00 &&
						buf[address + 2] === 0x00 &&
						buf[address + 3] === 0x00) {
						break;
					} else {
						address += 40;
					}
				}

				this.coma = getLongNum(buf, address + (buf[address] + 1) * 4, 2);

			} else {
				if (exte === "smi") {
					this.coma = getLongNum(buf, 0x40, 2);
				} else if (exte === "mpr") {
					this.coma = getLongNum(buf, 0x28, 2);
				} else {
					this.coma = getLongNum(buf, 0x38, 2);
				}
			}
		},

		/* ----------------------------------- */
		// init-elseInfo

		initInfo: function() {
			var exte = this.fileInfo.exte,
				buf = this.buf,
				coma = this.coma,
				size = this.fileInfo.size;

			this.widArr = new Int16Array(this.coma);
			this.heiArr = new Int16Array(this.coma);
			this.lefArr = new Int16Array(this.coma);
			this.topArr = new Int16Array(this.coma);

			if (exte === "smi") {
				this.initInfo_for_smi(buf, coma, size);

			} else if (exte === "mpr") {
				this.initInfo_for_mpr(buf, coma, size);

			} else if (equalAnyStr(exte, "sad sd rso rfo rbd rso")) {

				if (this.bNewType) {
					this.bHighColor ? 
						this.initInfo_for_newType_highColor(buf, coma, size) :
						this.initInfo_for_newType_lowColor(buf, coma, size);
				} else {
					this.bHighColor ? 
						this.initInfo_for_oldType_highColor(buf, coma, size) :
						this.initInfo_for_oldType_lowColor(buf, coma, size);
				}
			}
		},
		initInfo_for_smi: function(buf, coma, size) {
			var address,
				i = 0,
				j = 0;
			
			for ( ; j < coma + 1; i += 4, j++) {

				address = coma * 4 + 0x44 + 4 + getLongNum(buf, i + 0x44, 4) * 2;

				if (address > size) {
					this.bFailure = true;
					return;
				}

				this.adrArr[j] = address;
						
				if(j !== coma) {
					this.widArr[j] = getLongNum(buf, address + 0, 2);
					this.heiArr[j] = getLongNum(buf, address + 2, 2);
					this.lefArr[j] = 0;
					this.topArr[j] = 0;
				}
			}
		},
		initInfo_for_mpr: function(buf, coma, size) {
			var mprWidth = getLongNum(buf, 0x2A, 2),
				mprHeight = getLongNum(buf, 0x2C, 2),
				i = 0;


			for ( ; i < coma + 1; i++) {
				this.adrArr[i] = 0x2E + i * mprWidth * mprHeight * 2;

				if (this.adrArr[i] > size) {
					this.bFailure = true;
					return;
				}

				if(i !== coma) {
					this.widArr[i] = mprWidth;
					this.heiArr[i] = mprHeight;
					this.lefArr[i] = 0;
					this.topArr[i] = 0;
				}
			}
		},
		initInfo_for_oldType_lowColor: function(buf, coma, size) {
			var address,
				pl = 0,
				i = 0,
				j = 0;

			for( ; pl < 512; pl++) {
				this.pltData[pl] = buf[pl + 0x40];
			}

			for ( ; j < coma + 1; i += 4, j++) {

				address = coma * 4 + 0x240 + 4 + getLongNum(buf, i + 0x240, 4);

				if (address > size) {
					this.bFailure = true;
					return;
				}

				this.adrArr[j] = address;
				if (j < coma) {
					this.widArr[j] = getLongNum(buf, address + 0, 2);
					this.heiArr[j] = getLongNum(buf, address + 2, 2);
					this.lefArr[j] = getLongNum(buf, address + 4, 2);
					this.topArr[j] = getLongNum(buf, address + 6, 2);

				}
			}
		},
		initInfo_for_oldType_highColor: function(buf, coma, size) {
			var address,
				i = 0,
				j = 0;

			for ( ; j < coma + 1; i += 4, j++) {

				address = coma * 4 + 0x40 + 4 + getLongNum(buf, i + 0x40, 4) * 2;

				if (address > size) {
					this.bFailure = true;
					return;
				}

				this.adrArr[j] = address;
				if (j < coma) {
					this.widArr[j] = getLongNum(buf, address + 0, 2);
					this.heiArr[j] = getLongNum(buf, address + 2, 2);
					this.lefArr[j] = getLongNum(buf, address + 4, 2);
					this.topArr[j] = getLongNum(buf, address + 6, 2);

				}
			}
		},
		initInfo_for_newType_lowColor: function(buf, coma, size) {
			var colorCount,
				address = getLongNum(buf, 0x4, 2),
				pl = 0,
				j = 0,
				m = 0;
				
			// パレットデータ
			var pos = 0x78;
			var limitAddress = getLongNum(buf, 0x4, 2);
			
			// 定義データを回してposを求める（一応残す）
			//var groupLength = getLongNum(buf, 0x68, 2);
			//var g, sceneLength, directionLength;
			//
			//for (g = 0; g < groupLength; ) {
			//	sceneLength = getLongNum(buf, pos, 2);
			//	directionLength = getLongNum(buf, pos + 8, 2);
			//	
			//	if (getLongNum(buf, pos + 2, 2) == 0) {
			//		// seek to data begin
			//		pos += 36 + sceneLength;
			//		
			//		// seek to data end
			//		pos += sceneLength * directionLength * 3;
			//		g++;
			//	} else {
			//		// seek to data end
			//		pos += 32;
			//	}
			//}
			
			pos = limitAddress - ((coma + 1) * 4 * 3) - 512
			
			for(pl = 0; pl < 512; pl++) {
				this.pltData[pl] = buf[pl + pos];
			}
			
			// 画像データ
			for(j = 0; j < coma + 1; j++) {

				if (address > size) {
					this.bFailure = true;
					return;
				}

				this.adrArr[j] = address;

				if (j < coma) {
					this.widArr[j] = getLongNum(buf, address + 0, 2);
					this.heiArr[j] = getLongNum(buf, address + 2, 2);
					this.lefArr[j] = getLongNum(buf, address + 4, 2);
					this.topArr[j] = getLongNum(buf, address + 6, 2);

					address += 8;

					for(m = 0 ; m < this.heiArr[j]; m++, address++) {
						colorCount = buf[address];
						while (colorCount--) {
							address += buf[address + 2] + 2;
						}
					}
				}
			}
		},
		initInfo_for_newType_highColor: function(buf, coma, size) {
			var colorCount,
				address = getLongNum(buf, 0x04, 2),
				j = 0,
				m = 0;

			for ( ; j < coma + 1; j++) {

				if (address > size) {
					this.bFailure = true;
					return;
				}

				this.adrArr[j] = address;
				if (j < coma) {
					this.widArr[j] = getLongNum(buf, address + 0, 2);
					this.heiArr[j] = getLongNum(buf, address + 2, 2);
					this.lefArr[j] = getLongNum(buf, address + 4, 2);
					this.topArr[j] = getLongNum(buf, address + 6, 2);


					address += 8;

					for (m = 0 ; m < this.heiArr[j]; m++, address += 2) {
						colorCount = getLongNum(buf, address, 2);
						while (colorCount--) {
							address += getLongNum(buf, address + 4, 2) * 2 + 4;
						}
					}
				}
			}
		},

		/* ----------------------------------- */
		// init-Shadow

		initShadow: function() {

			if (!equalAnyStr(this.fileInfo.exte, "sad sd")) {
				this.bNoShadow = true;
				return;
			}

			var lastAdr = this.adrArr[this.coma],
				buf = this.buf,
				coma = this.coma,
				size = this.fileInfo.size;

			this.s_widArr = new Int16Array(coma);
			this.s_heiArr = new Int16Array(coma);
			this.s_lefArr = new Int16Array(coma);
			this.s_topArr = new Int16Array(coma);
			
			this.bNewType ? 
				this.initShadow_for_newType(lastAdr, buf, coma, size) :
				this.initShadow_for_oldType(lastAdr, buf, coma, size);
		},
		initShadow_for_oldType: function(lastAdr, buf, coma, size) {
			var address, i, j;
			
			if (getLongNum(buf, lastAdr + 4, 4) === 0 && getLongNum(buf, lastAdr + 8, 4) === 0) {
				this.bNoShadow = true;
			}
			
			// shadow check
			for (i = 0, j = 0; j < coma + 1; i++, j++) {
				address = lastAdr + (coma + 1) * 4 + getLongNum(buf, lastAdr + i * 4, 4);

				if (address > size) {
					this.bFailure = true;
					return;
				}

				this.s_adrArr[j] = address;
			}
			
			if (getLongNum(buf, this.s_adrArr[coma] + 4, 4) === 0 &&
				getLongNum(buf, this.s_adrArr[coma] + 8, 4) === 0) {
				this.bNoShadow = true;
				this.s_adrArr[coma] = lastAdr;
				return;
			}

			for (i = 0, j = 0; j < coma + 1; i++, j++) {
				address = lastAdr + (coma + 1) * 4 + getLongNum(buf, lastAdr + i * 4, 4);

				if (address > size) {
					this.bNoShadow = true;
					return;
				}

				this.s_adrArr[j] = address;
				
				//if (getLongNum(buf, address, 4) === 0 && getLongNum(buf, address + 4, 4) > 0) {
				//	lastAdr = address;
				//	continue;
				//};
				
				if (j < coma && !this.bNoShadow) {
					this.s_widArr[j] = getLongNum(buf, address + 0, 2);
					this.s_heiArr[j] = getLongNum(buf, address + 2, 2);
					this.s_lefArr[j] = getLongNum(buf, address + 4, 2);
					this.s_topArr[j] = getLongNum(buf, address + 6, 2);
				}
			}
		},
		initShadow_for_newType: function(lastAdr, buf, coma, size) {
			var colorCount,
				address = lastAdr,
				j = 0,
				m = 0,
				hei = 0;
			
			// shadow check
			for(j = 0 ; j < coma + 1; j++) {

				this.s_adrArr[j] = address;

				if (address > size) {
					this.bNoShadow = true;
					return;
				}
				
				if (j < coma) {
					hei = getLongNum(buf, address + 2, 2);
					address += 8;
					for(m = 0 ; m < hei; m++, address++) {
						address += 2 * buf[address];
					}
				}
			}
			
			if (this.s_adrArr[coma] >= getLongNum(buf, 0x8, 4)) {
				this.bNoShadow = true;
				this.s_adrArr[coma] = lastAdr;
				return;
			}
			
			address = lastAdr;

			for(j = 0 ; j < coma + 1; j++) {

				this.s_adrArr[j] = address;

				if (address > size) {
					this.bNoShadow = true;
					return;
				}

				if (j < coma) {
					this.s_widArr[j] = getLongNum(buf, address + 0, 2);
					this.s_heiArr[j] = getLongNum(buf, address + 2, 2);
					this.s_lefArr[j] = getLongNum(buf, address + 4, 2);
					this.s_topArr[j] = getLongNum(buf, address + 6, 2);
					
					address += 8;

					for(m = 0 ; m < this.s_heiArr[j]; m++, address++) {
						colorCount = buf[address];
						while (colorCount--) {
							address += 2;
						}
					}
				}
			}
		},
		
		/* ----------------------------------- */
		// init-outline
		
		initOutline: function() {
			
			if (!equalAnyStr(this.fileInfo.exte, "sad sd")) {
				this.bNoOutline = true;
				return;
			}

			var lastAdr = this.s_adrArr[this.coma],
				buf = this.buf,
				coma = this.coma,
				size = this.fileInfo.size;

			this.outline_widArr = new Int16Array(coma);
			this.outline_heiArr = new Int16Array(coma);
			this.outline_lefArr = new Int16Array(coma);
			this.outline_topArr = new Int16Array(coma);
			
			this.bNewType ?
				this.initOutline_for_newType(lastAdr, buf, coma, size) :
				this.initOutline_for_oldType(lastAdr, buf, coma, size);
		},
		initOutline_for_oldType: function(lastAdr, buf, coma, size) {
			var address, i, j;
			
			for (i = 0 , j = 0; j < coma + 1; i++, j++) {
				address = lastAdr + (coma + 1) * 4 + getLongNum(buf, lastAdr + i * 4, 4);

				if (address > size) {
					this.bNoOutline = true;
					return;
				}

				this.outline_adrArr[j] = address;
				
				//if (getLongNum(buf, address, 4) === 0 && getLongNum(buf, address + 4, 4) > 0) {
				//	lastAdr = address;
				//	continue;
				//};
				
				if (j < coma) {
					this.outline_widArr[j] = getLongNum(buf, address + 0, 2);
					this.outline_heiArr[j] = getLongNum(buf, address + 2, 2);
					this.outline_lefArr[j] = getLongNum(buf, address + 4, 2);
					this.outline_topArr[j] = getLongNum(buf, address + 6, 2);
				}
			}
		},
		initOutline_for_newType: function(lastAdr, buf, coma, size) {
			var colorCount,
				address = lastAdr,
				j = 0,
				m = 0;

			for( ; j < coma + 1; j++) {

				this.outline_adrArr[j] = address;

				if (address > size) {
					this.bNoOutline = true;
					return;
				}
				
				if (j < coma) {
					this.outline_widArr[j] = getLongNum(buf, address + 0, 2);
					this.outline_heiArr[j] = getLongNum(buf, address + 2, 2);
					this.outline_lefArr[j] = getLongNum(buf, address + 4, 2);
					this.outline_topArr[j] = getLongNum(buf, address + 6, 2);
					address += 8;

					for(m = 0 ; m < this.outline_heiArr[j]; m++, address++) {
						colorCount = buf[address];
						while (colorCount--) {
							address += 2;
						}
					}
				}
			}
		},


		/* ----------------------------------- */
		// init-calcSize

		initCalcMaxSize: function() {

			if (this.bFailure) {
				return
			}
			
			var i = 0;
			
			// lefMax, topMax
			for (i = 0 ; i < this.coma; i++) {
				this.lefMax = Math.max(
					this.lefMax,
					this.lefArr[i],
					!this.bNoShadow && this.s_lefArr[i],
					!this.bNoOutline && this.outline_lefArr[i]
				);
				this.topMax = Math.max(
					this.topMax,
					this.topArr[i],
					!this.bNoShadow && this.s_topArr[i],
					!this.bNoOutline && this.outline_topArr[i]
				);
			}
			
			// xMax, yMax
			for (i = 0 ; i < this.coma; i++) {
				var _xMax = Math.max(
					this.xMax,
					this.lefMax - this.lefArr[i] + this.widArr[i],
					!this.bNoShadow && (this.lefMax - this.s_lefArr[i] + this.s_widArr[i]),
					!this.bNoOutline && (this.lefMax - this.outline_lefArr[i] + this.outline_widArr[i])
				);
				var _yMax = Math.max(
					this.yMax,
					this.topMax - this.topArr[i] + this.heiArr[i],
					!this.bNoShadow && (this.topMax - this.s_topArr[i] + this.s_heiArr[i]),
					!this.bNoOutline && (this.topMax - this.outline_topArr[i] + this.outline_heiArr[i])
				);
				
				this.xMax = _xMax < 1024 ? _xMax : this.xMax;
				this.yMax = _yMax < 768 ? _yMax : this.yMax;
				
				if (this.xMax > 10000 || this.yMax > 1000) {
					alert("coma: " + i);
					alert(this.lefArr[i] +","+ this.widArr[i] +","+ this.topArr[i] +","+ this.heiArr[i]);
					alert(this.s_lefArr[i] +","+ this.s_widArr[i] +","+ this.s_topArr[i] +","+ this.s_heiArr[i]);
					alert(this.outline_lefArr[i] +","+ this.outline_widArr[i] +","+ this.outline_topArr[i] +","+ this.outline_heiArr[i]);
				}
			}
		},
		
		
		/* ----------------------------------- */
		// decode buffer
		
		initDecodeBuffer2: function() {
			// メモ
			// より確実な復号keyを取得する
			// address配列を3種類全て取得したあと、addressデータ部と比較する
			// 影データがないものはaddressデータ部が全部0となるので処理を分ける
		},
		
		
		/* ----------------------------------- */
		// get palette data
		
		initPalette: function() {
			// メモ
			// initInfoにある処理を写す
			// デコード後に色データを取得させる
		},


		/* ----------------------------------- */
		// print-effect

		printEffect: function(index) {
			var bUseOpacity = $("#efv_inUseOpacity").is(":checked"),
				bNoMargin = $("#efv_inNoMargin").is(":checked"),
				bUseBGColor = $("#efv_inBGColor").is(":checked"),
				drawPixel,

				buf = this.buf,
				exte = this.fileInfo.exte,
				width = this.widArr[index],
				height = this.heiArr[index],
				left = bNoMargin ? 0 : this.lefMax - this.lefArr[index],
				top = bNoMargin ? 0 : this.topMax - this.topArr[index],
				address = this.adrArr[index];

			this.setComaCount(index);
			
			if (bNoMargin) {
				canvas.init(width, height);
			} else {
				canvas.init(this.xMax, this.yMax)
			}
			
			if (bUseBGColor && bUseOpacity) {
				drawPixel = canvas.drawBlendPixel
			} else {
				drawPixel = canvas.drawPixel
			}

			//console.time("drawPixelAll");
			if(width > 0 && width < 3000 && height > 0 && height < 2000) {

				if (exte === "smi") {
					this.printEffect_for_smi(buf, width, height, left, top, address, bUseOpacity, drawPixel);

				} else if (exte === "mpr") {
					this.printEffect_for_mpr(buf, width, height, left, top, address, bUseOpacity, drawPixel);

				} else if (equalAnyStr(exte, "sad sd rso rfo rbd rso")) {
					this.bHighColor ? 
						this.printEffect_for_highColor(buf, width, height, left, top, address, bUseOpacity, drawPixel) :
						this.printEffect_for_lowColor(buf, width, height, left, top, address, bUseOpacity, drawPixel);
				}
			}
			
			//console.timeEnd("drawPixelAll");

			//console.time("update");
			canvas.update();
			//console.timeEnd("update");
		},
		printEffect_for_smi: function(buf, width, height, left, top, address, bUseOpacity, drawPixel) {
			var colorData1, colorData2, pxData,
				he = 0,
				wi = 0;

			address += 4;

			for( ; he < height; he++) {
				for (wi = 0 ; wi < width; wi++) {
					colorData1 = buf[address + 1];
					colorData2 = buf[address + 0];

					pxData = getRGBA(colorData1, colorData2, bUseOpacity, false);

					drawPixel.call(
						canvas,
						left + wi,
						top + he,
						pxData.red,
						pxData.green,
						pxData.blue,
						pxData.alfa
					);
					address += 2;
				}
			}
		},
		printEffect_for_mpr: function(buf, width, height, left, top, address, bUseOpacity, drawPixel) {
			var colorData1, colorData2, pxData,
				he = 0,
				wi = 0;

			for( ; he < height; he++) {
				for (wi = 0; wi < width; wi++) {
					colorData1 = buf[address + 1];
					colorData2 = buf[address + 0];

					pxData = getRGBA(colorData1, colorData2, bUseOpacity, false);

					drawPixel.call(
						canvas,
						left + wi,
						top + he,
						pxData.red,
						pxData.green,
						pxData.blue,
						pxData.alfa
					);
					address += 2;
				}
			}
		},
		printEffect_for_lowColor: function(buf, width, height, left, top, address, bUseOpacity, drawPixel)  {
			var colorCount, colorData1, colorData2, colorWidth, pltData, pxData,
				red, gree, blue, opa,
				pltOptionVal = window.parseInt($("#efv_inPltSelect option:selected").val()),
				b16bitColor = false,
				he = 0,
				wi = 0;

			address += 8;

			if (this.pltFile !== null && pltOptionVal !== 0) {
				pltData = this.pltFile.data[pltOptionVal - 1];
				b16bitColor = this.pltFile.b16bitColor;
			} else {
				pltData = this.pltData;
			}

			for( ; he < height; address++, he++) {
				colorCount = buf[address];
				wi = 0;

				while (colorCount--) {
					colorWidth = buf[address + 2];
					wi += buf[address + 1];

					while(colorWidth--){
						colorData1 = pltData[ buf[address + 3] * 2 + 1 ];
						colorData2 = pltData[ buf[address + 3] * 2 ];

						pxData = getRGBA(colorData1, colorData2, bUseOpacity, b16bitColor);

						drawPixel.call(
							canvas,
							left + wi,
							top + he,
							pxData.red,
							pxData.green,
							pxData.blue,
							pxData.alfa
						);
						wi++;
						address++;
					}
					address += 2;
				}
			}
		},
		printEffect_for_highColor: function(buf, width, height, left, top, address, bUseOpacity, drawPixel)  {
			var colorCount, colorData1, colorData2, colorWidth, pxData,
				red, gree, blue, opa,
				he = 0,
				wi = 0;

			address += 8;

			for( ; he < height; address += 2, he++) {
				colorCount = getLongNum(buf, address, 2);
				wi = 0;

				while (colorCount--) {
					colorWidth = getLongNum(buf, address + 4, 2);
					wi += getLongNum(buf, address + 2, 2);

					while (colorWidth--) {

						colorData1 = buf[address + 7];
						colorData2 = buf[address + 6];
						
						pxData = getRGBA(colorData1, colorData2, bUseOpacity, false);

						drawPixel.call(
							canvas,
							left + wi,
							top + he,
							pxData.red,
							pxData.green,
							pxData.blue,
							pxData.alfa
						);
						wi++;
						address += 2;
					}
					address += 4;
				}
			}
		},


		/* ----------------------------------- */
		// print-shadow

		printShadow: function(index) {

			if (this.bNoShadow ||
				!equalAnyStr(this.fileInfo.exte, "sad sd") ||
				!$("#efv_inShowShadow").is(":checked")) {
				
				return;
			}

			var bNoMargin = $("#efv_inNoMargin").is(":checked"),

				buf = this.buf,
				width = this.s_widArr[index],
				height = this.s_heiArr[index],
				left = bNoMargin ? 0 : this.lefMax - this.s_lefArr[index],
				top = bNoMargin ? 0 : this.topMax - this.s_topArr[index],
				address = this.s_adrArr[index],

				colorCount, colorWidth,
				he = 0,
				wi = 0;

			address += 8;

			this.setComaCount(index);

			if(width > 0 && width < 3000 && height > 0 && height <2000) {

				for( ; he < height; address++, he++) {
					colorCount = buf[address];
					wi = 0;

					while (colorCount--) {
						colorWidth = buf[address + 2];
						wi += buf[address + 1];

						while (colorWidth--) {
							canvas.drawBlendPixel(
								left + wi,
								top + he,
								1,
								1,
								1,
								60
							);
							wi++;
						}
						address += 2;
					}
				}

			}

			canvas.update();
		},


		/* ----------------------------------- */
		// print-outline

		printOutline: function(index) {

			if (!equalAnyStr(this.fileInfo.exte, "sad sd") || !$("#efv_inShowOutline").is(":checked")) {
				
				return;
			}

			var bNoMargin = $("#efv_inNoMargin").is(":checked"),

				buf = this.buf,
				width = this.outline_widArr[index],
				height = this.outline_heiArr[index],
				left = bNoMargin ? 0 : this.lefMax - this.outline_lefArr[index],
				top = bNoMargin ? 0 : this.topMax - this.outline_topArr[index],
				address = this.outline_adrArr[index],

				colorCount, colorWidth,
				he = 0,
				wi = 0;

			address += 8;

			this.setComaCount(index);

			if(width > 0 && width < 3000 && height > 0 && height <2000) {

				for( ; he < height; address++, he++) {
					colorCount = buf[address];
					wi = 0;

					while (colorCount--) {
						colorWidth = buf[address + 2];
						wi += buf[address + 1];

						while (colorWidth--) {
							canvas.drawBlendPixel(
								left + wi,
								top + he,
								1,
								1,
								1,
								60
							);
							wi++;
						}
						address += 2;
					}
				}

			}

			canvas.update();
		},
		

		/* ----------------------------------- */

		outComaData: function() {
			comaTable.removeAll();
			if (!this.bParsable || this.bFailure) {
				return;
			}

			var len = this.widArr.length,
				i = 0;

			if (this.comaTableCache === void 0) {
				this.comaTableCache = "";
				for ( ; i < len; i++) {
					// 高速化のため文字列で処理
					this.comaTableCache +=
						"<tr><td>" + i + "</td>" +
						"<td>" + this.widArr[i] + "</td>" + 
						"<td>" + this.heiArr[i] + "</td></tr>";
				}
			}
			comaTable.addCache(this.comaTableCache, this);
			comaTable.trigIndex(0);
		},
		setComaCount: function(index) {
			$("#efv_comaCountView").html(index + 1 + " / " + this.coma);
		}

	}
	
	function getLongNum(buf, start, length) {
		var num = 0;
		while (length--) {
			num |= buf[start + length] << (length * 8);
		}
		return num;
	}
	
	function equalAnyStr(str, strText) {
		var strArr = strText.split(" "),
			len = strArr.length,
			i = 0;

		for ( ; i < len; i++) {
			if (str === strArr[i]) {
				return true;
			}
		}
		return false;
	}

	function addFigure(num) {
		var strNum = new String(num).replace(/,/g, "");
		while(strNum !== (strNum = strNum.replace(/^(-?\d+)(\d{3})/, "$1,$2"))){};
		return strNum;
	}

	function getRGBA(colorData1, colorData2, bUseOpacity, b16bitColor) {
		var red, green, blue, alfa;

		if (b16bitColor) {
			red = colorData1 & 0xF8;
			green = ((colorData1 << 8 | colorData2) & 0x07E0 ) >> 3;
			blue = (colorData2 & 0x1F) << 3;
		} else {
			red = (colorData1 & 0x7C) << 1;
			green = ((colorData1 << 8 | colorData2) & 0x03E0 ) >> 2;
			blue = (colorData2 & 0x1F) << 3;
		}

		return {
			red: red,
			green: green,
			blue: blue,
			alfa: bUseOpacity ? getOpacity(red, green, blue) : 0xFF
		};
	}

	function getOpacity(red, green, blue) {
		var opacity = Math.round(red + green + blue);
		return opacity;
	}


	/* ---------------------------------------------------------------------- */
	// PaletteFile

	/**
	 * pltファイル
	 * {FileInfo} fileInfo: ファイルの情報
	 * {Uint8ClampedArray} buf: 読み込んだファイルのバッファ
	 */
	function PaletteFile(fileInfo, buf) {
		this.fileInfo = fileInfo;
		this.buf = buf;
		this.data = [];
		this.bParsable = true;
		this.b16bitColor = true;

		this.init();
	}

	PaletteFile.prototype = {
		init: function() {
			var size = this.fileInfo.size;

			this.clearOption();

			if (size === 2562) {
				this.setPlt_for_Monsters();

			} else if(size === 512 || size === 1280) {
				this.setPlt_for_Interface();

			} else if (size == 2560) {
				this.setPlt_for_Heroes();

			} else if(size > 10000) {
				this.setPlt_for_else();
			} else {
				this.bParsable = false;
			}

			if (this.bParsable) {
				$("#efv_inPltSelect").children().eq(1).attr("selected", "selected");
			}
		},
		addOption: function(index) {
			var option = $("<option />").val(index).text(index);
			$("#efv_inPltSelect").append(option);
		},
		clearOption: function() {
			var option = $("<option />").val(0).text("デフォルト").attr("selected", "selected");
			$("#efv_inPltSelect").empty().append(option);
		},
		setPlt_for_Monsters: function() {
			var j,
				i = 0;

			this.b16bitColor = false;

			for( ; i < 5; i++) {
				this.data[i] = [];

				for(j = 0; j < 512; j++) {
					this.data[i][j] = this.buf[i * 512 + 2 + j];
				}

				this.addOption(i + 1);
			}
		},
		setPlt_for_Interface: function() {
			var i = 0;

			this.data[0] = [];

			for( ; i < 512; i++) {
				this.data[0][i] = this.buf[i];
			}

			this.addOption(1);
		},
		setPlt_for_Heroes: function() {
			var j,
				i = 0;

			for( ; i < 5; i++) {
				this.data[i] = [];

				for(j = 0; j < 512; j++) {
					this.data[i][j] = this.buf[i * 512 + j];
				}

				this.addOption(i + 1);
			}
		},
		setPlt_for_else: function() {
			var j,
				i = 0;

			for( ; i < 11; i++) {
				this.data[i] = [];

				for(j = 0; j < 512; j++) {
					this.data[i][j] = this.buf[i * 1280 + j];
				}

				this.addOption(i + 1);
			}
		}
	}

	/* ---------------------------------------------------------------------- */
	// Table & Column

	/**
	 * テーブル
	 * {String} id: テーブルtbodyのid
	 * {Function} clickFunc: 行をクリックした時のコールバック
	 */
	function Table(id, parentSpaceId, clickFunc) {
		this.init(id, parentSpaceId, clickFunc);
	}

	Table.prototype = {
		body: null,
		head: null,
		columns: null,
		lastClickIndex: -1,
		clickFunc: void 0,
		parentSpace: null,

		init: function(id, parentSpaceId, clickFunc) {
			this.body = $("#" + id);
			this.head = this.body.children("tr:first-child");
			this.columns = [],
			this.lastClickIndex = -1;
			this.clickFunc = clickFunc;
			this.parentSpace = $("#" + parentSpaceId);
			this.setColumnEvent()
		},
		setColumnEvent: function() {
			var _this = this;
			
			this.body.on("mousedown", "tr", function(event, bForceUpdate){
				var top, selectTop, height, margin;
				var index = $(this).index() - 1;
				var column = _this.columns[index];
				
				if (!column) {
					return;
				}
				
				if (_this.lastClickIndex === column.index && !bForceUpdate) {
					return;
				}

				// Set table scroll-top
				top = _this.parentSpace.scrollTop();
				selectTop = column.index * 19;
				height = _this.parentSpace.height() - 55;
				margin = height / 6;

				if (selectTop < top + margin) {
					_this.parentSpace.scrollTop(selectTop - margin);

				} else if (selectTop > top + height - margin) {
					_this.parentSpace.scrollTop(selectTop - height + margin);
				}

				// Set column background-color
				if (_this.columns[_this.lastClickIndex]) {
					_this.columns[_this.lastClickIndex].elem.find("td").removeClass("efv_column_active");
				}
				$(this).children().addClass("efv_column_active");

				// Callback
				_this.clickFunc(column.data, column.index);

				_this.lastClickIndex = column.index;
			});
		},
		trigIndex: function(index, bForceUpdate) {
			this.columns[index] && this.columns[index].elem.trigger("mousedown", [bForceUpdate]);
		},
		trigLastSelect: function() {
			this.trigIndex(this.lastClickIndex, true);
		}
	}

	/**
	 * テーブルの行
	 * {Array} dataArray: tdに入れるためのデータ
	 * {Object-jQuery} : テーブルのtbodyのjQueryオブジェクト
	 */
	function Column(dataArr, tbody) {
		this.elem = null;
		this.index = -1;
		this.data = null;
		dataArr && this.init(dataArr, tbody);
	}

	Column.prototype = {
		init: function(dataArr, tbody) {
			var len = dataArr.length,
				td = "",
				i = 0;

			for ( ; i < len; i++) {
				td += "<td>" + dataArr[i] + "</td>"; // 高速化のため
			}

			this.elem = $("<tr />").append(td)
			tbody.append(this.elem);
		},
		set: function(index, data) {
			this.elem.children().eq(index).text(data);
		}
	}

	/**
	 * ファイルのテーブル用。Tableの拡張。
	 * {String} id: テーブルtbodyのid
	 * {Function} clickFunc: 行をクリックした時のコールバック
	 */
	function FileTable(id, parentSpaceId, clickFunc) {
		this.init(id, parentSpaceId, clickFunc);
		this.description = this.body.children("tr:nth-child(2)");
	}

	$.extend(FileTable.prototype, Table.prototype, {
		firstAdd: true,
		description: null, 
		add: function(dataArr, data) {
			if (this.firstAdd) {
				this.removeAll();
				this.firstAdd = false;
			}
			var column = new Column(dataArr, this.body);
			column.index = this.columns.length;
			column.data = data;
			this.columns.push(column);
		},
		removeAll: function() {

			this.body.empty();
			this.columns = [];

			this.body.append(this.head);

			!this.firstAdd && this.body.append(this.description);

			this.firstAdd = true;
			this.lastClickIndex = -1;
		}
	});

	/**
	 * ファイルのテーブル用。Tableの拡張。
	 * {String} id: テーブルtbodyのid
	 * {Function} clickFunc: 行をクリックした時のコールバック
	 */
	function ComaTable(id, parentSpaceId, clickFunc) {
		this.init(id, parentSpaceId, clickFunc);
	}

	$.extend(ComaTable.prototype, Table.prototype, {
		interval: null,
		addCache: function(cache, data) {
			var _this = this;

			this.body.append($(cache).each(function() {
				var column = new Column;
				column.elem = $(this);
				column.index = _this.columns.length;
				column.data = data;
				_this.columns.push(column);
			}));
		},
		trigNext: function() {
			var index = this.lastClickIndex + 1;
			index = index > this.columns.length - 1 ? 0 : index;
			this.trigIndex(index);
		},
		trigPrev: function() {
			var index = this.lastClickIndex - 1;
			index = index < 0 ? this.columns.length - 1 : index;
			this.trigIndex(index);
		},
		play: function() {
			if (this.interval === void 0) {
				this.interval = setInterval(function(){
					comaTable.trigNext();
				}, 1000 / 16);
			}
		},
		stop: function() {
			clearInterval(this.interval);
			this.interval = void 0;
		},
		removeAll: function() {
			this.stop();

			this.body.empty();
			this.columns = [];

			this.body.append(this.head);
			this.lastClickIndex = -1;
		}
	});


	/* ---------------------------------------------------------------------- */
	// Canvas

	/**
	 * canvasの描画用。
	 * {String} id: canvasのid
	 */
	function Canvas(id) {
		this.canvas = document.getElementById(id);
		this.context = this.canvas.getContext("2d");
		this.$canvas = $("#" + id);

		this.width = 0;
		this.height = 0;
		this.imgData = null;
		this.pxData = null;
		this.initPxData = null;

		this.bDrawError = false;
		this.supportTypedArray = window.Uint8ClampedArray !== void 0 ? true : false;

		this.init(100, 100);
	}

	Canvas.prototype = {

		init: function(w, h) {
			if (!w || w > 0xFFFF || !h || h > 0xFFFF || 
				(w === this.width && h === this.height)) {
				return;
			}

			this.$canvas.attr({
				width: w,
				height: h
			});
			this.width = w;
			this.height = h;
			this.imgData = this.context.getImageData(0, 0, w, h);
			this.pxData = this.imgData.data;
			//this.initPxData = this.supportTypedArray && new Uint8ClampedArray(this.pxData.length);
			
			if ($("#efv_inBGColor").is(":checked")) {
				this.clear(false);
			}
		},
		drawPixel: function(x, y, new_R, new_G, new_B, new_A) {
			
			if (x >= this.width || x < 0 || y >= this.height || y < 0) {
				this.bDrawError = true;
				return
			}
			
		    var index = (x + y * this.width) * 4;
		    
		    this.pxData[index + 0] = new_R;
		    this.pxData[index + 1] = new_G;
		    this.pxData[index + 2] = new_B;
		    this.pxData[index + 3] = new_A;
		},
		drawBlendPixel: function(x, y, new_R, new_G, new_B, new_A) {

			if (x >= this.width || x < 0 || y >= this.height || y < 0) {
				this.bDrawError = true;
				return
			}
			
		    var index = (x + y * this.width) * 4,
				old_R = this.pxData[index + 0],
				old_G = this.pxData[index + 1],
				old_B = this.pxData[index + 2],
				old_A = this.pxData[index + 3],
				opa = new_A / 255;

		    this.pxData[index + 0] = (old_R + new_R * opa) / (1 + opa);
		    this.pxData[index + 1] = (old_G + new_G * opa) / (1 + opa);
		    this.pxData[index + 2] = (old_B + new_B * opa) / (1 + opa);
		    this.pxData[index + 3] = Math.max(old_A, new_A);
		},
		update: function() {
			if (this.bDrawError) {
				noticeError("一部の描画に失敗しました。");
				this.bDrawError = false;
			}
		    this.context.putImageData(this.imgData, 0, 0);
		},
		clear: function(bUpdate) {
			
			//if (this.supportTypedArray) {
			//	this.pxData.set(this.initPxData)
			//} else {
			//	var len = this.pxData.length,
			//		i = 0;
			//	for ( ; i < len; i++) {
			//		this.pxData[i] = 0;
			//	}
			//}
			
			var len = this.pxData.length,
				i = 0;
				bgcol = [canvasBGColor.r, canvasBGColor.g, canvasBGColor.b, 0xFF],
				bUseBGColor = $("#efv_inBGColor").is(":checked");
			
			if (bUseBGColor) {
				for ( ; i < len; i++) {
					this.pxData[i] = bgcol[i % 4];
				}
			} else {
				for ( ; i < len; i++) {
					this.pxData[i] = 0;
				}
			}

			bUpdate && this.update();
		}
	}


	/* ---------------------------------------------------------------------- */
	// EffectZip

	/**
	 * 画像出力用
	 */
	function EffectZip() {
		this.zipFile = null;
		this.zipCount = 1;
		this.zipRange = null;
		this.effectName = null;
		this.effectFile = null;
		this.bFirstZip = true;

		this.init();
	}

	EffectZip.prototype = {
		init: function() {
			
			var fileIndex = fileTable.lastClickIndex,
				nowSize = 0;

			if (!fileTable.columns[fileIndex]) {
				return
			}

			this.effectFile = fileTable.columns[fileIndex].data;
			
			if (!this.effectFile || !this.effectFile.bParsable || bAlreadyOut) {
				return
			}

			$("#efv_zipUrl").empty().text("zip ");
			comaTable.stop();

			this.zipFile = new JSZip();
			this.zipRange = [0, this.effectFile.coma];
			this.effectName = this.effectFile.fileInfo.nameWithoutExte;

			$(canvas.$canvas).hide();
			$("#efv_leftColumn").children().hide();
			$("#efv_maskArea, #efv_maskInner").show();

			this.loop(nowSize, 0, this.effectFile.coma)
		},
		loop: function(nowSize, count, max) {

			if (count >= max || bCancelOut) {
				this.callback(true, count >= max);
				bCancelOut = false;
				return;
			}

			comaTable.trigIndex(count);

			var rate = Math.round((count) * 100 / max),
				imgData = canvas.canvas.toDataURL("image/png").replace("data:image/png;base64,", ""),
				imgName = this.effectName + "_" + count + ".png",
				//imgName = this.effectName + "_" + ("000" + count).slice(-4) + ".png",
				_this = this;

			// Blobがサポートされていない場合にChromeがクラッシュするため、zipを小分けにする
			nowSize += (imgData + "_").length * 0.75;
			if (!JSZip.support.blob && nowSize > 1000 * 1000) {
				this.callback(false, false);
				this.zipFile = new JSZip();
				this.zipCount++;
				nowSize = 0;
				this.zipRange[0] = count;
			}

			$("#efv_maskText").html("zipファイル作成中...(" + rate + "％)");
			progresbar.set(rate);

			this.zipRange[1] = count;
			this.zipFile.file(imgName, imgData, {base64: true});

			setTimeout(function() {
				_this.loop(nowSize, count + 1, max);
			}, 1);

		},
		callback: function(bForceEnd, bEnd) {

			var zipHref, zipName, downloadTag, downloadInput;

			if (bForceEnd) {
				bAlreadyOut = bEnd;
				canvas.$canvas.show();
				$("#efv_leftColumn").children().show();
				$("#efv_maskArea, #efv_maskInner").hide();
				comaTable.trigIndex(this.effectFile.coma - 1);
			}

			if (!bCancelOut) {

				if (this.bFirstZip) {
					this.bFirstZip = false;
					this.zipFile.file(this.effectName + ".txt", createTextData(this.effectFile))
				}
				
				zipHref = JSZip.support.blob ?
					window.URL.createObjectURL(this.zipFile.generate({type: "blob"})) :
					"data:application/zip;base64," + this.zipFile.generate();
				
				zipName = this.effectName + "_Data_" + this.zipRange[0] + "-" + this.zipRange[1] + ".zip";

				downloadTag = $("<a />").attr({
					target: "_blank",
					href: zipHref,
					download: zipName
				}).hide();

				downloadInput = $("<input />").on("click", function() {
					var ev;

					if (document.createEvent && window.dispatchEvent) {
						ev = document.createEvent('MouseEvents');
						ev.initEvent("click", true, true);
						downloadTag[0].dispatchEvent(ev);
					} else {
						downloadTag[0].click();
					}
				}).attr("type", "button").val(this.zipCount).addClass("downloadButton");

				$("#efv_zipUrl").append(downloadTag, downloadInput);
				
				if (JSZip.support.blob) {
					downloadInput.trigger("click").hide();
					$("#efv_zipUrl").empty();
				}
			}
		}
	}

	function createTextData(effectFile) {
		var i = 0,
			outText = "",
			useMargin = !$("#efv_inNoMargin").is(":checked");

		outText += "\n" +
			"[ファイル名] " + effectFile.fileInfo.name + "\n" +
			"[タイプ] " + effectFile.strType + "\n" +
			"[コマ数] " + effectFile.coma + " コマ\n" +
			(useMargin && ("[基準値] " + "x: " + effectFile.lefMax + ", y: " + effectFile.topMax)) +
			"\n" +
			" コマ " + "  幅px" + " 高さpx" + "   左px" + "   上px\n";

		for ( ; i < effectFile.coma; i++) {
			outText += "[" + addSpace(i, 4) + "] " +
				addSpace(effectFile.widArr[i], 4) + "   " +
				addSpace(effectFile.heiArr[i], 4) + "   " +
				addSpace(effectFile.lefArr[i], 4) + "   " +
				addSpace(effectFile.topArr[i], 4) + "\n";
		}

		return outText;
	}

	function addSpace(text, strLength) {
		var len = text.toString().length;

		while (len++ < strLength) {
			text = " " + text;
		}
		return text;
	}
	
	function downloadImg() {
	
		var fileIndex = fileTable.lastClickIndex;
		var comaIndex = comaTable.lastClickIndex;
		
		if (!fileTable.columns[fileIndex]) {
			return
		}
		
		var effectFile = fileTable.columns[fileIndex].data;
		
		if (!effectFile || !effectFile.bParsable) {
			return
		}
		
		var effectName = effectFile.fileInfo.nameWithoutExte;
		//var imgName = effectName + "_" + ("000" + comaIndex).slice(-4) + ".png";
		var imgName = effectName + "_" + comaIndex + ".png";
		var imgUrl = canvas.canvas.toDataURL("image/png");
		
		var ev;
		var downloadTag = $("<a />").attr({
			target: "_blank",
			href: imgUrl,
			download: imgName
		}).hide();
		
		if (document.createEvent && window.dispatchEvent) {
			ev = document.createEvent('MouseEvents');
			ev.initEvent("click", true, true);
			downloadTag[0].dispatchEvent(ev);
		} else {
			downloadTag[0].click();
		}
	}

	/* ---------------------------------------------------------------------- */
	// ProgressBar

	/**
	 * プログレスバー
	 * {String} pid: 親要素のid
	 * {String} cid: 子要素のid
	 */
	function ProgressBar(pid, cid) {
		this.parent = $("#" + pid);
		this.child = $("#" + cid);
		this.parentWidth = this.parent.width();
	}

	ProgressBar.prototype = {
		set: function(rate) {
			rate = Math.max(0 ,Math.min(100, rate));
			this.child.css("width", rate + "%");
		}
	}


	/* ---------------------------------------------------------------------- */
	// initialize

	fileTable = new FileTable("efv_fileTbody", "efv_fileTableSpace", function(data){
		data.bParsable && canvas.init(data.xMax, data.yMax);
		canvas.clear(true);
		data.load();
		bAlreadyOut = false;

		$("#efv_zipUrl").empty();
		
		if (data.bNoShadow) {
			$("#efv_inShowShadow").removeAttr("checked").parent().hide();
		} else {
			$("#efv_inShowShadow").parent().show();
		}
		
		if (data.bNoOutline) {
			$("#efv_inShowOutline").removeAttr("checked").parent().hide();
		} else {
			$("#efv_inShowOutline").parent().show();
		}
		
		if ($("#efv_inShowShadow").is(":checked") || $("#efv_inShowOutline").is(":checked")) {
			$("#efv_inNoMargin").removeAttr("checked").parent().hide();
		} else {
			$("#efv_inNoMargin").parent().show();
		}
	});
	comaTable = new ComaTable("efv_comaTbody", "efv_comaTableSpace", function(data, index){
		canvas.clear(false);
		data.printEffect(index);
		data.printShadow(index);
		data.printOutline(index);
	});
	canvas = new Canvas("efv_canvas");
	progresbar = new ProgressBar("efv_progressParent", "efv_progressChild");


	$("#efv_inClearAllFile").on("click", function() {
		fileTable.removeAll();
		comaTable.removeAll();
		canvas.init(100, 100);
		bAlreadyOut = false;
		$("#efv_zipUrl").empty();
	});

	$("#efv_inUseOpacity, #efv_inShowShadow, #efv_inShowOutline, #efv_inNoMargin, #efv_inBGColor").on("click", function(){
		if ($("#efv_inShowShadow").is(":checked") || $("#efv_inShowOutline").is(":checked")) {
			$("#efv_inNoMargin").removeAttr("checked").parent().hide();
		} else {
			$("#efv_inNoMargin").parent().show();
		}
		
		comaTable.trigLastSelect();
		bAlreadyOut = false;
	}).removeAttr("checked");

	$("#efv_inBtnNext").on("mousedown", function(){
		comaTable.trigNext();
	});

	$("#efv_inBtnPrev").on("mousedown", function(){
		comaTable.trigPrev();
	});

	$("#efv_inBtnPlay").on("mousedown", function(){
		comaTable.play();
	});

	$("#efv_inBtnStop").on("mousedown", function(){
		comaTable.stop();
	});

	$("#efv_inPltSelect").change(function() {
		comaTable.trigLastSelect();
	});

	$("#efv_maskArea").css("opacity", 0.5);
	$("#efv_cancelOut").on("click", function() {
		bCancelOut = true;
	});

	if (window.navigator.userAgent.toLowerCase().indexOf('msie') != -1) {
		$("#efv_zipArea").hide();

	} else {
		$("#efv_outZip").on("click", function() {
			new EffectZip();
		});
	}
	
	$("#efv_outImg").on("click", downloadImg);
	
	// color picker
	$('.color-box').colpick({
		colorScheme:'light',
		layout:'rgbhex',
		color:'ff8800',
		onSubmit:function(hsb, hex, rgb, el) {
			$(el).css('background-color', '#' + hex);
			$(el).colpickHide();
			canvasBGColor = rgb;
			comaTable.trigLastSelect();
			bAlreadyOut = false;
		}
	}).css('background-color', '#000');

})();
