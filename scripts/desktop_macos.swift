// Native window for the existing local UI. No model calls or privileged JS bridge.
import AppKit
import WebKit

final class AriadneApp: NSObject, NSApplicationDelegate, NSWindowDelegate, WKNavigationDelegate, WKUIDelegate, WKDownloadDelegate {
    var windows: [NSWindow] = []
    var service: Process?
    var input: Pipe?
    var output = Data()
    var ready = false
    var quitting = false
    var showingError = false
    var origin = URL(string: "http://127.0.0.1:8000")!
    var home = FileManager.default.homeDirectoryForCurrentUser.appendingPathComponent("Library/Application Support/Ariadne Local")
    var runtime: URL { Bundle.main.resourceURL!.appendingPathComponent("runtime") }
    var logURL: URL { home.appendingPathComponent("desktop.log") }

    func applicationDidFinishLaunching(_ notification: Notification) {
        NSApp.setActivationPolicy(.regular)
        makeMenus()
        let view = makeWindow(configuration: WKWebViewConfiguration())
        let loading = NSTextField(labelWithString: "正在打开 Ariadne…")
        loading.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(loading)
        NSLayoutConstraint.activate([loading.centerXAnchor.constraint(equalTo: view.centerXAnchor), loading.centerYAnchor.constraint(equalTo: view.centerYAnchor)])
        NSApp.activate(ignoringOtherApps: true)
        do {
            #if DESKTOP_QA
            home = Bundle.main.bundleURL.deletingLastPathComponent().appendingPathComponent("qa-home")
            origin = URL(string: "http://127.0.0.1:18761")!
            let args = CommandLine.arguments
            if let index = args.firstIndex(of: "--home"), index + 1 < args.count { home = URL(fileURLWithPath: args[index + 1]) }
            if let index = args.firstIndex(of: "--port"), index + 1 < args.count, let port = Int(args[index + 1]), (1024...65535).contains(port) {
                origin = URL(string: "http://127.0.0.1:\(port)")!
            }
            #endif
            try FileManager.default.createDirectory(at: home, withIntermediateDirectories: true, attributes: [.posixPermissions: 0o700])
            if !FileManager.default.fileExists(atPath: logURL.path) { FileManager.default.createFile(atPath: logURL.path, contents: nil, attributes: [.posixPermissions: 0o600]) }
            let log = try FileHandle(forWritingTo: logURL)
            try log.seekToEnd()
            let process = Process()
            process.executableURL = runtime.appendingPathComponent("python/bin/python3")
            process.arguments = ["-I", "-B", runtime.appendingPathComponent("local_package.py").path, "desktop", "--home", home.path, "--port", String(origin.port!)]
            let parentPipe = Pipe()
            let stdout = Pipe()
            process.standardInput = parentPipe
            process.standardOutput = stdout
            process.standardError = log
            process.terminationHandler = { [weak self] _ in
                DispatchQueue.main.async {
                    guard let self, !self.quitting, !self.showingError else { return }
                    self.fail("本地服务未能运行。端口可能被另一份 Ariadne 占用，请先退出原服务再试。\n日志：\(self.logURL.path)")
                }
            }
            stdout.fileHandleForReading.readabilityHandler = { [weak self] handle in
                let data = handle.availableData
                if data.isEmpty { handle.readabilityHandler = nil; return }
                DispatchQueue.main.async { self?.received(data, loading: loading, view: view) }
            }
            input = parentPipe
            service = process
            try process.run()
            // Closing this copy is important: only the native App owns the writer.
            try? parentPipe.fileHandleForReading.close()
            DispatchQueue.main.asyncAfter(deadline: .now() + 90) { [weak self] in
                guard let self, !self.ready, !self.quitting else { return }
                self.fail("启动超时。请重新打开 Ariadne。\n日志：\(self.logURL.path)")
            }
        } catch { fail("无法启动 Ariadne：\(error.localizedDescription)") }
    }

    func received(_ data: Data, loading: NSTextField, view: WKWebView) {
        guard !quitting, !ready else { return }
        output.append(data)
        if output.count > 65_536 { fail("本地启动响应异常，请查看日志。"); return }
        while let range = output.range(of: Data([10])) {
            let line = output.subdata(in: output.startIndex..<range.lowerBound)
            output.removeSubrange(output.startIndex..<range.upperBound)
            if let state = try? JSONSerialization.jsonObject(with: line) as? [String: String],
               state["status"] == "ready", state["origin"] == origin.absoluteString {
                ready = true
                loading.removeFromSuperview()
                view.window?.makeKeyAndOrderFront(nil)
                NSApp.activate(ignoringOtherApps: true)
                view.load(URLRequest(url: origin))
            }
        }
    }

