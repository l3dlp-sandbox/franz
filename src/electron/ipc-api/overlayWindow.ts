import {
  BrowserWindow, ipcMain,
  webContents,
} from 'electron';
// eslint-disable-next-line import/no-named-default
import { isDevMode, isLinux, isMac } from '../../environment';
import { OVERLAY_OPEN, RELAY_MESSAGE } from '../../ipcChannels';

const debug = require('debug')('Franz:ipcApi:overlayWindow');

interface IArgs {
  route: string;
  query?: Record<string, string>,
  width?: number;
  height?: number;
  transparent?: boolean;
  modal?: boolean;
  overrideParent?: number;
}

export function openOverlay(mainWindow: BrowserWindow, settings: any, args: IArgs, eventSenderId?: number) {
  return new Promise((resolve) => {
    try {
      debug('Got overlay window open request', args);

      let { route } = args;
      if (eventSenderId) {
        route = route.replace('{webContentsId}', eventSenderId.toString());
      }

      const windows = BrowserWindow.getAllWindows();
      const win = windows.find(window => window.webContents.getURL().endsWith(route));

      if (win) {
        win.show();
        win.focus();

        return resolve('show');
      }

      const bounds = mainWindow.getBounds();

      let parent = args.modal ? mainWindow : null;
      if (args.overrideParent) {
        parent = BrowserWindow.fromWebContents(webContents.fromId(args.overrideParent));
      }

      const window = new BrowserWindow({
        width: args.width ?? bounds.width - 100,
        height: args.height ?? bounds.height - 100,
        titleBarStyle: isMac ? 'hidden' : 'default',
        frame: isLinux,
        transparent: args.transparent || false,
        modal: args.modal ?? false,
        parent,
        backgroundColor: !settings.get('darkMode') ? '#3498db' : '#1E1E1E',
        webPreferences: {
          nodeIntegration: true,
          webviewTag: true,
          contextIsolation: false,
        },
      });

      // eslint-disable-next-line global-require
      require('@electron/remote/main').enable(window.webContents);

      window.once('ready-to-show', () => {
        window.show();
        window.webContents.focus();

        if (isDevMode) {
          window.webContents.openDevTools();
        }
      });

      window.loadFile('overlay.html', {
        hash: route,
        query: args.query,
      });

      window.on('close', () => resolve('closed'));

      // ipc messages
      ipcMain.on(RELAY_MESSAGE, (event, channel, ...data) => {
        const mainWindowWebContentsId = mainWindow.webContents.id;

        if (event.sender.id === mainWindowWebContentsId) {
          window.webContents.send(channel, event.sender.id, ...data);
        } else {
          mainWindow.webContents.send(channel, event.sender.id, ...data);
        }
      });
    } catch (err) {
      console.log(err);
      resolve('error');
    }
  });
}

export default ({ mainWindow, settings: { app: settings } }: { mainWindow: BrowserWindow, settings: any }) => {
  ipcMain.handle(OVERLAY_OPEN, (event, args: IArgs) => openOverlay(mainWindow, settings, args, event.sender.id));
};
