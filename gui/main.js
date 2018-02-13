const electron = require('electron');
// Module to control application life.
const app = electron.app;

const ipcMain = electron.ipcMain;
const dialog = electron.dialog;

// Module to create native browser window.
const BrowserWindow = electron.BrowserWindow;

const path = require('path');
const url = require('url');

const {spawn} = require("child_process");

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let mainWindow;

let hantek = null;

function createWindow () {
  // Create the browser window.
  mainWindow = new BrowserWindow({width: 800, height: 600});

  // and load the index.html of the app.
  mainWindow.loadURL(url.format({
    pathname: path.join(__dirname, 'index.html'),
    protocol: 'file:',
    slashes: true
    }));

  // start the initial hantek process here.  (this will probably change in future)
  startHantek();

  // Open the DevTools.
  // mainWindow.webContents.openDevTools()

  // Emitted when the window is closed.
  mainWindow.on('closed', function () {
    // Dereference the window object, usually you would store windows
    // in an array if your app supports multi windows, this is the time
    // when you should delete the corresponding element.
    mainWindow = null
    });
}

function startHantek(mode = "", relative = false){
    if(hantek){
        // kill the process if it is running
        hantek.kill();
    }

    var htargs = [];
    if (relative){
        htargs.push('-r');
    }
    if (mode){
        htargs.push('-m');
        htargs.push(mode);
    }

    hantek = spawn('../cli/hantek', htargs);

    mainWindow.webContents.send('statusMessage', { 'data': "Hantek process (re)started.\n" });

    // keep a flag for auto-restart on usb error
    hantek.shouldBeRunning = true;

    hantek.on('exit', function (code, signal) {
        try{
            mainWindow.webContents.send('statusMessage', { 'data': `Hantek process exited with code ${code} and signal ${signal}\n` });
        }catch(err){
            console.log(err.message);
        }
    });

    hantek.stdout.on('data', (data) => {
        try{
            mainWindow.webContents.send('readingMessage', { 'data': data });
        }catch(err){
            console.log(err.message);
        }
    });

    hantek.stderr.on('data', (data) => {
        try{
            mainWindow.webContents.send('errorMessage', { 'data': data });
        }catch(err){
            console.log(err.message);
        }
    });


}

ipcMain.on('initHantekMessage', (event, props) => {
    startHantek(props.mode, props.relative);
  });



  ipcMain.on('doBlockingWork', () => {
    const work = require('./work');
    work();
});






// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', createWindow)

// Quit when all windows are closed.
app.on('window-all-closed', function () {
  // On OS X it is common for applications and their menu bar
  // to stay active until the user quits explicitly with Cmd + Q
  if (process.platform !== 'darwin') {
    app.quit()
  }

  if (hantek) {
     hantek.kill();
  }

})

app.on('activate', function () {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (mainWindow === null) {
    createWindow()
  }
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
