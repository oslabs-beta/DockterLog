const express = require('express');
const http = require('http');
const socketio = require('socket.io');
const fs = require('fs');
const { createInterface } = require('readline');
const { once } = require('events');
const readLastLines = require('read-last-lines');
const stripAnsi = require('strip-ansi');

const app = express();
const server = http.createServer(app);
const io = socketio(server);

const PORT = 8080;

const watchers = [];

// Socket event handlers
io.on('connection', (socket) => {
  console.log('Dockter Log is listening...');

  // Called only during the first time a container is selected for log collection 
  socket.on('initializeLogger', (requestedContainerId, sendResponse) => {
    const logs = [];

    // TODO: Modularize this in a helper js file
    ((async function processLogFile() {
      try {
        const rl = createInterface({
          input: fs.createReadStream(`/containers/${requestedContainerId}/${requestedContainerId}-json.log`),
          crlfDelay: Infinity,
        });

        rl.on('line', (line) => {
          const logEntry = JSON.parse(line);
          logEntry.log = stripAnsi(logEntry.log);
          logEntry.containerId = requestedContainerId;

          logs.push(logEntry);
        });

        await once(rl, 'close');

        sendResponse(logs);
      } catch (err) {
        // TODO: Better error handling
        console.error(err);
      }
    })());
  });

  // Begin log collection for a specified container
  socket.on('startLogCollection', (requestedContainerId) => {
    const logFile = `/containers/${requestedContainerId}/${requestedContainerId}-json.log`;

    const watcher = fs.watch(logFile, (event) => {
      if (event === 'change') {
        readLastLines.read(logFile, 1)
          .then((line) => {
            const logEntry = JSON.parse(line);
            logEntry.log = stripAnsi(logEntry.log);
            logEntry.containerId = requestedContainerId;

            console.log(logEntry);

            socket.emit('newLog', logEntry);
          });
      }
    });

    watchers.push(watcher);
  });

  // TODO: stopLogCollection event handler

  socket.on('disconnect', () => {
    // Close and clear all watchers
    watchers.forEach((watcher) => (watcher.close()));
    watchers.length = 0;
  });
});

server.listen(PORT, () => {
  console.log(`Server listening on ${PORT}`);
});
