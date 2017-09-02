const { app, BrowserWindow, Menu, shell, ipcMain, Notification } = require('electron');
const url = require('url');
const path = require('path');
const { spawn, exec } = require('child_process');
const { accessSync } = require('fs');
const ipcConstants = require('./ipc/constants');
const { autoUpdater } = require('electron-updater');

const DEV_PATH_TO_POLYGLOT_BINARY = path.join(__dirname, "polyglot_deploy.jar");

const Visitor = require('universal-analytics').Visitor;
const visitor = new Visitor('UA-105606228-1');

let mainWindow;

if (process.env.NODE_ENV === 'production') {
    const sourceMapSupport = require('source-map-support');
    sourceMapSupport.install();
}

if (process.env.NODE_ENV === 'development') {
    require('electron-debug')();
    const p = path.join(__dirname, '..', 'app', 'node_modules');
    require('module').globalPaths.push(p);
}

const installExtensions = () => {
    if (process.env.NODE_ENV === 'development') {
        const installer = require('electron-devtools-installer');

        const extensions = [
            "REACT_DEVELOPER_TOOLS",
            'REDUX_DEVTOOLS'
        ];
        const forceDownload = !!process.env.UPGRADE_EXTENSIONS;
        return Promise.all(extensions.map(name => installer.default(installer[name], forceDownload)));
    }

    return Promise.resolve([]);
};

const createWindow = () => {
    mainWindow = new BrowserWindow({
        show: false,
        width: 2000,
        height: 1400
    });

    mainWindow.loadURL(url.format({
        pathname: path.join(__dirname, '/app.html'),
        protocol: 'file:',
        slashes: true
    }));

    mainWindow.webContents.on('did-finish-load', () => {
        mainWindow.show();
        mainWindow.focus();
    });

    mainWindow.webContents.on('will-navigate', ev => {
        ev.preventDefault()
    })

    mainWindow.on('closed', () => {
        mainWindow = null;
    });

    setupElectronMenu()
    visitor.event('main', 'lifecycle', 'createWindow').send();
}

app.on('ready', () => {
    installExtensions()
        .then(createWindow(), () => {
            console.log("Error installing extensions");
        })
        .then(registerIpcListeners())
        .then(() => {
            if (process.env.NODE_ENV !== 'development') {
                autoUpdater.checkForUpdates()
            }
        });
    visitor.event('dragoman', 'lifecycle', 'ready').send();
});

// Quit when all windows are closed.
app.on('window-all-closed', function () {
    // On OS X it is common for applications and their menu bar
    // to stay active until the user quits explicitly with Cmd + Q
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', function () {
    // On OS X it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (mainWindow === null) {
        createWindow();
    }
});

autoUpdater.on('checking-for-update', () => {
    console.log('Checking for update');
});

autoUpdater.on('update-available', (info) => {
    console.log('Update available.');
});

autoUpdater.on('update-not-available', (info) => {
    console.log('Update not available.');
});

autoUpdater.on('error', (err) => {
    console.log('Error in auto-updater.', err);
    visitor.event('main', 'autoUpdate', 'error').send();
});

autoUpdater.on('download-progress', (progressObj) => {
    let log_message = "Download speed: " + progressObj.bytesPerSecond;
    log_message = log_message + ' - Downloaded ' + progressObj.percent + '%';
    log_message = log_message + ' (' + progressObj.transferred + "/" + progressObj.total + ')';
    console.log(log_message);
});

autoUpdater.on('update-downloaded', (info) => {
    visitor.event('main', 'autoUpdate', 'updateDownloaded').send();
    console.log('Update downloaded');
    const myNotification = new Notification({
        title: 'Dragoman',
        subtitle: 'Auto Update',
        body: 'Updated downloaded, quit and install? ',
        icon: '../resources/dragoman-logo.png',
        actions: [{ text: 'Ok', type: 'button' }]
    });

    myNotification.show();

    myNotification.once('action', (event, index) => {
        console.log('Action clicked ', index)
        if (index === 0) { // Selected ok
            visitor.event('main', 'autoUpdate', 'updatedInstalled').send();
            autoUpdater.quitAndInstall();
        }
    });
});

function registerIpcListeners() {
    ipcMain.on(ipcConstants.CANCEL_REQUEST, killChildProcess);
}

// Keep references to the child process we spawn, so we can kill them in the future if we need
let childProcesses = {};


//******* Node process communication for renderer process ********//

/* Users can cancel long running requests. This will remove all running child processes and return 
   the success of the operation. */
function killChildProcess(event) {
    console.warn("Killing current child process");
    var successfullyKilled = true;

    for (var procId in childProcesses) {
        childProcesses[procId].kill();
        if (!childProcesses[procId].killed) {
            successfullyKilled = false;
        } else {
            delete childProcesses[procId];
        }
    }

    console.warn("Processes killed successfully: ", successfullyKilled);
    event.sender.send(ipcConstants.CANCEL_REQUEST_RESPONSE, successfullyKilled);
}

//****************************************************************//

const setupElectronMenu = () => {
    const template = [
        {
            label: 'Edit',
            submenu: [
                { role: 'cut' },
                { role: 'copy' },
                { role: 'paste' },
                { role: 'delete' },
                { role: 'selectall' }
            ]
        }, {
            label: 'View',
            submenu: [
                { role: 'resetzoom' },
                { role: 'zoomin' },
                { role: 'zoomout' },
                { type: 'separator' },
                { role: 'togglefullscreen' },
                { type: 'separator' },
                { role: 'reload' },
                { role: 'forcereload' },
                { role: 'toggledevtools' }
            ]
        }, {
            label: 'Window',
            submenu: [
                { role: 'minimize' },
                { role: 'close' }
            ]
        }, {
            role: 'help',
            submenu: [
                {
                    label: 'Learn More',
                    click() { shell.openExternal('https://github.com/peteboothroyd/dragoman') }
                }]
        }];

    if (process.platform === 'darwin') {
        template.unshift({
            label: app.getName(),
            submenu: [
                { role: 'about' },
                { type: 'separator' },
                { role: 'hide' },
                { role: 'hideothers' },
                { role: 'unhide' },
                { type: 'separator' },
                { role: 'quit' }
            ]
        });

        // Window menu
        template[3].submenu = [
            { role: 'close' },
            { role: 'minimize' },
            { role: 'zoom' },
            { type: 'separator' },
            { role: 'front' }
        ]

        Menu.setApplicationMenu(Menu.buildFromTemplate(template));
    }
}