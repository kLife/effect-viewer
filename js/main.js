/* global $, Koukun */

// ==================================================
// メイン
// ==================================================
(function() {
	
	$(document).ready(function() {
		var _App = Koukun.EffectViewer;
		var _Constant = Koukun.EffectViewer.Constant;
		var _Message = Koukun.EffectViewer.Message;
		
		_App.logger = new Koukun.cl.Logger({showCaller: true});
		_App.fileSaver = new Koukun.cl.FileSaver();
		
		_App.fileManager = new _App.FileManager();
		_App.uiManager = new _App.UIManager();
		_App.canvasManager = new _App.CanvasManager();
		_App.mainManager = new _App.MainManager();
		
		if (_App.mainManager.checkBasicSupport()) {
			_App.fileManager.initialize();
			_App.uiManager.initialize();
			_App.canvasManager.initialize();
			_App.mainManager.initialize();
		} else {
			_App.uiManager.notice(_Message.get("not_support_file_reader"));
		}
	});
})();
