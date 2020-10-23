const express = require('express');
const http = require('http');
const socketio = require('socket.io');
const fs = require('fs');
const { createInterface } = require('readline');
const { once } = require('events');

const app = express();
const server = http.createServer(app);
const io = socketio(server);

const PORT = 8080;

let parentContainerId = null;

// Establish parent container
fs.readdir('/containers', (err, containers) => {
  // TODO: handle error

  /*
   * The /containers directory in this container file system should only contain
   * a single directory whose name is the parent id.
   *
   * This is estalished because the bind mount is mapped to the
   * parent container's specific .log file in the host system.
   *
   * Example of an absolute path to a parent container's .log file on the host machine:
   * /var/lib/docker/containers/fc5856ddefc085af36de170e85793eb3f62602f0d65cb511873c2da560d6b7e0/fc5856ddefc085af36de170e85793eb3f62602f0d65cb511873c2da560d6b7e0-json.log
   *
   * This current container's /container directory is mapped to /var/lib/docker/containers
   *
   */

  [parentContainerId] = containers;
});

// socket event handlers
io.on('connection', (socket) => {
  console.log('Dockter Log is listening...');

  // initializeLogger is called only upon first time a logging container is created
  socket.on('initializeLogger', (requestedContainerId, response) => {
    const logs = [];

    // TODO: Modularize this in a helper js file
    ((async function processLogFile() {
      try {
        const rl = createInterface({
          input: fs.createReadStream(`/containers/${parentContainerId}/${parentContainerId}-json.log`),
          crlfDelay: Infinity,
        });

        rl.on('line', (line) => {
          logs.push(JSON.parse(line));
        });

        await once(rl, 'close');

        response(logs);
      } catch (err) {
        // TODO: Better error handling
        console.error(err);
      }
    })());
  });

  socket.on('collectLogs', (requestedContainerId) => {
    if (requestedContainerId === parentContainerId) {
      // TODO: Collect logs
    }
  });
});

server.listen(PORT, () => {
  console.log(`Server listening on ${PORT}`);
});
