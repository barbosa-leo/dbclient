import AppKit

// Without an Edit menu wired to the responder chain, ⌘C/⌘V/⌘Z do nothing inside a WKWebView.
enum MainMenu {
    static func build() -> NSMenu {
        let main = NSMenu()
        main.addItem(submenu(appMenu()))
        main.addItem(submenu(editMenu()))
        main.addItem(submenu(viewMenu()))

        let window = windowMenu()
        main.addItem(submenu(window))
        NSApp.windowsMenu = window

        let help = helpMenu()
        main.addItem(submenu(help))
        NSApp.helpMenu = help
        return main
    }

    private static func submenu(_ menu: NSMenu) -> NSMenuItem {
        let item = NSMenuItem()
        item.submenu = menu
        return item
    }

    private static func item(
        _ title: String,
        _ action: Selector?,
        _ key: String = "",
        modifiers: NSEvent.ModifierFlags = .command
    ) -> NSMenuItem {
        let item = NSMenuItem(title: title, action: action, keyEquivalent: key)
        item.keyEquivalentModifierMask = modifiers
        return item
    }

    private static func appMenu() -> NSMenu {
        let menu = NSMenu(title: "DBClient")
        menu.addItem(item("Sobre o DBClient", #selector(NSApplication.orderFrontStandardAboutPanel(_:))))
        menu.addItem(.separator())
        menu.addItem(item("Ocultar DBClient", #selector(NSApplication.hide(_:)), "h"))
        menu.addItem(item("Ocultar Outros", #selector(NSApplication.hideOtherApplications(_:)), "h", modifiers: [.command, .option]))
        menu.addItem(item("Mostrar Todos", #selector(NSApplication.unhideAllApplications(_:))))
        menu.addItem(.separator())
        menu.addItem(item("Sair do DBClient", #selector(NSApplication.terminate(_:)), "q"))
        return menu
    }

    private static func editMenu() -> NSMenu {
        let menu = NSMenu(title: "Editar")
        menu.addItem(item("Desfazer", Selector(("undo:")), "z"))
        menu.addItem(item("Refazer", Selector(("redo:")), "z", modifiers: [.command, .shift]))
        menu.addItem(.separator())
        menu.addItem(item("Recortar", #selector(NSText.cut(_:)), "x"))
        menu.addItem(item("Copiar", #selector(NSText.copy(_:)), "c"))
        menu.addItem(item("Colar", #selector(NSText.paste(_:)), "v"))
        menu.addItem(item("Selecionar Tudo", #selector(NSText.selectAll(_:)), "a"))
        return menu
    }

    private static func viewMenu() -> NSMenu {
        let menu = NSMenu(title: "Visualizar")
        menu.addItem(item("Recarregar", #selector(AppDelegate.reloadPage(_:)), "r"))
        menu.addItem(item("Abrir no Navegador", #selector(AppDelegate.openInBrowser(_:)), "o", modifiers: [.command, .shift]))
        menu.addItem(.separator())
        menu.addItem(item("Tamanho Real", #selector(AppDelegate.resetZoom(_:)), "0"))
        menu.addItem(item("Aumentar", #selector(AppDelegate.zoomIn(_:)), "+"))
        menu.addItem(item("Diminuir", #selector(AppDelegate.zoomOut(_:)), "-"))
        menu.addItem(.separator())
        menu.addItem(item("Tela Cheia", #selector(NSWindow.toggleFullScreen(_:)), "f", modifiers: [.command, .control]))
        return menu
    }

    private static func windowMenu() -> NSMenu {
        let menu = NSMenu(title: "Janela")
        menu.addItem(item("Minimizar", #selector(NSWindow.performMiniaturize(_:)), "m"))
        menu.addItem(item("Zoom", #selector(NSWindow.performZoom(_:))))
        menu.addItem(item("Fechar", #selector(NSWindow.performClose(_:)), "w"))
        return menu
    }

    private static func helpMenu() -> NSMenu {
        let menu = NSMenu(title: "Ajuda")
        menu.addItem(item("Abrir Pasta de Logs", #selector(AppDelegate.openLogs(_:))))
        menu.addItem(item("Abrir Pasta de Dados", #selector(AppDelegate.openDataFolder(_:))))
        return menu
    }
}
