//go:build windows

package main

import (
	"errors"
	"unsafe"

	"golang.org/x/sys/windows"
)

const (
	imageIcon        = 1
	lrLoadFromFile   = 0x10
	wmSetIcon        = 0x80
	iconSmall        = 0
	iconBig          = 1
	smCxIcon         = 11
	smCyIcon         = 12
	smCxSmIcon       = 49
	smCySmIcon       = 50
	swRestore        = 9
	idYes            = 6
	dpiPerMonitorV2  = ^uintptr(3) // DPI_AWARENESS_CONTEXT_PER_MONITOR_AWARE_V2 (-4)
	singleInstanceID = `Local\DBClientDesktop`
)

var (
	user32                            = windows.NewLazySystemDLL("user32.dll")
	procSetProcessDpiAwarenessContext = user32.NewProc("SetProcessDpiAwarenessContext")
	procSetProcessDPIAware            = user32.NewProc("SetProcessDPIAware")
	procFindWindowW                   = user32.NewProc("FindWindowW")
	procShowWindow                    = user32.NewProc("ShowWindow")
	procSetForegroundWindow           = user32.NewProc("SetForegroundWindow")
	procLoadImageW                    = user32.NewProc("LoadImageW")
	procSendMessageW                  = user32.NewProc("SendMessageW")
	procGetSystemMetrics              = user32.NewProc("GetSystemMetrics")
)

// Without an application manifest Windows treats the process as DPI-unaware and bitmap-scales the window.
func enableDPIAwareness() {
	if procSetProcessDpiAwarenessContext.Find() == nil {
		if ok, _, _ := procSetProcessDpiAwarenessContext.Call(dpiPerMonitorV2); ok != 0 {
			return
		}
	}
	_, _, _ = procSetProcessDPIAware.Call()
}

func acquireSingleInstance() (release func(), alreadyRunning bool, err error) {
	name, err := windows.UTF16PtrFromString(singleInstanceID)
	if err != nil {
		return nil, false, err
	}
	mutex, err := windows.CreateMutex(nil, false, name)
	if errors.Is(err, windows.ERROR_ALREADY_EXISTS) {
		windows.CloseHandle(mutex)
		return nil, true, nil
	}
	if err != nil {
		return nil, false, err
	}
	return func() { windows.CloseHandle(mutex) }, false, nil
}

func focusExistingWindow() {
	className, _ := windows.UTF16PtrFromString("webview")
	title, _ := windows.UTF16PtrFromString(appName)
	hwnd, _, _ := procFindWindowW.Call(uintptr(unsafe.Pointer(className)), uintptr(unsafe.Pointer(title)))
	if hwnd == 0 {
		return
	}
	_, _, _ = procShowWindow.Call(hwnd, swRestore)
	_, _, _ = procSetForegroundWindow.Call(hwnd)
}

// The executable carries no icon resource, so the window icon is loaded from the .ico shipped beside it.
func setWindowIcon(hwnd uintptr, icoPath string) {
	path, err := windows.UTF16PtrFromString(icoPath)
	if err != nil {
		return
	}
	for _, size := range []struct {
		kind    uintptr
		cxIndex uintptr
		cyIndex uintptr
	}{
		{iconBig, smCxIcon, smCyIcon},
		{iconSmall, smCxSmIcon, smCySmIcon},
	} {
		cx, _, _ := procGetSystemMetrics.Call(size.cxIndex)
		cy, _, _ := procGetSystemMetrics.Call(size.cyIndex)
		icon, _, _ := procLoadImageW.Call(0, uintptr(unsafe.Pointer(path)), imageIcon, cx, cy, lrLoadFromFile)
		if icon != 0 {
			_, _, _ = procSendMessageW.Call(hwnd, wmSetIcon, size.kind, icon)
		}
	}
}

func showError(owner uintptr, title, message string) {
	messageBox(owner, title, message, windows.MB_OK|windows.MB_ICONERROR)
}

func askYesNo(owner uintptr, title, message string) bool {
	return messageBox(owner, title, message, windows.MB_YESNO|windows.MB_ICONWARNING) == idYes
}

func messageBox(owner uintptr, title, message string, flags uint32) int32 {
	t, _ := windows.UTF16PtrFromString(title)
	m, _ := windows.UTF16PtrFromString(message)
	ret, _ := windows.MessageBox(windows.HWND(owner), m, t, flags|windows.MB_SETFOREGROUND)
	return ret
}

func openExternal(target string) {
	verb, _ := windows.UTF16PtrFromString("open")
	file, _ := windows.UTF16PtrFromString(target)
	_ = windows.ShellExecute(0, verb, file, nil, nil, windows.SW_SHOWNORMAL)
}