    func makeMenus() {
        let bar = NSMenu()
        let appItem = NSMenuItem()
        let appMenu = NSMenu()
        appMenu.addItem(withTitle: "关于 Ariadne", action: #selector(NSApplication.orderFrontStandardAboutPanel(_:)), keyEquivalent: "")
        appMenu.addItem(.separator())
        let login = appMenu.addItem(withTitle: "登录 Codex…", action: #selector(loginCodex), keyEquivalent: "")
        login.target = self
        appMenu.addItem(.separator())
        appMenu.addItem(withTitle: "隐藏 Ariadne", action: #selector(NSApplication.hide(_:)), keyEquivalent: "h")
        appMenu.addItem(withTitle: "退出 Ariadne", action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q")
        appItem.submenu = appMenu
        bar.addItem(appItem)
        let file = NSMenuItem(title: "文件", action: nil, keyEquivalent: "")
        let fileMenu = NSMenu(title: "文件")
        fileMenu.addItem(withTitle: "关闭窗口", action: #selector(NSWindow.performClose(_:)), keyEquivalent: "w")
        file.submenu = fileMenu
        bar.addItem(file)
        let edit = NSMenuItem(title: "编辑", action: nil, keyEquivalent: "")
        let menu = NSMenu(title: "编辑")
        for (title, selector, key) in [("撤销", "undo:", "z"), ("剪切", "cut:", "x"), ("复制", "copy:", "c"), ("粘贴", "paste:", "v"), ("全选", "selectAll:", "a")] {
            menu.addItem(withTitle: title, action: Selector(selector), keyEquivalent: key)
        }
        edit.submenu = menu
        bar.addItem(edit)
        NSApp.mainMenu = bar
    }

    @objc func loginCodex() {
        // Explicit user action opens the existing official login flow in Terminal.
        NSWorkspace.shared.open(runtime.appendingPathComponent("登录 Codex.command"))
    }

    @discardableResult func makeWindow(configuration: WKWebViewConfiguration) -> WKWebView {
        #if DESKTOP_QA
        // Native automation captures occluded windows; WebKit pauses their
        // animation clock. Finish finite animations only in this test build.
        configuration.userContentController.addUserScript(WKUserScript(source: "setInterval(()=>document.getAnimations().forEach(a=>{if(a.effect?.getTiming().iterations!==Infinity){try{a.finish()}catch(e){}}}),100)", injectionTime: .atDocumentEnd, forMainFrameOnly: false))
        #endif
        let view = WKWebView(frame: NSRect(x: 0, y: 0, width: 1180, height: 800), configuration: configuration)
        view.navigationDelegate = self
        view.uiDelegate = self
        view.allowsBackForwardNavigationGestures = true
        let window = NSWindow(contentRect: view.frame, styleMask: [.titled, .closable, .miniaturizable, .resizable], backing: .buffered, defer: false)
        window.title = "Ariadne · 衡"
        window.minSize = NSSize(width: 760, height: 560)
        let controller = NSViewController()
        controller.view = view
        window.contentViewController = controller
        window.delegate = self
        window.isReleasedWhenClosed = false
        window.center()
        windows.append(window)
        window.makeKeyAndOrderFront(nil)
        return view
    }

    func windowWillClose(_ notification: Notification) {
        if let window = notification.object as? NSWindow { windows.removeAll { $0 === window } }
        if windows.isEmpty { NSApp.terminate(nil) }
    }
    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool { true }
    func applicationShouldHandleReopen(_ sender: NSApplication, hasVisibleWindows flag: Bool) -> Bool {
        windows.first?.makeKeyAndOrderFront(nil)
        return true
    }
    func applicationShouldTerminate(_ sender: NSApplication) -> NSApplication.TerminateReply {
        if quitting { return .terminateNow }
        quitting = true
        try? input?.fileHandleForWriting.close()
        guard let service, service.isRunning else { return .terminateNow }
        DispatchQueue.global().async {
            service.waitUntilExit()
            DispatchQueue.main.async { NSApp.reply(toApplicationShouldTerminate: true) }
        }
        return .terminateLater
    }
    func fail(_ message: String) {
        guard !quitting, !showingError else { return }
        showingError = true
        // Stop our service even while an error dialog is visible.
        try? input?.fileHandleForWriting.close()
        let alert = NSAlert()
        alert.messageText = "Ariadne 无法继续运行"
        alert.informativeText = message
        alert.addButton(withTitle: "退出")
        alert.runModal()
        NSApp.terminate(nil)
    }

    func isLocal(_ url: URL) -> Bool {
        (url.scheme == "http" && url.host == "127.0.0.1" && url.port == origin.port)
        || url.absoluteString == "about:blank"
        || url.absoluteString.hasPrefix("blob:\(origin.absoluteString)/")
    }
    func webView(_ webView: WKWebView, decidePolicyFor action: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        guard let url = action.request.url else { decisionHandler(.cancel); return }
        if isLocal(url) { decisionHandler(action.shouldPerformDownload ? .download : .allow); return }
        if action.targetFrame?.isMainFrame != false && ["http", "https", "mailto"].contains(url.scheme ?? "") { NSWorkspace.shared.open(url) }
        decisionHandler(.cancel)
    }
    func webView(_ webView: WKWebView, decidePolicyFor response: WKNavigationResponse, decisionHandler: @escaping (WKNavigationResponsePolicy) -> Void) {
        decisionHandler(response.canShowMIMEType ? .allow : .download)
    }
    func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration, for action: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
        guard let url = action.request.url, isLocal(url) else { return nil }
        return makeWindow(configuration: configuration)
    }
    func webViewDidClose(_ webView: WKWebView) { webView.window?.close() }
    func webViewWebContentProcessDidTerminate(_ webView: WKWebView) {
        fail("页面进程意外停止，请重新打开 Ariadne。已保存的资料保留。")
    }
    #if DESKTOP_QA
    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        DispatchQueue.main.asyncAfter(deadline: .now() + 2) {
            try? "visible=\(webView.window?.isVisible ?? false) occlusion=\(String(describing: webView.window?.occlusionState)) active=\(NSApp.isActive) frame=\(webView.frame)".write(to: self.home.appendingPathComponent("native-state.txt"), atomically: true, encoding: .utf8)
            webView.evaluateJavaScript("JSON.stringify({visibility:document.visibilityState,focused:document.hasFocus(),time:document.timeline.currentTime,url:location.href,body:document.body.className,styles:[document.documentElement,document.body,...document.querySelectorAll('.runtime-shell,.runtime-selector,.runtime-menu-item')].map(e=>({tag:e.tagName,id:e.id,rect:e.getBoundingClientRect().toJSON(),opacity:getComputedStyle(e).opacity,display:getComputedStyle(e).display,visibility:getComputedStyle(e).visibility,background:getComputedStyle(e).backgroundColor})),errors:document.querySelector('#runtime-message')?.textContent})") { value, error in
                try? String(describing: value ?? error as Any).write(to: self.home.appendingPathComponent("webview-state.txt"), atomically: true, encoding: .utf8)
            }
            webView.takeSnapshot(with: nil) { image, _ in
                if let tiff = image?.tiffRepresentation, let bitmap = NSBitmapImageRep(data: tiff), let png = bitmap.representation(using: .png, properties: [:]) {
                    try? png.write(to: self.home.appendingPathComponent("webview.png"))
                }
            }
        }
    }
    #endif
    func webView(_ webView: WKWebView, runOpenPanelWith parameters: WKOpenPanelParameters, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping ([URL]?) -> Void) {
        let panel = NSOpenPanel()
        panel.allowsMultipleSelection = parameters.allowsMultipleSelection
        panel.canChooseDirectories = parameters.allowsDirectories
        panel.canChooseFiles = true
        completionHandler(panel.runModal() == .OK ? panel.urls : nil)
    }
    func webView(_ webView: WKWebView, runJavaScriptAlertPanelWithMessage message: String, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping () -> Void) {
        let alert = NSAlert(); alert.messageText = message; alert.addButton(withTitle: "好")
        alert.beginSheetModal(for: webView.window!) { _ in completionHandler() }
    }
    func webView(_ webView: WKWebView, runJavaScriptConfirmPanelWithMessage message: String, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping (Bool) -> Void) {
        let alert = NSAlert(); alert.messageText = message
        alert.addButton(withTitle: "确定"); alert.addButton(withTitle: "取消")
        alert.beginSheetModal(for: webView.window!) { completionHandler($0 == .alertFirstButtonReturn) }
    }
    func webView(_ webView: WKWebView, runJavaScriptTextInputPanelWithPrompt prompt: String, defaultText: String?, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping (String?) -> Void) {
        let alert = NSAlert(); alert.messageText = prompt
        let field = NSTextField(frame: NSRect(x: 0, y: 0, width: 320, height: 24)); field.stringValue = defaultText ?? ""
        alert.accessoryView = field; alert.addButton(withTitle: "确定"); alert.addButton(withTitle: "取消")
        alert.beginSheetModal(for: webView.window!) { completionHandler($0 == .alertFirstButtonReturn ? field.stringValue : nil) }
    }
    func webView(_ webView: WKWebView, navigationAction: WKNavigationAction, didBecome download: WKDownload) { download.delegate = self }
    func webView(_ webView: WKWebView, navigationResponse: WKNavigationResponse, didBecome download: WKDownload) { download.delegate = self }
    func download(_ download: WKDownload, decideDestinationUsing response: URLResponse, suggestedFilename: String, completionHandler: @escaping (URL?) -> Void) {
        let panel = NSSavePanel(); panel.nameFieldStringValue = (suggestedFilename as NSString).lastPathComponent
        completionHandler(panel.runModal() == .OK ? panel.url : nil)
    }
}

let app = NSApplication.shared
let delegate = AriadneApp()
app.delegate = delegate
app.run()
